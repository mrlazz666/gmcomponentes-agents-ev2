const { embedText } = require('../embeddings/embedder');
const { searchSimilar } = require('./vector-store');
const { rerankDocuments } = require('./reranker');
const { retrieval } = require('../config/rag.config');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?????!.,;:()[\]{}\/\\\-_"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function splitAlphaNumericToken(token) {
  const normalized = normalizeText(token);
  const parts = normalized.match(/[a-z]+|\d+[a-z]*/g);
  return parts ? parts.filter(Boolean) : [];
}

function levenshteinDistance(a, b) {
  const left = normalizeCompact(a);
  const right = normalizeCompact(b);

  if (!left) return right.length;
  if (!right) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function isNearTokenMatch(queryToken, productText) {
  const compactQuery = normalizeCompact(queryToken);
  const productTokens = tokenize(productText);

  if (!compactQuery || compactQuery.length < 4) {
    return false;
  }

  return productTokens.some(token => {
    const compactToken = normalizeCompact(token);

    if (!compactToken || compactToken.length < 4) {
      return false;
    }

    return levenshteinDistance(compactQuery, compactToken) <= 1;
  });
}

function tokenize(text) {
  return normalizeText(text).split(' ').filter(Boolean);
}

function hasGpuModelToken(text) {
  const normalized = normalizeText(text);
  const compact = normalizeCompact(text);

  return (
    /(^| )rtx ?\d/.test(normalized) ||
    /(^| )gtx ?\d/.test(normalized) ||
    /(^| )rx ?\d/.test(normalized) ||
    /rtx\d/.test(compact) ||
    /gtx\d/.test(compact) ||
    /rx\d/.test(compact)
  );
}

const KNOWN_BRANDS = [
  'nvidia',
  'amd',
  'intel',
  'corsair',
  'g skill',
  'kingston',
  'crucial',
  'hyperx',
  'adata',
  'teamgroup',
  'samsung',
  'western digital',
  'wd',
  'asus',
  'msi',
  'gigabyte',
  'nzxt',
  'cooler master',
  'thermaltake'
];

const GENERIC_QUERY_TOKENS = new Set([
  'que', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'en', 'con', 'sin', 'para', 'por', 'me', 'mi', 'tu', 'su', 'sus',
  'tienen', 'tiene', 'hay', 'vende', 'venden', 'mostrar', 'muestra', 'muestrame',
  'busco', 'quiero', 'necesito', 'ver', 'algun', 'alguna', 'algunas', 'algunos',
  'cuales', 'ser', 'es', 'son', 'sobre', 'dame', 'listar', 'lista',
  'productos', 'producto', 'marca', 'modelo', 'stock', 'disponible', 'disponibilidad',
  'graficas', 'grafica', 'tarjeta', 'tarjetas', 'gpu', 'gpus', 'rtx', 'gtx', 'rx',
  'procesador', 'procesadores', 'cpu', 'cpus', 'proce', 'proces', 'core',
  'ram', 'rams', 'memoria', 'memorias', 'ddr4', 'ddr5',
  'placa', 'placas', 'mother', 'motherboard', 'gabinete', 'gabinetes', 'case', 'cases',
  'torre', 'chasis', 'almacenamiento', 'ssd', 'hdd', 'nvme', 'm2'
]);

for (const brand of KNOWN_BRANDS) {
  for (const part of tokenize(brand)) {
    GENERIC_QUERY_TOKENS.add(part);
  }
}

function getSpecificQueryTokens(question) {
  const tokens = tokenize(question);
  const expanded = new Set();

  for (const token of tokens) {
    const isMixedModelToken = /[a-z]/i.test(token) && /\d/.test(token);

    if (!GENERIC_QUERY_TOKENS.has(token) && token.length >= 2) {
      expanded.add(token);
    }

    const compact = normalizeCompact(token);
    if (compact && compact !== token && !GENERIC_QUERY_TOKENS.has(compact) && compact.length >= 2) {
      expanded.add(compact);
    }

    for (const part of splitAlphaNumericToken(token)) {
      if ((isMixedModelToken || !GENERIC_QUERY_TOKENS.has(part)) && part.length >= 2) {
        expanded.add(part);
      }
    }
  }

  return Array.from(expanded);
}

function getStrictModelTokens(tokens) {
  return (Array.isArray(tokens) ? tokens : []).filter(token => {
    const compact = normalizeCompact(token);
    return compact.length >= 5 && /[a-z]/.test(compact) && /\d/.test(compact);
  });
}

function tokenMatchesSearchable(token, searchable, compactSearchable) {
  const compactToken = normalizeCompact(token);
  const isNumericOnly = /^\d+$/.test(compactToken);

  if (!compactToken) {
    return false;
  }

  if (searchable.includes(token) || compactSearchable.includes(compactToken)) {
    return true;
  }

  if (isNumericOnly) {
    return false;
  }

  return isNearTokenMatch(token, searchable);
}

function questionHasStrongModelSignal(question) {
  const tokens = tokenize(question);
  const hasNumericToken = tokens.some(token => /\d/.test(token));

  if ((tokens.includes('rtx') || tokens.includes('gtx') || tokens.includes('rx')) && hasNumericToken) {
    return true;
  }

  if ((tokens.includes('ryzen') || tokens.includes('intel') || tokens.includes('core')) && hasNumericToken) {
    return true;
  }

  return tokens.some(token => {
    const compact = normalizeCompact(token);

    if (!compact || GENERIC_QUERY_TOKENS.has(compact)) {
      return false;
    }

    if (/^(\d+|\d+gb|\d+tb|ddr\d|\d+mhz|oc|rgb|wifi|pro)$/i.test(compact)) {
      return false;
    }

    if (/[a-z]/.test(compact) && /\d/.test(compact) && compact.length >= 4) {
      return true;
    }

    return /[a-z]/.test(compact) && compact.length >= 4;
  });
}

function questionLooksPureConfig(question) {
  const tokens = tokenize(question);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every(token => {
    const compact = normalizeCompact(token);
    return /^(\d+|\d+gb|\d+tb|\d+g|\d+t|ddr\d|\d+mhz|cl\d+|x|kit|oc|rgb)$/i.test(compact);
  });
}

function isAmbiguousExactCandidate(question, questionTokens, bestMatch, rankedMatches) {
  const best = bestMatch || null;
  const second = Array.isArray(rankedMatches) ? rankedMatches[1] : null;

  if (!best || !second) {
    return false;
  }

  if (questionHasStrongModelSignal(question)) {
    return false;
  }

  if (questionLooksPureConfig(question)) {
    return true;
  }

  return (best.score - second.score) < 80;
}

function looksLikeExactProductQuery(question) {
  const specificTokens = getSpecificQueryTokens(question);
  const compactQuestion = normalizeCompact(question);

  if (specificTokens.length === 0) {
    return /[a-z]/.test(compactQuestion) && /\d/.test(compactQuestion) && compactQuestion.length >= 5;
  }

  const hasModelLikeToken = specificTokens.some(token => {
    if (/\d/.test(token)) return true;
    if (/^[a-z]+\d+[a-z0-9-]*$/i.test(token)) return true;
    return token.length >= 5;
  });

  return hasModelLikeToken || /[a-z]/.test(compactQuestion) && /\d/.test(compactQuestion) && compactQuestion.length >= 5 || specificTokens.length >= 2;
}

function dedupeProducts(products) {
  const seen = new Set();

  return (Array.isArray(products) ? products : []).filter(product => {
    const id = Number(product?.id);
    const key = id > 0 ? `id:${id}` : `name:${normalizeText(product?.nombre || '')}`;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function inferCategoryFromProduct(product) {
  const nombre = normalizeText(product?.nombre);
  const categoria = normalizeText(product?.categoria);
  const descripcion = normalizeText(product?.descripcion);
  const gpuLike = hasGpuModelToken(`${product?.nombre || ''} ${product?.descripcion || ''}`);

  if (
    categoria.includes('graf') ||
    categoria.includes('tarjeta') ||
    gpuLike ||
    descripcion.includes('grafica') ||
    descripcion.includes('video')
  ) return 'gpu';

  if (
    categoria.includes('proces') ||
    categoria.includes('cpu') ||
    nombre.includes('ryzen') ||
    nombre.includes('intel') ||
    nombre.includes('core')
  ) return 'cpu';

  if (
    categoria.includes('ram') ||
    nombre.includes('ram') ||
    descripcion.includes('ddr4') ||
    descripcion.includes('ddr5')
  ) return 'ram';

  if (
    categoria.includes('almacen') ||
    nombre.includes('ssd') ||
    nombre.includes('hdd') ||
    nombre.includes('nvme') ||
    nombre.includes('disco') ||
    descripcion.includes('ssd') ||
    descripcion.includes('hdd') ||
    descripcion.includes('nvme')
  ) return 'storage';

  if (
    categoria.includes('placa') ||
    categoria.includes('mother') ||
    descripcion.includes('placa madre') ||
    descripcion.includes('motherboard')
  ) return 'motherboard';

  if (
    categoria.includes('gabinete') ||
    categoria.includes('gabinetes') ||
    nombre.includes('gabinete') ||
    nombre.includes('gabinetes') ||
    nombre.includes('case') ||
    descripcion.includes('gabinete') ||
    descripcion.includes('gabinetes') ||
    descripcion.includes('chasis')
  ) return 'case';

  return 'other';
}

function matchesCategory(product, targetCategory) {
  const nombre = normalizeText(product?.nombre);
  const categoria = normalizeText(product?.categoria);
  const descripcion = normalizeText(product?.descripcion);
  const gpuLike = hasGpuModelToken(`${product?.nombre || ''} ${product?.descripcion || ''}`);

  if (targetCategory === 'gpu') {
    return (
      categoria === 'tarjetas graficas' ||
      categoria === 'tarjeta grafica' ||
      categoria.includes('tarjetas graficas') ||
      categoria.includes('tarjeta grafica') ||
      (
        (descripcion.includes('geforce') ||
         descripcion.includes('radeon') ||
         gpuLike) &&
        !categoria.includes('ram') &&
        !categoria.includes('memoria')
      )
    );
  }

  if (targetCategory === 'cpu') {
    return (
      categoria === 'procesadores' ||
      categoria === 'procesador' ||
      categoria.includes('procesador') ||
      categoria.includes('procesadores') ||
      (
        (descripcion.includes('ryzen') || descripcion.includes('core i')) &&
        !categoria.includes('placa') &&
        !categoria.includes('ram')
      )
    );
  }

  if (targetCategory === 'ram') {
    return (
      categoria === 'memorias ram' ||
      categoria === 'memoria ram' ||
      categoria.includes('memorias ram') ||
      categoria.includes('memoria ram') ||
      categoria === 'ram' ||
      descripcion.includes('ddr4') ||
      descripcion.includes('ddr5')
    );
  }

  if (targetCategory === 'storage') {
    return (
      categoria.includes('almacenamiento') ||
      categoria.includes('disco') ||
      descripcion.includes('ssd') ||
      descripcion.includes('hdd') ||
      descripcion.includes('nvme')
    );
  }

  if (targetCategory === 'motherboard') {
    return (
      categoria.includes('placa madre') ||
      categoria.includes('placas madre') ||
      categoria.includes('motherboard') ||
      categoria.includes('mother')
    );
  }

  if (targetCategory === 'case') {
    return (
      categoria.includes('gabinete') ||
      categoria.includes('gabinetes') ||
      categoria.includes('case') ||
      categoria.includes('torre')
    );
  }

  return inferCategoryFromProduct(product) === targetCategory;
}



function simpleAnalyzeQuestion(question) {
  const q = normalizeText(question);

  const category =
    q.includes('rtx') || q.includes('gtx') || q.includes('rx') || q.includes('gpu') || q.includes('grafica') || q.includes('graficas') || q.includes('tarjeta') ? 'gpu' :
    q.includes('ryzen') || q.includes('intel') || q.includes('core i') || q.includes('corei') || q.includes('procesador') || q.includes('procesadores') || q === 'proce' || q === 'proces' ? 'cpu' :
    q.includes('ram') || q.includes('rams') || q.includes('ddr') || q.includes('memoria') || q.includes('memorias') ? 'ram' :
    q.includes('ssd') || q.includes('nvme') || q.includes('hdd') || q.includes('disco') || q.includes('almacenamiento') || q.includes('samsung') || q.includes('western digital') || q.includes('wd ') ? 'storage' :
    q.includes('placa') || q.includes('placas') || q.includes('mother') || q.includes('motherboard') ? 'motherboard' :
    q.includes('gabinete') || q.includes('gabinetes') || q.includes('case') || q.includes('torre') ? 'case' :
    null;

  const knownBrands = KNOWN_BRANDS;

  const brand = knownBrands.find(item => q.includes(item)) || null;

  const isStoreQuestion =
    q.includes('gmcomponents') ||
    q.includes('gm components') ||
    q.includes('gmcomponentes') ||
    q.includes('gm component');

  const isGeneral =
    isStoreQuestion ||
    (
      !category &&
      !brand &&
      (
        q.includes('que venden') ||
        q.includes('que productos') ||
        q.includes('que ofrece') ||
        q.includes('que ofrecen') ||
        q.includes('quienes son') ||
        q.includes('que es') ||
        q.includes('de que se trata')
      )
    );

  const categoryOnlyQuery =
    q === 'graficas' ||
    q === 'grafica' ||
    q === 'tarjetas graficas' ||
    q === 'tarjeta grafica' ||
    q === 'gpu' ||
    q === 'gpus' ||
    q === 'procesadores' ||
    q === 'procesador' ||
    q === 'proce' ||
    q === 'proces' ||
    q === 'cpu' ||
    q === 'cpus' ||
    q === 'memorias ram' ||
    q === 'memoria ram' ||
    q === 'memorias' ||
    q === 'ram' ||
    q === 'rams' ||
    q === 'placas madre' ||
    q === 'placa madre' ||
    q === 'placa' ||
    q === 'placas' ||
    q === 'motherboard' ||
    q === 'motherboards' ||
    q === 'gabinetes' ||
    q === 'gabinete' ||
    q === 'cases' ||
    q === 'case' ||
    q === 'almacenamiento' ||
    q === 'ssd' ||
    q === 'hdd' ||
    q === 'nvme';

  const wantsFullList =
    categoryOnlyQuery ||
    q.includes('todas las') ||
    q.includes('todos los') ||
    q.includes('dame todas') ||
    q.includes('dame todos') ||
    q.includes('muestrame todas') ||
    q.includes('muestrame todos') ||
    q.includes('muestra todas') ||
    q.includes('muestra todos') ||
    q.includes('listar') ||
    q.includes('lista de') ||
    q.includes('que graficas venden') ||
    q.includes('que tarjetas venden') ||
    q.includes('que procesadores venden') ||
    q.includes('que memorias venden') ||
    q.includes('que memorias ram venden') ||
    q.includes('que placas venden') ||
    q.includes('que gabinetes venden') ||
    q.includes('que gabinetes tienen') ||
    q.includes('que graficas tienen') ||
    q.includes('que procesadores tienen') ||
    q.includes('que memorias tienen') ||
    q.includes('que memorias ram tienen') ||
    q.includes('que placas tienen') ||
    q.includes('que tarjetas tienen');

    

  const specificTokens = getSpecificQueryTokens(q);
  const looksLikeExactMatch = looksLikeExactProductQuery(q);

  const isBroadCategoryQuery = categoryOnlyQuery;
  const wantsBrandCategoryList = Boolean(category && brand) && !looksLikeExactMatch;

  return {
    category,
    brand,
    isGeneral,
    wantsFullList,
    isBroadCategoryQuery,
    wantsBrandCategoryList,
    specificTokens,
    looksLikeExactProductQuery: looksLikeExactMatch
  };
}



function getFullCategoryList(products, analysis) {
  let items = dedupeProducts(products);

  if (analysis?.brand) {
    const brand = normalizeText(analysis.brand);
    items = items.filter(product => {
      const nombre = normalizeText(product.nombre);
      const descripcion = normalizeText(product.descripcion);
      return nombre.includes(brand) || descripcion.includes(brand);
    });
  }

  if (analysis?.category) {
    items = items.filter(product => {
      const categoria = normalizeText(product?.categoria);

      if (analysis.category === 'gpu') return categoria.includes('tarjetas graficas');
      if (analysis.category === 'cpu') return categoria.includes('procesadores') || categoria.includes('procesador');
      if (analysis.category === 'ram') return categoria.includes('memorias ram') || categoria.includes('memoria ram') || categoria === 'ram';
      if (analysis.category === 'motherboard') return categoria.includes('placas madre') || categoria.includes('placa madre');
      if (analysis.category === 'case') return categoria.includes('gabinetes') || categoria.includes('gabinete');

      return true;
    });
  }

  return items.sort((a, b) => {
    if (Number(b.stock || 0) !== Number(a.stock || 0)) {
      return Number(b.stock || 0) - Number(a.stock || 0);
    }

    if (Number(a.precio || 0) !== Number(b.precio || 0)) {
      return Number(a.precio || 0) - Number(b.precio || 0);
    }

    return String(a.descripcion || '').localeCompare(String(b.descripcion || ''));
  });
}


function findDirectProductMatch(products, question, analysis) {
  if (
    analysis?.isGeneral ||
    analysis?.isBroadCategoryQuery ||
    analysis?.wantsFullList ||
    analysis?.wantsBrandCategoryList ||
    !analysis?.looksLikeExactProductQuery
  ) {
    return null;
  }

  const normalizedQuestion = normalizeText(question);
  const compactQuestion = normalizeCompact(question);
  const specificTokens = getSpecificQueryTokens(question);
  const strictModelTokens = getStrictModelTokens(specificTokens);
  const cleanProducts = dedupeProducts(Array.isArray(products) ? products : []);

  const directMatches = cleanProducts
    .map(product => {
      const nombre = normalizeText(product?.nombre);
      const descripcion = normalizeText(product?.descripcion);
      const categoria = normalizeText(product?.categoria);
      const compactNombre = normalizeCompact(product?.nombre);
      const compactDescripcion = normalizeCompact(product?.descripcion);
      const compactCategoria = normalizeCompact(product?.categoria);

      const fullName = `${nombre} ${descripcion}`.trim();
      const searchable = `${nombre} ${descripcion} ${categoria}`.trim();
      const compactFullName = normalizeCompact(fullName);
      const compactSearchable = `${compactNombre} ${compactDescripcion} ${compactCategoria}`.trim();

      let score = 0;

      if (normalizedQuestion.includes(fullName)) score += 200;
      if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 160;
      if (compactQuestion && compactFullName && compactQuestion.includes(compactFullName)) score += 220;
      if (compactQuestion && compactFullName && compactFullName.includes(compactQuestion) && compactQuestion.length >= 4) score += 170;

      if (nombre && normalizedQuestion.includes(nombre)) score += 60;
      if (descripcion && normalizedQuestion.includes(descripcion)) score += 120;
      if (compactQuestion && compactDescripcion.includes(compactQuestion)) score += 150;
      if (compactQuestion && compactSearchable.includes(compactQuestion)) score += 110;

      const meaningfulTokens = specificTokens.filter(token => token.length >= 2);
      const allTokensPresent =
        meaningfulTokens.length > 0 &&
        meaningfulTokens.every(token => {
          const compactToken = normalizeCompact(token);
          return (
            tokenMatchesSearchable(token, searchable, compactSearchable)
          );
        });

      if (allTokensPresent) score += 100;

      const splitTokenParts = meaningfulTokens.flatMap(token => splitAlphaNumericToken(token)).filter(part => part.length >= 2);
      const allPartsPresent =
        splitTokenParts.length > 0 &&
        splitTokenParts.every(part => {
          const compactPart = normalizeCompact(part);
          return (
            tokenMatchesSearchable(part, searchable, compactSearchable)
          );
        });

      if (allPartsPresent) score += 120;

      if (strictModelTokens.length > 0) {
        const hasStrictModelCoverage = strictModelTokens.some(token => {
          const compactToken = normalizeCompact(token);
          const parts = splitAlphaNumericToken(token).filter(part => part.length >= 2);
          const fullMatch =
            tokenMatchesSearchable(token, searchable, compactSearchable);
          const partsMatch =
            parts.length > 0 &&
            parts.every(part => {
              const compactPart = normalizeCompact(part);
              return (
                tokenMatchesSearchable(part, searchable, compactSearchable)
              );
            });

          return fullMatch || partsMatch;
        });

        if (!hasStrictModelCoverage) {
          score = 0;
        }
      }

      return { product, score };
    })
    .filter(item => item.score >= 170)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.product.stock || 0) - Number(a.product.stock || 0);
    });

  return directMatches.length > 0 ? directMatches[0].product : null;
}

function findBestDirectProductMatch(products, question, analysis) {
  if (
    analysis?.isGeneral ||
    analysis?.isBroadCategoryQuery ||
    analysis?.wantsFullList ||
    analysis?.wantsBrandCategoryList ||
    !analysis?.looksLikeExactProductQuery
  ) {
    return null;
  }

  const normalizedQuestion = normalizeText(question);
  const compactQuestion = normalizeCompact(question);
  const specificTokens = getSpecificQueryTokens(question);
  const strictModelTokens = getStrictModelTokens(specificTokens);
  const cleanProducts = dedupeProducts(Array.isArray(products) ? products : []);

  const matches = cleanProducts
    .map(product => {
      const nombre = normalizeText(product?.nombre);
      const descripcion = normalizeText(product?.descripcion);
      const categoria = normalizeText(product?.categoria);
      const compactNombre = normalizeCompact(product?.nombre);
      const compactDescripcion = normalizeCompact(product?.descripcion);
      const compactCategoria = normalizeCompact(product?.categoria);

      const fullName = `${nombre} ${descripcion}`.trim();
      const searchable = `${nombre} ${descripcion} ${categoria}`.trim();
      const compactFullName = normalizeCompact(fullName);
      const compactSearchable = `${compactNombre} ${compactDescripcion} ${compactCategoria}`.trim();

      let score = 0;

      if (normalizedQuestion.includes(fullName)) score += 250;
      if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 200;
      if (compactQuestion && compactFullName && compactQuestion.includes(compactFullName)) score += 260;
      if (compactQuestion && compactFullName && compactFullName.includes(compactQuestion) && compactQuestion.length >= 4) score += 200;
      if (nombre && normalizedQuestion.includes(nombre)) score += 70;
      if (descripcion && normalizedQuestion.includes(descripcion)) score += 140;
      if (compactQuestion && compactDescripcion.includes(compactQuestion)) score += 170;
      if (compactQuestion && compactSearchable.includes(compactQuestion)) score += 120;

      const meaningfulTokens = specificTokens.filter(token => token.length >= 2);
      const allTokensPresent =
        meaningfulTokens.length > 0 &&
        meaningfulTokens.every(token => {
          const compactToken = normalizeCompact(token);
          return (
            tokenMatchesSearchable(token, searchable, compactSearchable)
          );
        });

      if (allTokensPresent) score += 120;

      const splitTokenParts = meaningfulTokens.flatMap(token => splitAlphaNumericToken(token)).filter(part => part.length >= 2);
      const allPartsPresent =
        splitTokenParts.length > 0 &&
        splitTokenParts.every(part => {
          const compactPart = normalizeCompact(part);
          return (
            tokenMatchesSearchable(part, searchable, compactSearchable)
          );
        });

      if (allPartsPresent) score += 140;

      if (strictModelTokens.length > 0) {
        const hasStrictModelCoverage = strictModelTokens.some(token => {
          const compactToken = normalizeCompact(token);
          const parts = splitAlphaNumericToken(token).filter(part => part.length >= 2);
          const fullMatch =
            tokenMatchesSearchable(token, searchable, compactSearchable);
          const partsMatch =
            parts.length > 0 &&
            parts.every(part => {
              const compactPart = normalizeCompact(part);
              return (
                tokenMatchesSearchable(part, searchable, compactSearchable)
              );
            });

          return fullMatch || partsMatch;
        });

        if (!hasStrictModelCoverage) {
          score = 0;
        }
      }

      return { product, score };
    })
    .filter(item => item.score >= 180)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.product.stock || 0) - Number(a.product.stock || 0);
    });

  return matches.length > 0 ? matches[0].product : null;
}



