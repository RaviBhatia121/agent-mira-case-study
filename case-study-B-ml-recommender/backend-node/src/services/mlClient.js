// src/services/mlClient.js
//
// Small client wrapper around the Python FastAPI ML microservice.
// Responsibility:
//   - Map property fields → ML input payload
//   - Call /predict with a short timeout
//   - Return predicted_price (or null on failure)

const axios = require("axios");

// ML service endpoint (can be overridden via env variable)
const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000/predict";

/**
 * Call the ML service for a single property and return predicted_price.
 * If anything fails, we return null and let the scoring layer handle fallback.
 */
async function getPredictedPriceForProperty(property) {
  try {
    const payload = {
      price: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      size_sqft: property.size_sqft,
      school_rating: property.school_rating,
      commute_time: property.commute_time,
      property_age: property.property_age,
    };

    const response = await axios.post(ML_SERVICE_URL, payload, {
      timeout: 2000, // ms – avoid hanging if ML service is down
    });

    const predictedPrice = response.data?.predicted_price;
    return typeof predictedPrice === "number" ? predictedPrice : null;
  } catch (err) {
    console.error(
      `⚠️ Error calling ML service for property id=${property.id}:`,
      err.message
    );
    return null;
  }
}

/**
 * Fetch ML predictions for an array of property objects.
 * Returns an object keyed by property.id → { predicted_price }.
 */
async function getMlScoresForProperties(properties = []) {
  const scoresById = {};
  let anyPrediction = false;

  await Promise.all(
    properties.map(async (property) => {
      const predictedPrice = await getPredictedPriceForProperty(property);
      if (typeof predictedPrice === "number" && property.id != null) {
        scoresById[property.id] = { predicted_price: predictedPrice };
        anyPrediction = true;
      }
    })
  );

  return { scoresById, anyPrediction };
}

module.exports = {
  getPredictedPriceForProperty,
  getMlScoresForProperties,
};
