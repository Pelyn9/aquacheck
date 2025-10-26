const express = require("express");
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json());

// Temporary in-memory storage
let latestData = {
  ph: null,
  turbidity: null,
  temperature: null,
  tds: null,
  timestamp: null
};

// ✅ Test route
app.get("/", (req, res) => {
  res.json({
    message: "✅ AquaCheck API is running successfully!",
    endpoints: ["/api/upload", "/api/data"]
  });
});

// ✅ Upload data from ESP32
app.post("/api/upload", (req, res) => {
  const { ph, turbidity, temperature, tds } = req.body;

  if (ph === undefined || turbidity === undefined || temperature === undefined || tds === undefined) {
    return res.status(400).json({ error: "Missing required sensor fields" });
  }

  latestData = {
    ph,
    turbidity,
    temperature,
    tds,
    timestamp: new Date().toISOString()
  };

  console.log("📡 New data received:", latestData);
  res.status(200).json({ message: "✅ Data received successfully", data: latestData });
});

// ✅ Get latest data (for your dashboard)
app.get("/api/data", (req, res) => {
  if (!latestData.timestamp) {
    return res.status(404).json({ message: "❌ No data available yet" });
  }
  res.json(latestData);
});

// ✅ Required for Vercel
module.exports = app;
