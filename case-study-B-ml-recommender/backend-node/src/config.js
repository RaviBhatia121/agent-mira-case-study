// Centralized configuration for Case B backend
// Read values from environment with sensible local defaults.

const BACKEND_PORT = process.env.PORT || 5001;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

module.exports = {
  BACKEND_PORT,
  ML_SERVICE_URL,
};
