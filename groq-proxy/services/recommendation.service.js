const { callGroq } = require('../lib/groq-client');

const ordinalLabels = ['mejor', 'segunda', 'tercera', 'cuarta', 'quinta'];
const categoryChoices = ['Tarjetas Graficas', 'Procesadores', 'Memorias RAM', 'Placas Madre', 'Gabinetes'];
const useCaseChoices = ['Gaming', 'Oficina', 'Edicion', 'Diseno grafico', 'General'];
const priorityChoices = ['Calidad', 'Precio', 'Calidad/Precio'];
const noPreferenceKeywords = [
  'sin preferencia',
  'sin marca',
  'ninguna',
  'cualquiera',
  'me da igual',
  'me da lo mismo',
  'da igual',
  'da lo mismo',
  'no tengo',
  'general',
  'sin filtro'
];

const unsupportedComponentKeywords = [
  'fuente',
  'fuente de poder',
  'power supply',
  'psu',
  'ssd',
  'nvme',
  'sata',
  'hdd',
  'disco duro',
  'disco',
  'almacenamiento',
  'cooler',
  'refrigeracion',
  'ventilador',
  'watercooling',
  'monitor',
  'teclado',
  'mouse',
  'parlante',
  'webcam'
];

const categoryKeywords = {
  'Tarjetas Graficas': ['grafica', 'graficas', 'gpu', 'video', 'rtx', 'radeon', 'rx', 'nvidia', 'amd', '4k'],
  'Memorias RAM': ['ram', 'memoria', 'ddr4', 'ddr5', 'dimm'],
  'Placas Madre': ['placa', 'motherboard', 'z690', 'z790', 'x570', 'b550', 'wifi'],
  Gabinetes: ['gabinete', 'case', 'tower', 'chasis'],
  Procesadores: ['procesador', 'cpu', 'ryzen', 'intel', 'core', 'hilos']
};

const categoryAliases = {
  'Tarjetas Graficas': ['tarjeta grafica', 'tarjetas graficas', 'grafica', 'graficas', 'gpu', 'rtx', 'radeon'],
  'Memorias RAM': ['memoria ram', 'memorias ram', 'ram', 'ddr4', 'ddr5', 'dimm'],
  'Placas Madre': ['placa madre', 'placas madre', 'tarjeta madre', 'motherboard'],
  Gabinetes: ['gabinete', 'gabinetes', 'case', 'chasis'],
  Procesadores: ['procesador', 'procesadores', 'cpu', 'ryzen', 'intel core', 'core i']
};

const useCaseKeywords = {
  gaming: ['gaming', 'jugar', 'juegos', 'gamer', '4k', 'fps', 'stream'],
  oficina: ['oficina', 'trabajo', 'word', 'excel', 'navegar', 'estudio', 'basico'],
  edicion: ['edicion', 'video', 'render', 'premiere', 'after', 'produccion'],
  'diseno grafico': ['diseno', 'diseno grafico', 'photoshop', 'illustrator', 'creativo'],
  general: ['general', 'normal', 'todo', 'mixto', 'comun']
};

const priorityKeywords = {
  calidad: ['calidad', 'potencia', 'rendimiento', 'maximo', 'premium', 'alto rendimiento'],
  precio: ['precio', 'barato', 'economico', 'ahorro', 'mas barato', 'bajo costo'],
  'calidad/precio': ['calidad precio', 'calidad/precio', 'equilibrado', 'balance', 'balanceado', 'mejor valor']
};

const gpuPerformance = {
  'rx 7900 xt': 99,
  'rtx 4070 super': 95,
  'rtx 3080 ti': 93,
  'rx 7800 xt': 92,
  'rx 7700 xt': 88,
  'rtx 4060': 84,
  'rx 7600 xt': 82,
  'rtx 3060': 78
};

const cpuPerformance = {
  'core i9-13900k': 98,
  'ryzen 9 7950x': 97,
  'core i7-13700k': 92,
  'ryzen 7 7700x': 88,
  'core i5-13600k': 83,
  'ryzen 5 7600x': 80
};

const motherboardPerformance = {
  z790: 96,
  z690: 92,
  x570: 88,
  z590: 84,
  b550: 76
};

const cabinetPerformance = {
  'obsidian series 500d rgb se': 92,
  'mastercase h500m': 91,
  'pc-o11 dynamic': 90,
  'dark base 700': 88,
  'h510 elite': 86,
  'eclipse p500a drgb': 85,
  'tower 500': 84,
  'meshify c': 82,
  'df600 flux': 80,
  '303': 78
};

