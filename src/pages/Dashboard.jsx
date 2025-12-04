// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const FIXED_INTERVAL = 900000; // 15 minutes

const AdminDashboard = () => {
  const intervalRef = useRef(null);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(0);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  // ===========================
  // SAFETY SCORE
  // ===========================
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every((v) => v === "N/A")) {
      setOverallSafety("N/A");
      return;
    }

    const scores = Object.entries(data).map(([key, value]) => {
      if (value === "N/A") return 0;
      const v = parseFloat(value);

      switch (key) {
        case "ph": return v >= 6.5 && v <= 8.5 ? 2 : 0;
        case "turbidity": return v <= 5 ? 2 : v <= 10 ? 1 : 0;
        case "temp": return v >= 24 && v <= 32 ? 2 : 0;
        case "tds": return v <= 500 ? 2 : 0;
        default: return 0;
      }
    });

    const total = scores.reduce((a, b) => a + b, 0);

    if (total >= 7) setOverallSafety("Safe");
    else if (total >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  // ===========================
  // FETCH SENSOR DATA
  // ===========================
  const fetchSensorData = useCallback(async () => {
    try {
      // Primary: ESP32 Local
      const res = await fetch(esp32Url, { cache: "no-store" });
      if (!res.ok) throw new Error("ESP32 unavailable");
      const json = await res.json();
      const latest = json.latestData || json;

      const formatted = {
        ph: latest.ph ? (+latest.ph).toFixed(2) : "N/A",
        turbidity: latest.turbidity ? (+latest.turbidity).toFixed(1) : "N/A",
        temp: latest.temperature ? (+latest.temperature).toFixed(1) : "N/A",
        tds: latest.tds ? (+latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ ESP32 data fetched.");

      return formatted;
    } catch (e) {
      // Secondary: Cloud Backup
      try {
        const cloudRes = await fetch("/api/data");
        const json = await cloudRes.json();
        const latest = json.latestData || {};

        const formatted = {
          ph: latest.ph ? (+latest.ph).toFixed(2) : "N/A",
          turbidity: latest.turbidity ? (+latest.turbidity).toFixed(1) : "N/A",
          temp: latest.temperature ? (+latest.temperature).toFixed(1) : "N/A",
          tds: latest.tds ? (+latest.tds).toFixed(0) : "N/A",
        };

        setSensorData(formatted);
        computeOverallSafety(formatted);
        setStatus("🌐 Cloud backup used.");
        return formatted;
      } catch {
        setStatus("❌ Failed to fetch sensor data.");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  // ===========================
  // SAVE NOW + AUTO-SAVE
  // ===========================
  const handleAutoSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const record = {
        user_id: user.id,
        ph: +data.ph || null,
        turbidity: +data.turbidity || null,
        temperature: +data.temp || null,
        tds: +data.tds || null,
      };

      const { error } = await supabase.from("dataset_history").insert([record]);
      if (error) throw error;

      const nextTS = Date.now() + FIXED_INTERVAL;

      await supabase
        .from("device_scanning")
        .update({
          next_auto_save_ts: nextTS,
          status: 1,
        })
        .eq("id", 1);

      setStatus(`💾 Auto-saved @ ${new Date().toLocaleTimeString()}`);
    } catch {
      setStatus("❌ Auto-save failed.");
    }
  }, [fetchSensorData]);

  // ===========================
  // COUNTDOWN TIMER
  // ===========================
  const startCountdown = useCallback((nextTS) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const remaining = nextTS - Date.now();
      setCountdown(Math.max(0, Math.floor(remaining / 1000)));

      if (remaining <= 0 && autoScanRunning) {
        await handleAutoSave();
      }
    }, 1000);
  }, [autoScanRunning, handleAutoSave]);

  // ===========================
  // TOGGLE AUTO-SCAN (NO RESET)
  // ===========================
  const toggleAutoScan = useCallback(async () => {
    const newStatus = !autoScanRunning;
    setAutoScanRunning(newStatus);

    try {
      const nextTS = newStatus ? Date.now() + FIXED_INTERVAL : null;

      await supabase.from("device_scanning").update({
        status: newStatus ? 1 : 0,
        next_auto_save_ts: nextTS
      }).eq("id", 1);

      // 🟥 STOPPING AUTO SCAN — RESET TO N/A
      if (!newStatus) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCountdown(0);

        setSensorData({
          ph: "N/A",
          turbidity: "N/A",
          temp: "N/A",
          tds: "N/A",
        });

        setOverallSafety("N/A");

        setStatus("⏹ Auto-scan stopped (sensor data N/A)");
        return;
      }

      // 🟩 START AUTO SCAN
      startCountdown(nextTS);
      setStatus("▶ Auto-scan started");
    } catch (e) {
      console.error("Auto-scan error:", e);
    }
  }, [autoScanRunning, startCountdown]);


  // ===========================
  // INITIAL LOAD
  // ===========================
  useEffect(() => {
    fetchSensorData();
  }, [fetchSensorData]);

  // ===========================
  // REALTIME LISTENER
  // ===========================
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (!data) return;

      setAutoScanRunning(data.status === 1);

      if (data.next_auto_save_ts) {
        startCountdown(data.next_auto_save_ts);
      }
    };
    init();

    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "device_scanning",
          filter: "id=eq.1",
        },
        (payload) => {
          const running = payload.new.status === 1;
          setAutoScanRunning(running);

          if (running) {
            startCountdown(payload.new.next_auto_save_ts);
          } else {
            setCountdown(0);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [startCountdown]);

  // ===========================
  // SENSOR CARD STATUS
  // ===========================
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const v = parseFloat(value);

    switch (type) {
      case "ph": return v >= 6.5 && v <= 8.5 ? "safe" : "unsafe";
      case "turbidity": return v <= 5 ? "safe" : v <= 10 ? "moderate" : "unsafe";
      case "temp": return v >= 24 && v <= 32 ? "safe" : "unsafe";
      case "tds": return v <= 500 ? "safe" : "unsafe";
      default: return "";
    }
  };

  // ===========================
  // UI
  // ===========================
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>

        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleAutoSave}>Save Now</button>

            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in:{" "}
              <strong>{Math.floor(countdown / 60)}m {countdown % 60}s</strong>
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
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
              <p className={`status-label ${getSensorStatus(key, sensorData[key])}`}>
                {sensorData[key] === "N/A"
                  ? "NO DATA"
                  : getSensorStatus(key, sensorData[key]).toUpperCase()}
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
