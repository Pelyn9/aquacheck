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

/**
 * GET all users
 */
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
    }));

    res.json({ users: mappedUsers });
  } catch (err) {
    console.error("❌ Failed to fetch users:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
});

/**
 * POST create/update admin user
 */
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  if (!email || !password || !key) {
    return res
      .status(400)
      .json({ error: "Missing email, password, or admin key" });
  }

  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = data.users?.find((u) => u.email === email);

    if (existingUser) {
      const { data: updatedUser, error } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          user_metadata: { role: "admin" },
          email_confirm: true,
        });

      if (error) return res.status(400).json({ error: error.message });

      await supabaseAdmin.from("Admins").upsert(
        { auth_id: existingUser.id, email },
        { onConflict: "auth_id" }
      );

      return res.json({
        user: updatedUser,
        message: "✅ Existing user updated as admin",
      });
    }

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "admin" },
      });

    if (createError) return res.status(400).json({ error: createError.message });

    await supabaseAdmin.from("Admins").insert({
      auth_id: newUser.user.id,
      email,
    });

    return res.json({ user: newUser.user, message: "✅ New admin user created" });
  } catch (err) {
    console.error("❌ Create/update admin user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST water quality (from ESP32)
 */
app.post("/api/water-quality", async (req, res) => {
  const { ph, turbidity, tds, temperature } = req.body;

  if (
    ph === undefined &&
    turbidity === undefined &&
    tds === undefined &&
    temperature === undefined
  ) {
    return res.status(400).json({ error: "No water quality data provided" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("water_quality")
      .insert([{ ph, turbidity, tds, temperature }])
      .select();

    if (error) throw error;

    console.log("✅ Water quality saved:", data);
    res.json({ message: "✅ Water quality saved", data });
  } catch (err) {
    console.error("❌ Error saving water quality:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start server
 */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Admin backend running at http://localhost:${PORT}`)
);

/**
 * GET master password
 */
app.get("/api/admin/master-password", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("master_password") // make sure this table exists in Supabase
      .select("*")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // ignore empty table

    if (!data) {
      // Insert default password if not exists
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
    console.error("❌ Failed to fetch master password:", err);
    res.status(500).json({ error: "Failed to fetch master password" });
  }
});

/**
 * PUT update master password
 */
app.put("/api/admin/master-password", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    const { data, error } = await supabaseAdmin
      .from("master_password")
      .upsert([{ id: 1, password }], { onConflict: "id" }) // assuming id=1 for single master
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Master password updated ✅", password: data.password });
  } catch (err) {
    console.error("❌ Failed to update master password:", err);
    res.status(500).json({ error: "Failed to update master password" });
  }
});

