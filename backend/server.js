import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Supabase Admin Client
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Utility
const handleError = (res, err, message = "Internal Server Error") => {
  console.error("❌", message, err.message || err);
  return res.status(500).json({ error: message });
};

// Initialize Master Password
const initializeMasterPassword = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("master_password")
      .select("*")
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error; // ignore 'no rows' error
    if (!data) {
      await supabaseAdmin
        .from("master_password")
        .insert([{ id: 1, password: "watercheck123" }]);
      console.log("✅ Master password initialized");
    }
  } catch (err) {
    console.error("❌ Failed to initialize master password:", err.message);
  }
};
initializeMasterPassword();

// Get All Users
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    const mappedUsers = data.users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || "user",
      created_at: user.created_at,
      disabled: user.disabled,
      app_metadata: user.app_metadata,
    }));
    res.json({ users: mappedUsers });
  } catch (err) {
    return handleError(res, err, "Failed to fetch users");
  }
});

// Toggle User Active/Disable
app.post("/api/admin/users/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { enable } = req.body;
  if (!id || enable === undefined)
    return res.status(400).json({ error: "Missing parameters" });
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      disabled: !enable,
    });
    if (error) throw error;
    res.json({ message: `User ${enable ? "enabled" : "disabled"}`, user: data });
  } catch (err) {
    return handleError(res, err, "Failed to toggle user");
  }
});

// Delete User
app.delete("/api/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "User ID required" });
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    return handleError(res, err, "Failed to delete user");
  }
});

// Master Password
app.get("/api/admin/master-password", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("master_password")
      .select("*")
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    res.json({ password: data?.password || "watercheck123" });
  } catch (err) {
    return handleError(res, err, "Failed to fetch master password");
  }
});

app.put("/api/admin/master-password", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    const { data, error } = await supabaseAdmin
      .from("master_password")
      .upsert([{ id: 1, password }], { onConflict: "id", returning: "representation" });

    if (error) throw error;

    const updatedPassword = Array.isArray(data) ? data[0].password : data.password;
    if (!updatedPassword) throw new Error("No password returned from server");

    res.json({ password: updatedPassword });
  } catch (err) {
    return handleError(res, err, "Failed to update master password");
  }
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Admin backend running at http://localhost:${PORT}`));
