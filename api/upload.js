export default async function handler(req, res) {
  // ✅ Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Ensure JSON body is parsed
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: "No JSON body received" });
    }

    console.log("📥 Received data from ESP32:", data);

    // Optional: Save to Supabase or any database
    // await supabase.from("dataset_history").insert([data]);

    return res.status(200).json({ message: "✅ Data received successfully!" });
  } catch (err) {
    console.error("❌ Error handling upload:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
