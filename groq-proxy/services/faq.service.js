const fs = require('fs');
const path = require('path');
const { callGroq } = require('../lib/groq-client');
const { faqPrompt } = require('../knowledge/system-prompts');
const { runFaqRagPipeline } = require('../rag/pipelines/faq-rag.pipeline');
const { saveFaqLog } = require('../lib/mongo-log');



const faqData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'knowledge', 'faq-gmcomponents.json'), 'utf8')
);

const STOPWORDS = new Set([
  'que', 'qué', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'en', 'con', 'sin', 'para', 'por', 'me', 'mi', 'tu', 'su', 'sus',
  'tienen', 'tiene', 'hay', 'vende', 'venden', 'mostrar', 'muestra', 'busco',
  'quiero', 'necesito', 'ver', 'algun', 'alguna', 'algunas', 'algunos', 'cuales',
  'cuáles', 'ser', 'es', 'son', 'sobre'
]);

const CATEGORY_SYNONYMS = {
  cpu: ['cpu', 'proce', 'proces', 'procesador', 'procesadores', 'ryzen', 'intel', 'core', 'i3', 'i5', 'i7', 'i9'],
  gpu: ['gpu', 'grafica', 'graficas', 'gr?fica', 'gr?ficas', 'tarjeta', 'tarjetas', 'video', 'rtx', 'gtx', 'rx'],
  ram: ['ram', 'memoria', 'memorias', 'ddr4', 'ddr5', 'dimm'],
  storage: ['disco', 'discos', 'ssd', 'hdd', 'nvme', 'm2', 'm.2', 'almacenamiento', 'storage', 'unidad'],
  motherboard: ['placa', 'placas', 'mother', 'motherboard', 'placamadre', 'placa madre', 'board'],
  case: ['gabinete', 'gabinetes', 'case', 'torre', 'chasis', 'caja']
};

const BRAND_MATCHERS = [
  'nvidia',
  'amd',
  'intel',
  'corsair',
  'kingston',
  'teamgroup',
  'samsung',
  'western digital',
  'wd',
  'msi',
  'asus',
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
  'cuales', 'cu?les', 'ser', 'es', 'son', 'sobre', 'dame', 'listar', 'lista',
  'productos', 'producto', 'marca', 'modelo', 'stock', 'disponible', 'disponibilidad'
]);

for (const synonymList of Object.values(CATEGORY_SYNONYMS)) {
  for (const term of synonymList) {
    for (const part of normalizeText(term).split(' ')) {
      if (part) GENERIC_QUERY_TOKENS.add(part);
    }
  }
}

for (const brand of BRAND_MATCHERS) {
  for (const part of normalizeText(brand).split(' ')) {
    if (part) GENERIC_QUERY_TOKENS.add(part);
  }
}

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
  return normalizeText(text)
    .split(' ')
    .filter(Boolean)
    .filter(token => !STOPWORDS.has(token));
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
    const idKey = Number(product?.id) > 0 ? `id:${Number(product.id)}` : '';
    const nameKey = normalizeText(product?.nombre || '');
    const key = idKey || `name:${nameKey}`;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function shuffleProducts(products) {
  const array = [...(Array.isArray(products) ? products : [])];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}


function expandQuestion(question) {
  const normalized = normalizeText(question);
  const tokens = new Set(tokenize(normalized));

  for (const synonymList of Object.values(CATEGORY_SYNONYMS)) {
    const matched = synonymList.some(term => normalized.includes(normalizeText(term)));
    if (matched) {
      synonymList.forEach(term => {
        const normalizedTerm = normalizeText(term);
        normalizedTerm.split(' ').forEach(part => {
          if (part && !STOPWORDS.has(part)) {
            tokens.add(part);
          }
        });
      });
    }
  }

  return Array.from(tokens);
}

function detectIntent(tokens) {
  const hasAny = list => list.some(term => tokens.includes(normalizeText(term)));

  return {
    cpu: hasAny(CATEGORY_SYNONYMS.cpu),
    gpu: hasAny(CATEGORY_SYNONYMS.gpu),
    ram: hasAny(CATEGORY_SYNONYMS.ram),
    storage: hasAny(CATEGORY_SYNONYMS.storage),
    motherboard: hasAny(CATEGORY_SYNONYMS.motherboard),
    case: hasAny(CATEGORY_SYNONYMS.case)
  };
}

