// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabaseAdmin } from "./supabaseAdminClient.js";

dotenv.config();
const app = express();

app.use(cors({ origin: "http://localhost:3000" })); // Allow frontend
app.use(express.json());

// Local secret admin key (NOT Supabase service key)
let adminSecret = process.env.ADMIN_SECRET || "SuperSecretAdminKey123";

// --- Verify local admin key ---
app.post("/api/admin/verify-key", (req, res) => {
  const { key } = req.body;
  if (key === adminSecret) {
    return res.json({ valid: true });
  }
  res.status(401).json({ valid: false, message: "Invalid admin key" });
});

// --- Change local admin key ---
app.post("/api/admin/change-key", (req, res) => {
  const { newKey } = req.body;
  if (!newKey?.trim()) {
    return res.status(400).json({ message: "Key cannot be empty" });
  }
  adminSecret = newKey;
  res.json({ message: "Admin key updated!" });
});

// --- Fetch Authentication Users ---
app.get("/api/admin/users", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    res.json({ users: data.users });
  } catch (err) {
    console.error("❌ Fetch users failed:", err.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// --- Delete Auth User ---
app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("❌ Delete failed:", err.message);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// --- Disable / Enable Auth User ---
app.post("/api/admin/users/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { enable } = req.body;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: enable ? "none" : "forever",
    });
    if (error) throw error;
    res.json({ message: enable ? "User enabled" : "User disabled", user: data });
  } catch (err) {
    console.error("❌ Toggle failed:", err.message);
    res.status(500).json({ message: "Failed to toggle user" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));