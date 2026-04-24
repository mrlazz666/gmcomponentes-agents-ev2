function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function inferCategory(product) {
  const categoria = normalizeLower(product.categoria);
  const nombre = normalizeLower(product.nombre);
  const descripcion = normalizeLower(product.descripcion);

  if (
    categoria.includes('tarjetas graficas') ||
    categoria.includes('tarjeta grafica') ||
    nombre.includes('rtx') ||
    nombre.includes('gtx') ||
    nombre.includes('rx')
  ) return 'gpu';

  if (
    categoria.includes('memorias ram') ||
    categoria.includes('ram') ||
    descripcion.includes('ddr4') ||
    descripcion.includes('ddr5')
  ) return 'ram';

  if (
    categoria.includes('almacenamiento') ||
    categoria.includes('disco') ||
    nombre.includes('ssd') ||
    nombre.includes('hdd') ||
    nombre.includes('nvme') ||
    descripcion.includes('ssd') ||
    descripcion.includes('hdd') ||
    descripcion.includes('nvme')
  ) return 'storage';

  if (
    categoria.includes('placas madre') ||
    categoria.includes('placa madre') ||
    categoria.includes('motherboard')
  ) return 'motherboard';

  if (
    categoria.includes('gabinetes') ||
    categoria.includes('gabinete') ||
    categoria.includes('case')
  ) return 'case';

  if (
    categoria.includes('procesadores') ||
    categoria.includes('procesador') ||
    nombre.includes('ryzen') ||
    nombre.includes('intel') ||
    nombre.includes('core')
  ) return 'cpu';

  return 'other';
}


function inferBrand(product) {
  return normalizeLower(product.nombre);
}

function mapProductToDocument(product) {
  const brand = normalizeText(product.nombre);
  const model = normalizeText(product.descripcion);
  const categoryRaw = normalizeText(product.categoria);
  const category = inferCategory(product);

  return {
    id: `product-${product.id}`,
    sourceType: 'product',
    title: `${brand} ${model}`.trim(),
    content: [
      `Categoria: ${categoryRaw}`,
      `Marca: ${brand}`,
      `Modelo: ${model}`,
      `Precio: ${product.precio}`,
      `Stock: ${product.stock}`
    ].join('. '),
    metadata: {
      productId: Number(product.id),
      category,
      categoryRaw,
      brand: inferBrand(product),
      brandRaw: brand,
      model,
      stock: Number(product.stock || 0),
      price: Number(product.precio || 0),
      image: product.image || ''
    },
    raw: {
      id: Number(product.id),
      categoria: categoryRaw,
      nombre: brand,
      descripcion: model,
      precio: Number(product.precio || 0),
      stock: Number(product.stock || 0),
      image: product.image || ''
    }
  };
}

function loadCatalogDocuments(products) {
  return (Array.isArray(products) ? products : []).map(mapProductToDocument);
}

module.exports = {
  loadCatalogDocuments,
  inferCategory,
  inferBrand
};
