# Agent Mira – Case Study Solutions (A & B)

This repository contains my implementations for the **Agent Mira technical case studies**:

- **Case Study A – Chatbot for Property Discovery**
- **Case Study B – ML-Powered Price & Recommendation Service**

The goal is to show:
- Practical full-stack skills (Node.js, React, Vite)
- Clean separation between UI, backend, and ML service
- Reuse of shared business logic across both cases
- Production-aware touches (MongoDB, env config, graceful degradation)

---

## 1. Tech Stack

### Common
- **Node.js**, **Express**
- **Shared JS utils** under `common/utils`:
  - `dataLoader.js`, `filtering.js`, `propertyJoiner.js`, `reasoning.js`, `scoring.js`, `types.js`

### Case Study A (Chatbot)
- **Backend:** Node.js + Express (`case-study-A-chatbot/backend-node`)
- **Frontend:** React + Vite (`case-study-A-chatbot/frontend-react`)
- **Database:** MongoDB Atlas (for saved properties), via **Mongoose**

### Case Study B (ML Recommender)
- **ML Service:** Python + FastAPI (`case-study-B-ml-recommender/ml-service-python`)
- **Backend:** Node.js + Express (`case-study-B-ml-recommender/backend-node`)
- **Frontend:** React + Vite (`case-study-B-ml-recommender/frontend-react`)
- **Model:** Pre-trained price model (`model/complex_price_model_v2.pkl`)

---

## 2. Repository Structure

