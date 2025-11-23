// src/server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadPropertyDatasets } = require('../../../common/utils/dataLoader');
const {
  joinPropertyData,
} = require('../../../common/utils/propertyJoiner');
const { filterProperties } = require('../../../common/utils/filtering');
const {
  computeRuleScore,
  computePriceMatchScore,
  computeBedroomScore,
  computeSchoolRatingScore,
  computeCommuteScore,
  computePropertyAgeScore,
  computeAmenitiesScore,
  computeTotalScore,
} = require('../../../common/utils/scoring');
const { buildReason } = require('../../../common/utils/reasoning');

const {
  getMlScoresForProperties,
} = require('./services/mlClient');

const app = express();
const PORT = process.env.PORT || 5001;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Load data once in memory ----------
const DATA_DIR = path.join(__dirname, '..', 'data');
const {
  basics: propertyBasics,
  characteristics: propertyCharacteristics,
  images: propertyImages,
} = loadPropertyDatasets(DATA_DIR);

const fullProperties = joinPropertyData(
  propertyBasics,
  propertyCharacteristics,
  propertyImages
);

const rawCharacteristicsById = propertyCharacteristics.reduce((acc, item) => {
  const key = item.property_id ?? item.id;
  if (key == null) return acc;
  acc[key] = item;
  return acc;
}, {});

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPropertyForML(property) {
  const price =
    toNumberOrNull(
      property.list_price ?? property.price ?? property.listing_price
    ) ?? toNumberOrNull(property.price);
  const baseDetails =
    (property.characteristics &&
      Object.keys(property.characteristics).length > 0 &&
      property.characteristics) ||
    rawCharacteristicsById[property.id] ||
    {};
  const bedrooms =
    toNumberOrNull(
      property.bedrooms ??
        baseDetails.bedrooms ??
        baseDetails.beds
    ) ?? toNumberOrNull(property.bedrooms);
  const bathrooms =
    toNumberOrNull(
      property.bathrooms ??
        baseDetails.bathrooms ??
        baseDetails.baths
    ) ?? toNumberOrNull(property.bathrooms);
  const sizeSqft =
    toNumberOrNull(
      property.size_sqft ?? baseDetails.size_sqft
    ) ?? toNumberOrNull(property.size_sqft);

  const schoolRating =
    toNumberOrNull(
      property.school_rating ?? baseDetails.school_rating
    ) ?? 7;
  const commuteTime =
    toNumberOrNull(
      property.commute_time ?? baseDetails.commute_time
    ) ?? 30;
  const propertyAge =
    toNumberOrNull(
      property.property_age ?? baseDetails.property_age
    ) ?? 10;

  return {
    id: property.id,
    price,
    bedrooms,
    bathrooms,
    size_sqft: sizeSqft,
    school_rating: schoolRating,
    commute_time: commuteTime,
    property_age: propertyAge,
  };
}

// Combine rule-based and ML outputs
function computeFinalScore({ ruleScore, mlPriceScore }) {
  // If ML is missing, just return rule score
  if (mlPriceScore == null) return ruleScore;

  // Simple weighted blend
  // 70% business/rule logic, 30% ML price favourability
  return 0.7 * ruleScore + 0.3 * mlPriceScore;
}

// Convert predicted price into a 0–100 score where
// properties under budget get higher score, over budget get lower.
function priceToScore(predictedPrice, budget) {
  if (typeof predictedPrice !== 'number' || !budget || budget <= 0) {
    return null;
  }

  const ratio = predictedPrice / budget;

  // If predicted is <= budget, good; if > budget, worse
  if (ratio <= 1) {
    // 60–100 range for within-budget
    return 60 + 40 * (1 - ratio);
  } else {
    // 0–60 range for over-budget, decaying as it gets more expensive
    const over = Math.min(ratio - 1, 1.5); // cap at +150% over
    return Math.max(0, 60 - over * 40);
  }
}

// ---------- Routes ----------

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ml-recommender-backend' });
});

// Return all properties (merged view)
app.get('/properties', (req, res) => {
  res.json({ properties: fullProperties });
});

