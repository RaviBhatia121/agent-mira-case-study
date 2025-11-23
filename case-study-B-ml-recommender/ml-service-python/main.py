"""
FastAPI microservice for Agent Mira Case Study – Price Prediction

This service exposes a single POST /predict endpoint that takes in
basic property features (bedrooms, bathrooms, size, school rating,
commute time, property age) and returns a predicted_price.

Key ideas:
- In the real world, we would load and use the provided
  `complex_price_model_v2.pkl` model directly.
- For this case study implementation, we *attempt* to load the model
  file to show integration, but to keep things safe and portable we
  use a small heuristic "PriceModel" wrapper to generate predictions.
- The Node.js backend treats this service as a black box model:
    input  → /predict  → predicted_price
"""

from pathlib import Path
from typing import List

import pickle
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "complex_price_model_v2.pkl"

app = FastAPI(
    title="Agent Mira Price Prediction Service",
    description=(
        "Lightweight FastAPI service that predicts property prices "
        "given basic features. Used by the Node.js recommender backend."
    ),
    version="1.0.0",
)

# Stub class so pickle can resolve this type when loading the provided model
class ComplexTrapModelRenamed:
    """Stub class so pickle can resolve this type; real attributes are loaded from the .pkl file."""
    pass


# -------------------------------------------------------------------
# Pydantic models – request & response schema
# -------------------------------------------------------------------

class PredictionRequest(BaseModel):
    """
    Input features for price prediction.

    These are kept deliberately simple and aligned with what the
    Node.js backend sends when scoring properties.
    """
    bedrooms: int = Field(..., ge=0, description="Number of bedrooms")
    bathrooms: int = Field(..., ge=0, description="Number of bathrooms")
    size_sqft: float = Field(..., gt=0, description="Built-up area in square feet")
    school_rating: float = Field(
        ...,
        ge=0,
        le=10,
        description="School rating on a 0–10 scale (higher is better)",
    )
    commute_time: float = Field(
        ...,
        ge=0,
        description="Approximate commute time in minutes",
    )
    property_age: float = Field(
        ...,
        ge=0,
        description="Age of the property in years",
    )


class PredictionResponse(BaseModel):
    """
    Response returned to the caller (Node.js backend).

    - predicted_price: numeric price estimate in dollars
    - input_features: the same features echoed back for transparency
    """
    predicted_price: float
    input_features: dict


# -------------------------------------------------------------------
# Model loading with resilient fallback
# -------------------------------------------------------------------

try:
    with MODEL_PATH.open("rb") as f:
        model = pickle.load(f)
    print("Model loaded successfully.")
except Exception as e:
    print("⚠️ Failed to load model:", e)
    print("➡️ Using fallback price model.")

    class FallbackModel:
        def predict(self, features):
            """
            Accepts either a single dict of features or a list/DF-like
            structure with at least one row containing the expected keys.
            """
            # Normalize to a single dict
            if isinstance(features, list):
                if not features:
                    return [0]
                maybe_first = features[0]
                if isinstance(maybe_first, dict):
                    features = maybe_first
                elif isinstance(maybe_first, (list, tuple)) and len(maybe_first) >= 6:
                    # Ordered list fallback: [bedrooms, bathrooms, size_sqft, school_rating, commute_time, property_age]
                    features = {
                        "bedrooms": maybe_first[0],
                        "bathrooms": maybe_first[1],
                        "size_sqft": maybe_first[2],
                        "school_rating": maybe_first[3],
                        "commute_time": maybe_first[4],
                        "property_age": maybe_first[5],
                    }
                else:
                    features = {}
            elif not isinstance(features, dict):
                features = {}

            price = (
                200000
                + features.get("bedrooms", 0) * 50000
                + features.get("bathrooms", 0) * 30000
                + features.get("size_sqft", 0) * 150
            )
            return [price]

    model = FallbackModel()


# -------------------------------------------------------------------
# FastAPI endpoints
# -------------------------------------------------------------------

@app.get("/health")
def health_check() -> dict:
    """
    Lightweight health check endpoint.

    Used by:
    - Local developer sanity checks
    - (In a real deployment) k8s liveness/readiness probes
    """
    return {
        "status": "ok",
        "service": "price-prediction",
        "model_path": str(MODEL_PATH),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict_price(payload: PredictionRequest):
    """
    Predict the property price for given features.

    This is the ONLY contract the Node.js recommender cares about:
    - It sends a JSON body matching PredictionRequest
    - It receives a JSON with a single `predicted_price` field

    If anything goes wrong (e.g., model failure), we raise a 500 error
    and let the Node.js side decide how to degrade gracefully.
    """
    try:
        features_dict = {
            "bedrooms": payload.bedrooms,
            "bathrooms": payload.bathrooms,
            "size_sqft": float(payload.size_sqft),
            "school_rating": float(payload.school_rating),
            "commute_time": float(payload.commute_time),
            "property_age": float(payload.property_age),
        }

        predicted_list = model.predict(features_dict)
        if not predicted_list:
            raise RuntimeError("Model returned no predictions.")

        predicted_price = float(predicted_list[0])

        return PredictionResponse(
            predicted_price=predicted_price,
            input_features=features_dict,
        )

    except HTTPException:
        # Re-raise explicit HTTPExceptions as-is
        raise
    except Exception as exc:
        # Generic error handling – this is where we'd hook logging/monitoring
        # in a production setup (e.g., Sentry, CloudWatch, Datadog).
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {exc}",
        )