function matchesCpu(nombre, categoria, descripcion) {
  return (
    categoria.includes('proces') ||
    categoria.includes('cpu') ||
    nombre.includes('ryzen') ||
    nombre.includes('intel') ||
    nombre.includes('core') ||
    descripcion.includes('procesador')
  );
}

function matchesGpu(nombre, categoria, descripcion) {
  return (
    categoria.includes('tarjeta') ||
    categoria.includes('graf') ||
    hasGpuModelToken(`${nombre} ${descripcion}`) ||
    nombre.includes('gpu') ||
    descripcion.includes('grafica') ||
    descripcion.includes('video')
  );
}

function matchesRam(nombre, categoria, descripcion) {
  return (
    categoria.includes('ram') ||
    nombre.includes('ram') ||
    descripcion.includes('ram') ||
    descripcion.includes('ddr4') ||
    descripcion.includes('ddr5')
  );
}

function matchesStorage(nombre, categoria, descripcion) {
  return (
    categoria.includes('almacen') ||
    nombre.includes('ssd') ||
    nombre.includes('hdd') ||
    nombre.includes('nvme') ||
    nombre.includes('m2') ||
    nombre.includes('m 2') ||
    nombre.includes('disco') ||
    descripcion.includes('ssd') ||
    descripcion.includes('hdd') ||
    descripcion.includes('nvme')
  );
}

function matchesMotherboard(nombre, categoria, descripcion) {
  return (
    categoria.includes('placa') ||
    categoria.includes('mother') ||
    descripcion.includes('placa madre') ||
    descripcion.includes('motherboard')
  );
}

function matchesCase(nombre, categoria, descripcion) {
  return (
    categoria.includes('gabinete') ||
    nombre.includes('gabinete') ||
    nombre.includes('case') ||
    descripcion.includes('gabinete') ||
    descripcion.includes('chasis')
  );
}

function matchesIntent(product, analysis) {
  const nombre = normalizeText(product.nombre);
  const categoria = normalizeText(product.categoria);
  const descripcion = normalizeText(product.descripcion);

  if (analysis?.category === 'gpu') return matchesGpu(nombre, categoria, descripcion);
  if (analysis?.category === 'cpu') return matchesCpu(nombre, categoria, descripcion);
  if (analysis?.category === 'ram') return matchesRam(nombre, categoria, descripcion);
  if (analysis?.category === 'storage') return matchesStorage(nombre, categoria, descripcion);
  if (analysis?.category === 'motherboard') return matchesMotherboard(nombre, categoria, descripcion);
  if (analysis?.category === 'case') return matchesCase(nombre, categoria, descripcion);

  return true;
}

function getCategoryKey(product) {
  const nombre = normalizeText(product.nombre);
  const categoria = normalizeText(product.categoria);
  const descripcion = normalizeText(product.descripcion);

  if (matchesGpu(nombre, categoria, descripcion)) return 'gpu';
  if (matchesCpu(nombre, categoria, descripcion)) return 'cpu';
  if (matchesRam(nombre, categoria, descripcion)) return 'ram';
  if (matchesStorage(nombre, categoria, descripcion)) return 'storage';
  if (matchesMotherboard(nombre, categoria, descripcion)) return 'motherboard';
  if (matchesCase(nombre, categoria, descripcion)) return 'case';

  return 'other';
}


