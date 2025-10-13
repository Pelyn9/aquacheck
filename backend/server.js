// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// -------------------- Supabase Admin Client --------------------
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -------------------- Utility --------------------
const handleError = (res, err, message = "Internal Server Error") => {
  console.error("❌", message, err.message || err);
  return res.status(500).json({ error: message });
};

// -------------------- GET all users --------------------
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

// -------------------- Toggle user active/disable --------------------
app.post("/api/admin/users/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { enable } = req.body;
  if (!id || enable === undefined)
    return res.status(400).json({ error: "Missing parameters" });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      disabled: !enable ? true : false,
    });
    if (error) throw error;

    res.json({ message: `User ${enable ? "enabled" : "disabled"}`, user: data });
  } catch (err) {
    return handleError(res, err, "Failed to toggle user");
  }
});

// -------------------- Delete User --------------------
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

// -------------------- Create/Update Admin User --------------------
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, key } = req.body;
  if (!email || !password || !key)
    return res.status(400).json({ error: "Missing email, password, or admin key" });

  if (key !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: "Invalid admin key" });

  try {
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = data.users?.find((u) => u.email === email);

    if (existingUser) {
      const { data: updatedUser, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { role: "admin" },
        email_confirm: true,
      });
      if (error) return res.status(400).json({ error: error.message });

      await supabaseAdmin.from("Admins").upsert({ auth_id: existingUser.id, email }, { onConflict: "auth_id" });

      return res.json({ user: updatedUser, message: "✅ Existing user updated as admin" });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    if (createError) return res.status(400).json({ error: createError.message });

    await supabaseAdmin.from("Admins").insert({ auth_id: newUser.user.id, email });

    return res.json({ user: newUser.user, message: "✅ New admin user created" });
  } catch (err) {
    return handleError(res, err, "Create/update admin user error");
  }
});

// -------------------- Master Password --------------------
// GET master password
app.get("/api/admin/master-password", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("master_password").select("*").limit(1).single();

    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("master_password")
        .insert([{ password: "watercheck123" }])
        .select()
        .single();
      if (insertErr) throw insertErr;
      return res.json({ password: inserted.password });
    }

    res.json({ password: data.password });
  } catch (err) {
    return handleError(res, err, "Failed to fetch master password");
  }
});

// PUT update master password
app.put("/api/admin/master-password", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    const { data, error } = await supabaseAdmin
      .from("master_password")
      .upsert([{ id: 1, password }], { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;

    res.json({ message: "Master password updated ✅", password: data.password });
  } catch (err) {
    return handleError(res, err, "Failed to update master password");
  }
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Admin backend running at http://localhost:${PORT}`));
