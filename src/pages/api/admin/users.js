import { supabaseAdmin } from "../../../supabaseAdminClient";

export default async function handler(req, res) {
  try {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // GET all users
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) return res.status(400).json({ error: error.message });

      const allUsers = data.users.map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        disabled: user.disabled,
        user_metadata: user.user_metadata || {},
      }));

      return res.status(200).json({ users: allUsers });
    }

    // DELETE a user
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "User ID is required" });

      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ success: true });
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error("❌ Admin API error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
