import React, { useState } from "react";
import "./App.css";

// Backend base URL for Case B recommender.
// In production we’ll set VITE_API_BASE via Render; locally it falls back to the current localhost URL.
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5001";

const AVAILABLE_AREAS = [
  "Austin, TX",
  "Boston, MA",
  "Chicago, IL",
  "Dallas, TX",
  "Los Angeles, CA",
  "Miami, FL",
  "New York, NY",
  "San Francisco, CA",
  "Seattle, WA",
  "Others",
];

const formatUsd = (value) => {
  if (value == null || isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

function App() {
  const [budget, setBudget] = useState("");
  const [minBedrooms, setMinBedrooms] = useState(2);
  const [maxCommuteTime, setMaxCommuteTime] = useState(45);
  const [preferredAreas, setPreferredAreas] = useState(["Austin, TX"]);

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState(null);
  const [diagnostics, setDiagnostics] = useState({});
  const [mlStatus, setMlStatus] = useState({
    mlUsed: false,
    fallbackDetected: false,
    message: null,
  });
  const [showDebug, setShowDebug] = useState(false);

  const handleAreaChange = (area) => {
    setPreferredAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRecommendations([]);

    try {
      const resp = await fetch(`${API_BASE}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: budget ? Number(budget) : null,
          minBedrooms: minBedrooms ? Number(minBedrooms) : null,
          maxCommuteTime: maxCommuteTime ? Number(maxCommuteTime) : null,
          preferredAreas,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Backend error: ${resp.status}`);
      }

      const data = await resp.json();
      setRawResponse(data);
      setMlStatus({
        mlUsed: Boolean(data.ml_used),
        fallbackDetected: Boolean(data.ml_fallback_detected),
        message: data.ml_fallback_message || null,
      });
      setDiagnostics(data.diagnostics || {});

      // Combine top recommendations from backend into a single list
      const combined = data.topRecommendations || data.recommendations || [];

      const normalized = combined.map((p, idx) => {
        const listingPrice =
          p.price ?? p.listingPrice ?? p.listing_price ?? p.listingPriceUsd ?? null;

        const predictedPrice =
          p.predicted_price ?? p.modelPredictedPrice ?? p.ml_predicted_price ?? null;

        const matchScore =
          p.matchScore != null
            ? Number(p.matchScore)
            : p.scores?.totalScore != null
            ? Number(p.scores.totalScore.toFixed(2))
            : null;

        return {
          id: p.id ?? idx + 1,
          title: p.title ?? "",
          location: p.location || [p.city, p.state].filter(Boolean).join(", "),
          price: listingPrice,
          predicted_price: predictedPrice,
          matchScore,
          reasoning: p.reason ?? p.reasoning ?? null,
          scores: p.scores ?? null,
          ml_metadata: p.ml_metadata ?? null,
          bedrooms: p.bedrooms ?? null,
          bathrooms: p.bathrooms ?? null,
          size_sqft: p.size_sqft ?? null,
          amenities: Array.isArray(p.amenities) ? p.amenities : [],
          image_url: p.image_url ?? p.imageUrl ?? null,
          isModelApplied:
            typeof p.isModelApplied === "boolean"
              ? p.isModelApplied
              : Boolean(predictedPrice),
          listingPrice,
          modelPredictedPrice: predictedPrice,
          mlInputs: p.mlInputs || p.ml_inputs || null,
        };
      });

      setRecommendations(normalized);
    } catch (err) {
      console.error(err);
      setError(
        "Something went wrong while fetching recommendations. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <header className="page-header">
        <h1>Property Matchmaker (Case Study B)</h1>
        <p>
          A small agent that ranks properties using rules + ML scoring.
        </p>
      </header>

      <main className="app-grid">
        {/* LEFT: TELL YOUR PREFERENCES */}
        <section className="preferences-card">
          <h2>Tell us your preferences</h2>

          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <span className="field-label">Budget ($)</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 60000"
              />
              <span className="field-help">
                Optional – leave blank if you’re not sure about budget yet.
              </span>
            </label>

            <label className="field">
              <span className="field-label">Minimum Bedrooms</span>
              <input
                type="number"
                value={minBedrooms}
                onChange={(e) => setMinBedrooms(e.target.value)}
                placeholder="2"
              />
            </label>

            <label className="field">
              <span className="field-label">Max Commute Time (minutes)</span>
              <input
                type="number"
                value={maxCommuteTime}
                onChange={(e) => setMaxCommuteTime(e.target.value)}
                placeholder="e.g. 45"
              />
            </label>

            <div className="field">
              <span className="field-label">Preferred Areas</span>
              <div className="chip-container">
                {AVAILABLE_AREAS.map((area) => (
                  <button
                    type="button"
                    key={area}
                    className={
                      preferredAreas.includes(area)
                        ? "chip chip-selected"
                        : "chip"
                    }
                    onClick={() => handleAreaChange(area)}
                  >
                    {area}
                  </button>
                ))}
              </div>
              <span className="selected-text">
                Selected:{" "}
                {preferredAreas.length
                  ? preferredAreas.join(", ")
                  : "None yet"}
              </span>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Finding..." : "Get Recommendations"}
            </button>
          </form>
        </section>

        {/* RIGHT: RECOMMENDATIONS */}
        <section className="recommendations-card">
          <div className="section-header">
            <h2>Recommended Properties</h2>
            <label className="debug-toggle">
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.target.checked)}
              />
              Debug view
            </label>
          </div>

          {(() => {
            const totalProperties = diagnostics?.total_properties ?? 0;
            const mlScoredCount =
              diagnostics?.properties_with_ml_scores ?? 0;

            let mlBannerText = null;

            if (mlStatus.fallbackDetected) {
              mlBannerText =
                mlStatus.message ||
                "Remote ML service unavailable; using rule-based scoring only.";
            } else if (mlScoredCount === 0) {
              mlBannerText =
                "Using rule-based scoring only (ML predictions not applied).";
            } else if (mlScoredCount === totalProperties && totalProperties > 0) {
              mlBannerText = "ML scoring used for all properties.";
            } else if (mlScoredCount > 0) {
              mlBannerText = "ML scoring used for some properties.";
            }

            if (!mlBannerText) return null;

            return (
              <div className="ml-status-banner">
                {mlBannerText}
              </div>
            );
          })()}

          {error && <p className="error-text">{error}</p>}

          {loading && (
            <p className="muted">
              Talking to backend &amp; ML model. Please wait…
            </p>
          )}

          {!loading && !error && recommendations.length === 0 && (
            <p className="muted">
              No recommendations yet. Fill the form and click
              {" “Get Recommendations”. "}
            </p>
          )}

          {recommendations.map((prop, index) => (
            <div key={prop.id} className="result-item">
              <h3>#{index + 1}</h3>
              <p className="prop-title">{prop.title || "Untitled property"}</p>
              <p className="prop-location">
                {prop.location || "Unknown location"}
              </p>

              {!mlStatus.fallbackDetected && prop.isModelApplied && (
                <p className="ml-badge">AI Model Applied</p>
              )}

              {prop.matchScore != null && (
                <p className="match-score">
                  <strong>Match Score:</strong> {prop.matchScore} / 100
                </p>
              )}

              <p>
                <strong>Listing Price</strong>
                <br />
                {formatUsd(prop.price)}
              </p>

              <p>
                <strong>ML Predicted Fair Price</strong>
                <br />
                {prop.predicted_price != null
                  ? formatUsd(prop.predicted_price)
                  : "N/A"}
              </p>

              {(() => {
                const mlInputs = prop.mlInputs;
                const hasMlInputs = Array.isArray(mlInputs)
                  ? mlInputs.length > 0
                  : mlInputs && Object.keys(mlInputs).length > 0;

                if (!hasMlInputs) return null;

                return (
                  <details className="ml-inputs">
                    <summary>Show ML Inputs</summary>
                    <pre>{JSON.stringify(mlInputs, null, 2)}</pre>
                  </details>
                );
              })()}

              <div className="match-reasoning">
                <p className="match-reasoning-title">Why this match:</p>
                <p className="match-reasoning-text">
                  {mlStatus.fallbackDetected
                    ? "Using rule-based scores only; detailed ML explanation not available."
                    : prop.reasoning || "Reasoning not available for this property."}
                </p>
                {prop.isFallbackSuggestion && (
                  <p className="match-reasoning-fallback">
                    This property is a secondary recommendation because fewer ML matches were
                    available. It is shown as a close alternative based on rule-based scoring.
                  </p>
                )}
              </div>

              {prop.scores && (
                <details className="score-breakdown">
                  <summary>Score Breakdown</summary>
                  <ul>
                    <li>Price Match Score: {prop.scores.priceMatchScore ?? "N/A"}</li>
                    <li>Bedroom Score: {prop.scores.bedroomScore ?? "N/A"}</li>
                    <li>School Rating Score: {prop.scores.schoolRatingScore ?? "N/A"}</li>
                    <li>Commute Score: {prop.scores.commuteScore ?? "N/A"}</li>
                    <li>
                      Property Age Score: {prop.scores.propertyAgeScore ?? "N/A"}
                    </li>
                    <li>Amenities Score: {prop.scores.amenitiesScore ?? "N/A"}</li>
                    <li>Total Score: {prop.scores.totalScore ?? "N/A"}</li>
                  </ul>
                </details>
              )}

              {(() => {
                const hasScores =
                  prop.scores && Object.keys(prop.scores).length > 0;
                const hasMlMetadata =
                  prop.ml_metadata && Object.keys(prop.ml_metadata).length > 0;

                if (!showDebug || (!hasScores && !hasMlMetadata)) {
                  return null;
                }

                return (
                  <div className="debug-section">
                    <p className="debug-section-title">Debug Info</p>
                    <div className="debug-grid">
                      {hasScores && (
                        <div>
                          <strong>Scores</strong>
                          <pre>{JSON.stringify(prop.scores, null, 2)}</pre>
                        </div>
                      )}
                      {hasMlMetadata && (
                        <div>
                          <strong>ML Metadata</strong>
                          <pre>{JSON.stringify(prop.ml_metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}

          {showDebug && rawResponse && (
            <details className="debug-raw-response">
              <summary>Raw response (debug)</summary>
              <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
            </details>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
