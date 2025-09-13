// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { supabaseAdmin } from "./supabaseAdminClient.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -----------------------------
// GET all users
// -----------------------------
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || "user",
      created_at: user.created_at,
      disabled: user.disabled,
    }));

    res.json({ users });
  } catch (err) {
    console.error("❌ Failed to fetch users:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
});

// -----------------------------
// POST create/update admin user
// -----------------------------
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  if (!email || !password || !key) {
    return res.status(400).json({ error: "Missing email, password, or admin key" });
  }

  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    // Check if user exists
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = userList?.users?.find((u) => u.email === email);

    if (existingUser) {
      // Update existing user
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { role: "admin" },
        email_confirm: true,
      });

      if (error) return res.status(400).json({ error: error.message });

      await supabaseAdmin.from("Admins").upsert(
        { auth_id: existingUser.id, email },
        { onConflict: "auth_id" }
      );

      return res.json({ user: data, message: "✅ Existing user updated as admin" });
    }

    // Create new user
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (createError) return res.status(400).json({ error: createError.message });

    const newUser = data.user ?? data;

    await supabaseAdmin.from("Admins").insert({
      auth_id: newUser.id,
      email,
    });

    return res.json({ user: newUser, message: "✅ New admin user created" });
  } catch (err) {
    console.error("❌ Create/update admin user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Admin backend running at http://localhost:${PORT}`));
