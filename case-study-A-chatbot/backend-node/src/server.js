const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const { connectDB } = require("./config/db");

const { loadPropertyDatasets } = require("../../../common/utils/dataLoader");
const { joinPropertyData } = require("../../../common/utils/propertyJoiner");
const { filterProperties } = require("../../../common/utils/filtering");
const { computeRuleScore } = require("../../../common/utils/scoring");
const { buildReason } = require("../../../common/utils/reasoning");

const createChatRouter = require("./routes/chatRoutes");

if (process.env.MONGODB_URI) {
  connectDB();
} else {
  console.warn("MONGODB_URI not set; skipping DB connection.");
}

const DATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "case-study-B-ml-recommender",
  "backend-node",
  "data"
);

console.log("Case A DATA_DIR:", DATA_DIR);

const { basics, characteristics, images } = loadPropertyDatasets(DATA_DIR);
const joinedProperties = joinPropertyData(basics, characteristics, images);

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

const chatRouter = createChatRouter({ joinedProperties });
app.use("/", chatRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "case-study-a-chatbot-backend" });
});

app.listen(PORT, () => {
  console.log(`Case A chatbot backend listening on port ${PORT}`);
});

module.exports = { joinedProperties };
