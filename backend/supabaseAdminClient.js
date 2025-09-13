// backend/src/supabaseAdminClient.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // must be service role key

if (!supabaseUrl || !serviceKey) {
  throw new Error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey);