```text
.
├── case-study-A-chatbot
│   ├── README.md                  # (optional: case-specific notes)
│   ├── backend-node
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── server.js          # Express app, mounts Case A routes
│   │   │   ├── config
│   │   │   │   └── db.js          # MongoDB connection (caseA db)
│   │   │   ├── models
│   │   │   │   └── SavedProperty.js
│   │   │   ├── routes
│   │   │   │   └── chatRoutes.js  # /message, /properties, /save-property
│   │   │   └── services
│   │   │       └── nlp.js         # Simple text → preferences parser
│   └── frontend-react
│       ├── package.json
│       ├── vite.config.js
│       └── src
│           ├── main.jsx
│           ├── App.jsx            # Chat UI, property cards, Save button
│           └── App.css
│
├── case-study-B-ml-recommender
│   ├── backend-node
│   │   ├── package.json
│   │   └── src
│   │       ├── server.js          # Express API consuming ML service
│   │       └── utils
│   │           ├── scoring.js
│   │           ├── reasoning.js
│   │           └── mlClient.js    # HTTP client to Python FastAPI
│   ├── frontend-react
│   │   ├── package.json
│   │   └── src
│   │       ├── App.jsx            # Case B UI
│   │       ├── App.css
│   │       ├── index.css
│   │       └── data/areas.json
│   └── ml-service-python
│       ├── main.py                # FastAPI app exposing ML endpoints
│       ├── requirements.txt
│       └── model
│           └── complex_price_model_v2.pkl
│
├── common
│   └── utils                      # Shared business logic between A & B
│       ├── dataLoader.js
│       ├── filtering.js
│       ├── propertyJoiner.js
│       ├── reasoning.js
│       ├── scoring.js
│       └── types.js
│
├── .gitignore
└── README.md                      # You are here


⸻

3. Case Study A – Chatbot for Property Discovery

3.1. Features
	•	Natural language query parsing, e.g.
“Looking for 2 BHK in Miami under 600k”
	•	Extracts:
	•	Budget (600000)
	•	Bedrooms (minBedrooms = 2)
	•	Location (["Miami"])
	•	Uses shared filtering & scoring from common/utils to:
	•	Filter from static property JSON (reused from Case B data)
	•	Rank matches
	•	Return top N candidates with simple reasoning
	•	Frontend UI
	•	Chat interface (user and bot bubbles)
	•	Property cards for matches
	•	Save this property button
	•	Saved Properties panel showing saved items
	•	Persistence
	•	Saves properties to MongoDB Atlas via SavedProperty model
	•	Degrades gracefully when DB is not connected (returns persistenceEnabled: false)

⸻

3.2. Running Case A – Backend (Node, port 5002)

From repo root:

cd case-study-A-chatbot/backend-node
npm install

Create .env in case-study-A-chatbot/backend-node:

MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-host>/?appName=Cluster0"

In my local setup this is e.g.:

MONGODB_URI="mongodb+srv://agentmira_user:agentmira@cluster0.g3xixmm.mongodb.net/?appName=Cluster0"

Then start the backend:

npm run dev

You should see logs similar to:

Case A DATA_DIR: .../case-study-B-ml-recommender/backend-node/data
Case A chatbot backend listening on port 5002
Connected to MongoDB (caseA)

Key Endpoints
	•	GET /properties
Returns the static property catalog as JSON.
	•	POST /message
Request body:

{
  "message": "Looking for 2 BHK in Miami under 600k"
}

Response (shape):

{
  "reply": "I found 1 home(s) matching your preferences. For example, ...",
  "matches": [
    {
      "id": 2,
      "title": "2 BHK Condo with Sea View",
      "price": 380000,
      "location": "Miami, FL",
      "amenities": [],
      "matchScore": 36,
      "reasoning": ""
    }
  ],
  "parsedPreferences": {
    "budget": 600000,
    "minBedrooms": 2,
    "preferredLocations": ["Miami"],
    "amenities": [],
    "rawText": "Looking for 2 BHK in Miami under 600k"
  }
}


	•	POST /save-property
Request body:

{
  "userId": "demo",
  "propertyId": 2
}

Response when DB is connected:

{
  "success": true,
  "savedProperty": { ... },
  "persistenceEnabled": true
}

When DB is not connected, it responds with:

{
  "success": false,
  "error": "MongoDB not connected",
  "persistenceEnabled": false
}



⸻

3.3. Running Case A – Frontend (React + Vite, port 5173/5174)

From repo root:

cd case-study-A-chatbot/frontend-react
npm install
npm run dev

Vite will start (e.g. on http://localhost:5173 or http://localhost:5174).

The frontend is wired to call the backend at:

const API_BASE = "http://localhost:5002";

Make sure the Case A backend is running first.

⸻

4. Case Study B – ML Recommender (Overview)

Note: Core Case B implementation is present & runnable; polishing and extended UX can be layered on later.

4.1. Components
	•	ML Service (Python/FastAPI)
	•	Loads model/complex_price_model_v2.pkl
	•	Exposes prediction/recommendation endpoints (e.g. price estimate, top N similar properties)
	•	Backend Node API
	•	Calls the ML service via mlClient.js
	•	Applies scoring + reasoning from shared common/utils
	•	Frontend React
	•	Allows selection of areas, budget, key preferences
	•	Displays ML-powered suggestions (price & ranking)

⸻

4.2. Running Case B – ML Service (Python, default port 8001)

From repo root:

cd case-study-B-ml-recommender/ml-service-python

# Create and activate virtualenv (example for macOS/Linux)
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

Start the FastAPI service:

uvicorn main:app --reload --port 8001


⸻

4.3. Running Case B – Backend (Node, e.g. port 5003)

From repo root:

cd case-study-B-ml-recommender/backend-node
npm install
npm run dev

The backend will call the Python ML service at http://localhost:8001 (config inside mlClient.js).

⸻

4.4. Running Case B – Frontend (React + Vite)

From repo root:

cd case-study-B-ml-recommender/frontend-react
npm install
npm run dev

This starts the Case B frontend on its own Vite dev port (e.g. http://localhost:5173 or 5174).

⸻

5. Environment & Local Setup Notes
	•	Node versions: Tested with Node ≥ 18.
	•	Python: Tested with Python 3.x (FastAPI + Uvicorn).
	•	MongoDB:
	•	Case A expects a valid MONGODB_URI in .env.
	•	If unset or unreachable, backend and frontend still work; only the “Save property” feature reports persistenceEnabled: false and shows a non-blocking banner.

⸻

6. Testing Snippets (Quick sanity checks)

From repo root:

# Case A – list properties
curl -s http://localhost:5002/properties | jq '.[:2]'

# Case A – chatbot query
curl -s -X POST http://localhost:5002/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Looking for 2 BHK in Miami under 600k"}' | jq

# Case A – save property
curl -s -X POST http://localhost:5002/save-property \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo","propertyId":2}' | jq


⸻

7. Notes & Possible Extensions

If time permits, natural next steps:
	•	Add more robust NLP (entity extraction, intent classification)
	•	Add Jest tests for shared utils and route handlers
	•	Add docker-compose for end-to-end local spin-up (Node + Python + Mongo)
	•	Harden production configuration (CORS, rate limiting, logging)

For the current submission, all core flows are wired and working:
	•	Case A: Chat → Parsed preferences → Filter + score → Property cards → Save to MongoDB
	•	Case B: Inputs → ML price model → Scoring → UI suggestions