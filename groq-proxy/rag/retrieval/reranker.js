function rerankDocuments(results, analysis = {}) {
  return [...results]
    .map(item => {
      let bonus = 0;

      if (item.document?.sourceType === 'product') {
        const stock = Number(item.document.metadata?.stock || 0);
        const category = String(item.document.metadata?.category || '').toLowerCase();
        const brand = String(item.document.metadata?.brand || '').toLowerCase();
        const model = String(item.document.metadata?.model || '').toLowerCase();

        if (stock > 0) bonus += 0.08;

        if (analysis.category && category === analysis.category) {
          bonus += 0.15;
        }

        if (analysis.brand && brand.includes(String(analysis.brand).toLowerCase())) {
          bonus += 0.15;
        }

        if (analysis.category === 'gpu' && (model.includes('rtx') || model.includes('rx'))) {
          bonus += 0.05;
        }

        if (analysis.category === 'cpu' && (model.includes('ryzen') || model.includes('core i'))) {
          bonus += 0.05;
        }

        if (analysis.category === 'ram' && model.includes('ddr')) {
          bonus += 0.05;
        }
      }

      return {
        ...item,
        finalScore: item.score + bonus
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

module.exports = {
  rerankDocuments
};
