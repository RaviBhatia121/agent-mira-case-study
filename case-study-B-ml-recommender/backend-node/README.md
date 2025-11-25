# Backend Node Service – Case Study B

This service:
- Loads & merges property JSON data sources.
- Calls the Python ML microservice for price prediction.
- Applies scoring logic (0–100 weighted model).
- Generates human-readable reasoning.
- Returns Top 3 recommendations.

Node.js backend that:
- Serves APIs to the frontend
- Talks to the ML service (Python) for recommendations
- Loads scoring rules from `data/` where applicable

## How to Run

```bash
cd case-study-B-ml-recommender/backend-node
npm install
npm start   # or node src/server.js

## Environment variables

Local development:
- `PORT` (default: 5001)
- `ML_SERVICE_URL` (default: `http://localhost:8000`)

Render:
- `PORT` is set automatically by Render.
- Set `ML_SERVICE_URL` to the deployed ML service base URL, e.g. `https://<your-ml-service>.onrender.com`. The backend will normalize this and call the `/score` endpoint.

Structure:
- `/src/server.js` – main service
- `/src/services/mlClient.js` – ML API client
- `/src/utils/scoring.js` – scoring utilities
- `/src/utils/reasoning.js` – reasoning generator
