// /api/data.js
let latestData = null;
let lastUpdated = null;

export default function handler(req, res) {
  const OFFLINE_THRESHOLD = 15000; // 15 seconds

  if (req.method === "POST") {
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data sent" });

    latestData = data;
    lastUpdated = Date.now();
    console.log("📥 Data received from ESP32:", data);
    return res.status(200).json({ message: "✅ Data received" });
  }

  if (req.method === "GET") {
    const now = Date.now();
    if (!latestData || now - lastUpdated > OFFLINE_THRESHOLD) {
      return res.status(200).json({
        status: "offline",
        data: { ph: "N/A", turbidity: "N/A", temperature: "N/A", tds: "N/A" }
      });
    }
    return res.status(200).json({ status: "online", data: latestData });
  }

  res.status(405).json({ error: "Method Not Allowed" });
}
