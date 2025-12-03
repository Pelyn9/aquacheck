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
let adminSecret = process.env.ADMIN_SECRET || "SuperSecretAdminKey123";

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
  const { newKey } = req.body;
  if (!newKey?.trim()) {
    return res.status(400).json({ message: "Key cannot be empty" });
  }
  adminSecret = newKey;
  res.json({ message: "Admin key updated!" });
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
