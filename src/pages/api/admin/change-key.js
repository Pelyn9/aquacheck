export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { newKey, oldKey } = req.body;

    if (oldKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!newKey || newKey.trim() === "") {
      return res.status(400).json({ error: "New key cannot be empty" });
    }

    process.env.ADMIN_SECRET = newKey.trim();
    return res.status(200).json({ success: true, message: "Admin secret updated!" });
  } catch (err) {
    console.error("❌ Change key failed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
