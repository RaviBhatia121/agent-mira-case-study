# Backend Local ML Test Guide (Case B)

Manual steps to validate the Node backend using the local ML service at `http://localhost:8000/score`.

## 1) Configure ML service URL
- Ensure the ML service is running locally (see the ML service test guide).
- Set the backend env var so it calls the local ML:
  ```bash
  export ML_SERVICE_URL="http://localhost:8000"
  ```
  (If you run via `npm run dev`, set this in the same shell/session.)

## 2) Start backend
From `case-study-B-ml-recommender/backend-node`:
```bash
npm run dev
```
Ensure it logs that it is listening (e.g., port 5001) and no ML fallback errors appear on startup.

## 3) Health check
```bash
curl -s http://localhost:5001/ | jq
```
**Passing:** Responds with a simple health payload (e.g., status/ok), not an error page.

## 4) Recommendation request (invokes ML /score)
Send a POST with sample preferences; backend will fetch properties and call the ML service:
```bash
curl -s -X POST http://localhost:5001/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 600000,
    "minBedrooms": 2,
    "maxCommuteTime": 45,
    "preferredAreas": ["New York, NY", "Miami, FL"]
  }' | jq
```

**Passing expectations:**
- `ml_fallback_detected` should be `false`.
- Each recommendation should include a numeric ML price:
  - `predicted_price` / `modelPredictedPrice` populated with a number.
  - `ml_metadata.predicted_price` populated and `ml_metadata.ml_used_for_property` true when ML applied.
  - `isModelApplied` true when a numeric prediction exists.
- Recommendations should show ML-enhanced fields (e.g., `matchScore` reflecting ML price when available).

**If failing (fallback):**
- `ml_fallback_detected` true and/or `ml_fallback_message` present.
- `predicted_price` / `modelPredictedPrice` null and `isModelApplied` false.

## 5) Notes
- Make sure the ML service at `localhost:8000/score` is up and responding before the POST above.
- If you switch to a deployed ML service, set `ML_SERVICE_URL` to that URL instead.
