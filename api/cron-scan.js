import { createClient } from "@supabase/supabase-js";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const SENSOR_TIMEOUT_MS = 7000;

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeSensorPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const source = payload.latestData && typeof payload.latestData === "object" ? payload.latestData : payload;

  const normalized = {
    ph: toNumberOrNull(source.ph),
    turbidity: toNumberOrNull(source.turbidity),
    temperature: toNumberOrNull(source.temperature ?? source.temp),
    tds: toNumberOrNull(source.tds),
  };

  const hasValues = Object.values(normalized).some((value) => value !== null);
  return hasValues ? normalized : null;
};

const toDashboardSensorShape = (sensor) => ({
  ph: sensor.ph !== null ? Number(sensor.ph).toFixed(2) : "N/A",
  turbidity: sensor.turbidity !== null ? Number(sensor.turbidity).toFixed(1) : "N/A",
  temp: sensor.temperature !== null ? Number(sensor.temperature).toFixed(1) : "N/A",
  tds: sensor.tds !== null ? Number(sensor.tds).toFixed(0) : "N/A",
});

const resolveSiteUrl = () => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
};

const fetchJsonWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SENSOR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchCurrentSensor = async (scanConfig) => {
  const urls = new Set();

  if (process.env.SENSOR_SOURCE_URL) {
    urls.add(process.env.SENSOR_SOURCE_URL);
  }

  const siteUrl = resolveSiteUrl();
  if (siteUrl) {
    urls.add(`${siteUrl}/api/data`);
  }

  for (const url of urls) {
    try {
      const payload = await fetchJsonWithTimeout(url);
      const normalized = normalizeSensorPayload(payload);
      if (normalized) return { sensor: normalized, source: url };
    } catch {
      // Continue fallback chain.
    }
  }

  const fromDb = normalizeSensorPayload(scanConfig?.latest_sensor);
  if (fromDb) {
    return { sensor: fromDb, source: "device_scanning.latest_sensor" };
  }

  return { sensor: null, source: null };
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error:
        "Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL environment variables.",
    });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: "Unauthorized cron request." });
    }
  }

  try {
    const { data: scanConfig, error: scanError } = await supabase
      .from("device_scanning")
      .select("id, status, interval_ms, next_auto_save_ts, latest_sensor, started_by")
      .eq("id", 1)
      .single();

    if (scanError) {
      return res.status(500).json({ ok: false, error: scanError.message });
    }

    if (!scanConfig || scanConfig.status !== 1) {
      return res.status(200).json({ ok: true, ran: false, reason: "auto_scan_disabled" });
    }

    const now = Date.now();
    const nextAutoSaveTs = Number(scanConfig.next_auto_save_ts || 0);
    const intervalMs =
      Number.isFinite(Number(scanConfig.interval_ms)) && Number(scanConfig.interval_ms) > 0
        ? Number(scanConfig.interval_ms)
        : DEFAULT_INTERVAL_MS;

    if (nextAutoSaveTs > now) {
      return res.status(200).json({
        ok: true,
        ran: false,
        reason: "not_due",
        next_auto_save_ts: nextAutoSaveTs,
      });
    }

    const { sensor, source } = await fetchCurrentSensor(scanConfig);
    if (!sensor) {
      return res.status(200).json({
        ok: true,
        ran: false,
        reason: "no_sensor_data_available",
      });
    }

    const userId = scanConfig.started_by || process.env.DEFAULT_USER_ID || null;
    if (!userId) {
      return res.status(500).json({
        ok: false,
        error:
          "No user_id available for auto-save. Start scan from dashboard or set DEFAULT_USER_ID env variable.",
      });
    }

    const entry = {
      user_id: userId,
      ph: sensor.ph,
      turbidity: sensor.turbidity,
      temperature: sensor.temperature,
      tds: sensor.tds,
    };

    const { error: insertError } = await supabase.from("dataset_history").insert([entry]);
    if (insertError) {
      return res.status(500).json({ ok: false, error: insertError.message });
    }

    const nextTimestamp = now + intervalMs;
    const latestSensor = toDashboardSensorShape(sensor);

    const { error: updateError } = await supabase
      .from("device_scanning")
      .update({
        last_scan_time: new Date(now).toISOString(),
        next_auto_save_ts: nextTimestamp,
        latest_sensor: latestSensor,
      })
      .eq("id", 1);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      ran: true,
      source,
      next_auto_save_ts: nextTimestamp,
      saved_at: new Date(now).toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unknown cron error",
    });
  }
}
