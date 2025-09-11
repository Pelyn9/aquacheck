// src/server/routes/adminRoutes.js
import express from "express";
import { supabaseAdmin } from "../supabaseAdminClient.js";
import { deleteUser, toggleUserStatus } from "../admin.js";

const router = express.Router();

// GET all users
router.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ users: data.users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a user
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  const data = await deleteUser(id);
  if (!data) return res.status(400).json({ error: "Failed to delete user" });
  res.json({ success: true });
});

// TOGGLE user status
router.post("/users/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const data = await toggleUserStatus(id, isActive);
  if (!data) return res.status(400).json({ error: "Failed to update user" });
  res.json({ success: true });
});

export default router;