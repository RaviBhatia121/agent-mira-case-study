/**
 * Check if a property fits within the given budget.
 * @param {object} property
 * @param {?number} budget
 * @returns {boolean}
 */
function fitsBudget(property, budget) {
  if (!budget || budget <= 0) return true;
  const price =
    property.price ??
    property.list_price ??
    property.listing_price ??
    property.listingPrice ??
    null;

  if (price == null) return true;
  return Number(price) <= Number(budget);
}

/**
 * Check if a property meets the minimum bedroom preference.
 * @param {object} property
 * @param {?number} minBedrooms
 * @returns {boolean}
 */
function meetsBedroomRequirement(property, minBedrooms) {
  if (!minBedrooms || minBedrooms <= 0) return true;
  const beds =
    property.bedrooms ??
    property.beds ??
    property.characteristics?.beds ??
    null;

  if (beds == null) return true;
  return Number(beds) >= Number(minBedrooms);
}

/**
 * Check if property is in preferred locations.
 * @param {object} property
 * @param {string[]} preferredLocations
 * @returns {boolean}
 */
function matchesPreferredLocation(property, preferredLocations = []) {
  if (!Array.isArray(preferredLocations) || preferredLocations.length === 0) {
    return true;
  }

  const locationTokens = [
    property.location,
    property.city,
    property.neighbourhood,
    property.state,
  ]
    .filter(Boolean)
    .map((token) => token.toString().trim());

  return preferredLocations.some((preferred) =>
    locationTokens.includes(preferred)
  );
}

/**
 * Filter properties based on common preference fields.
 * @param {Array<object>} properties
 * @param {object} preferences
 * @param {?number} preferences.budget
 * @param {?number} preferences.minBedrooms
 * @param {string[]} preferences.preferredLocations
 * @returns {Array<object>}
 */
function filterProperties(properties = [], preferences = {}) {
  const { budget, minBedrooms, preferredLocations = [] } = preferences;

  return properties.filter((property) => {
    if (!fitsBudget(property, budget)) return false;
    if (!meetsBedroomRequirement(property, minBedrooms)) return false;
    if (!matchesPreferredLocation(property, preferredLocations)) return false;
    return true;
  });
}

module.exports = {
  fitsBudget,
  meetsBedroomRequirement,
  matchesPreferredLocation,
  filterProperties,
};
