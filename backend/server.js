// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabaseAdmin } from "./supabaseAdminClient.js";

dotenv.config();
const app = express();

// Allow both local frontend and deployed Vercel frontend
app.use(
  cors({
    origin: [
      "http://localhost:3000",          // Local React app
      "https://aquachecklive.vercel.app" // Deployed site
    ],
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ------------------------------
// Local admin key system
// ------------------------------
let adminSecret = process.env.ADMIN_SECRET || "Aquackeck123";
let masterPassword = process.env.MASTER_ADMIN_PASSWORD || "watercheck123";

// ✅ Verify local admin key
app.post("/api/admin/verify-key", (req, res) => {
  const { key } = req.body;
  if (key === adminSecret) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, message: "Invalid admin key" });
});

// ✅ Change local admin key
app.post("/api/admin/change-key", (req, res) => {
  const oldKey = typeof req.body?.oldKey === "string" ? req.body.oldKey.trim() : "";
  const newKey = typeof req.body?.newKey === "string" ? req.body.newKey.trim() : "";

  if (!oldKey || !newKey) {
    return res.status(400).json({ error: "Current key and new key are required." });
  }

  if (oldKey !== adminSecret) {
    return res.status(401).json({ error: "Current key is incorrect." });
  }

  adminSecret = newKey;
  res.json({ success: true, message: "Admin key updated." });
});

app.get("/api/admin/master-password", (_req, res) => {
  res.json({ password: masterPassword });
});

app.put("/api/admin/master-password", (req, res) => {
  const password =
    typeof req.body?.password === "string" ? req.body.password.trim() : "";

  if (!password) {
    return res.status(400).json({ error: "Password cannot be empty." });
  }

  masterPassword = password;
  return res.json({ success: true, password: masterPassword });
});

// ------------------------------
// Supabase User Management
// ------------------------------

// ✅ Fetch all users
app.get("/api/admin/users", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    // Ensure consistent response format
    res.json({ success: true, users: data?.users || [] });
  } catch (err) {
    console.error("❌ Fetch users failed:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch users", error: err.message });
  }
});

// ✅ Delete a user by ID
app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    res.json({ success: true, message:  "User deleted successfully" });
  } catch (err) {
    console.error("❌ Delete user failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

// ✅ Disable or enable a user (ban/unban)
app.post("/api/admin/users/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { enable } = req.body;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: enable ? "none" : "forever",
    });
    if (error) throw error;

    res.json({
      success: true,
      message: enable ? "User enabled" : "User disabled",
      user: data,
    });
  } catch (err) {
    console.error("❌ Toggle user failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to toggle user" });
  }
});

// ------------------------------
// Server Start
// ------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at: http://localhost:${PORT}`);
});