function analyzeQuestion(question) {
  const normalized = normalizeText(question);

  const categoryMatchers = {
    gpu: ['gpu', 'grafica', 'graficas', 'tarjeta', 'tarjetas', 'video', 'rtx', 'gtx', 'rx'],
    cpu: ['cpu', 'proce', 'proces', 'procesador', 'procesadores', 'ryzen', 'intel', 'core i'],
    ram: ['ram', 'rams', 'memoria', 'memorias', 'memoria ram', 'memorias ram', 'ddr4', 'ddr5'],
    storage: ['disco', 'discos', 'ssd', 'hdd', 'nvme', 'm2', 'almacenamiento'],
    motherboard: ['placa', 'placas', 'placa madre', 'placas madre', 'mother', 'motherboard'],
    case: ['gabinete', 'gabinetes', 'case', 'torre', 'chasis']
  };

  const brandMatchers = BRAND_MATCHERS;

  const category =
    Object.entries(categoryMatchers).find(([, terms]) =>
      terms.some(term => normalized.includes(normalizeText(term)))
    )?.[0] || null;

  const brand = brandMatchers.find(item => normalized.includes(item)) || null;

  const isStoreQuestion =
    normalized.includes('gm components') ||
    normalized.includes('gmcomponentes') ||
    normalized.includes('gm componens') ||
    normalized.includes('gm component') ||
    normalized.includes('gmcomp');

  const isGeneral =
    isStoreQuestion ||
    (
      !category &&
      !brand &&
      (
        normalized.includes('que venden') ||
        normalized.includes('que productos') ||
        normalized.includes('que ofrece') ||
        normalized.includes('que tienen en tienda') ||
        normalized.includes('quienes son') ||
        normalized.includes('que es') ||
        normalized.includes('de que se trata')
      )
    );

  const categoryOnlyQuery = [
    'graficas',
    'grafica',
    'tarjetas graficas',
    'tarjeta grafica',
    'gpu',
    'gpus',
    'procesadores',
    'procesador',
    'proce',
    'proces',
    'cpu',
    'cpus',
    'memorias ram',
    'memoria ram',
    'memorias',
    'ram',
    'rams',
    'placas madre',
    'placa madre',
    'placa',
    'placas',
    'motherboard',
    'motherboards',
    'gabinetes',
    'gabinete',
    'cases',
    'case',
    'almacenamiento',
    'ssd',
    'hdd',
    'nvme'
  ].includes(normalized);

  const wantsFullList =
    categoryOnlyQuery ||
    normalized.includes('todas las') ||
    normalized.includes('todos los') ||
    normalized.includes('dame todas') ||
    normalized.includes('dame todos') ||
    normalized.includes('muestrame todas') ||
    normalized.includes('muestrame todos') ||
    normalized.includes('muestra todas') ||
    normalized.includes('muestra todos') ||
    normalized.includes('listar') ||
    normalized.includes('lista de') ||
    normalized.includes('que graficas venden') ||
    normalized.includes('que tarjetas venden') ||
    normalized.includes('que procesadores venden') ||
    normalized.includes('que memorias venden') ||
    normalized.includes('que memorias ram venden') ||
    normalized.includes('que placas venden') ||
    normalized.includes('que gabinetes venden') ||
    normalized.includes('que gabinetes tienen') ||
    normalized.includes('que graficas tienen') ||
    normalized.includes('que procesadores tienen') ||
    normalized.includes('que memorias tienen') ||
    normalized.includes('que memorias ram tienen') ||
    normalized.includes('que placas tienen') ||
    normalized.includes('que tarjetas tienen');

  const asksStock =
    normalized.includes('stock') ||
    normalized.includes('disponible') ||
    normalized.includes('disponibilidad');

  const specificTokens = getSpecificQueryTokens(normalized);
  const exactQuery = looksLikeExactProductQuery(normalized);

  return {
    category,
    brand,
    isGeneral,
    asksStock,
    wantsFullList,
    isBroadCategoryQuery: categoryOnlyQuery,
    wantsBrandCategoryList: Boolean(category && brand) && !exactQuery,
    specificTokens,
    looksLikeExactProductQuery: exactQuery
  };
}


function scoreFaqItem(item, question) {
  const tokens = expandQuestion(question);
  const pregunta = normalizeText(item.pregunta);
  const respuesta = normalizeText(item.respuesta);

  let score = 0;

  for (const token of tokens) {
    if (pregunta.includes(token)) score += 5;
    if (respuesta.includes(token)) score += 3;
  }

  return score;
}

function scoreProduct(product, question, analysis) {
  const tokens = expandQuestion(question);
  const intent = detectIntent(tokens);

  const nombre = normalizeText(product.nombre);
  const categoria = normalizeText(product.categoria);
  const descripcion = normalizeText(product.descripcion);

  let score = 0;

  for (const token of tokens) {
    if (nombre.includes(token)) score += 8;
    if (categoria.includes(token)) score += 6;
    if (descripcion.includes(token)) score += 4;
  }

  if (intent.cpu && matchesCpu(nombre, categoria, descripcion)) score += 20;
  if (intent.gpu && matchesGpu(nombre, categoria, descripcion)) score += 20;
  if (intent.ram && matchesRam(nombre, categoria, descripcion)) score += 20;
  if (intent.storage && matchesStorage(nombre, categoria, descripcion)) score += 20;
  if (intent.motherboard && matchesMotherboard(nombre, categoria, descripcion)) score += 20;
  if (intent.case && matchesCase(nombre, categoria, descripcion)) score += 20;

  if (analysis?.brand) {
    const brand = normalizeText(analysis.brand);
    if (
      nombre.includes(brand) ||
      categoria.includes(brand) ||
      descripcion.includes(brand)
    ) {
      score += 18;
    }
  }

  if (Number(product.stock) > 0) score += 8;
  if (product.image) score += 2;

  return score;
}

