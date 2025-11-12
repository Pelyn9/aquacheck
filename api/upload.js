let latestData = {
  ph: null,
  turbidity: null,
  temperature: null,
  tds: null,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: "No JSON body received" });
    }

    console.log("📥 Received data from ESP32:", data);

    latestData = {
      ph: data.ph ?? null,
      turbidity: data.turbidity ?? null,
      temperature: data.temperature ?? null,
      tds: data.tds ?? null,
    };

    return res.status(200).json({ message: "✅ Data received successfully!" });
  } catch (err) {
    console.error("❌ Error handling upload:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Export for data API
export { latestData };
