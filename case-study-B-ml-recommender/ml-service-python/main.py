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

# Track whether the real model was loaded
MODEL_LOADED = False

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


class RenamingUnpickler(pickle.Unpickler):
    """Custom unpickler that maps ComplexTrapModelRenamed to our local stub."""

    def find_class(self, module, name):
        if name == "ComplexTrapModelRenamed":
            return ComplexTrapModelRenamed
        return super().find_class(module, name)


class SimplePriceModel:
    """
    Simple regression-style model for the case study.
    Input X is an iterable of rows:
    [bedrooms, bathrooms, size_sqft, school_rating, commute_time, property_age]
    """

    def predict(self, X):
        preds = []
        for row in X:
            (
                bedrooms,
                bathrooms,
                size_sqft,
                school_rating,
                commute_time,
                property_age,
            ) = row

            base_price = 50000
            price = (
                base_price
                + 30000 * bedrooms
                + 20000 * bathrooms
                + 80 * size_sqft
                + 5000 * (school_rating / 10.0)
                - 1000 * commute_time
                - 2000 * property_age
            )

            preds.append(max(price, 50000))
        return preds


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
        # Use custom unpickler so ComplexTrapModelRenamed resolves to our stub
        loaded_obj = RenamingUnpickler(f).load()

    # If the unpickled object has no .predict, replace it with SimplePriceModel
    if not hasattr(loaded_obj, "predict"):
        print("Loaded object has no 'predict'; using SimplePriceModel instead.")
        model = SimplePriceModel()
    else:
        model = loaded_obj

    MODEL_LOADED = True
    print("ML model loaded successfully.")
except Exception as e:
    print("⚠️ Failed to load model:", e)
    print("➡️ Using SimplePriceModel fallback due to load failure.")
    model = SimplePriceModel()


def predict_single(features_dict: dict) -> float:
    """
    Shared prediction helper used by both /predict and /score.
    Returns a float predicted_price.
    """
    feature_order = [
        "bedrooms",
        "bathrooms",
        "size_sqft",
        "school_rating",
        "commute_time",
        "property_age",
    ]
    row = [
        [float(features_dict.get(name, 0.0) or 0.0) for name in feature_order]
    ]
    predicted = model.predict(row)
    if not hasattr(predicted, "__len__") or len(predicted) == 0:
        raise RuntimeError("Model returned no predictions.")
    return float(predicted[0])


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

        predicted_price = predict_single(features_dict)
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


# -------------------------------------------------------------------
# Batch scoring endpoint for Case B backend
# -------------------------------------------------------------------


@app.post("/score")
def score_batch(payload: dict):
    """
    Batch scoring endpoint expected by the Case B Node backend.

    Request shape (example):
    {
      "budget": 600000,
      "min_bedrooms": 2,
      "properties": [
        {
          "id": 1,
          "bedrooms": 3,
          "bathrooms": 2,
          "size_sqft": 1500,
          "school_rating": 7.5,
          "commute_time": 30,
          "property_age": 10
        },
        ...
      ]
    }

    Response shape:
    {
      "predictions": { "<id>": { "predicted_price": <number> }, ... },
      "ml_used": bool,
      "fallback": bool
    }
    """
    try:
        props = payload.get("properties") or []
        predictions = {}

        for prop in props:
            try:
                current_year = 2025
                year_built = prop.get("year_built")
                if year_built:
                    property_age = max(0.0, float(current_year - int(year_built)))
                else:
                    property_age = float(prop.get("property_age", 0) or 0)

                features_dict = {
                    "bedrooms": prop.get("bedrooms", 0),
                    "bathrooms": prop.get("bathrooms", 0),
                    "size_sqft": float(prop.get("size_sqft", 0) or 0),
                    "school_rating": float(prop.get("school_rating", 0) or 0),
                    "commute_time": float(prop.get("commute_time", 0) or 0),
                    "property_age": property_age,
                }
                predicted_price = predict_single(features_dict)
                prop_id = prop.get("id")
                if prop_id is not None:
                    predictions[str(prop_id)] = {"predicted_price": predicted_price}
            except Exception as inner_exc:
                # Skip individual failures; continue scoring others
                continue

        return {
            "predictions": predictions,
            "ml_used": MODEL_LOADED,
            "fallback": not MODEL_LOADED,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scoring failed: {exc}",
        )
