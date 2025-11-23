# ML Service (FastAPI) – Case Study B

FastAPI microservice used to simulate ML price prediction.

Features:
- POST `/predict` endpoint receives property features.
- Attempts to load the provided pickled model.
- If the real pickle cannot be loaded, falls back to a safe heuristic model.
- Returns: `{ predicted_price, input_features }`

# Case Study B – ML Service (Python)

Python microservice that:
- Loads ML model / rules
- Exposes a REST API consumed by the Node backend

## How to Run

```bash
cd case-study-B-ml-recommender/ml-service-python
# e.g.
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

This mimics a real ML service integration in production.