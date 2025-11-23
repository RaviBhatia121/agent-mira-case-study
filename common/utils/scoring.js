/**
 * Compute price match score using predicted price vs budget.
 * @param {?number} predictedPrice
 * @param {?number} userBudget
 * @returns {number}
 */
function computePriceMatchScore(predictedPrice, userBudget) {
  if (!userBudget || userBudget <= 0 || !predictedPrice) {
    return 50;
  }

  if (predictedPrice <= userBudget) {
    return 100;
  }

  const diffRatio = (predictedPrice - userBudget) / userBudget;
  const penalty = diffRatio * 100;
  return Math.max(0, 100 - penalty);
}

/**
 * Compute bedroom score.
 * @param {?number} propertyBedrooms
 * @param {?number} userMinBedrooms
 * @returns {number}
 */
function computeBedroomScore(propertyBedrooms, userMinBedrooms) {
  if (!userMinBedrooms || userMinBedrooms <= 0) return 100;
  if (!propertyBedrooms) return 0;
  if (propertyBedrooms >= userMinBedrooms) return 100;
  return Math.max(
    0,
    Math.min(100, (propertyBedrooms / userMinBedrooms) * 100)
  );
}

/**
 * @param {?number} schoolRating
 * @returns {number}
 */
function computeSchoolRatingScore(schoolRating) {
  if (schoolRating == null) return 50;
  return Math.max(0, Math.min(100, (schoolRating / 10) * 100));
}

/**
 * @param {?number} commuteTime minutes
 * @returns {number}
 */
function computeCommuteScore(commuteTime) {
  if (commuteTime == null) return 50;
  if (commuteTime <= 15) return 100;
  if (commuteTime <= 30) return 80;
  if (commuteTime <= 45) return 50;
  return 20;
}

/**
 * @param {?number} propertyAge in years
 * @returns {number}
 */
function computePropertyAgeScore(propertyAge) {
  if (propertyAge == null) return 60;
  if (propertyAge <= 5) return 100;
  if (propertyAge <= 15) return 80;
  if (propertyAge <= 30) return 60;
  return 40;
}

/**
 * @param {Array<string>} amenities
 * @returns {number}
 */
function computeAmenitiesScore(amenities) {
  if (!Array.isArray(amenities) || amenities.length === 0) return 0;

  const normalized = amenities
    .map((a) => (a || '').toLowerCase().trim())
    .filter((a) => a.length > 0);

  const hasPool = normalized.some((a) => a.includes('pool'));
  const hasGarage = normalized.some((a) => a.includes('garage'));
  const hasGarden =
    normalized.some((a) => a.includes('garden')) ||
    normalized.some((a) => a.includes('backyard'));

  const trueCount = [hasPool, hasGarage, hasGarden].filter(Boolean).length;
  return (trueCount / 3) * 100;
}

/**
 * Weighted total score.
 * @param {object} components contains numeric fields
 * @returns {number}
 */
function computeTotalScore(components = {}) {
  const {
    priceMatchScore = 50,
    bedroomScore = 50,
    schoolRatingScore = 50,
    commuteScore = 50,
    propertyAgeScore = 60,
    amenitiesScore = 0,
  } = components;

  return (
    0.3 * priceMatchScore +
    0.2 * bedroomScore +
    0.15 * schoolRatingScore +
    0.15 * commuteScore +
    0.1 * propertyAgeScore +
    0.1 * amenitiesScore
  );
}

/**
 * Compute overall rule score for a property.
 * @param {object} property joined property record
 * @param {object} preferences user preferences
 * @returns {number}
 */
function computeRuleScore(property, preferences = {}) {
  const { budget, minBedrooms } = preferences;

  const predictedPrice =
    property.predicted_price ??
    property.modelPredictedPrice ??
    property.ml_metadata?.predicted_price ??
    null;

  const priceMatchScore = computePriceMatchScore(predictedPrice, budget);
  const bedroomScore = computeBedroomScore(
    property.bedrooms ??
      property.beds ??
      property.characteristics?.beds ??
      null,
    minBedrooms
  );
  const schoolRatingScore = computeSchoolRatingScore(
    property.school_rating ?? property.characteristics?.school_rating ?? null
  );
  const commuteScore = computeCommuteScore(
    property.commute_time ?? property.characteristics?.commute_time ?? null
  );
  const propertyAgeScore = computePropertyAgeScore(
    property.property_age ?? property.characteristics?.property_age ?? null
  );
  const amenitiesScore = computeAmenitiesScore(
    property.amenities ?? property.characteristics?.amenities ?? []
  );

  return computeTotalScore({
    priceMatchScore,
    bedroomScore,
    schoolRatingScore,
    commuteScore,
    propertyAgeScore,
    amenitiesScore,
  });
}

module.exports = {
  computePriceMatchScore,
  computeBedroomScore,
  computeSchoolRatingScore,
  computeCommuteScore,
  computePropertyAgeScore,
  computeAmenitiesScore,
  computeTotalScore,
  computeRuleScore,
};
