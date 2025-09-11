import { supabaseAdmin } from "../../../supabaseAdminClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { id, enable, key } = req.body;

    if (key !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!id) return res.status(400).json({ error: "User ID is required" });

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: enable ? "none" : "forever",
    });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ message: enable ? "User enabled" : "User disabled", user: data });
  } catch (err) {
    console.error("❌ Toggle user failed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
