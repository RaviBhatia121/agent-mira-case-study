# ML Service Local Test Guide

Manual curl commands to sanity-check the FastAPI ML service running locally (default port 8000).

## 1) Health Check
```bash
curl -s http://localhost:8000/health | jq
```
**Passing:** JSON shows `"status": "ok"` and the `model_path`.

## 2) Single Prediction (POST /predict)
```bash
curl -s -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "bedrooms": 2,
    "bathrooms": 1,
    "size_sqft": 800,
    "school_rating": 7.5,
    "commute_time": 25,
    "property_age": 10
  }' | jq
```
**Passing:** Response includes `predicted_price` (numeric, > 0) and echoes `input_features`. If the model loaded, you should see a reasonable price estimate.

## 3) Batch Scoring (POST /score)
```bash
curl -s -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 600000,
    "min_bedrooms": 2,
    "properties": [
      {
        "id": 1,
        "bedrooms": 3,
        "bathrooms": 2,
        "size_sqft": 1500,
        "school_rating": 8.0,
        "commute_time": 30,
        "property_age": 5,
        "year_built": 2020
      },
      {
        "id": 2,
        "bedrooms": 2,
        "bathrooms": 1,
        "size_sqft": 900,
        "school_rating": 7.0,
        "commute_time": 20,
        "property_age": 15
      }
    ]
  }' | jq
```
**Passing:** Response structure:
```json
{
  "predictions": {
    "1": { "predicted_price": <number> },
    "2": { "predicted_price": <number> }
  },
  "ml_used": true,
  "fallback": false
}
```
`predicted_price` values should be numeric and present for each property id. `ml_used` should be `true` when the model is loaded; `fallback` should be `false` in that case. If the model failed to load, `ml_used` may be false and `fallback` true (still acceptable for fallback mode).
