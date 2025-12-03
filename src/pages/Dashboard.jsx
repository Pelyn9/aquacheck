import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

/**
 * ======================================================================
 *  ADMIN DASHBOARD — ADVANCED VERSION + GLOBAL AUTO SCAN
 * ======================================================================
 */

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes in milliseconds

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScan, setAutoScan] = useState({ running: false, nextAutoSave: null });

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  /* ----------------------------------------------
   * SAFETY COMPUTATION
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
        case "ph": return val >= 6.5 && val <= 8.5 ? 2 : 0;
        case "turbidity": return val <= 5 ? 2 : val <= 10 ? 1 : 0;
        case "temp": return val >= 24 && val <= 32 ? 2 : 0;
        case "tds": return val <= 500 ? 2 : 0;
        default: return 0;
      }
    });

    const total = scores.reduce((a, b) => a + b, 0);
    if (total >= 7) setOverallSafety("Safe");
    else if (total >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  /* ----------------------------------------------
   * FETCH SENSOR DATA
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
   * MANUAL SAVE
   * ---------------------------------------------- */
  const handleSave = useCallback(async () => {
    if (Object.values(sensorData).every((v) => v === "N/A")) {
      setStatus("⚠ Cannot save—sensor data is empty.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatus("💾 Saved successfully.");
    } catch (err) {
      console.error(err);
      setStatus("❌ Save failed.");
    }
  }, [sensorData]);

  /* ----------------------------------------------
   * GLOBAL AUTO SCAN TOGGLE
   * ---------------------------------------------- */
  const toggleAutoScan = useCallback(async () => {
    try {
      const row = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if (!row.data) return;

      const newStatus = row.data.status === 1 ? 0 : 1;

      // STOP → reset sensors
      if (newStatus === 0) {
        setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
        setOverallSafety("N/A");
        setStatus("🛑 Auto Scan stopped — sensors reset.");
      } else {
        fetchSensorData();
        setStatus("🔄 Auto Scan started (15-minute interval).");
      }

      // Update Supabase row
      await supabase.from("device_scanning").update({
        status: newStatus,
        next_auto_save_ts: Date.now() + FIXED_INTERVAL,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);

    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to toggle Auto Scan.");
    }
  }, [fetchSensorData]);

  /* ----------------------------------------------
   * REALTIME SUBSCRIPTION FOR GLOBAL AUTO-SCAN
   * ---------------------------------------------- */
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if (data) {
        setAutoScan({
          running: data.status === 1,
          nextAutoSave: data.next_auto_save_ts,
        });
      }
    };
    fetchInitial();

    const subscription = supabase
      .from("device_scanning:id=eq.1")
      .on("UPDATE", payload => {
        setAutoScan({
          running: payload.new.status === 1,
          nextAutoSave: payload.new.next_auto_save_ts,
        });
      })
      .subscribe();

    return () => supabase.removeSubscription(subscription);
  }, []);

  /* ----------------------------------------------
   * AUTO-SAVE COUNTDOWN
   * ---------------------------------------------- */
  useEffect(() => {
    if (!autoScan.running) return;

    const interval = setInterval(() => {
      if (!autoScan.nextAutoSave) return;

      const remaining = Math.max(0, Math.floor((autoScan.nextAutoSave - Date.now()) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        // Trigger auto-save
        handleSave();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoScan, handleSave]);

  /* ----------------------------------------------
   * SENSOR STATUS COLOR
   * ---------------------------------------------- */
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";

    const val = parseFloat(value);
    switch (type) {
      case "ph": return val >= 6.5 && val <= 8.5 ? "safe" : "unsafe";
      case "turbidity": return val <= 5 ? "safe" : val <= 10 ? "moderate" : "unsafe";
      case "temp": return val >= 24 && val <= 32 ? "safe" : "unsafe";
      case "tds": return val <= 500 ? "safe" : "unsafe";
      default: return "";
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

        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleSave}>Save Manually</button>
            <button
              className={`start-stop-btn ${autoScan.running ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScan.running ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          {autoScan.running && (
            <div className="countdown-timer">
              ⏱ Next auto-save in: <strong>{Math.floor(countdown / 60)}m {countdown % 60}s</strong>
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map(key => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]} {key==="turbidity"?"NTU":key==="temp"?"°C":key==="tds"?"ppm":""}</p>
              <p className={`status-label ${getSensorStatus(key, sensorData[key])}`}>
                {sensorData[key]==="N/A"?"NO DATA":getSensorStatus(key,sensorData[key]).toUpperCase()}
              </p>
            </div>
          ))}
        </section>

        <section className={`overall-safety ${overallSafety.toLowerCase()}`}>
          <h2>Swimming Safety: {overallSafety}</h2>
        </section>

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
