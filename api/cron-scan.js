const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const SENSOR_TIMEOUT_MS = 7000;

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const supabaseRequest = async (path, { method = "GET", body, prefer } = {}) => {
  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json",
  };

  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await safeJson(response);

  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
};

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
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
    const scanRows = await supabaseRequest(
      "device_scanning?id=eq.1&select=id,status,next_auto_save_ts,latest_sensor"
    );

    const scanConfig = Array.isArray(scanRows) ? scanRows[0] : null;
    if (!scanConfig || Number(scanConfig.status) !== 1) {
      return res.status(200).json({ ok: true, ran: false, reason: "auto_scan_disabled" });
    }

    const now = Date.now();
    const nextAutoSaveTs = Number(scanConfig.next_auto_save_ts || 0);
    const intervalMs = DEFAULT_INTERVAL_MS;

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

    const userId = process.env.DEFAULT_USER_ID || null;
    if (!userId) {
      return res.status(500).json({
        ok: false,
        error: "No user_id available for auto-save. Set DEFAULT_USER_ID environment variable.",
      });
    }

    const entry = {
      user_id: userId,
      ph: sensor.ph,
      turbidity: sensor.turbidity,
      temperature: sensor.temperature,
      tds: sensor.tds,
    };

    await supabaseRequest("dataset_history", {
      method: "POST",
      body: [entry],
      prefer: "return=minimal",
    });

    const nextTimestamp = now + intervalMs;
    const latestSensor = toDashboardSensorShape(sensor);

    await supabaseRequest("device_scanning?id=eq.1", {
      method: "PATCH",
      body: {
        last_scan_time: new Date(now).toISOString(),
        next_auto_save_ts: nextTimestamp,
        latest_sensor: latestSensor,
      },
      prefer: "return=minimal",
    });

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

module.exports = handler;
