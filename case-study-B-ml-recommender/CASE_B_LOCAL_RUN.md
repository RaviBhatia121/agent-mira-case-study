# Case B Local Run Guide (ML Recommender)

This project runs in three parts: ML service (Python), backend (Node), frontend (Vite React). Configure everything via env vars—no code edits needed to switch between local and Render.

## Directory Layout
```
<repo-root>/
  case-study-B-ml-recommender/
    ml-service-python/
    backend-node/
    frontend-react/
```

## Local Run (three terminals)

### 1. Start the ML service (Python)

cd case-study-B-ml-recommender/ml-service-python
source venv/bin/activate   # if using venv
uvicorn main:app --reload --port 8000

# ML is now available at:
# http://localhost:8000

### 2. Start the Node backend

cd case-study-B-ml-recommender/backend-node
export ML_SERVICE_URL=http://localhost:8000
npm install
npm run dev

# Backend listens on http://localhost:5001
# It calls the ML service using ML_SERVICE_URL/score

### 3) Start frontend (Vite, port 5173/5174)
```bash
cd case-study-B-ml-recommender/frontend-react
cp .env.example .env  # or .env.local
# ensure VITE_BACKEND_BASE=http://localhost:5001
npm install
npm run dev
```
App should be at http://localhost:5173 (or 5174 if 5173 is taken).

### 4) Test end-to-end (backend → ML)
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
Passing indicators:
- `ml_used: true`
- `ml_fallback_detected: false`
- Each recommendation has `modelPredictedPrice` numeric, `isModelApplied: true`, and `ml_metadata.predicted_price` numeric with `ml_used_for_property: true`.

## Render Deployment (summary)

- ML service:
  - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Health: GET `/health`
- Backend:
  - Start: `npm start` (or `node src/server.js`)
  - Env: `ML_SERVICE_URL=https://<your-ml-service>.onrender.com` (Render sets `PORT` automatically)
- Frontend:
  - Build: `npm run build`
  - Env: `VITE_BACKEND_BASE=https://<your-backend>.onrender.com`
  - In production, the Case B frontend calls the backend at https://agent-mira-case-b-backend.onrender.com (URL currently configured in the frontend).

See `.env.example` in each service directory for ready-to-copy values.

> ⚠️ IMPORTANT: The backend defaults to ML_SERVICE_URL=http://localhost:8000.
> If you run the ML service on ANY other port, you must export ML_SERVICE_URL accordingly,
> or the backend will fall back to rule-only scoring.
