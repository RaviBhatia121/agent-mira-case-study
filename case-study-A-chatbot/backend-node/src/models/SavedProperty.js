const mongoose = require("mongoose");

const SavedPropertySchema = new mongoose.Schema({
  userId: { type: String },
  propertyId: { type: mongoose.Schema.Types.Mixed, required: true },
  title: { type: String },
  price: { type: Number },
  location: { type: String },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  size_sqft: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

const SavedProperty = mongoose.model("SavedProperty", SavedPropertySchema);

module.exports = SavedProperty;
