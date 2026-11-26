function isCommercialProperty(type) {
  return type === "Office Space" || type === "Retail";
}

function propertyNumberLabel(type) {
  if (type === "Retail") return "Shop no.";
  if (type === "Office Space") return "Office no.";
  return "House / flat number";
}

module.exports = { isCommercialProperty, propertyNumberLabel };
