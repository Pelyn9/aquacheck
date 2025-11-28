// /api/data.js

// In-memory storage for latest ESP32 data
let latestData = null;
let lastUpdated = null; // timestamp in ms

export default function handler(req, res) {
  const OFFLINE_THRESHOLD = 15000; // 15 seconds

  if (req.method === "POST") {
    // ESP32 sends new data
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data sent" });

    latestData = data;
    lastUpdated = Date.now();

    console.log("📥 Data received from ESP32:", data);
    return res.status(200).json({ message: "✅ Data received" });
  }

  if (req.method === "GET") {
    const now = Date.now();

    if (!latestData || (lastUpdated && now - lastUpdated > OFFLINE_THRESHOLD)) {
      // ESP32 offline or never sent data
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

    // ESP32 online
    return res.status(200).json({
      status: "online",
      data: latestData,
    });
  }

  // Method not allowed
  res.status(405).json({ error: "Method Not Allowed" });
}