function scoreExactMatch(product, question) {
  const normalizedQuestion = normalizeText(question);
  const compactQuestion = normalizeCompact(question);
  const questionTokens = getSpecificQueryTokens(question);
  const strictModelTokens = getStrictModelTokens(questionTokens);

  const nombre = normalizeText(product?.nombre);
  const descripcion = normalizeText(product?.descripcion);
  const categoria = normalizeText(product?.categoria);
  const compactNombre = normalizeCompact(product?.nombre);
  const compactDescripcion = normalizeCompact(product?.descripcion);
  const compactCategoria = normalizeCompact(product?.categoria);

  const searchable = `${nombre} ${descripcion} ${categoria}`;
  const compactSearchable = `${compactNombre} ${compactDescripcion} ${compactCategoria}`;
  const fullName = `${nombre} ${descripcion}`.trim();
  const compactFullName = normalizeCompact(fullName);

  let score = 0;
  let tokenMatches = 0;

  if (normalizedQuestion.includes(fullName) && fullName.length > 3) score += 160;
  if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 120;
  if (compactQuestion && compactFullName && compactQuestion.includes(compactFullName)) score += 220;
  if (compactQuestion && compactFullName && compactFullName.includes(compactQuestion) && compactQuestion.length >= 4) score += 180;

  if (normalizedQuestion.includes(nombre) && nombre.length > 2) score += 60;
  if (normalizedQuestion.includes(descripcion) && descripcion.length > 2) score += 100;
  if (searchable.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 90;
  if (compactQuestion && compactDescripcion.includes(compactQuestion)) score += 160;
  if (compactQuestion && compactSearchable.includes(compactQuestion)) score += 120;

  for (const token of questionTokens) {
    const compactToken = normalizeCompact(token);
    const matched = tokenMatchesSearchable(token, searchable, compactSearchable);
    if (matched) {
      tokenMatches += 1;
      score += 22;
      if (/\d/.test(token)) score += 14;
    }
  }

  const meaningfulTokens = questionTokens.filter(token => token.length >= 2);
  const allMeaningfulTokensPresent =
    meaningfulTokens.length > 0 &&
    meaningfulTokens.every(token => {
      const compactToken = normalizeCompact(token);
      return (
        tokenMatchesSearchable(token, searchable, compactSearchable)
      );
    });

  if (allMeaningfulTokensPresent) {
    score += 120;
  }

  const tokenParts = meaningfulTokens
    .flatMap(token => splitAlphaNumericToken(token))
    .filter(part => part.length >= 2);

  const allTokenPartsPresent =
    tokenParts.length > 0 &&
    tokenParts.every(part => {
      const compactPart = normalizeCompact(part);
      return (
        tokenMatchesSearchable(part, searchable, compactSearchable)
      );
    });

  if (allTokenPartsPresent) {
    score += 110;
  }

  if (strictModelTokens.length > 0) {
    const hasStrictModelCoverage = strictModelTokens.some(token => {
      const compactToken = normalizeCompact(token);
      const parts = splitAlphaNumericToken(token).filter(part => part.length >= 2);
      const fullMatch =
        tokenMatchesSearchable(token, searchable, compactSearchable);
      const partsMatch =
        parts.length > 0 &&
        parts.every(part => {
          const compactPart = normalizeCompact(part);
          return (
            tokenMatchesSearchable(part, searchable, compactSearchable)
          );
        });

      return fullMatch || partsMatch;
    });

    if (!hasStrictModelCoverage) {
      score = 0;
    }
  }

  const brandAndModelPresent =
    nombre.length > 1 &&
    descripcion.length > 1 &&
    (normalizedQuestion.includes(nombre) || compactQuestion.includes(compactNombre)) &&
    meaningfulTokens.some(token => {
      const compactToken = normalizeCompact(token);
      return descripcion.includes(token) || (compactToken && compactDescripcion.includes(compactToken));
    });

  if (brandAndModelPresent) {
    score += 70;
  }

  const numericTokens = questionTokens.filter(token => /\d/.test(token));
  const allNumericTokensPresent =
    numericTokens.length > 0 &&
    numericTokens.every(token => {
      const compactToken = normalizeCompact(token);
      return searchable.includes(token) || (compactToken && compactSearchable.includes(compactToken));
    });

  if (allNumericTokensPresent) {
    score += 55;
  }

  return {
    score,
    tokenMatches
  };
}



function findExactProduct(products, question, analysis) {
  if (analysis?.isGeneral ||
    analysis?.isBroadCategoryQuery ||
    analysis?.wantsFullList ||
    analysis?.wantsBrandCategoryList ||
    !analysis?.looksLikeExactProductQuery) {
    return null;
  }



  const matches = dedupeProducts(products)
    .map(product => {
      const result = scoreExactMatch(product, question);
      return {
        product,
        score: result.score,
        tokenMatches: result.tokenMatches
      };
    })
    .filter(item => item.score > 0 && item.tokenMatches > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.product.stock || 0) - Number(a.product.stock || 0);
    });

  if (matches.length === 0) {
    return null;
  }

  const best = matches[0];

  if (best.score < 140) {
    return null;
  }

  return best.product;
}

