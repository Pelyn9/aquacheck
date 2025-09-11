// src/server/supabaseAdminClient.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// ⚠️ Service role key (keep secret - backend only)
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Missing Supabase admin environment variables.");
} else {
  console.log("✅ Supabase admin environment variables loaded successfully.");
}

// Export admin client (backend only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);