// Main recommendations endpoint
app.post('/recommendations', async (req, res) => {
  const requestPayload = req.body || {};
  const rawPrefs =
    requestPayload.preferences &&
    typeof requestPayload.preferences === 'object' &&
    !Array.isArray(requestPayload.preferences)
      ? requestPayload.preferences
      : {};

  const mergedPrefs = {
    ...requestPayload,
    ...rawPrefs,
  };

  const inputAreas = Array.isArray(mergedPrefs.preferredAreas)
    ? mergedPrefs.preferredAreas
    : [];
  const inputLocations = Array.isArray(mergedPrefs.preferredLocations)
    ? mergedPrefs.preferredLocations
    : [];

  const normalizedAreas =
    inputAreas.length > 0 ? inputAreas : inputLocations;
  const normalizedLocations =
    inputLocations.length > 0 ? inputLocations : normalizedAreas;

  const preferences = {
    ...rawPrefs,
    budget: toNumberOrNull(mergedPrefs.budget),
    minBedrooms: toNumberOrNull(mergedPrefs.minBedrooms),
    minBathrooms: toNumberOrNull(mergedPrefs.minBathrooms),
    maxCommuteTime: toNumberOrNull(mergedPrefs.maxCommuteTime),
    preferredAreas: Array.isArray(normalizedAreas) ? normalizedAreas : [],
    preferredLocations: Array.isArray(normalizedLocations)
      ? normalizedLocations
      : [],
  };

  if (preferences.budget == null) {
    preferences.budget = 250000;
  }

  const properties = filterProperties(fullProperties, preferences);
  const propertiesForML = properties
    .map(buildPropertyForML)
    .filter(Boolean);

  let mlCallSucceeded = false;
  let mlAnyPrediction = false;
  let mlFallbackMessage = null;
  let mlScoreById = {};

  if (propertiesForML.length > 0) {
    try {
      const { scoresById, anyPrediction } = await getMlScoresForProperties(propertiesForML);
      mlScoreById = scoresById || {};
      mlAnyPrediction = Boolean(anyPrediction) && Object.keys(mlScoreById).length > 0;
      mlCallSucceeded = true;
      console.log(
        `[ML] Received predictions for ${Object.keys(mlScoreById).length} properties`
      );
    } catch (err) {
      console.error('Error calling ML service:', err.message);
      mlFallbackMessage = 'Remote ML service unavailable; using rule-based scoring only.';
    }
  }

  // If ML call succeeded but came back completely empty/invalid, treat as fallback
  if (mlCallSucceeded && !mlAnyPrediction && !mlFallbackMessage) {
    mlFallbackMessage = 'Remote ML service responded without usable predictions; using rule-based scoring only.';
  }

  const budget = preferences.budget;

  const enriched = properties.map((p) => {
    const mlEntry = mlScoreById[p.id];
    const predictedPrice =
      mlEntry && typeof mlEntry.predicted_price === 'number'
        ? mlEntry.predicted_price
        : null;

    const propertyForScoring = {
      ...p,
      price: p.list_price ?? p.price ?? null,
      predicted_price: predictedPrice,
    };

    const ruleScore = computeRuleScore(propertyForScoring, preferences);

    const priceMatchScore = computePriceMatchScore(
      predictedPrice,
      preferences.budget
    );
    const bedroomScore = computeBedroomScore(
      propertyForScoring.bedrooms ??
        propertyForScoring.beds ??
        propertyForScoring.characteristics?.beds ??
        null,
      preferences.minBedrooms
    );
    const schoolRatingScore = computeSchoolRatingScore(
      propertyForScoring.school_rating ??
        propertyForScoring.characteristics?.school_rating ??
        null
    );
    const commuteScore = computeCommuteScore(
      propertyForScoring.commute_time ??
        propertyForScoring.characteristics?.commute_time ??
        null
    );
    const propertyAgeScore = computePropertyAgeScore(
      propertyForScoring.property_age ??
        propertyForScoring.characteristics?.property_age ??
        null
    );
    const amenitiesScore = computeAmenitiesScore(
      propertyForScoring.amenities ??
        propertyForScoring.characteristics?.amenities ??
        []
    );

    const scoreBreakdown = {
      priceMatchScore,
      bedroomScore,
      schoolRatingScore,
      commuteScore,
      propertyAgeScore,
      amenitiesScore,
      totalScore: ruleScore != null ? Number(ruleScore.toFixed(2)) : null,
    };

    const mlPriceScore =
      predictedPrice != null ? priceToScore(predictedPrice, budget) : null;

    const finalScore = computeFinalScore({ ruleScore, mlPriceScore });

    const mlUsedForThisProperty = mlPriceScore != null;

    const reasoning = buildReason(propertyForScoring, preferences);

    const matchScore = finalScore != null ? Number(finalScore.toFixed(2)) : null;
    const listingPrice = p.list_price ?? null;
    const modelPredictedPrice = predictedPrice;
    const isModelApplied = mlUsedForThisProperty;

    return {
      ...p,
      reasoning,
      matchScore,
      listingPrice,
      modelPredictedPrice,
      isModelApplied,
      scores: scoreBreakdown,
      scoring: {
        rule_score: ruleScore,
        ml_price_score: mlPriceScore,
        final_score: finalScore,
      },
      ml_metadata: {
        ml_used_for_property: mlUsedForThisProperty,
        predicted_price: predictedPrice,
      },
    };
  });

  // Sort by final_score descending
  enriched.sort((a, b) => {
    const af = a.scoring.final_score ?? -Infinity;
    const bf = b.scoring.final_score ?? -Infinity;
    return bf - af;
  });

  const totalProperties = enriched.length;
  const propertiesWithMl = enriched.filter((p) => p.ml_metadata.ml_used_for_property).length;

  let finalRecommendations = enriched;

  // --- hard cap: always return at most 3 recommendations ---
  if (Array.isArray(finalRecommendations)) {
    finalRecommendations = finalRecommendations.slice(0, 3);
  }
  // --- end cap ---

  const responsePayload = {
    ml_used: mlCallSucceeded && mlAnyPrediction,
    ml_fallback_detected: !!mlFallbackMessage,
    ml_fallback_message: mlFallbackMessage,
    diagnostics: {
      total_properties: totalProperties,
      properties_with_ml_scores: propertiesWithMl,
    },
    recommendations: finalRecommendations,
  };

  res.json(responsePayload);
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`ML recommender backend listening on port ${PORT}`);
});