function getDiverseProducts(products, limit = 6) {
  const grouped = new Map();
  const deduped = dedupeProducts(products).filter(product => Number(product.stock || 0) > 0);

  for (const product of deduped) {
    const category = inferCategoryFromProduct(product);

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

    grouped.get(category).push(product);
  }

  const orderedCategories = ['gpu', 'cpu', 'ram', 'storage', 'motherboard', 'case', 'other'];
  const result = [];

  for (const category of orderedCategories) {
    const items = grouped.get(category) || [];
    if (items.length > 0) {
      result.push(items[0]);
    }
  }

  return result.slice(0, limit);
}

function filterProductsByCategory(products, category) {
  if (!category) {
    return dedupeProducts(products);
  }

  return dedupeProducts(products).filter(product => {
    if (!matchesCategory(product, category)) {
      return false;
    }

    const inferred = inferCategoryFromProduct(product);

    if (inferred === category) {
      return true;
    }

    const categoria = normalizeText(product?.categoria);

    if (category === 'gpu' && categoria.includes('tarjetas graficas')) return true;
    if (category === 'cpu' && categoria.includes('procesadores')) return true;
    if (category === 'ram' && categoria.includes('memorias ram')) return true;
    if (category === 'motherboard' && categoria.includes('placas madre')) return true;
    if (category === 'case' && categoria.includes('gabinetes')) return true;

    return false;
  });
}







