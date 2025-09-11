// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { supabaseAdmin } from "./supabaseAdminClient.js"; // SERVICE ROLE key

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
    console.error("❌ Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// -----------------------------
// POST verify admin key
// -----------------------------
app.post("/api/admin/verify-key", async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: "Missing admin key" });

  try {
    const { data: keys, error } = await supabaseAdmin
      .from("admin_keys_v2")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!keys.length) return res.status(400).json({ message: "No admin key found" });

    const currentKey = keys[0].key_value;
    if (key === currentKey) return res.json({ message: "Key valid" });

    return res.status(401).json({ message: "Invalid admin key" });
  } catch (err) {
    console.error("❌ Verify key error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------
// POST create admin user
// -----------------------------
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  if (!email || !password || !key) {
    return res.status(400).json({ error: "Missing email, password, or admin key" });
  }
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    // Verify admin key
    const { data: keys, error: keyError } = await supabaseAdmin
      .from("admin_keys_v2")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);
    if (keyError) throw keyError;
    if (!keys.length) return res.status(400).json({ error: "No admin key found" });

    const currentKey = keys[0].key_value;
    if (key !== currentKey) return res.status(401).json({ error: "Invalid admin key" });

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    if (existingUsers.users.some((u) => u.email === email)) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Create admin user
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (createError) throw createError;

    res.json({ user: data.user || data });
  } catch (err) {
    console.error("❌ Create user route error:", err);
    res.status(500).json({ error: "Database error creating new user" });
  }
});

// -----------------------------
// POST toggle user status
// -----------------------------
app.post("/api/admin/toggle-user", async (req, res) => {
  const { userId, isActive, key } = req.body;
  if (!userId || typeof isActive !== "boolean" || !key)
    return res.status(400).json({ error: "Missing userId, isActive, or admin key" });

  try {
    const { data: keys, error } = await supabaseAdmin
      .from("admin_keys_v2")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw error;
    const currentKey = keys[0]?.key_value;
    if (key !== currentKey) return res.status(401).json({ error: "Invalid admin key" });

    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      disabled: !isActive,
    });
    if (updateError) throw updateError;

    res.json({ user: data, message: `User ${userId} is now ${isActive ? "active" : "disabled"}` });
  } catch (err) {
    console.error("❌ Error updating user status:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// -----------------------------
// POST delete user
// -----------------------------
app.post("/api/admin/delete-user", async (req, res) => {
  const { userId, key } = req.body;
  if (!userId || !key) return res.status(400).json({ error: "Missing userId or admin key" });

  try {
    const { data: keys, error } = await supabaseAdmin
      .from("admin_keys_v2")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw error;
    const currentKey = keys[0]?.key_value;
    if (key !== currentKey) return res.status(401).json({ error: "Invalid admin key" });

    const { data, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    res.json({ message: `User ${userId} deleted`, user: data });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// -----------------------------
// POST change admin key
// -----------------------------
app.post("/api/admin/change-key", async (req, res) => {
  const { oldKey, newKey } = req.body;
  if (!oldKey || !newKey) return res.status(400).json({ error: "Missing fields" });

  try {
    const { data: keys, error } = await supabaseAdmin
      .from("admin_keys_v2")
      .select("key_value")
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!keys.length) return res.status(400).json({ error: "No admin key found" });

    const currentKey = keys[0].key_value;
    if (oldKey !== currentKey) return res.status(401).json({ error: "Old key is incorrect" });

    const { error: insertError } = await supabaseAdmin
      .from("admin_keys_v2")
      .insert([{ key_value: newKey }]);
    if (insertError) throw insertError;

    res.json({ message: "Admin key successfully updated" });
  } catch (err) {
    console.error("❌ Change key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Admin backend running at http://localhost:${PORT}`));
