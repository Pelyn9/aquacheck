import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

/**
 * ======================================================================
 *  ADMIN DASHBOARD — ADVANCED VERSION
 *  - Auto scan (15 minutes)
 *  - Manual fetch
 *  - Auto save
 *  - Overall safety computation
 *  - ESP32 + Vercel fallback API
 *  - Sensor reset to "N/A" when Auto Scan stops   <-- REQUIRED FEATURE
 * ======================================================================
 */

const AdminDashboard = () => {
  /* ----------------------------------------------
   * CONFIGURATION
   * ---------------------------------------------- */
  const FIXED_INTERVAL = 900000; // 15 minutes in milliseconds

  /* ----------------------------------------------
   * STATE MANAGEMENT
   * ---------------------------------------------- */
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [manualStopped, setManualStopped] = useState(false);

  /* ----------------------------------------------
   * ESP32 URL DETECTION
   * ---------------------------------------------- */
  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  /* ----------------------------------------------
   * OVERALL SAFETY COMPUTATION FUNCTION
   * ---------------------------------------------- */
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

  /* ----------------------------------------------
   * FETCH SENSOR DATA FUNCTION (ESP32 + Vercel backup)
   * ---------------------------------------------- */
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

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ ESP32 data fetched.");
      return formatted;

    } catch (err) {
      console.warn("ESP32 failed, trying cloud backup...");

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

        setSensorData(formatted);
        computeOverallSafety(formatted);
        setStatus("🌐 Cloud backup used.");
        return formatted;

      } catch (err2) {
        console.error("Both ESP32 & Cloud failed:", err2);
        setStatus("❌ Failed to fetch data");
        setOverallSafety("N/A");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  /* ----------------------------------------------
   * MANUAL SAVE FUNCTION
   * ---------------------------------------------- */
  const handleSave = useCallback(async () => {
    if (Object.values(sensorData).every((v) => v === "N/A")) {
      setStatus("⚠ Cannot save—sensor data is empty.");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("⚠ User authentication required.");
        return;
      }

      const saveData = {
        user_id: user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase
        .from("dataset_history")
        .insert([saveData]);

      if (error) throw error;

      setStatus("💾 Saved successfully.");
    } catch (err) {
      console.error(err);
      setStatus("❌ Save failed.");
    }
  }, [sensorData]);

  /* ----------------------------------------------
   * AUTO SAVE FUNCTION
   * ---------------------------------------------- */
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

      const { error } = await supabase
        .from("dataset_history")
        .insert([saveData]);

      if (error) throw error;

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
      localStorage.setItem("lastAutoSave", Date.now().toString());
    } catch (err) {
      console.error(err);
      setStatus("❌ Auto-save failed.");
    }
  }, [fetchSensorData]);

  /* ----------------------------------------------
   * AUTO SCAN LOOP
   * ---------------------------------------------- */
  useEffect(() => {
    let interval = null;

    if (localStorage.getItem("autoScanRunning") === "true" && !manualStopped) {
      const startTime = parseInt(
        localStorage.getItem("autoScanStartTime") || Date.now()
      );
      localStorage.setItem("autoScanStartTime", startTime);

      interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const remaining = FIXED_INTERVAL - (elapsed % FIXED_INTERVAL);

        setCountdown(Math.floor(remaining / 1000));

        if (remaining <= 1000) await handleAutoSave();
      }, 1000);

      fetchSensorData();
    }

    return () => interval && clearInterval(interval);
  }, [fetchSensorData, handleAutoSave, manualStopped]);

  /* ----------------------------------------------
   * AUTO SCAN TOGGLE
   * — Stop Auto Scan → CLEAR SENSOR DATA (YOUR REQUEST)
   * ---------------------------------------------- */
  const toggleAutoScan = useCallback(() => {
    const running = localStorage.getItem("autoScanRunning") === "true";

    if (running) {
      // STOPPING AUTOSCAN
      localStorage.setItem("autoScanRunning", "false");
      setManualStopped(true);

      // 🔥 REQUIRED FEATURE — Reset sensors on stop
      setSensorData({
        ph: "N/A",
        turbidity: "N/A",
        temp: "N/A",
        tds: "N/A",
      });

      setOverallSafety("N/A");
      setStatus("🛑 Auto Scan stopped — all sensors reset.");
      return;
    }

    // START AUTO SCAN
    localStorage.setItem("autoScanRunning", "true");
    localStorage.setItem("autoScanStartTime", Date.now());
    setManualStopped(false);

    fetchSensorData();
    setStatus("🔄 Auto Scan started (15-minute interval).");
  }, [fetchSensorData]);

  /* ----------------------------------------------
   * SENSOR STATUS COLOR FUNCTION
   * ---------------------------------------------- */
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

  /* ----------------------------------------------
   * JSX RETURN
   * ---------------------------------------------- */
  return (
    <div className="dashboard-container">
      <Sidebar />

      <main className="main-content">
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        {/* AUTOSCAN CONTROL AREA */}
        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleSave}>
              Save Manually
            </button>

            <button
              className={`start-stop-btn ${
                localStorage.getItem("autoScanRunning") === "true"
                  ? "stop"
                  : "start"
              }`}
              onClick={toggleAutoScan}
            >
              {localStorage.getItem("autoScanRunning") === "true"
                ? "Stop Auto Scan"
                : "Start Auto Scan"}
            </button>
          </div>

          {localStorage.getItem("autoScanRunning") === "true" &&
            !manualStopped && (
              <div className="countdown-timer">
                ⏱ Next auto-save in:
                <strong>
                  {" "}
                  {Math.floor(countdown / 60)}m {countdown % 60}s
                </strong>
              </div>
            )}
        </section>

        {/* SENSOR DISPLAY GRID */}
        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
            <div
              key={key}
              className={`sensor-card ${getSensorStatus(
                key,
                sensorData[key]
              )}`}
            >
              <h3>{key.toUpperCase()}</h3>
              <p>
                {sensorData[key]}{" "}
                {key === "turbidity"
                  ? "NTU"
                  : key === "temp"
                  ? "°C"
                  : key === "tds"
                  ? "ppm"
                  : ""}
              </p>

              <p
                className={`status-label ${getSensorStatus(
                  key,
                  sensorData[key]
                )}`}
              >
                {sensorData[key] === "N/A"
                  ? "NO DATA"
                  : getSensorStatus(key, sensorData[key]).toUpperCase()}
              </p>
            </div>
          ))}
        </section>

        {/* OVERALL SAFETY */}
        <section className={`overall-safety ${overallSafety.toLowerCase()}`}>
          <h2>Swimming Safety: {overallSafety}</h2>
        </section>

        {/* STATUS MESSAGE */}
        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
