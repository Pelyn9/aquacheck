import express from "express";
import { supabaseAdmin } from "../supabaseAdminClient.js";

const router = express.Router();

// POST /api/admin/create-user
router.post("/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  // Validate input
  if (!email || !password || !key) {
    return res.status(400).json({ error: "Missing email, password, or admin key" });
  }

  // Verify admin key
  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    // -----------------------------
    // 1. Check if user already exists
    // -----------------------------
    const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = allUsers.users.find(u => u.email === email);

    if (existingUser) {
      // ✅ Update existing user: role = admin, confirm email
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { role: "admin" },
        email_confirmed: true,
      });

      if (error) return res.status(400).json({ error: error.message });

      return res.json({ user: data, message: "Existing user updated as admin" });
    }

    // -----------------------------
    // 2. Create new admin user
    // -----------------------------
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ user: data, message: "New admin user created" });

  } catch (err) {
    console.error("❌ Create/update admin user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
