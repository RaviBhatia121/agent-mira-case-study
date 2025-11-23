# Agent Mira – Real Estate Chatbot (Case A)

## 1. Overview
Agent Mira Case A is a lightweight real estate chatbot. It accepts natural-language queries (budget, bedrooms, preferred locations), runs them through a small NLP layer, filters properties using the shared utilities from Case B, and returns the top matches. It supports saving properties to MongoDB (Atlas), with graceful fallback when persistence is disabled.

## 2. Features
- Chatbot UI (React) with chat transcript and property cards
- NLP parsing for budget, bedrooms (BHK), and locations (compromise + regex)
- Property lookup using shared Case B filters and data
- MongoDB save-property support (Atlas-ready)
- Graceful fallback when MongoDB is not connected (persistenceEnabled flag)
- Top 3 property matching and scoring
- API-driven chat responses from the Node backend

## 3. Tech Stack
- **Backend:** Node.js, Express, MongoDB Atlas, Mongoose, compromise (NLP)
- **Frontend:** React (Vite), CSS
- **Shared:** Case B common utilities (dataLoader, propertyJoiner, filtering, scoring, reasoning)

## 4. Folder Structure
- `case-study-A-chatbot/backend-node` – Case A backend (Express + MongoDB)
- `case-study-A-chatbot/frontend-react` – Case A React frontend (Vite)
- `common/utils` – Shared helpers (loaded by both Case A/B)
- `case-study-B-ml-recommender/backend-node/data` – JSON data source reused by Case A

## 5. Setup Instructions
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd agent-mira-case-study
   ```
2. Backend setup:
   ```bash
   cd case-study-A-chatbot/backend-node
   npm install
   ```
3. Create `.env` in `backend-node` with:
   ```env
   MONGODB_URI="mongodb+srv://agentmira_user:agentmira@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
   ```
4. Start backend (port 5002):
   ```bash
   npm run dev     # or npm start
   ```
5. Frontend setup:
   ```bash
   cd ../frontend-react
   npm install
   npm run dev     # Vite (defaults to 5173; may auto-pick 5174 if busy)
   ```

## 6. Running Locally
- **Backend (from `case-study-A-chatbot/backend-node`):**
  ```bash
  npm run dev
  # logs: "Case A chatbot backend listening on port 5002"
  ```
- **Frontend (from `case-study-A-chatbot/frontend-react`):**
  ```bash
  npm run dev -- --port 5173
  # open http://localhost:5173 (or the port Vite prints)
  ```
- **Test API via curl:**
  ```bash
  # Get properties
  curl -s http://localhost:5002/properties | head

  # Chat message
  curl -s -X POST http://localhost:5002/message \
    -H "Content-Type: application/json" \
    -d '{"message":"Looking for 2 BHK in Miami under 600k"}'

  # Save property
  curl -s -X POST http://localhost:5002/save-property \
    -H "Content-Type: application/json" \
    -d '{"userId":"demo","propertyId":2}'
  ```

## 7. API Documentation
- **POST `/message`**
  - Body: `{ "message": "string" }`
  - Response: `{ reply: string, matches: [...], parsedPreferences: {...} }`
- **GET `/properties`**
  - Returns: Array of joined property objects (id, title, price, location, bedrooms, bathrooms, size_sqft, amenities, image_url).
- **POST `/save-property`**
  - Body: `{ "userId": "string", "propertyId": number|string }`
  - Response: `{ success: boolean, persistenceEnabled?: boolean, savedProperty?: {...}, error?: string }`

## 8. MongoDB Notes
- If `MONGODB_URI` is missing or the connection fails, the backend returns `persistenceEnabled: false` so saves do not persist.
- SavedProperty schema:
  - userId: String
  - propertyId: Number/String
  - title, price, location
  - bedrooms, bathrooms, size_sqft
  - createdAt: Date (default now)

## 9. Deployment Notes (placeholder)
- Deployment instructions to be added (e.g., Atlas + hosted frontend).

## 10. Screenshots (placeholder)
- Add UI screenshots when ready.
