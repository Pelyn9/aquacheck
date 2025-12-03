import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

/**
 * Admin Dashboard (global auto-scan via device_scanning table)
 * - Uses device_scanning.status (1 = running, 0 = stopped) for global state
 * - Realtime subscription so all users see changes instantly
 * - When stopped by anyone: sensors reset to "N/A" for all users
 * - Vercel/SSR-safe (no localStorage during initial render)
 */

const AdminDashboard = () => {
  /* -----------------------
   * CONFIG
   * ----------------------- */
  const FIXED_INTERVAL = 900000; // 15 minutes in ms

  /* -----------------------
   * STATE
   * ----------------------- */
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [statusMessage, setStatusMessage] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(null);
  const [overallSafety, setOverallSafety] = useState("N/A");

  // global status (true = running, false = stopped). Drives button text / UI.
  const [globalRunning, setGlobalRunning] = useState(false);

  // Prevent running effects after unmount
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* -----------------------
   * ENV / URL
   * ----------------------- */
  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  /* -----------------------
   * HELPERS: convert DB status -> boolean
   * ----------------------- */
  const dbStatusToBool = (dbStatus) => Number(dbStatus) === 1;
  const boolToDbStatus = (b) => (b ? 1 : 0);

  /* --------------------------------
   * Compute overall safety
   * -------------------------------- */
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every((v) => v === "N/A")) {
      setOverallSafety("N/A");
      return;
    }

    const scores = Object.entries(data).map(([key, value]) => {
      if (value === "N/A") return 0;
      const val = parseFloat(value);
      switch (key) {
        case "ph":
          return val >= 6.5 && val <= 8.5 ? 2 : 0;
        case "turbidity":
          return val <= 5 ? 2 : val <= 10 ? 1 : 0;
        case "temp":
          return val >= 24 && val <= 32 ? 2 : 0;
        case "tds":
          return val <= 500 ? 2 : 0;
        default:
          return 0;
      }
    });

    const total = scores.reduce((a, b) => a + b, 0);
    if (total >= 7) setOverallSafety("Safe");
    else if (total >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  /* --------------------------------
   * FETCH SENSOR DATA (ESP32 primary, /api/data fallback)
   * -------------------------------- */
  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("ESP32 fetch failed");

      const data = await response.json();
      const latest = data.latestData || data;

      const formatted = {
        ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      if (!isMounted.current) return formatted;
      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatusMessage("✅ ESP32 data fetched.");
      return formatted;
    } catch (err) {
      console.warn("ESP32 failed, trying cloud backup...", err);
      try {
        const cloudRes = await fetch("/api/data", { cache: "no-store" });
        const cloudJson = await cloudRes.json();
        const latest = cloudJson.latestData || {};

        const formatted = {
          ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
          turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
          temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
          tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
        };

        if (!isMounted.current) return formatted;
        setSensorData(formatted);
        computeOverallSafety(formatted);
        setStatusMessage("🌐 Cloud backup used.");
        return formatted;
      } catch (err2) {
        console.error("Both sources failed:", err2);
        if (!isMounted.current) return null;
        setStatusMessage("❌ Failed to fetch data");
        setOverallSafety("N/A");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  /* --------------------------------
   * MANUAL SAVE (user-triggered)
   * -------------------------------- */
  const handleSave = useCallback(async () => {
    if (Object.values(sensorData).every((v) => v === "N/A")) {
      setStatusMessage("⚠ Cannot save—sensor data is empty.");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatusMessage("⚠ User authentication required.");
        return;
      }

      const saveData = {
        user_id: user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatusMessage("💾 Saved successfully.");
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Save failed.");
    }
  }, [sensorData]);

  /* --------------------------------
   * AUTO SAVE routine (used by interval)
   * -------------------------------- */
  const handleAutoSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const saveData = {
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatusMessage(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
      // keep last auto save timestamp in localStorage for debugging (optional)
      if (typeof window !== "undefined") localStorage.setItem("lastAutoSave", Date.now().toString());
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Auto-save failed.");
    }
  }, [fetchSensorData]);

  /* --------------------------------
   * DB helpers for global state (device_scanning table)
   * - We expect device_scanning row with id = 1 exists.
   * - We'll read/write "status" column (int2). 1 = running, 0 = stopped.
   * -------------------------------- */
  const fetchGlobalScanState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("device_scanning")
        .select("status, interval_ms, next_auto_save_ts")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("fetchGlobalScanState error:", error);
        return false;
      }
      const running = dbStatusToBool(data.status);
      // keep countdown aligned with next_auto_save_ts if provided
      if (data.next_auto_save_ts && running && typeof data.next_auto_save_ts === "number") {
        const nowMs = Date.now();
        const remainingMs = Math.max(0, data.next_auto_save_ts - nowMs);
        if (isMounted.current) setCountdown(Math.floor(remainingMs / 1000));
      }
      return running;
    } catch (err) {
      console.error("fetchGlobalScanState unexpected:", err);
      return false;
    }
  }, []);

  const updateGlobalScanState = useCallback(async (isRunning) => {
    try {
      const nextTs = isRunning ? Date.now() + FIXED_INTERVAL : null;
      const updates = {
        status: boolToDbStatus(isRunning),
        updated_at: new Date().toISOString(),
        next_auto_save_ts: nextTs,
      };
      const { error } = await supabase.from("device_scanning").update(updates).eq("id", 1);
      if (error) console.error("updateGlobalScanState error:", error);
      return !error;
    } catch (err) {
      console.error("updateGlobalScanState unexpected:", err);
      return false;
    }
  }, []);

  /* --------------------------------
   * Toggle auto-scan (user action)
   * - Updates the device_scanning.status row
   * - When stopping: resets sensors to N/A for everyone
   * -------------------------------- */
  const toggleAutoScan = useCallback(async () => {
    try {
      const currentlyRunning = await fetchGlobalScanState();

      if (currentlyRunning) {
        // STOP globally
        await updateGlobalScanState(false);
        // locally reflect stop
        setGlobalRunning(false);
        setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
        setOverallSafety("N/A");
        setCountdown(null);
        setStatusMessage("🛑 Auto Scan stopped — all sensors reset.");
        return;
      }

      // START globally
      const ok = await updateGlobalScanState(true);
      if (!ok) {
        setStatusMessage("❌ Could not start Auto Scan (DB error).");
        return;
      }

      setGlobalRunning(true);
      setStatusMessage("🔄 Auto Scan started (GLOBAL 15-minute interval).");
      // fetch immediate data for all users now
      await fetchSensorData();
    } catch (err) {
      console.error("toggleAutoScan error:", err);
      setStatusMessage("❌ Error toggling Auto Scan.");
    }
  }, [fetchGlobalScanState, updateGlobalScanState, fetchSensorData]);

  /* --------------------------------
   * Subscribe to realtime changes on device_scanning
   * so all users see updates immediately.
   * -------------------------------- */
  useEffect(() => {
    // fetch initial global state once on mount
    (async () => {
      const running = await fetchGlobalScanState();
      if (!isMounted.current) return;
      setGlobalRunning(running);
      // if running, start countdown loop below; otherwise keep sensors as-is
      if (running) {
        setStatusMessage("🔄 Auto Scan running (synced).");
      }
    })();

    const channel = supabase
      .channel("realtime:device_scanning")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "device_scanning",
          // filter to only the row with id = 1 (optional)
          filter: "id=eq.1",
        },
        (payload) => {
          try {
            const newStatus = payload.new?.status;
            const running = dbStatusToBool(newStatus);

            // update UI for everyone
            setGlobalRunning(running);

            if (running) {
              setStatusMessage("🔄 Auto Scan started by another user.");
              // fetch fresh sensor data when someone else starts
              fetchSensorData();
              // compute countdown using next_auto_save_ts (if available)
              if (payload.new?.next_auto_save_ts) {
                const remainingMs = Math.max(0, payload.new.next_auto_save_ts - Date.now());
                setCountdown(Math.floor(remainingMs / 1000));
              }
            } else {
              // stopped by someone else — reset sensors
              setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
              setOverallSafety("N/A");
              setCountdown(null);
              setStatusMessage("🛑 Auto Scan stopped by another user — sensors reset.");
            }
          } catch (err) {
            console.error("Realtime handler error:", err);
          }
        }
      )
      .subscribe();

    return () => {
      // cleanup subscription
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // older clients use .unsubscribe() — ignore silently
      }
    };
  }, [fetchGlobalScanState, fetchSensorData]);

  /* --------------------------------
   * Auto-scan countdown & auto-save loop
   * Uses globalRunning to decide whether to run
   * -------------------------------- */
  useEffect(() => {
    let interval = null;
    if (globalRunning) {
      // use start reference from DB (next_auto_save_ts if present) or local start time
      const startTime = Date.now();

      interval = setInterval(async () => {
        // compute remaining relative to startTime or FIXED_INTERVAL
        // prefer using next_auto_save_ts from DB would be best, but we approximate here
        const elapsed = Date.now() - startTime;
        const remaining = FIXED_INTERVAL - (elapsed % FIXED_INTERVAL);

        if (!isMounted.current) return;
        setCountdown(Math.floor(remaining / 1000));

        if (remaining <= 1000) {
          await handleAutoSave();
          // update DB next_auto_save_ts so other clients can sync their countdown
          await updateGlobalScanState(true).catch(() => {}); // refresh next_auto_save_ts
        }
      }, 1000);
    } else {
      // not running: ensure countdown cleared
      setCountdown(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [globalRunning, handleAutoSave, updateGlobalScanState]);

  /* --------------------------------
   * Helper: sensor status class name
   * -------------------------------- */
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";

    const val = parseFloat(value);
    switch (type) {
      case "ph":
        return val >= 6.5 && val <= 8.5 ? "safe" : "unsafe";
      case "turbidity":
        return val <= 5 ? "safe" : val <= 10 ? "moderate" : "unsafe";
      case "temp":
        return val >= 24 && val <= 32 ? "safe" : "unsafe";
      case "tds":
        return val <= 500 ? "safe" : "unsafe";
      default:
        return "";
    }
  };

  /* --------------------------------
   * RENDER
   * -------------------------------- */
  return (
    <div className="dashboard-container">
      <Sidebar />

      <main className="main-content">
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        {/* scan controls */}
        <section className="scan-controls">
          <div className="interval-setting">
            <label>Auto Scan Interval:</label>
            <select disabled>
              <option>Every 15 Minutes</option>
            </select>
          </div>

          <div className="button-group">
            <button className="save-btn" onClick={handleSave}>
              Save
            </button>

            <button
              className={`start-stop-btn ${globalRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {globalRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          {globalRunning && countdown !== null && (
            <div className="countdown-timer">
              ⏱ Next auto-save in: {Math.floor(countdown / 60)}m {countdown % 60}s
            </div>
          )}
        </section>

        {/* sensors */}
        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>
                {sensorData[key]}{" "}
                {key === "turbidity" ? "NTU" : key === "temp" ? "°C" : key === "tds" ? "ppm" : ""}
              </p>
              <p className={`status-label ${getSensorStatus(key, sensorData[key])}`}>
                {sensorData[key] === "N/A" ? "NO DATA" : getSensorStatus(key, sensorData[key]).toUpperCase()}
              </p>
            </div>
          ))}
        </section>

        {/* overall */}
        <section className={`overall-safety ${overallSafety.toLowerCase()}`}>
          <h2>Swimming Safety: {overallSafety}</h2>
        </section>

        {/* status area */}
        <div className="status-card">{statusMessage}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
