import express from "express";
import { supabaseAdmin } from "../supabaseAdminClient.js";

const router = express.Router();

// POST /api/admin/create-user
router.post("/create-user", async (req, res) => {
  const { email, password, key } = req.body;

  // -----------------------------
  // 0. Validate input
  // -----------------------------
  if (!email || !password || !key) {
    return res
      .status(400)
      .json({ error: "Missing email, password, or admin key" });
  }

  // -----------------------------
  // 1. Verify admin key
  // -----------------------------
  if (key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  try {
    // -----------------------------
    // 2. Check if user already exists
    // -----------------------------
    const { data: userList, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) throw listError;

    const existingUser = userList?.users?.find((u) => u.email === email);

    if (existingUser) {
      // ✅ Update existing user: set role = admin, confirm email
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          user_metadata: { role: "admin" },
          email_confirm: true,
        }
      );

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // 🔹 Ensure user exists in Admins table
      await supabaseAdmin.from("Admins").upsert(
        {
          auth_id: existingUser.id,
          email,
        },
        { onConflict: "auth_id" }
      );

      return res.json({
        user: data,
        message: "Existing user updated as admin and synced to Admins table",
      });
    }

    // -----------------------------
    // 3. Create new admin user
    // -----------------------------
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // -----------------------------
    // 4. Insert into Admins table
    // -----------------------------
    const newUser = data.user ?? data;

    await supabaseAdmin.from("Admins").insert({
      auth_id: newUser.id,
      email,
    });

    return res.json({
      user: newUser,
      message: "New admin user created and added to Admins table",
    });
  } catch (err) {
    console.error("❌ Create/update admin user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
