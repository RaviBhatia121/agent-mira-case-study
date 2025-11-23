/**
 * Build an index keyed by property_id for quick lookups.
 * @param {Array<object>} collection list of items that include property_id
 * @returns {Record<string|number, object>}
 */
function getPropertyKey(item) {
  if (!item) return null;
  if (item.property_id != null) return item.property_id;
  if (item.id != null) return item.id;
  return null;
}

function indexByPropertyId(collection = []) {
  return collection.reduce((acc, item) => {
    const key = getPropertyKey(item);
    if (key == null) return acc;
    acc[key] = item;
    return acc;
  }, {});
}

/**
 * Join property basics with characteristics and images.
 * @param {Array<object>} basics
 * @param {Array<object>} characteristics
 * @param {Array<object>} images
 * @returns {Array<object>}
 */
function joinPropertyData(basics = [], characteristics = [], images = []) {
  const characteristicsById = indexByPropertyId(characteristics);
  const imagesById = indexByPropertyId(images);

  return basics.map((basic) => {
    const propertyId = getPropertyKey(basic);
    const details = characteristicsById[propertyId] || {};
    const imageEntry = imagesById[propertyId] || {};

    return {
      id: propertyId,
      ...basic,
      characteristics: details,
      images: Array.isArray(imageEntry.images) ? imageEntry.images : [],
    };
  });
}

/**
 * Merge additional fields into each property by property id.
 * @param {Array<object>} properties joined property records
 * @param {Record<string|number, object>} extraById map of additional data keyed by property id
 * @returns {Array<object>}
 */
function enrichProperties(properties = [], extraById = {}) {
  return properties.map((property) => {
    const key = property.id ?? property.property_id;
    const extra = extraById[key] || {};
    return {
      ...property,
      ...extra,
    };
  });
}

module.exports = {
  indexByPropertyId,
  joinPropertyData,
  enrichProperties,
};