function filterProductsByAnalysis(products, analysis) {
  let filtered = Array.isArray(products) ? [...products] : [];

  if (analysis.category) {
    filtered = filtered.filter(product => matchesIntent(product, analysis));
  }

  if (analysis.brand) {
    const brand = normalizeText(analysis.brand);

    filtered = filtered.filter(product => {
      const nombre = normalizeText(product.nombre);
      const categoria = normalizeText(product.categoria);
      const descripcion = normalizeText(product.descripcion);

      if (brand === 'wd') {
        return (
          nombre.includes('wd') ||
          nombre.includes('western digital') ||
          descripcion.includes('western digital')
        );
      }

      return (
        nombre.includes(brand) ||
        categoria.includes(brand) ||
        descripcion.includes(brand)
      );
    });
  }

  return dedupeProducts(filtered);
}

function findSpecificProduct(products, question, analysis) {
  if (analysis?.isGeneral || analysis?.wantsFullList || analysis?.isBroadCategoryQuery || analysis?.wantsBrandCategoryList || !analysis?.looksLikeExactProductQuery) {
    return [];
  }

  if (questionLooksPureConfig(question)) {
    return [];
  }

  const questionTokens = getSpecificQueryTokens(question);
  const normalizedQuestion = normalizeText(question);
  const compactQuestion = normalizeCompact(question);
  const strictModelTokens = getStrictModelTokens(questionTokens);

  const scoredMatches = (Array.isArray(products) ? products : [])
    .filter(product => matchesIntent(product, analysis))
    .map(product => {
      const nombre = normalizeText(product.nombre);
      const descripcion = normalizeText(product.descripcion);
      const categoria = normalizeText(product.categoria);
      const searchableText = `${nombre} ${descripcion} ${categoria}`.trim();
      const compactNombre = normalizeCompact(product.nombre);
      const compactDescripcion = normalizeCompact(product.descripcion);
      const compactCategoria = normalizeCompact(product.categoria);
      const compactSearchable = `${compactNombre} ${compactDescripcion} ${compactCategoria}`.trim();

      let tokenMatches = 0;

      for (const token of questionTokens) {
        const compactToken = normalizeCompact(token);
        if (
          tokenMatchesSearchable(token, searchableText, compactSearchable)
        ) {
          tokenMatches += 1;
        }
      }

      let score = 0;

      if (normalizedQuestion.includes(nombre)) score += 100;
      if (nombre.includes(normalizedQuestion)) score += 60;
      if (normalizedQuestion.includes(descripcion)) score += 25;
      if (compactQuestion && compactNombre && compactQuestion.includes(compactNombre)) score += 150;
      if (compactQuestion && compactDescripcion && compactQuestion.includes(compactDescripcion)) score += 170;
      if (compactQuestion && compactSearchable.includes(compactQuestion)) score += 120;

      score += tokenMatches * 20;

      const allQuestionTokensPresent =
        questionTokens.length > 0 &&
        questionTokens.every(token => {
          const compactToken = normalizeCompact(token);
          return (
            tokenMatchesSearchable(token, searchableText, compactSearchable)
          );
        });

      if (allQuestionTokensPresent) {
        score += 80;
      }

      const tokenParts = questionTokens
        .flatMap(token => splitAlphaNumericToken(token))
        .filter(part => part.length >= 2);

      const allTokenPartsPresent =
        tokenParts.length > 0 &&
        tokenParts.every(part => {
          const compactPart = normalizeCompact(part);
          return (
            tokenMatchesSearchable(part, searchableText, compactSearchable)
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
            tokenMatchesSearchable(token, searchableText, compactSearchable);
          const partsMatch =
            parts.length > 0 &&
            parts.every(part => {
              const compactPart = normalizeCompact(part);
              return (
                tokenMatchesSearchable(part, searchableText, compactSearchable)
              );
            });

          return fullMatch || partsMatch;
        });

        if (!hasStrictModelCoverage) {
          score = 0;
        }
      }

      return {
        product,
        score,
        tokenMatches
      };
    })
    .filter(item => item.score > 0 && item.tokenMatches > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.tokenMatches !== a.tokenMatches) return b.tokenMatches - a.tokenMatches;
      return Number(b.product.stock || 0) - Number(a.product.stock || 0);
    });

  if (scoredMatches.length === 0) {
    return [];
  }

  const bestMatch = scoredMatches[0];

  if (bestMatch.score < 140) {
    return [];
  }

  return [bestMatch.product];
}



