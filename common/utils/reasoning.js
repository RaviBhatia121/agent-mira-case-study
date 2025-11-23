/**
 * Build a human-readable explanation string for a property.
 * @param {object} property
 * @param {object} preferences
 * @returns {string}
 */
function buildReason(property, preferences = {}) {
  const parts = getReasonParts(property, preferences);
  return Object.values(parts)
    .filter(Boolean)
    .join(' ');
}

/**
 * Return structured explanation parts for easier consumption.
 * @param {object} property
 * @param {object} preferences
 * @returns {{
 *  priceRemark?: string,
 *  bedroomsRemark?: string,
 *  areaRemark?: string,
 *  amenitiesRemark?: string
 * }}
 */
function getReasonParts(property, preferences = {}) {
  const { budget, minBedrooms, preferredAreas = [] } = preferences;
  const parts = {};

  const predictedPrice =
    property.predicted_price ??
    property.modelPredictedPrice ??
    property.ml_metadata?.predicted_price ??
    null;
  const listPrice =
    property.price ??
    property.list_price ??
    property.listing_price ??
    property.listingPrice ??
    null;

  if (predictedPrice) {
    const formatted = `$${Number(predictedPrice).toLocaleString('en-US')}`;
    if (!budget) {
      parts.priceRemark = `The model predicts this home is valued at around ${formatted}.`;
    } else if (predictedPrice <= budget) {
      parts.priceRemark = `The model predicts this home is valued at around ${formatted}. Fits within your budget.`;
    } else {
      parts.priceRemark = `The model predicts this home is valued at around ${formatted}. Is above your stated budget.`;
    }
  } else if (budget && listPrice) {
    const formatted = `$${Number(listPrice).toLocaleString('en-US')}`;
    if (listPrice <= budget) {
      parts.priceRemark = `List price (${formatted}) fits within your budget (model prediction unavailable).`;
    } else {
      parts.priceRemark = `List price (${formatted}) is above your budget (model prediction unavailable).`;
    }
  }

  const bedrooms =
    property.bedrooms ??
    property.beds ??
    property.characteristics?.beds ??
    null;
  if (minBedrooms) {
    if (bedrooms > minBedrooms) {
      parts.bedroomsRemark = `Offers more bedrooms (${bedrooms}) than your minimum preference (${minBedrooms}).`;
    } else if (bedrooms === minBedrooms) {
      parts.bedroomsRemark = `Meets your bedroom preference (${bedrooms} bedrooms).`;
    } else if (bedrooms != null) {
      parts.bedroomsRemark = `Has fewer bedrooms (${bedrooms}) than your minimum preference (${minBedrooms}).`;
    }
  }

  if (Array.isArray(preferredAreas) && preferredAreas.length > 0) {
    const location =
      property.location ||
      [property.city, property.state].filter(Boolean).join(', ');
    if (preferredAreas.includes(location)) {
      parts.areaRemark = `Located in one of your preferred areas (${location}).`;
    } else {
      parts.areaRemark = `Located in ${location || 'this area'}, which is outside your selected preferred areas.`;
    }
  }

  const amenities = Array.isArray(property.amenities)
    ? property.amenities
    : property.characteristics?.amenities || [];
  if (amenities.length > 0) {
    const cleaned = amenities
      .map((a) => (a || '').trim())
      .filter((a) => a.length > 0);
    if (cleaned.length > 0) {
      parts.amenitiesRemark = `Comes with amenities: ${cleaned.join(', ')}.`;
    }
  }

  return parts;
}

module.exports = {
  buildReason,
  getReasonParts,
};
