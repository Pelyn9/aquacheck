// backend/src/routes/adminRoutes.js
import express from "express";
import { supabaseAdmin } from "../supabaseAdminClient.js";

const router = express.Router();

router.post("/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  if (!email || !password || !key) {
    return res.status(400).json({ error: "Missing email, password, or admin key" });
  }

  try {
    // Verify admin key
    const { data: keys, error: keyError } = await supabaseAdmin
      .from("admin_keys")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);

    if (keyError) throw keyError;
    if (!keys.length) return res.status(400).json({ error: "No admin key set in DB" });

    const currentKey = keys[0].key_value;
    if (key !== currentKey) return res.status(401).json({ error: "Invalid admin key" });

    // Create user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return res.status(400).json({ error: error.message });

    // Send the user info in a consistent format
    res.json({ user: data.user || data });
  } catch (err) {
    console.error("❌ Create user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
