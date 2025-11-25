// src/services/mlClient.js
//
// Small client wrapper around the Python FastAPI ML microservice.
// Responsibility:
//   - Map property fields → ML input payload
//   - Call /predict with a short timeout
//   - Return predicted_price (or null on failure)

const axios = require("axios");
const { ML_SERVICE_URL } = require("../config");

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

    const response = await axios.post(`${ML_SERVICE_URL}/score`, payload, {
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
 * Fetch ML predictions for an array of property objects via batch /score.
 * Returns predictions keyed by property.id → { predicted_price }, plus flags.
 */
async function getMlScoresForProperties(properties = []) {
  const scoresById = {};
  let anyPrediction = false;
  let mlUsed = false;
  let fallback = false;

  const url = ML_SERVICE_URL.endsWith("/score")
    ? ML_SERVICE_URL
    : `${ML_SERVICE_URL.replace(/\/+$/, "")}/score`;

  const payload = {
    properties,
  };

  try {
    console.log("[ML DEBUG] Calling ML service at:", url);
    const response = await axios.post(url, payload, {
      timeout: 4000, // ms – avoid hanging if ML service is down
    });
    const data = response.data || {};
    const predictions = data.predictions || {};
    mlUsed = !!data.ml_used;
    fallback = !!data.fallback;

    Object.keys(predictions).forEach((key) => {
      const entry = predictions[key];
      if (entry && typeof entry.predicted_price === "number") {
        scoresById[key] = { predicted_price: entry.predicted_price };
        anyPrediction = true;
      }
    });

    console.log(
      "[ML DEBUG] ML response:",
      JSON.stringify({ mlUsed, fallback, predictionsCount: Object.keys(scoresById).length })
    );
  } catch (err) {
    console.error(
      `[ML DEBUG] Error calling ML service at ${url}:`,
      err.message || err
    );
    // return empty scores; caller will handle fallback
  }

  return { scoresById, anyPrediction, mlUsed, fallback };
}

module.exports = {
  getPredictedPriceForProperty,
  getMlScoresForProperties,
};
