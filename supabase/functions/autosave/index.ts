/// <reference types="@types/deno" />
import { createClient } from "@supabase/supabase-js";

// Supabase connection
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ESP32 URL fallback
const esp32Url = Deno.env.get("ESP32_URL") || "http://aquacheck.local:5000/data";

export async function handler(_req: Request): Promise<Response> {
  try {
    const response = await fetch(esp32Url);
    const data = await response.json();
    const latest = data.latestData || data;

    const formatted = {
      ph: latest.ph ? parseFloat(latest.ph) : null,
      turbidity: latest.turbidity ? parseFloat(latest.turbidity) : null,
      temperature: latest.temperature ? parseFloat(latest.temperature) : null,
      tds: latest.tds ? parseFloat(latest.tds) : null,
    };

    // Save to Supabase dataset_history
    const { error: insertError } = await supabase
      .from("dataset_history")
      .insert([{ user_id: null, ...formatted }]);
    if (insertError) throw insertError;

    // Update device_scanning table
    const { error: updateError } = await supabase
      .from("device_scanning")
      .update({
        latest_sensor: formatted,
        last_scan_time: new Date().toISOString(),
        next_auto_save_ts: Date.now() + 15 * 60 * 1000,
      })
      .eq("id", 1);
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ message: "Auto-save successful", data: formatted }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
