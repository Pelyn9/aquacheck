// api/data.js
let latestData = {
  ph: 7.0,
  temperature: 25.0,
  tds: 2418.89,
  turbidity: 2395.53,
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Return latest sensor data
    return res.status(200).json(latestData);
  }

  if (req.method === "POST") {
    try {
      // Ensure JSON body is parsed
      const body = req.body;

      if (!body) {
        return res.status(400).json({ message: "❌ No data received" });
      }

      const { ph, temperature, tds, turbidity } = body;

      latestData = {
        ph: ph !== undefined && !isNaN(ph) ? parseFloat(ph) : latestData.ph,
        temperature: temperature !== undefined && !isNaN(temperature) ? parseFloat(temperature) : latestData.temperature,
        tds: tds !== undefined && !isNaN(tds) ? parseFloat(tds) : latestData.tds,
        turbidity: turbidity !== undefined && !isNaN(turbidity) ? parseFloat(turbidity) : latestData.turbidity,
      };

      return res.status(200).json({ message: "✅ Data received successfully!", latestData });
    } catch (err) {
      console.error("❌ Error processing data:", err);
      return res.status(400).json({ message: "❌ Invalid data format" });
    }
  }

  // Method not allowed
  return res.status(405).json({ message: "Method not allowed" });
}