function findSimilarProducts(products, question, analysis, featuredProduct = null) {
  let filtered = filterProductsByAnalysis(
    products,
    featuredProduct ? { ...analysis, brand: null } : analysis
  );

  if (featuredProduct) {
    const featuredCategory = getCategoryKey(featuredProduct);

    filtered = filtered.filter(product => {
      const category = getCategoryKey(product);
      return category === featuredCategory && Number(product.id) !== Number(featuredProduct.id);
    });

    return dedupeProducts(filtered)
      .sort((a, b) => {
        if (Number(b.stock || 0) !== Number(a.stock || 0)) {
          return Number(b.stock || 0) - Number(a.stock || 0);
        }
        if (Number(a.precio || 0) !== Number(b.precio || 0)) {
          return Number(a.precio || 0) - Number(b.precio || 0);
        }
        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
      })
      .slice(0, 8);
  }

  return getRelevantProducts(filtered, question, analysis, 8);
}





function getRelevantFaq(question) {
  return faqData
    .map(item => ({ ...item, _score: scoreFaqItem(item, question) }))
    .filter(item => item._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, 4)
    .map(({ _score, ...item }) => item);
}

function getRelevantProducts(products, question, analysis = null, limit = 8) {
  return dedupeProducts(
    (Array.isArray(products) ? products : [])
      .filter(product => matchesIntent(product, analysis))
      .map(product => ({ ...product, _score: scoreProduct(product, question, analysis) }))
      .filter(product => product._score > 0)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if (Number(b.stock || 0) !== Number(a.stock || 0)) {
          return Number(b.stock || 0) - Number(a.stock || 0);
        }
        if (Number(a.precio || 0) !== Number(b.precio || 0)) {
          return Number(a.precio || 0) - Number(b.precio || 0);
        }
        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
      })
      .map(({ _score, ...product }) => product)
  ).slice(0, limit);
}

