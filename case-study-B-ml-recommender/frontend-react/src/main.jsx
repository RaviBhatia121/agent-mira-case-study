// frontend-react/src/index.jsx  (or src/main.jsx in your setup)

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Small wrapper component that fetches area options from the backend
function Root() {
  const [availableAreas, setAvailableAreas] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const API_BASE = "https://agent-mira-case-b-backend.onrender.com";

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await fetch(`${API_BASE}/areas`);
        if (!res.ok) {
          throw new Error(`Failed to load areas: ${res.status}`);
        }
        const data = await res.json();
        // Expecting shape: { areas: [...] }
        setAvailableAreas(Array.isArray(data.areas) ? data.areas : []);
      } catch (err) {
        console.error("Error fetching areas from backend:", err);
        // Leave availableAreas as [] – App has a safe fallback ("Others")
      } finally {
        setHasFetched(true);
      }
    };

    fetchAreas();
  }, []);

  // You can optionally show a tiny loading state here, but
  // even without it App will just see an empty list and use fallback.
  return <App availableAreas={availableAreas} hasFetchedAreas={hasFetched} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
