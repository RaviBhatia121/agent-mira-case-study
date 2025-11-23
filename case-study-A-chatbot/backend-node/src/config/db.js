const mongoose = require("mongoose");

let isDbConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MongoDB disabled – no persistence");
    isDbConnected = false;
    return;
  }

  try {
    await mongoose.connect(uri, { dbName: "caseA" });
    isDbConnected = true;
    console.log("Connected to MongoDB (caseA)");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    isDbConnected = false;
  }
}

function getDbConnectionStatus() {
  return isDbConnected;
}

module.exports = { connectDB, getDbConnectionStatus };
