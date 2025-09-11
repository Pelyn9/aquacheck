// backend/src/server/admin.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { supabaseAdmin } from "../supabaseAdminClient.js";

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

    const users = data.users.map(user => ({
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
// POST create admin user
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
    // Create user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (error) throw error;

    res.json({ user: data.user || data });
  } catch (err) {
    console.error("❌ Failed to create user:", err);
    res.status(500).json({ error: "Database error creating new user" });
  }
});

// -----------------------------
// POST toggle user status (enable/disable)
// -----------------------------
app.post("/api/admin/toggle-user", async (req, res) => {
  const { userId, isActive, key } = req.body;

  if (!userId || typeof isActive !== "boolean" || !key) {
    return res.status(400).json({ error: "Missing userId, isActive, or admin key" });
  }

  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      disabled: !isActive,
    });

    if (error) throw error;
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

  if (key !== process.env.ADMIN_SECRET) return res.status(401).json({ error: "Invalid admin key" });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    res.json({ message: `User ${userId} deleted`, user: data });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Admin backend running at http://localhost:${PORT}`));
