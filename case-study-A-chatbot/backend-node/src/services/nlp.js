const nlp = require("compromise");

/**
 * Parsed preferences structure used by Case A.
 * @typedef {Object} ParsedPreferences
 * @property {number|null} budget
 * @property {number|null} minBedrooms
 * @property {string[]} preferredLocations
 * @property {string[]} amenities
 * @property {string} rawText
 */

/**
 * Best-effort number parser.
 */
function toNumberOrNull(value) {
  if (value == null) return null;
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

/**
 * Default/local NLP: uses compromise + simple regexes.
 * This is the primary parser for the case study (Option A).
 *
 * @param {string} message
 * @returns {ParsedPreferences}
 */
function parseUserMessageLocal(message = "") {
  const doc = nlp(message || "");
  const rawText = message || "";

  // Bedrooms: "2 bhk", "3 bedrooms", "at least 2 rooms", etc.
  let minBedrooms = null;
  const bedroomMatch = message.match(/\b(\d+)\s*(bhk|bed(room)?s?|rooms?)\b/i);
  if (bedroomMatch) {
    minBedrooms = toNumberOrNull(bedroomMatch[1]);
  }

  // Budget: look for patterns like "under 600k", "budget 750000", "max 500k", etc.
  // Avoid capturing trailing words as part of the amount.
  let budget = null;
  const moneyMatch = message.match(
    /\b(budget|under|below|max|upto|up to)\s+([\d,\.]+)\s*(k|K|m|M)?/i
  );
  if (moneyMatch) {
    const [, , rawAmount, suffix] = moneyMatch;
    let amount = toNumberOrNull(rawAmount);

    if (amount != null) {
      if (suffix && /k/i.test(suffix)) amount = amount * 1000;
      if (suffix && /m/i.test(suffix)) amount = amount * 1_000_000;
      budget = amount;
    }
  }

  // Locations: use compromise for places + a simple fallback for "in <city>"
  const preferredLocations = new Set();

  // "in Boston", "around Austin" (stop before "under"/"below" etc.)
  const inMatch = message.match(/\b(in|around|near)\s+([A-Za-z\s,]+?)(?:\s+under|\s+below|\s+budget|\s+max|\s+upto|\s+up to|$)/i);
  if (inMatch) {
    const loc = inMatch[2].trim();
    if (loc) preferredLocations.add(loc);
  }

  // Use compromise's places() as an additional signal
  const places = doc.places().out("array");
  for (const place of places) {
    if (place && place.trim().length > 0) {
      preferredLocations.add(place.trim());
    }
  }

  // Amenities: simple keyword scan
  const amenitiesKeywords = [
    "pool",
    "parking",
    "gym",
    "garden",
    "balcony",
    "garage",
    "beach access",
    "smart home",
    "backyard",
    "concierge",
  ];
  const amenities = [];
  const lower = message.toLowerCase();
  for (const term of amenitiesKeywords) {
    if (lower.includes(term.toLowerCase())) {
      amenities.push(term);
    }
  }

  return {
    budget,
    minBedrooms,
    preferredLocations: Array.from(preferredLocations),
    amenities,
    rawText,
  };
}

/**
 * Future-ready hook: LLM-based parsing (Option C).
 *
 * IMPORTANT:
 * - Do NOT import any OpenAI SDK.
 * - Do NOT use any real API keys.
 * - This function is NOT used by default; it only shows how we would extend.
 *
 * @param {string} message
 * @returns {Promise<ParsedPreferences>}
 */
async function parseUserMessageWithLLM(message = "") {
  // Placeholder implementation to show how this would be wired.
  // For now, just delegate to the local parser so the function is safe to call.
  return parseUserMessageLocal(message);
}

// MAIN exported function for current case study: Option A (local NLP).
function parseUserMessage(message) {
  return parseUserMessageLocal(message);
}

module.exports = {
  parseUserMessage,
  parseUserMessageLocal,
  parseUserMessageWithLLM, // exported but NOT used by default
};
