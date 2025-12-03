// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
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
  if (key === adminSecret) return res.json({ valid: true });
  return res.status(401).json({ valid: false, message: "Invalid admin key" });
});

// ✅ Change local admin key
app.post("/api/admin/change-key", (req, res) => {
  const { newKey } = req.body;
  if (!newKey?.trim()) return res.status(400).json({ message: "Key cannot be empty" });
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
    res.json({ success: true, users: data?.users || [] });
  } catch (err) {
    console.error("❌ Fetch users failed:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch users", error: err.message });
  }
});

// ✅ Delete a user by ID
app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    res.json({ success: true, message: "User deleted successfully" });
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
// Global Auto Scan
// ------------------------------
let autoScanInterval = null;

const fetchSensorData = async () => {
  let sensorData = null;

  try {
    const response = await fetch(process.env.ESP32_URL || "http://aquacheck.local:5000/data");
    const data = await response.json();
    sensorData = data.latestData || data;
  } catch {
    try {
      const cloudRes = await fetch("https://aquachecklive.vercel.app/api/data");
      const cloudData = await cloudRes.json();
      sensorData = cloudData.latestData || cloudData;
    } catch {
      console.error("❌ Failed to fetch sensor data");
      return null;
    }
  }

  return sensorData;
};

const saveSensorData = async (sensorData) => {
  if (!sensorData) return;
  try {
    await supabaseAdmin.from("dataset_history").insert([{
      user_id: null,
      ph: parseFloat(sensorData.ph) || null,
      turbidity: parseFloat(sensorData.turbidity) || null,
      temperature: parseFloat(sensorData.temperature) || null,
      tds: parseFloat(sensorData.tds) || null,
    }]);
    console.log("✅ Auto-saved at", new Date().toLocaleTimeString());
  } catch (err) {
    console.error("❌ Failed to save sensor data", err);
  }
};

// Start auto-scan
app.post("/api/admin/start-scan", async (_req, res) => {
  try {
    await supabaseAdmin.from("device_scanning").update({ status: 1 }).eq("id", 1);

    if (autoScanInterval) clearInterval(autoScanInterval);

    const { data } = await supabaseAdmin.from("device_scanning").select("*").eq("id", 1).single();
    const intervalMs = data?.interval_ms || 900000; // 15 minutes default

    const fetchAndSave = async () => {
      const sensorData = await fetchSensorData();
      await saveSensorData(sensorData);

      // Update next auto-save timestamp
      const nextTs = new Date(Date.now() + intervalMs);
      await supabaseAdmin.from("device_scanning").update({ next_auto_save_ts: nextTs }).eq("id", 1);
    };

    autoScanInterval = setInterval(fetchAndSave, intervalMs);
    fetchAndSave(); // run immediately

    res.json({ success: true, message: "Global auto-scan started" });
  } catch (err) {
    console.error("❌ Start scan failed", err);
    res.status(500).json({ success: false, message: "Failed to start auto-scan" });
  }
});

// Stop auto-scan
app.post("/api/admin/stop-scan", async (_req, res) => {
  try {
    if (autoScanInterval) clearInterval(autoScanInterval);
    autoScanInterval = null;
    await supabaseAdmin.from("device_scanning").update({ status: 0 }).eq("id", 1);
    res.json({ success: true, message: "Global auto-scan stopped" });
  } catch (err) {
    console.error("❌ Stop scan failed", err);
    res.status(500).json({ success: false, message: "Failed to stop auto-scan" });
  }
});

// Get scan status
app.get("/api/admin/scan-status", async (_req, res) => {
  try {
    const { data } = await supabaseAdmin.from("device_scanning").select("*").eq("id", 1).single();
    const remainingMs = data?.next_auto_save_ts ? new Date(data.next_auto_save_ts).getTime() - Date.now() : 0;
    res.json({ status: data?.status || 0, remainingMs: Math.max(remainingMs, 0) });
  } catch (err) {
    console.error("❌ Failed to get scan status", err);
    res.status(500).json({ success: false, message: "Failed to get scan status" });
  }
});

// ------------------------------
// Server Start
// ------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at: http://localhost:${PORT}`);
});
