export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { ph, turbidity, temperature, tds } = req.body;

      console.log("📩 Data received from ESP32:", req.body);

      // You can later add Supabase insert logic here if needed

      return res.status(200).json({
        message: "✅ Data received successfully!",
        data: { ph, turbidity, temperature, tds },
      });
    } catch (error) {
      console.error("❌ Error processing request:", error);
      return res.status(500).json({ error: "Server error" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
