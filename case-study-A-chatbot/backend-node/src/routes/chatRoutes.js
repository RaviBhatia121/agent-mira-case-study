const express = require("express");
const mongoose = require("mongoose");
const SavedProperty = require("../models/SavedProperty");
const { getDbConnectionStatus } = require("../config/db");
const { parseUserMessage } = require("../services/nlp");
const {
  filterProperties,
  fitsBudget,
  meetsBedroomRequirement,
} = require("../../../../common/utils/filtering");
const { computeRuleScore } = require("../../../../common/utils/scoring");

// Factory to inject shared property data
function createChatRouter({ joinedProperties }) {
  const router = express.Router();

  // POST /message – parse and return top matches
  router.post("/message", (req, res) => {
    console.log("Case A: /message hit with body:", req.body);
    try {
      const { message } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }

      const parsed = parseUserMessage(message);

      const preferences = {
        budget: parsed.budget ?? null,
        minBedrooms: parsed.minBedrooms ?? null,
        preferredLocations: parsed.preferredLocations || [],
        preferredAreas: parsed.preferredLocations || [],
        amenities: parsed.amenities || [],
      };

      const normalizedPrefs = {
        budget: preferences.budget,
        min_bedrooms: preferences.minBedrooms,
        max_bedrooms: preferences.maxBedrooms,
        preferredLocations: preferences.preferredLocations,
        amenities: preferences.amenities || [],
      };

      const all = Array.isArray(joinedProperties) ? joinedProperties : [];

      const preferredLocs = (normalizedPrefs.preferredLocations || []).map((loc) =>
        String(loc || "").toLowerCase().trim()
      );

      const filtered = all.filter((property) => {
        if (!fitsBudget(property, normalizedPrefs.budget)) return false;
        if (!meetsBedroomRequirement(property, normalizedPrefs.min_bedrooms))
          return false;

        if (preferredLocs.length) {
          const locTokens = [
            property.location,
            property.city,
            property.neighbourhood,
            property.state,
          ]
            .filter(Boolean)
            .map((token) => String(token).toLowerCase());

          const hasLocationMatch = preferredLocs.some((loc) =>
            locTokens.some((tok) => tok.includes(loc))
          );

          if (!hasLocationMatch) return false;
        }

        return true;
      });

      const scored = filtered
        .map((property) => {
          const ruleScore = computeRuleScore(property, preferences);
          const reason = property.reasoning || property.reason || "";
          return {
            property,
            ruleScore: Number.isFinite(ruleScore) ? ruleScore : 0,
            reason,
          };
        })
        .sort((a, b) => b.ruleScore - a.ruleScore);

      const topMatches = scored.slice(0, 3).map(({ property, ruleScore, reason }) => ({
        id: property.id,
        title: property.title,
        price: property.price,
        location: property.location,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        size_sqft: property.size_sqft,
        amenities: property.amenities || [],
        matchScore: ruleScore,
        reasoning: reason,
      }));

      const reply =
        topMatches.length > 0
          ? `I found ${topMatches.length} home(s) matching your preferences. For example, "${topMatches[0].title}" in ${topMatches[0].location} around $${(topMatches[0].price || 0).toLocaleString()}.`
          : `I couldn't find any homes matching your filters, but you can try adjusting your budget or locations.`;

      return res.json({
        reply,
        matches: topMatches,
        parsedPreferences: parsed,
      });
    } catch (err) {
      console.error("Error handling chat message:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /properties – minimal list of joined properties
  router.get("/properties", (req, res) => {
    console.log("Case A: /properties hit");
    const list = (joinedProperties || []).map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      location: p.location,
      bedrooms: p.characteristics?.bedrooms ?? p.bedrooms ?? null,
      bathrooms: p.characteristics?.bathrooms ?? p.bathrooms ?? null,
      size_sqft: p.characteristics?.size_sqft ?? p.size_sqft ?? null,
      amenities: p.characteristics?.amenities ?? [],
      image_url: Array.isArray(p.images) ? p.images[0] : null,
    }));
    return res.json(list);
  });

  // POST /save-property – persist a saved property
  // Note: previously failed because mongoose.readyState was checked without importing mongoose.
  // Now we import mongoose and gate persistence on the live connection status.
  router.post("/save-property", async (req, res) => {
    console.log("Case A: /save-property hit with body:", req.body);
    try {
      const { propertyId, userId } = req.body || {};
      if (propertyId == null || !userId) {
        return res
          .status(400)
          .json({ error: "userId and propertyId are required to save a property." });
      }

      const isDbConnected = getDbConnectionStatus();
      if (!isDbConnected || mongoose.connection.readyState !== 1) {
        return res.status(200).json({
          success: false,
          error: "MongoDB not connected",
          persistenceEnabled: false,
        });
      }

      const found = (joinedProperties || []).find((p) => p.id == propertyId);
      if (!found) {
        return res
          .status(404)
          .json({ error: "Property not found in dataset." });
      }

      const doc = await SavedProperty.create({
        userId: userId || null,
        propertyId: found.id,
        title: found.title,
        price: found.price,
        location: found.location,
        bedrooms: found.bedrooms ?? found.characteristics?.bedrooms ?? null,
        bathrooms: found.bathrooms ?? found.characteristics?.bathrooms ?? null,
        size_sqft: found.size_sqft ?? found.characteristics?.size_sqft ?? null,
      });

      return res.status(201).json({
        success: true,
        savedProperty: doc,
        persistenceEnabled: true,
      });
    } catch (err) {
      console.error("Error saving property:", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to save property due to a database error.",
        persistenceEnabled: true,
      });
    }
  });

  return router;
}

module.exports = createChatRouter;
