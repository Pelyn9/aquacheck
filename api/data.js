// /pages/api/data.js

// ✅ In-memory storage for the latest ESP32 data
let latestData = null;
let lastUpdated = null; // timestamp in milliseconds

export default function handler(req, res) {
  const OFFLINE_THRESHOLD = 15000; // 15 seconds

  // ----------------- POST: ESP32 uploads new data -----------------
  if (req.method === "POST") {
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data sent" });

    // Save the latest data in memory
    latestData = data;
    lastUpdated = Date.now();

    console.log("📥 Data received from ESP32:", data);

    return res.status(200).json({ message: "✅ Data received successfully" });
  }

  // ----------------- GET: Dashboard fetches latest data -----------------
  if (req.method === "GET") {
    const now = Date.now();

    // If no data yet or ESP32 hasn't uploaded recently
    if (!latestData || (lastUpdated && now - lastUpdated > OFFLINE_THRESHOLD)) {
      return res.status(200).json({
        status: "offline",
        data: {
          ph: "N/A",
          turbidity: "N/A",
          temperature: "N/A",
          tds: "N/A",
        },
      });
    }

    // ESP32 is online
    return res.status(200).json({
      status: "online",
      data: latestData,
    });
  }

  // ----------------- Other methods not allowed -----------------
  return res.status(405).json({ error: "Method Not Allowed" });
}