const knownBrands = [
  'NVIDIA',
  'AMD',
  'Intel',
  'Corsair',
  'Kingston',
  'Teamgroup',
  'Team',
  'G.Skill',
  'Gigabyte',
  'ASUS',
  'MSI',
  'ASRock',
  'NZXT',
  'Corsair',
  'Lian Li',
  'Thermaltake',
  'Antec',
  'Cooler Master',
  'InWin',
  'be quiet!'
];

function removeDiacritics(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(value) {
  return removeDiacritics(value).toLowerCase().trim();
}

function cleanText(value) {
  return normalize(value).replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return cleanText(value).split(' ').filter(token => token.length > 1);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

function tokenMatch(token, keyword) {
  if (!token || !keyword) return false;
  if (token === keyword) return true;
  if ((token.includes(keyword) || keyword.includes(token)) && token.length >= 3 && keyword.length >= 3) {
    return true;
  }

  const maxLen = Math.max(token.length, keyword.length);
  const distance = levenshtein(token, keyword);
  return maxLen <= 5 ? distance <= 1 : distance <= 2;
}

function inferBrand(product) {
  if (product.marca) {
    return product.marca;
  }

  const haystack = `${product.nombre || ''} ${product.descripcion || ''}`;
  const matched = knownBrands.find(brand => cleanText(haystack).includes(cleanText(brand)));
  return matched || '';
}

function enrichProduct(product) {
  return {
    ...product,
    marca: inferBrand(product)
  };
}

function productCategory(product) {
  return cleanText(product.categoria);
}

function productBrand(product) {
  return cleanText(product.marca || '');
}

function listBrands(products) {
  const uniqueBrands = new Map();

  products
    .map(product => inferBrand(product))
    .filter(Boolean)
    .forEach(brand => {
      const key = cleanText(brand);
      if (!uniqueBrands.has(key)) {
        uniqueBrands.set(key, brand);
      }
    });

  return [...uniqueBrands.values()].sort((a, b) => a.localeCompare(b));
}

function detectCategory(cleanedSearch, tokens) {
  const aliasMatches = Object.entries(categoryAliases)
    .map(([category, aliases]) => {
      const score = aliases.reduce((total, alias) => {
        const aliasText = cleanText(alias);
        if (cleanedSearch.includes(aliasText)) return total + 10;

        const aliasTokens = tokenize(aliasText);
        if (aliasTokens.length > 1 && aliasTokens.every(aliasToken => tokens.some(token => tokenMatch(token, aliasToken)))) {
          return total + 7;
        }

        if (aliasTokens.length === 1 && tokens.some(token => tokenMatch(token, aliasText))) {
          return total + 6;
        }

        return total;
      }, 0);

      return { category, score };
    })
    .sort((a, b) => b.score - a.score);

  if (aliasMatches[0] && aliasMatches[0].score > 0) {
    return aliasMatches[0].category;
  }

  const scored = Object.entries(categoryKeywords)
    .map(([category, keywords]) => ({
      category,
      score: keywords.reduce((total, keyword) => {
        const keywordText = cleanText(keyword);
        if (cleanedSearch.includes(keywordText)) return total + 3;
        if (tokens.some(token => tokenMatch(token, keywordText))) return total + 2;
        return total;
      }, 0)
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0] && scored[0].score > 0 ? scored[0].category : '';
}

function detectBrand(searchText, products) {
  const normalizedSearch = cleanText(searchText);
  const tokens = tokenize(searchText);
  const brands = listBrands(products);

  const scored = brands
    .map(brand => {
      const brandKey = cleanText(brand);
      let score = 0;

      if (normalizedSearch.includes(brandKey)) score += 6;
      if (tokens.some(token => tokenMatch(token, brandKey))) score += 4;

      for (const token of tokens) {
        for (const brandToken of tokenize(brandKey)) {
          if (tokenMatch(token, brandToken)) {
            score += 2;
          }
        }
      }

      return { brand, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0] && scored[0].score >= 4 ? scored[0].brand : '';
}

function detectUseCase(answer, allowImplicitGeneral = false) {
  const cleaned = cleanText(answer);
  const tokens = tokenize(answer);

  if (allowImplicitGeneral && isNoPreference(cleaned)) {
    return 'general';
  }

  const scored = Object.entries(useCaseKeywords)
    .map(([useCase, keywords]) => ({
      useCase,
      score: keywords.reduce((total, keyword) => {
        const keywordText = cleanText(keyword);
        if (cleaned.includes(keywordText)) return total + 4;
        if (tokens.some(token => tokenMatch(token, keywordText))) return total + 2;
        return total;
      }, 0)
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0] && scored[0].score > 0 ? scored[0].useCase : '';
}

function detectPriority(answer) {
  const cleaned = cleanText(answer);
  const tokens = tokenize(answer);

  const scored = Object.entries(priorityKeywords)
    .map(([priority, keywords]) => ({
      priority,
      score: keywords.reduce((total, keyword) => {
        const keywordText = cleanText(keyword);
        if (cleaned.includes(keywordText)) return total + 5;
        if (tokens.some(token => tokenMatch(token, keywordText))) return total + 2;
        return total;
      }, 0)
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0] && scored[0].score > 0 ? scored[0].priority : '';
}

function isNoPreference(answer) {
  return noPreferenceKeywords.some(keyword => answer.includes(cleanText(keyword)));
}

function filterByCategory(products, category) {
  const categoryKey = cleanText(category);
  return products.filter(product => productCategory(product) === categoryKey);
}

function hasMeaningfulSignal(cleanedSearch, tokens, products) {
  if (cleanedSearch.length < 3 || tokens.length === 0) {
    return false;
  }

  return products.some(product => {
    const haystack = cleanText(`${product.nombre} ${product.descripcion} ${product.categoria} ${product.marca || ''}`);
    if (haystack.includes(cleanedSearch)) return true;

    return tokens.some(token => {
      if (token.length < 3) return false;
      if (haystack.includes(token)) return true;
      return haystack.split(' ').some(word => tokenMatch(token, word));
    });
  });
}

function isUnsupportedComponentRequest(cleanedSearch) {
  return unsupportedComponentKeywords.some(keyword => cleanedSearch.includes(cleanText(keyword)));
}

function extractMemorySpeed(product) {
  const match = `${product.nombre} ${product.descripcion}`.match(/(\d{4})/);
  return Number(match && match[1] ? match[1] : 3200);
}

function extractMemoryCapacity(product) {
  const match = `${product.nombre} ${product.descripcion}`.match(/(\d+)\s*GB/i);
  return Number(match && match[1] ? match[1] : 16);
}

function findMappedPerformance(text, mapping, fallback) {
  for (const [key, score] of Object.entries(mapping)) {
    if (text.includes(key)) return score;
  }
  return fallback;
}

function performanceScore(product) {
  const text = cleanText(`${product.nombre} ${product.descripcion}`);
  const category = productCategory(product);

  if (category.includes('tarjetas')) return findMappedPerformance(text, gpuPerformance, 70);
  if (category.includes('procesadores')) return findMappedPerformance(text, cpuPerformance, 60);
  if (category.includes('placas')) return findMappedPerformance(text, motherboardPerformance, 58);
  if (category.includes('gabinetes')) return findMappedPerformance(text, cabinetPerformance, 55);
  if (category.includes('memorias')) return extractMemorySpeed(product) / 60 + extractMemoryCapacity(product) * 2;

  return 50;
}

function normalizePriority(priority) {
  const cleanedPriority = cleanText(priority);
  if (cleanedPriority.includes('calidad') && cleanedPriority.includes('precio')) return 'calidad/precio';
  if (cleanedPriority.includes('precio')) return 'precio';
  return 'calidad';
}

function useCaseBonus(product, useCase, performance) {
  const category = productCategory(product);
  if (useCase === 'gaming') {
    if (category.includes('tarjetas') || category.includes('procesadores')) return performance * 2.2;
    if (category.includes('memorias')) return extractMemorySpeed(product) * 0.04;
    return performance * 1.2;
  }

  if (useCase === 'edicion' || useCase === 'diseno grafico') {
    if (category.includes('tarjetas') || category.includes('procesadores')) return performance * 2;
    if (category.includes('memorias')) return extractMemorySpeed(product) * 0.03 + extractMemoryCapacity(product) * 2;
    return performance;
  }

  if (useCase === 'oficina') return 120 - product.precio / 6000 + performance * 0.6;
  return performance * 1.3 - product.precio / 20000;
}

function priorityBonus(product, performance, priority) {
  const normalizedPriority = normalizePriority(priority);
  const valueIndex = (performance * 1000) / Math.max(product.precio, 1);

  if (normalizedPriority === 'calidad') return performance * 4.2;
  if (normalizedPriority === 'precio') return 520 - product.precio / 1200 + valueIndex * 10 + performance * 0.08;
  return performance * 1.1 - product.precio / 5000 + valueIndex * 140;
}

function scoreProduct(product, state, cleanedRequest, requestTokens, overBudgetFallback, ignoreBudgetForRanking) {
  const haystack = cleanText(`${product.nombre} ${product.descripcion} ${product.categoria} ${product.marca || ''}`);
  const performance = performanceScore(product);
  const useCase = state.useCase || 'general';
  const priority = state.priority || 'calidad/precio';
  const normalizedPriority = normalizePriority(priority);
  const basePerformanceWeight = normalizedPriority === 'calidad' ? 3.8 : normalizedPriority === 'precio' ? 1.35 : 2.35;
  const useCaseWeight = normalizedPriority === 'calidad' ? 1.05 : normalizedPriority === 'precio' ? 0.55 : 0.8;

  let score = performance * basePerformanceWeight;

  if (cleanedRequest && haystack.includes(cleanedRequest)) {
    score += 28;
  }

  requestTokens.forEach(token => {
    if (token.length < 3) return;
    if (haystack.includes(token)) score += 6;
  });

  score += useCaseBonus(product, useCase, performance) * useCaseWeight;
  score += priorityBonus(product, performance, priority);

  if (!ignoreBudgetForRanking && state.budget) {
    if (product.precio <= state.budget) {
      score += 18;
      if (useCase === 'oficina' || useCase === 'general') {
        score += Math.max(0, 10 - Math.round((state.budget - product.precio) / 70000));
      }
    } else if (overBudgetFallback) {
      score -= Math.max(6, Math.round((product.precio - state.budget) / 45000));
    } else {
      score -= Math.max(14, Math.round((product.precio - state.budget) / 35000));
    }
  }

  score += Math.min(12, Number(product.stock || 0));
  return score;
}

function rankLabel(index) {
  if (index === 0) return 'Mejor recomendacion';
  return `${ordinalLabels[index] || `${index + 1}a`} recomendacion`;
}

function buildTechnicalSpecs(product) {
  const specs = [];
  const text = `${product.nombre} ${product.descripcion}`;
  const speedMatch = text.match(/(\d{4})\s*MHz/i);
  const capacityMatch = text.match(/(\d+)\s*GB/i);

  if (product.categoria && cleanText(product.categoria).includes('memorias')) {
    if (capacityMatch) specs.push(`Capacidad detectada: ${capacityMatch[1]} GB`);
    if (speedMatch) specs.push(`Velocidad detectada: ${speedMatch[1]} MHz`);
  }

  specs.push(`Categoria: ${product.categoria}`);
  if (product.marca) specs.push(`Marca: ${product.marca}`);
  specs.push(`Precio: $${Number(product.precio || 0).toLocaleString('es-CL')}`);
  specs.push(`Stock: ${Number(product.stock || 0)}`);

  return specs;
}

function buildRecommendationNote(product, index, state, topProduct, overBudgetFallback, ignoreBudgetForRanking) {
  const useCase = state.useCase || 'general';
  const normalizedPriority = normalizePriority(state.priority || 'calidad/precio');
  const scope = state.anyBrand ? 'entre las marcas disponibles' : `dentro de ${state.preferredBrand}`;

  let useReason = 'mantiene un equilibrio general entre rendimiento, precio y disponibilidad';
  const category = productCategory(product);
  if (useCase === 'gaming') {
    if (category.includes('tarjetas')) useReason = 'prioriza potencia grafica para juegos y resoluciones altas';
    else if (category.includes('procesadores')) useReason = 'prioriza rendimiento fuerte en gaming y buen margen para tareas exigentes';
    else if (category.includes('memorias')) useReason = 'aporta una velocidad conveniente para equipos orientados a gaming';
    else useReason = 'encaja bien en un armado orientado a gaming';
  } else if (useCase === 'edicion') {
    useReason = 'favorece un rendimiento estable para edicion y cargas de trabajo pesadas';
  } else if (useCase === 'diseno grafico') {
    useReason = 'favorece fluidez para diseno grafico y trabajo creativo';
  } else if (useCase === 'oficina') {
    useReason = 'mantiene un equilibrio util para trabajo diario, fluidez y costo';
  }

  let priorityReason = 'Tambien priorice calidad/precio, por eso destaque componentes potentes con un precio mas accesible.';
  if (normalizedPriority === 'calidad') {
    priorityReason = 'Tambien priorice calidad, por eso subi primero los componentes con mayor potencia tecnica.';
  } else if (normalizedPriority === 'precio') {
    priorityReason = 'Tambien priorice precio, por eso subi primero las opciones menos costosas.';
  }

  let budgetReason = 'Se considero tu consulta sin una regla adicional de presupuesto.';
  if (state.budget) {
    if (ignoreBudgetForRanking && product.precio > state.budget) {
      budgetReason = `Aqui priorice calidad por encima del precio, por eso la muestro aunque supere tu presupuesto de $${state.budget.toLocaleString('es-CL')}.`;
    } else if (product.precio <= state.budget) {
      budgetReason = `Ademas entra en tu presupuesto de $${state.budget.toLocaleString('es-CL')}.`;
    } else if (overBudgetFallback) {
      budgetReason = `La muestro porque no habia opciones dentro de tu presupuesto de $${state.budget.toLocaleString('es-CL')} y esta es la mas cercana.`;
    } else {
      budgetReason = `Queda sobre tu presupuesto de $${state.budget.toLocaleString('es-CL')}.`;
    }
  }

  const stockReason = Number(product.stock || 0) >= 8 ? 'Tambien mantiene stock para compra inmediata.' : 'Conviene revisar stock porque es mas limitado.';

  if (index === 0) {
    return `La puse como primera opcion porque es la que mejor balance logra ${scope}: ${useReason}. ${priorityReason} ${budgetReason} ${stockReason}`;
  }

  if (topProduct && Number(product.precio || 0) < Number(topProduct.precio || 0)) {
    return `La puse como alternativa porque mantiene un enfoque util para tu caso, aunque baja un poco frente a la principal en rendimiento. ${budgetReason} ${stockReason}`;
  }

  return `La puse como alternativa porque ${useReason}. ${priorityReason} ${budgetReason} ${stockReason}`;
}

function buildResultAnswer(main, second, state) {
  const lines = [
    'Recomendacion para GM-COMPONENTS',
    '',
    `La mejor recomendacion para tu caso es ${main.nombre}.`,
    `Categoria: ${main.categoria}.`,
    main.marca ? `Marca: ${main.marca}.` : '',
    `Criterio principal: ${state.priority || 'Calidad/Precio'}.`,
    `Precio: $${Number(main.precio || 0).toLocaleString('es-CL')}.`,
    `Stock disponible: ${Number(main.stock || 0)}.`,
    main.recommendationNote || 'Coincide mejor con la necesidad indicada.',
    '',
    'Caracteristicas destacadas:'
  ].filter(Boolean);

  (main.specs || []).forEach(spec => lines.push(`- ${spec}`));

  if (second) {
    lines.push('', `Tambien te dejo una alternativa fuerte: ${second.nombre}.`);
    if (second.recommendationNote) {
      lines.push(second.recommendationNote);
    }
  }

  return lines.join('\n');
}

async function enhanceAnswerWithGroq(question, state, baseAnswer, suggestions) {
  if (!process.env.GROQ_API_KEY || suggestions.length === 0) {
    return { answer: baseAnswer, llmUsed: false };
  }

  try {
    const result = await callGroq([
      {
        role: 'system',
        content: [
          'Eres el asistente de recomendaciones de GM-COMPONENTS.',
          'No puedes cambiar productos, orden, precios, stock, categoria, marca ni prioridad ya calculados por el sistema.',
          'Solo puedes mejorar la redaccion final para que sea mas clara, profesional y util.',
          'Debes responder exclusivamente en JSON valido con este formato: {"answer":"string"}.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          question,
          state,
          baseAnswer,
          suggestions: suggestions.map(item => ({
            nombre: item.nombre,
            categoria: item.categoria,
            marca: item.marca,
            precio: item.precio,
            stock: item.stock
          }))
        })
      }
    ]);

    return {
      answer: result.answer || baseAnswer,
      llmUsed: Boolean(result.answer)
    };
  } catch (error) {
    console.error('No se pudo mejorar la recommendation con Groq:', error.message);
    return { answer: baseAnswer, llmUsed: false };
  }
}

function buildBrandQuestion(category, products, preferredBrand) {
  const brands = listBrands(products);
  const brandList = brands.length > 0 ? brands.join(', ') : 'sin marcas claras';
  if (preferredBrand) {
    return `Para ${category} tengo estas marcas detectadas: ${brandList}. Dime si quieres ${preferredBrand} o prefieres opciones generales.`;
  }
  return `Perfecto. Para ${category} tengo estas marcas detectadas: ${brandList}. Dime si tienes alguna preferencia o si quieres opciones generales.`;
}

function askBrandQuestion(category, categoryProducts, state) {
  return {
    mode: 'question',
    answer: buildBrandQuestion(category, categoryProducts, state.preferredBrand),
    suggestions: [],
    nextStep: 'brand',
    quickOptions: [...listBrands(categoryProducts), 'Sin preferencia'],
    state
  };
}

function askUseQuestion(state) {
  const brandLine = state.anyBrand
    ? 'Perfecto, trabajare con marcas generales.'
    : `Perfecto, trabajare solo con ${state.preferredBrand}.`;

  return {
    mode: 'question',
    answer: `${brandLine} Ahora dime para que uso quieres el componente.`,
    suggestions: [],
    nextStep: 'use',
    quickOptions: useCaseChoices,
    state
  };
}

function askPriorityQuestion(state) {
  return {
    mode: 'question',
    answer: 'Perfecto. Ahora elige el criterio principal: calidad, precio o calidad/precio.',
    suggestions: [],
    nextStep: 'priority',
    quickOptions: priorityChoices,
    state
  };
}

function availableCategoryOptions(catalog) {
  const uniqueCategories = new Map();
  catalog.forEach(product => {
    const key = cleanText(product.categoria);
    if (!uniqueCategories.has(key)) {
      uniqueCategories.set(key, product.categoria);
    }
  });
  return [...uniqueCategories.values()];
}

function unsupportedComponentResponse(state, catalog) {
  return {
    mode: 'question',
    answer: `Lo lamento, pero no cuento con ese componente en la base de datos. Estos son los componentes con los que cuento: ${availableCategoryOptions(catalog).join(', ')}.`,
    suggestions: [],
    nextStep: 'category',
    quickOptions: availableCategoryOptions(catalog),
    state
  };
}

function notFoundResponse(category, brand, state) {
  if (category && brand) {
    return {
      mode: 'result',
      answer: `Recomendacion para GM-COMPONENTS\n\nNo encontre productos de ${brand} en ${category} dentro del catalogo actual.`,
      suggestions: [],
      nextStep: 'done',
      quickOptions: [],
      state
    };
  }

  return {
    mode: 'result',
    answer:
      'Recomendacion para GM-COMPONENTS\n\nNo encontre una coincidencia suficiente en la base actual. Prueba consultando por categoria, marca o modelo de componente.',
    suggestions: [],
    nextStep: 'done',
    quickOptions: [],
    state
  };
}

function budgetRequiredResponse(input) {
  const baseRequest = input.state && input.state.baseRequest ? input.state.baseRequest : input.message || '';
  return {
    mode: 'question',
    answer: baseRequest
      ? 'Necesito tu presupuesto en CLP para continuar con la recomendacion. Sin ese dato no avanzare a marca, uso ni resultados.'
      : 'Para comenzar necesito dos cosas: el componente que buscas y tu presupuesto en CLP.',
    suggestions: [],
    nextStep: 'initial',
    quickOptions: [],
    state: {
      baseRequest,
      category: input.state && input.state.category,
      preferredBrand: input.state && input.state.preferredBrand,
      anyBrand: input.state && input.state.anyBrand,
      useCase: input.state && input.state.useCase,
      priority: input.state && input.state.priority
    }
  };
}

function restoreState(input) {
  return {
    baseRequest: input.state && input.state.baseRequest ? input.state.baseRequest : input.message || '',
    budget: input.state && input.state.budget ? input.state.budget : input.budget,
    category: input.state && input.state.category,
    preferredBrand: input.state && input.state.preferredBrand,
    anyBrand: input.state && input.state.anyBrand,
    useCase: input.state && input.state.useCase,
    priority: input.state && input.state.priority
  };
}

function applyDetectedSignals(message, state, categoryProducts) {
  if (!state.category) return;
  const cleanedMessage = cleanText(message);

  if (!state.preferredBrand && !state.anyBrand) {
    const detectedBrand = detectBrand(message, categoryProducts);
    if (detectedBrand) {
      state.preferredBrand = detectedBrand;
      state.anyBrand = false;
    } else if (isNoPreference(cleanedMessage)) {
      state.anyBrand = true;
    }
  }

  if (!state.useCase) {
    const detectedUse = detectUseCase(message);
    if (detectedUse) state.useCase = detectedUse;
  }

  if (!state.priority) {
    const detectedPriority = detectPriority(message);
    if (detectedPriority) state.priority = detectedPriority;
  }
}

function buildRankedSuggestions(catalog, state) {
  if (!state.category) return [];

  let filtered = filterByCategory(catalog, state.category);
  if (!state.anyBrand && state.preferredBrand) {
    filtered = filtered.filter(product => productBrand(product) === cleanText(state.preferredBrand));
  }

  if (filtered.length === 0) return [];

  const normalizedPriority = normalizePriority(state.priority || 'calidad/precio');
  let withinBudget = filtered;
  let overBudgetFallback = false;
  let ignoreBudgetForRanking = false;

  if (state.budget && normalizedPriority === 'calidad') {
    ignoreBudgetForRanking = true;
  } else if (state.budget) {
    const eligible = filtered.filter(product => Number(product.precio || 0) <= state.budget);
    if (eligible.length > 0) {
      withinBudget = eligible;
    } else {
      overBudgetFallback = true;
    }
  }

  const cleanedRequest = cleanText(state.baseRequest);
  const requestTokens = tokenize(state.baseRequest);

  return withinBudget
    .map(product => ({
      product,
      score: scoreProduct(product, state, cleanedRequest, requestTokens, overBudgetFallback, ignoreBudgetForRanking)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry, index, arr) => ({
      ...entry.product,
      specs: buildTechnicalSpecs(entry.product),
      rankLabel: rankLabel(index),
      recommendationNote: buildRecommendationNote(
        entry.product,
        index,
        state,
        arr[0] && arr[0].product,
        overBudgetFallback,
        ignoreBudgetForRanking
      )
    }));
}

async function finalizeIfReady(state, catalog, question) {
  if (!state.category || !state.useCase || !state.priority || (!state.preferredBrand && !state.anyBrand)) {
    return undefined;
  }

  const suggestions = buildRankedSuggestions(catalog, state);
  if (suggestions.length === 0) {
    return notFoundResponse(state.category, state.preferredBrand, state);
  }

  const baseAnswer = buildResultAnswer(suggestions[0], suggestions[1], state);
  const enhanced = await enhanceAnswerWithGroq(question || state.baseRequest, state, baseAnswer, suggestions);

  return {
    mode: 'result',
    answer: enhanced.answer,
    suggestions,
    nextStep: 'done',
    quickOptions: [],
    state,
    confidence: enhanced.llmUsed ? 0.94 : 0.88,
    aiContext: {
      llmUsed: enhanced.llmUsed
    }
  };
}

async function nextResponseAfterSignals(state, categoryProducts, catalog, question) {
  if (!state.category) {
    return notFoundResponse(undefined, undefined, state);
  }

  const readyResponse = await finalizeIfReady(state, catalog, question);
  if (readyResponse) return readyResponse;

  if (!state.preferredBrand && !state.anyBrand) {
    return askBrandQuestion(state.category, categoryProducts, state);
  }

  if (!state.useCase) {
    return askUseQuestion(state);
  }

  if (!state.priority) {
    return askPriorityQuestion(state);
  }

  return notFoundResponse(state.category, state.preferredBrand, state);
}

async function handleInitialStep(input, catalog) {
  const baseRequest = String(input.message || '').trim();
  const cleanedRequest = cleanText(baseRequest);
  const tokens = tokenize(baseRequest);
  const state = {
    baseRequest,
    budget: input.budget
  };

  if (isUnsupportedComponentRequest(cleanedRequest)) {
    return unsupportedComponentResponse(state, catalog);
  }

  if (!baseRequest || !hasMeaningfulSignal(cleanedRequest, tokens, catalog)) {
    return notFoundResponse(undefined, undefined, state);
  }

  const detectedCategory = detectCategory(cleanedRequest, tokens);
  if (!detectedCategory) {
    return {
      mode: 'question',
      answer:
        'Antes de recomendarte, necesito saber que componente buscas. Puedes decirme si quieres una tarjeta grafica, procesador, memoria RAM, placa madre o gabinete.',
      suggestions: [],
      nextStep: 'category',
      quickOptions: categoryChoices,
      state
    };
  }

  state.category = detectedCategory;
  const categoryProducts = filterByCategory(catalog, detectedCategory);
  applyDetectedSignals(baseRequest, state, categoryProducts);
  return nextResponseAfterSignals(state, categoryProducts, catalog, baseRequest);
}

async function handleCategoryStep(input, catalog) {
  const state = restoreState(input);
  const cleanedMessage = cleanText(input.message);
  const detectedCategory = detectCategory(cleanedMessage, tokenize(input.message));

  if (!detectedCategory) {
    if (isUnsupportedComponentRequest(cleanedMessage)) {
      return unsupportedComponentResponse(state, catalog);
    }

    return {
      mode: 'question',
      answer: 'No logre reconocer el tipo de componente. Elige una de estas opciones para seguir con una recomendacion precisa.',
      suggestions: [],
      nextStep: 'category',
      quickOptions: categoryChoices,
      state
    };
  }

  state.category = detectedCategory;
  state.baseRequest = `${state.baseRequest} ${input.message}`.trim();
  const categoryProducts = filterByCategory(catalog, detectedCategory);
  applyDetectedSignals(state.baseRequest, state, categoryProducts);
  return nextResponseAfterSignals(state, categoryProducts, catalog, state.baseRequest);
}

async function handleBrandStep(input, catalog) {
  const state = restoreState(input);
  const category = state.category || detectCategory(cleanText(state.baseRequest), tokenize(state.baseRequest));

  if (!category) {
    return handleInitialStep(
      {
        ...input,
        message: state.baseRequest,
        step: 'initial'
      },
      catalog
    );
  }

  state.category = category;
  const categoryProducts = filterByCategory(catalog, category);
  const answerText = cleanText(input.message);

  if (isNoPreference(answerText)) {
    state.anyBrand = true;
    state.preferredBrand = undefined;
    applyDetectedSignals(input.message, state, categoryProducts);
    return nextResponseAfterSignals(state, categoryProducts, catalog, state.baseRequest);
  }

  const detectedBrand = detectBrand(input.message, categoryProducts);
  if (!detectedBrand) {
    return {
      mode: 'question',
      answer: `No reconoci esa marca dentro de ${category}. ${buildBrandQuestion(category, categoryProducts)}`,
      suggestions: [],
      nextStep: 'brand',
      quickOptions: [...listBrands(categoryProducts), 'Sin preferencia'],
      state
    };
  }

  state.anyBrand = false;
  state.preferredBrand = detectedBrand;
  applyDetectedSignals(input.message, state, categoryProducts);
  return nextResponseAfterSignals(state, categoryProducts, catalog, state.baseRequest);
}

async function handleUseStep(input, catalog) {
  const state = restoreState(input);
  const detectedUse = detectUseCase(input.message, true);

  if (!detectedUse) {
    return {
      mode: 'question',
      answer: 'Necesito un uso para afinar la recomendacion. Puedes responder gaming, oficina, edicion, diseno grafico o general.',
      suggestions: [],
      nextStep: 'use',
      quickOptions: useCaseChoices,
      state
    };
  }

  state.useCase = detectedUse;
  if (!state.category) {
    return notFoundResponse(undefined, undefined, state);
  }

  const categoryProducts = filterByCategory(catalog, state.category);
  applyDetectedSignals(input.message, state, categoryProducts);
  return nextResponseAfterSignals(state, categoryProducts, catalog, state.baseRequest);
}

async function handlePriorityStep(input, catalog) {
  const state = restoreState(input);
  const detectedPriority = detectPriority(input.message);

  if (!detectedPriority) {
    return {
      mode: 'question',
      answer: 'Ahora elige el criterio final: calidad, precio o calidad/precio.',
      suggestions: [],
      nextStep: 'priority',
      quickOptions: priorityChoices,
      state
    };
  }

  state.priority = detectedPriority;
  const readyResponse = await finalizeIfReady(state, catalog, state.baseRequest);
  if (readyResponse) return readyResponse;
  return notFoundResponse(state.category, state.preferredBrand, state);
}

async function handleRecommendation(payload) {
  const requiredBudget = (payload.state && payload.state.budget) || payload.budget;
  if (!requiredBudget || requiredBudget <= 0) {
    return budgetRequiredResponse(payload);
  }

  const catalog = (Array.isArray(payload.productos) ? payload.productos : [])
    .map(enrichProduct)
    .filter(product => Number(product.stock || 0) > 0);

  const step = payload.step || 'initial';

  if (step === 'category') return handleCategoryStep(payload, catalog);
  if (step === 'brand') return handleBrandStep(payload, catalog);
  if (step === 'use') return handleUseStep(payload, catalog);
  if (step === 'priority') return handlePriorityStep(payload, catalog);

  return handleInitialStep(payload, catalog);
}

module.exports = {
  handleRecommendation
};
