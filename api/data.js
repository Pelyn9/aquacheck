// /api/data.js
let latestData = null;
let lastUpdated = null;

export default function handler(req, res) {
  if (req.method === "GET") {
    if (!latestData) {
      return res.json({ status: "offline", data: null });
    }

    const now = Date.now();
    const offlineThreshold = 15000; // 15 seconds

    if (now - lastUpdated > offlineThreshold) {
      return res.json({ status: "offline", data: latestData });
    }

    return res.json({ status: "online", data: latestData });
  } else if (req.method === "POST") {
    // Optionally allow updates here
    const data = req.body;
    if (!data) return res.status(400).json({ error: "No data sent" });

    latestData = data;
    lastUpdated = Date.now();
    return res.status(200).json({ message: "Data received" });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
