import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// Backend base URL: configurable via VITE_API_BASE (Render/Netlify), defaults to local dev server.
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5002";

const formatPrice = (value) => {
  if (value == null || isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

function App() {
  const [chatMessages, setChatMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi! Tell me what you're looking for. For example: “Looking for 2 BHK in Miami under 600k”.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [matchedProperties, setMatchedProperties] = useState([]);
  const [savedProperties, setSavedProperties] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);
    setIsLoading(true);

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      const res = await fetch(`${API_BASE}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.reply || "Here are some properties I found.",
      };
      setChatMessages((prev) => [...prev, botMsg]);
      setMatchedProperties(Array.isArray(data.matches) ? data.matches : []);
    } catch (err) {
      console.error("Error calling /message:", err);
      setError(
        "Something went wrong while contacting the chatbot. Please try again."
      );
      setErrorMessage(
        "We couldn’t reach the chatbot service. Please try again shortly."
      );
      setTimeout(() => setErrorMessage(""), 5000);
      const fallbackBotMsg = {
        id: `bot-error-${Date.now()}`,
        sender: "bot",
        text: "I’m sorry, I couldn’t process that request. Please try again in a moment.",
      };
      setChatMessages((prev) => [...prev, fallbackBotMsg]);
      setMatchedProperties([]);
    } finally {
      setIsSending(false);
      setIsLoading(false);
    }
  };

  const handleSaveProperty = async (property) => {
    const propertyId = property.id;
    const userId = "demo";
    if (!propertyId) return;
    try {
      const res = await fetch(`${API_BASE}/save-property`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, propertyId }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        if (data.persistenceEnabled === false) {
          setSaveStatus(
            "ℹ️ This environment is running with saving disabled. The Save button won’t persist data."
          );
          setTimeout(() => setSaveStatus(""), 3000);
          return;
        }
        setSaveStatus("⚠️ Save failed on the server. Please try again.");
        setTimeout(() => setSaveStatus(""), 3000);
        return;
      }
      const savedProperty = data.savedProperty || {
        propertyId: property.id,
        title: property.title,
        price: property.price,
        location: property.location,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        size_sqft: property.size_sqft,
      };
      setSavedProperties((prev) => {
        const exists = prev.some(
          (p) => p.propertyId === savedProperty.propertyId
        );
        if (exists) return prev;
        return [...prev, savedProperty];
      });
      setSaveStatus("✅ Property saved to MongoDB Atlas for this demo user.");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error("Error saving property:", err);
      setSaveStatus(`Failed to save: ${err.message || "Unknown error"}.`);
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Agent Mira – Real Estate Chatbot</h1>
        <p className="app-subtitle">
          Talk to the bot to find matching properties using the shared Case B
          filters.
        </p>
      </header>

      <main className="chat-container">
        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <div className="chat-window">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message chat-message-${msg.sender}`}
            >
              <div className="chat-bubble">
                <div className="chat-sender">
                  {msg.sender === "user"
                    ? "You"
                    : msg.sender === "bot"
                    ? "Bot"
                    : "System"}
                </div>
                <div className="chat-text">{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
          {isLoading && (
            <div className="loading-msg">Mira is thinking…</div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
        {saveStatus && (
          <div className="save-status-banner">{saveStatus}</div>
        )}

        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder='Ask me: e.g. "Looking for 2 BHK in Miami under 600k"'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
          />
          <button type="submit" disabled={isSending || !inputText.trim()}>
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>

        {matchedProperties.length > 0 && (
          <div className="matches-section">
            <p className="matches-title">
              Top {matchedProperties.length} match
              {matchedProperties.length > 1 ? "es" : ""}:
            </p>
            <div className="matches-grid">
              {matchedProperties.map((prop) => (
                <div key={prop.id} className="match-card">
                  <h3 className="match-title">{prop.title}</h3>
                  <p className="match-location">{prop.location}</p>

                  <p className="match-price">
                    <strong>Price: </strong>
                    {formatPrice(prop.price)}
                  </p>

                  <p className="match-meta">
                    {prop.bedrooms != null && <span>{prop.bedrooms} BR</span>}
                    {prop.bathrooms != null && (
                      <span>{prop.bathrooms} Bath</span>
                    )}
                    {prop.size_sqft != null && (
                      <span>{prop.size_sqft} sqft</span>
                    )}
                  </p>

                  {Array.isArray(prop.amenities) &&
                    prop.amenities.length > 0 && (
                      <p className="match-amenities">
                        <strong>Amenities:</strong>{" "}
                        {prop.amenities.join(", ")}
                      </p>
                    )}

                  <button
                    className="save-btn"
                    onClick={() => handleSaveProperty(prop)}
                  >
                    Save this property
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="saved-properties-panel">
          <h3>Saved Properties</h3>
          {savedProperties.length === 0 ? (
            <p className="saved-empty">
              No properties saved yet. Use the Save button on any result.
            </p>
          ) : (
            <div className="saved-list">
              {savedProperties.map((p) => (
                <div key={p.propertyId} className="saved-property-item">
                  <div className="saved-title">{p.title}</div>
                  <div className="saved-location">{p.location}</div>
                  <div className="saved-price">{formatPrice(p.price)}</div>
                  <div className="saved-meta">
                    {p.bedrooms != null && <span>{p.bedrooms} BR</span>}
                    {p.bathrooms != null && <span>{p.bathrooms} Bath</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
