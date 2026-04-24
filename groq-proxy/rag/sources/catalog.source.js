const { catalogApiUrl } = require('../config/rag.config');

async function fetchCatalogFromSource() {
  const response = await fetch(catalogApiUrl);
  if (!response.ok) {
    throw new Error(`No se pudo obtener catalogo desde ${catalogApiUrl}`);
  }

  const products = await response.json();
  return Array.isArray(products) ? products : [];
}

function mapToProductLite(product) {
  return {
    id: product.id,
    categoria: product.categoria,
    nombre: product.nombre,
    descripcion: product.descripcion,
    precio: product.precio,
    stock: product.stock,
    image: product.image
  };
}

async function getCatalog({ fallbackProducts = [] } = {}) {
  try {
    const products = await fetchCatalogFromSource();
    return products.map(mapToProductLite);
  } catch (error) {
    if (Array.isArray(fallbackProducts) && fallbackProducts.length > 0) {
      return fallbackProducts;
    }
    throw error;
  }
}

module.exports = {
  getCatalog
};
