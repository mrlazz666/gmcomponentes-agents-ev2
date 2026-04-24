const { embedText } = require('../embeddings/embedder');
const { searchSimilar } = require('./vector-store');
const { rerankDocuments } = require('./reranker');
const { retrieval } = require('../config/rag.config');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()[\]{}\/\\\-_"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(' ').filter(Boolean);
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

  if (
    categoria.includes('graf') ||
    categoria.includes('tarjeta') ||
    nombre.includes('rtx') ||
    nombre.includes('gtx') ||
    nombre.includes('rx') ||
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

  if (targetCategory === 'gpu') {
    return (
      categoria === 'tarjetas graficas' ||
      categoria === 'tarjeta grafica' ||
      categoria.includes('tarjetas graficas') ||
      categoria.includes('tarjeta grafica') ||
      (
        (descripcion.includes('geforce') ||
         descripcion.includes('radeon') ||
         descripcion.includes('rtx') ||
         descripcion.includes('gtx') ||
         descripcion.includes('rx')) &&
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
    q.includes('rtx') || q.includes('gpu') || q.includes('grafica') || q.includes('graficas') || q.includes('tarjeta') ? 'gpu' :
    q.includes('ryzen') || q.includes('intel') || q.includes('core i') || q.includes('procesador') || q.includes('procesadores') || q === 'proce' || q === 'proces' ? 'cpu' :
    q.includes('ram') || q.includes('rams') || q.includes('ddr') || q.includes('memoria') || q.includes('memorias') ? 'ram' :
    q.includes('ssd') || q.includes('nvme') || q.includes('disco') || q.includes('almacenamiento') ? 'storage' :
    q.includes('placa') || q.includes('placas') || q.includes('mother') || q.includes('motherboard') ? 'motherboard' :
    q.includes('gabinete') || q.includes('gabinetes') || q.includes('case') || q.includes('torre') ? 'case' :
    null;

  const knownBrands = [
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
    'asus',
    'msi',
    'gigabyte',
    'nzxt',
    'cooler master',
    'thermaltake'
  ];

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

    

  const isBroadCategoryQuery = categoryOnlyQuery;
  const wantsBrandCategoryList =
    Boolean(category && brand) &&
    (
      q.includes('que ') ||
      q.includes(' cuales ') ||
      q.includes('cuales ') ||
      q.includes(' tienen') ||
      q.includes(' venden') 
      
    );


  

  return {
    category,
    brand,
    isGeneral,
    wantsFullList,
    isBroadCategoryQuery,
    wantsBrandCategoryList
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
    analysis?.wantsBrandCategoryList
  ) {
    return null;
  }

  const normalizedQuestion = normalizeText(question);
  const cleanProducts = dedupeProducts(Array.isArray(products) ? products : []);

  const directMatches = cleanProducts
    .map(product => {
      const nombre = normalizeText(product?.nombre);
      const descripcion = normalizeText(product?.descripcion);
      const categoria = normalizeText(product?.categoria);

      const fullName = `${nombre} ${descripcion}`.trim();
      const searchable = `${nombre} ${descripcion} ${categoria}`.trim();

      let score = 0;

      if (normalizedQuestion.includes(fullName)) score += 200;
      if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 160;

      if (nombre && normalizedQuestion.includes(nombre)) score += 60;
      if (descripcion && normalizedQuestion.includes(descripcion)) score += 120;

      const meaningfulTokens = tokenize(question).filter(token => token.length >= 3);
      const allTokensPresent =
        meaningfulTokens.length > 0 &&
        meaningfulTokens.every(token => searchable.includes(token));

      if (allTokensPresent) score += 100;

      return { product, score };
    })
    .filter(item => item.score >= 180)
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
    analysis?.wantsBrandCategoryList
  ) {
    return null;
  }

  const normalizedQuestion = normalizeText(question);
  const cleanProducts = dedupeProducts(Array.isArray(products) ? products : []);

  const matches = cleanProducts
    .map(product => {
      const nombre = normalizeText(product?.nombre);
      const descripcion = normalizeText(product?.descripcion);
      const categoria = normalizeText(product?.categoria);

      const fullName = `${nombre} ${descripcion}`.trim();
      const searchable = `${nombre} ${descripcion} ${categoria}`.trim();

      let score = 0;

      if (normalizedQuestion.includes(fullName)) score += 250;
      if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 200;
      if (nombre && normalizedQuestion.includes(nombre)) score += 70;
      if (descripcion && normalizedQuestion.includes(descripcion)) score += 140;

      const meaningfulTokens = tokenize(question).filter(token => token.length >= 3);
      const allTokensPresent =
        meaningfulTokens.length > 0 &&
        meaningfulTokens.every(token => searchable.includes(token));

      if (allTokensPresent) score += 120;

      return { product, score };
    })
    .filter(item => item.score >= 200)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.product.stock || 0) - Number(a.product.stock || 0);
    });

  return matches.length > 0 ? matches[0].product : null;
}



function scoreExactMatch(product, question) {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = tokenize(question);

  const nombre = normalizeText(product?.nombre);
  const descripcion = normalizeText(product?.descripcion);
  const categoria = normalizeText(product?.categoria);

  const searchable = `${nombre} ${descripcion} ${categoria}`;
  const fullName = `${nombre} ${descripcion}`.trim();

  let score = 0;
  let tokenMatches = 0;

  if (normalizedQuestion.includes(fullName) && fullName.length > 3) score += 160;
  if (fullName.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 120;

  if (normalizedQuestion.includes(nombre) && nombre.length > 2) score += 60;
  if (normalizedQuestion.includes(descripcion) && descripcion.length > 2) score += 100;
  if (searchable.includes(normalizedQuestion) && normalizedQuestion.length > 3) score += 90;

  for (const token of questionTokens) {
    if (searchable.includes(token)) {
      tokenMatches += 1;
      score += 18;
    }
  }

  const meaningfulTokens = questionTokens.filter(token => token.length >= 3);

  const allMeaningfulTokensPresent =
    meaningfulTokens.length > 0 &&
    meaningfulTokens.every(token => searchable.includes(token));

  if (allMeaningfulTokensPresent) {
    score += 90;
  }

  const brandAndModelPresent =
    nombre.length > 1 &&
    descripcion.length > 1 &&
    normalizedQuestion.includes(nombre) &&
    meaningfulTokens.some(token => descripcion.includes(token));

  if (brandAndModelPresent) {
    score += 70;
  }

  const numericTokens = questionTokens.filter(token => /\d/.test(token));
  const allNumericTokensPresent =
    numericTokens.length > 0 &&
    numericTokens.every(token => searchable.includes(token));

  if (allNumericTokensPresent) {
    score += 40;
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
    analysis?.wantsBrandCategoryList) {
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

  if (best.score < 35) {
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

  if (analysis?.brand) {
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