function getFullCategoryProducts(products, analysis) {
  let items = dedupeProducts(Array.isArray(products) ? products : []);

  if (analysis?.category) {
    items = items.filter(product => matchesIntent(product, analysis));
  }

  if (analysis?.brand) {
    const brand = normalizeText(analysis.brand);

    items = items.filter(product => {
      const nombre = normalizeText(product.nombre);
      const categoria = normalizeText(product.categoria);
      const descripcion = normalizeText(product.descripcion);

      return (
        nombre.includes(brand) ||
        categoria.includes(brand) ||
        descripcion.includes(brand)
      );
    });
  }

  if (analysis?.category) {
    items = items.filter(product => {
      const categoria = normalizeText(product.categoria);

      if (analysis.category === 'gpu') return categoria.includes('tarjetas graficas');
      if (analysis.category === 'cpu') return categoria.includes('procesadores') || categoria.includes('procesador');
      if (analysis.category === 'ram') return categoria.includes('memorias ram') || categoria.includes('memoria ram') || categoria === 'ram';
      if (analysis.category === 'motherboard') return categoria.includes('placas madre') || categoria.includes('placa madre');
      if (analysis.category === 'case') return categoria.includes('gabinetes') || categoria.includes('gabinete');
      if (analysis.category === 'storage') return categoria.includes('almacenamiento') || categoria.includes('disco');

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
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });
}


function getDiverseProducts(products, limit = 6) {
  const deduped = dedupeProducts(products).filter(product => Number(product.stock) > 0);
  const grouped = new Map();

  for (const product of deduped) {
    const categoryKey = getCategoryKey(product);

    if (!grouped.has(categoryKey)) {
      grouped.set(categoryKey, []);
    }

    grouped.get(categoryKey).push(product);
  }

  const result = [];

  for (const items of grouped.values()) {
    const shuffledItems = shuffleProducts(items);
    if (shuffledItems.length > 0) {
      result.push(shuffledItems[0]);
    }
  }

  return shuffleProducts(result).slice(0, limit);
}


function buildRagContext(question, analysis, relevantFaq, relevantProducts) {
  const faqDocs = relevantFaq.map((item, index) => ({
    id: item.id || `faq-${index + 1}`,
    tipo: 'faq',
    fuente: 'faq-gmcomponents.json',
    titulo: item.pregunta,
    contenido: item.respuesta
  }));

  const productDocs = relevantProducts.map(product => ({
    id: `product-${product.id}`,
    tipo: 'producto',
    fuente: 'catalogo-productos',
    titulo: product.nombre,
    contenido: [
      `Categoria: ${product.categoria}`,
      `Descripcion: ${product.descripcion}`,
      `Precio: ${product.precio}`,
      `Stock: ${product.stock}`
    ].join(' | ')
  }));

  return {
    pregunta: question,
    analisis: analysis,
    totalDocumentosFaq: faqDocs.length,
    totalDocumentosProducto: productDocs.length,
    documentos: [...faqDocs, ...productDocs]
  };
}

function buildStockSummary(products, question) {
  if (!products.length) return '';

  const normalizedQuestion = normalizeText(question);

  if (
    !normalizedQuestion.includes('stock') &&
    !normalizedQuestion.includes('disponible') &&
    !normalizedQuestion.includes('disponibilidad')
  ) {
    return '';
  }

  const disponibles = products.filter(product => Number(product.stock) > 0).length;
  const sinStock = products.filter(product => Number(product.stock) <= 0).length;

  if (sinStock === 0) {
    return `Actualmente hay ${disponibles} productos relacionados con stock disponible en catalogo.`;
  }

  return `Actualmente hay ${disponibles} productos con stock y ${sinStock} sin stock dentro de los relacionados.`;
}

function formatFaqAnswer(answer, products, analysis) {
  const cleanAnswer = String(answer || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (analysis?.isGeneral) {
    return cleanAnswer;
  }

  if (!products.length) {
    return cleanAnswer;
  }

  const availableCount = products.filter(product => Number(product.stock) > 0).length;

  let categoria = 'productos';
  if (analysis?.category === 'gpu') categoria = 'tarjetas graficas';
  else if (analysis?.category === 'cpu') categoria = 'procesadores';
  else if (analysis?.category === 'ram') categoria = 'memorias RAM';
  else if (analysis?.category === 'storage') categoria = 'unidades de almacenamiento';
  else if (analysis?.category === 'motherboard') categoria = 'placas madre';
  else if (analysis?.category === 'case') categoria = 'gabinetes';

  return [
    `GM-COMPONENTS tiene ${categoria} disponibles en catalogo.`,
    '',
    cleanAnswer,
    '',
    `Disponibilidad actual: ${availableCount} productos relacionados con stock.`
  ].join('\n');
}

async function handleFaqLegacy(payload) {
  const question = payload.pregunta || '';
  const allProducts = Array.isArray(payload.productos) ? payload.productos : [];
  

  const analysis = analyzeQuestion(question);
  const relevantFaq = getRelevantFaq(question);
  const specificMatches = findSpecificProduct(allProducts, question, analysis);

  let relevantProducts = [];

  if (analysis.isGeneral) {
    relevantProducts = getDiverseProducts(allProducts, 6);
  } else if ((analysis.wantsFullList || analysis.isBroadCategoryQuery || analysis.wantsBrandCategoryList) && analysis.category) {
    relevantProducts = getFullCategoryProducts(allProducts, analysis);
  } else if (specificMatches.length > 0) {
    const featuredProduct = specificMatches[0];

    const alternatives = findSimilarProducts(
      allProducts,
      question,
      {
        ...analysis,
        category: getCategoryKey(featuredProduct)
      },
      featuredProduct
    );

    relevantProducts = [
      featuredProduct,
      ...alternatives
    ];
  } else {
    relevantProducts = findSimilarProducts(allProducts, question, analysis);

    if (relevantProducts.length === 0) {
      relevantProducts = getRelevantProducts(allProducts, question, null, 6);
    }

    if (relevantProducts.length === 0) {
      relevantProducts = getDiverseProducts(allProducts, 6);
    }
  }

  const contextoRag = buildRagContext(
    question,
    {
      ...analysis,
      foundExactMatch: specificMatches.length > 0
    },
    relevantFaq,
    relevantProducts
  );

  const result = await callGroq([
    {
      role: 'system',
      content: faqPrompt
    },
    {
      role: 'user',
      content: JSON.stringify({
        pregunta: question,
        contextoRag
      })
    }
  ]);

  const sugerenciasModeloRaw = Array.isArray(result.sugerencias)
    ? result.sugerencias
        .map(item => {
          if (typeof item === 'string') return item.trim();

          if (item && typeof item === 'object') {
            return String(
              item.texto ||
              item.mensaje ||
              item.label ||
              item.sugerencia ||
              ''
            ).trim();
          }

          return '';
        })
        .filter(Boolean)
    : [];

  const sugerenciasBase = analysis.isGeneral
    ? [
        'Consulta por una categoria especifica para ver opciones mas precisas.',
        'Pregunta por una marca concreta si buscas algo puntual.'
      ]
    : [
        'Consulta por el stock de una alternativa especifica.',
        'Pide alternativas segun tu presupuesto.',
        'Pregunta por una marca concreta si quieres afinar la busqueda.'
      ];

  const stockSummary = buildStockSummary(relevantProducts, question);

  const respuestaOrdenada = formatFaqAnswer(
    result.respuesta || 'No fue posible responder la consulta en este momento.',
    relevantProducts,
    analysis
  );

  const sugerenciasFinales = [
    ...new Set([
      ...sugerenciasModeloRaw,
      ...sugerenciasBase,
      ...(stockSummary ? [stockSummary] : [])
    ])
  ].slice(0, 4);

  const productoDestacado =
    (analysis.wantsFullList || analysis.isBroadCategoryQuery || analysis.wantsBrandCategoryList)
      ? null
      : (specificMatches.length > 0 ? specificMatches[0] : null);

  const productosRelacionados = productoDestacado
    ? relevantProducts.filter(product => Number(product.id) !== Number(productoDestacado.id))
    : relevantProducts;

  return {
    respuesta: respuestaOrdenada,
    sugerencias: sugerenciasFinales,
    productoDestacado,
    productosRelacionados
  };
}


async function handleFaq(payload) {
  const question = payload.pregunta || '';
  const fallbackProducts = Array.isArray(payload.productos) ? payload.productos : [];
  //se agrego esta nueva linea por un bug raro que hacia que el fallback no tuviera productos, lo cual hacia que el RAG fallara al no tener productos para mostrar aunque la pregunta fuera general
  const pureConfigQuery = questionLooksPureConfig(question);


  try {
    const ragResult = await runFaqRagPipeline({
      pregunta: question,
      productosFallback: fallbackProducts
    });

    const llm = ragResult.llm || {};
    const retrieval = ragResult.retrieval || {};

    const sugerencias = Array.isArray(llm.sugerencias)
      ? llm.sugerencias
      : [];

    const productoDestacado = pureConfigQuery ? null : (retrieval.featuredProduct || null);

    const productosRelacionados = Array.isArray(retrieval.relatedProducts)
      ? (
          productoDestacado
            ? retrieval.relatedProducts.filter(
                product => Number(product.id) !== Number(productoDestacado.id)
              )
            : retrieval.relatedProducts
        )
      : [];

    const responsePayload = {
      respuesta: llm.respuesta || 'No fue posible responder la consulta en este momento.',
      sugerencias,
      productoDestacado,
      productosRelacionados
    };

    await saveFaqLog({
      pregunta: question,
      respuesta: responsePayload.respuesta,
      productoDestacado: responsePayload.productoDestacado,
      productosRelacionados: responsePayload.productosRelacionados,
      analisis: retrieval.analysis || null,
      foundExactMatch: Boolean(retrieval.foundExactMatch),
      origen: 'rag'
    });

    return responsePayload;
  } catch (error) {
    console.error('RAG FAQ fallo, usando fallback actual:', error);

    const fallbackResponse = await handleFaqLegacy(payload);

    await saveFaqLog({
      pregunta: question,
      respuesta: fallbackResponse.respuesta,
      productoDestacado: fallbackResponse.productoDestacado,
      productosRelacionados: fallbackResponse.productosRelacionados,
      analisis: null,
      foundExactMatch: Boolean(fallbackResponse.productoDestacado),
      origen: 'fallback_legacy'
    });

    return fallbackResponse;
  }
}


module.exports = {
  handleFaq
};
