import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Must be service role key
);

export const config = { runtime: "edge" };

export default async function handler() {
  try {
    let data;

    try {
      const esp = await fetch("http://aquacheck.local:5000/data", { timeout: 5000 });
      if (!esp.ok) throw new Error("ESP32 offline");
      data = await esp.json();
    } catch {
      const cloud = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/data`);
      data = await cloud.json();
    }

    if (!data || Object.keys(data).length === 0) {
      return new Response("⚠ No data received", { status: 400 });
    }

    const entry = {
      user_id: process.env.DEFAULT_USER_ID,
      ph: data.ph ? parseFloat(data.ph) : null,
      turbidity: data.turbidity ? parseFloat(data.turbidity) : null,
      temperature: data.temperature ? parseFloat(data.temperature) : null,
      tds: data.tds ? parseFloat(data.tds) : null,
    };

    const { error } = await supabase.from("dataset_history").insert([entry]);
    if (error) {
      return new Response("❌ Supabase Insert Error: " + error.message, { status: 500 });
    }

    return new Response("✅ Cron saved at " + new Date().toISOString(), { status: 200 });
  } catch (e) {
    return new Response("❌ Cron failed: " + e.message, { status: 500 });
  }
}
