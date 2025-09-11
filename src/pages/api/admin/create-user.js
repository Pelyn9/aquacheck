import { supabaseAdmin } from "../../../supabaseAdminClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { email, password, key } = req.body;

    if (key !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ user: data });
  } catch (err) {
    console.error("❌ Create user failed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