function getAlternatives({
  exactProduct = null,
  rerankedProducts = [],
  catalogProducts = [],
  analysis = {},
  limit = 8
}) {
  const targetCategory =
    analysis.category ||
    (exactProduct ? inferCategoryFromProduct(exactProduct) : null);

  const exactId = exactProduct ? Number(exactProduct.id) : null;

  const clean = list =>
    dedupeProducts(list)
      .filter(product => Number(product.id) !== exactId);

  let primary = clean(rerankedProducts);
  let fallback = clean(catalogProducts);

  if (targetCategory) {
    primary = filterProductsByCategory(primary, targetCategory);
    fallback = filterProductsByCategory(fallback, targetCategory);
  }

  if (analysis?.brand && !exactProduct) {
    const brand = normalizeText(analysis.brand);

    const brandFilter = product => {
      const nombre = normalizeText(product.nombre);
      const descripcion = normalizeText(product.descripcion);
      return nombre.includes(brand) || descripcion.includes(brand);
    };

    primary = primary.filter(brandFilter);
    fallback = fallback.filter(brandFilter);
  }

  const combined = dedupeProducts([...primary, ...fallback]);

  return combined.slice(0, limit);
}


async function retrieveFaqContext(question, catalog = []) {
  const analysis = simpleAnalyzeQuestion(question);
  const queryEmbedding = await embedText(question, 'query');

  const faqResults = searchSimilar(queryEmbedding, {
    topK: retrieval.topKFaq,
    filterFn: item => item.document.sourceType === 'faq'
  });

  const productResults = searchSimilar(queryEmbedding, {
    topK: retrieval.topKProducts,
    filterFn: item => item.document.sourceType === 'product'
  });

  const reranked = rerankDocuments([...faqResults, ...productResults], analysis)
    .filter(item => item.finalScore >= retrieval.minScore);

  const faqDocs = reranked
    .filter(item => item.document.sourceType === 'faq')
    .map(item => item.document);

  const rerankedProducts = reranked
    .filter(item => item.document.sourceType === 'product')
    .map(item => item.document.raw);

  const catalogProducts = Array.isArray(catalog) ? catalog : [];
  const productPool = catalogProducts.length > 0 ? catalogProducts : rerankedProducts;

  let featuredProduct = null;
  let relatedProducts = [];

  if (analysis.isGeneral) {
    featuredProduct = null;
    relatedProducts = getDiverseProducts(productPool, 6);
  } else if ((analysis.wantsFullList || analysis.isBroadCategoryQuery) && analysis.category) {
    featuredProduct = null;
    relatedProducts = getFullCategoryList(productPool, analysis);
  } else if (analysis.wantsBrandCategoryList && analysis.category && analysis.brand) {
    featuredProduct = null;
    relatedProducts = getFullCategoryList(productPool, analysis);
  } else {
    featuredProduct =
      findBestDirectProductMatch(productPool, question, analysis) ||
      findBestDirectProductMatch(rerankedProducts, question, analysis) ||
      findDirectProductMatch(productPool, question, analysis) ||
      findDirectProductMatch(rerankedProducts, question, analysis) ||
      findExactProduct(productPool, question, analysis) ||
      findExactProduct(rerankedProducts, question, analysis) ||
      null;

    relatedProducts = getAlternatives({
      exactProduct: featuredProduct,
      rerankedProducts,
      catalogProducts: productPool,
      analysis,
      limit: 8
    });
  }

  const productDocs = dedupeProducts([
    ...(featuredProduct ? [featuredProduct] : []),
    ...relatedProducts
  ]).map(product => ({
    id: `product-${product.id}`,
    sourceType: 'product',
    title: product.nombre,
    content: [
      `Categoria: ${product.categoria}`,
      `Descripcion: ${product.descripcion}`,
      `Precio: ${product.precio}`,
      `Stock: ${product.stock}`
    ].join('. '),
    raw: product
  }));

  return {
    analysis,
    foundExactMatch: Boolean(featuredProduct),
    documentos: [...faqDocs, ...productDocs],
    faqDocs,
    productDocs,
    featuredProduct,
    relatedProducts
  };
}



module.exports = {
  retrieveFaqContext
};
