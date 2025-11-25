# Case B Environment Setup (Local & Render)

This project is configurable via environment variables so you can switch between local and Render without code changes.

## Local Development

1) Start ML service (port 8000)
```bash
cd case-study-B-ml-recommender/ml-service-python
uvicorn main:app --reload --port 8000
```

2) Backend (port 5001 by default)
```bash
cd case-study-B-ml-recommender/backend-node
cp .env.example .env.local  # or .env
# ensure ML_SERVICE_URL=http://localhost:8000
npm run dev
```

3) Frontend (port 5173/5174)
```bash
cd case-study-B-ml-recommender/frontend-react
cp .env.example .env.local  # or .env
# ensure VITE_BACKEND_BASE=http://localhost:5001
npm run dev
```

## Render Deployment (example values)

- Backend service env:
  - `PORT` (e.g. 10000)
  - `ML_SERVICE_URL=https://<your-ml-service>.onrender.com`
- ML service: deploy normally (default port 8000); no code change needed.
- Frontend service env:
  - `VITE_BACKEND_BASE=https://<your-backend>.onrender.com`

No URLs are hardcoded in code; switching environments is done purely via env vars.
