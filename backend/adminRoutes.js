import express from "express";
import { supabaseAdmin } from "../supabaseAdminClient.js";

const router = express.Router();

// -----------------------------
// GET all users
// -----------------------------
router.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || "user",
      created_at: u.created_at,
      disabled: u.disabled,
    }));

    res.json({ users });
  } catch (err) {
    console.error("❌ Fetch users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// -----------------------------
// CREATE or update admin user
// -----------------------------
router.post("/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  if (!email || !password || !key) {
    return res.status(400).json({ error: "Missing email, password, or admin key" });
  }
  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    // Check existing user
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = userList.users.find((u) => u.email === email);

    if (existingUser) {
      // Update
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { role: "admin" },
        email_confirm: true,
      });
      if (error) throw error;

      await supabaseAdmin.from("Admins").upsert(
        { auth_id: existingUser.id, email },
        { onConflict: "auth_id" }
      );

      return res.json({ user: data, message: "✅ Existing user updated as admin" });
    }

    // Create
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    if (error) throw error;

    await supabaseAdmin.from("Admins").insert({
      auth_id: data.user.id,
      email,
    });

    res.json({ user: data.user, message: "✅ New admin user created" });
  } catch (err) {
    console.error("❌ Create user error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
