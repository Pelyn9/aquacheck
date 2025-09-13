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
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ✅ forces confirmation manually
      user_metadata: { role: "admin" },
    });

    if (error) {
      console.error("❌ Supabase error creating user:", error.message);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      user: data.user || data,
      message: `✅ Admin user created successfully (${email})`,
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Admin backend running at http://localhost:${PORT}`)
);
