import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes
  const intervalRef = useRef(null);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  // =============================================
  // COMPUTE OVERALL SAFETY SCORE
  // =============================================
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

  // =============================================
  // FETCH SENSOR DATA (ESP32 + CLOUD BACKUP)
  // =============================================
  const fetchSensorData = useCallback(async () => {
    const handleFormat = (latest) => ({
      ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
      turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
      temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
      tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
    });

    try {
      const res = await fetch(esp32Url, { cache: "no-store" });
      if (!res.ok) throw new Error("ESP32 request failed");

      const json = await res.json();
      const latest = json.latestData || json;
      const formatted = handleFormat(latest);

      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ ESP32 data fetched");

      return formatted;
    } catch (err) {
      console.warn("ESP32 failed, using cloud backup...");

      try {
        const cloud = await fetch("/api/data", { cache: "no-store" });
        const json = await cloud.json();
        const latest = json.latestData || {};
        const formatted = handleFormat(latest);

        setSensorData(formatted);
        computeOverallSafety(formatted);
        setStatus("🌐 Cloud backup used");

        return formatted;
      } catch (err2) {
        console.error("Both ESP32 and Cloud failed:", err2);
        setStatus("❌ Failed to fetch sensor data");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  // =============================================
  // AUTO SAVE
  // =============================================
  const handleAutoSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const savePayload = {
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([savePayload]);
      if (error) throw error;

      // Update realtime sync state
      await supabase
        .from("device_scanning")
        .update({ last_scan_time: new Date().toISOString() })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error("Auto-save error:", err);
      setStatus("❌ Auto-save failed");
    }
  }, [fetchSensorData]);

  // =============================================
  // AUTO SCAN LOOP (COUNTDOWN)
  // =============================================
  const startAutoScanLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let start = parseInt(localStorage.getItem("autoScanStartTime") || Date.now());
    localStorage.setItem("autoScanStartTime", start);

    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - start;
      const remaining = FIXED_INTERVAL - (elapsed % FIXED_INTERVAL);

      setCountdown(Math.floor(remaining / 1000));

      if (remaining <= 1000) await handleAutoSave();
    }, 1000);

    fetchSensorData();
  }, [fetchSensorData, handleAutoSave]);

  const stopAutoScanLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
    setOverallSafety("N/A");
  }, []);

  // =============================================
  // TOGGLE AUTO SCAN
  // =============================================
  const toggleAutoScan = useCallback(async () => {
    const newState = !autoScanRunning;
    setAutoScanRunning(newState);

    try {
      await supabase.from("device_scanning").upsert({
        id: 1,
        status: newState ? 1 : 0,
        interval_ms: FIXED_INTERVAL,
      });

      if (!newState) localStorage.removeItem("autoScanStartTime");
    } catch (err) {
      console.error("Failed to update auto scan:", err);
    }
  }, [autoScanRunning]);

  // =============================================
  // REALTIME LISTENER FOR device_scanning
  // =============================================
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (data) {
        setAutoScanRunning(data.status === 1);

        if (data.last_scan_time) {
          const elapsed = Date.now() - new Date(data.last_scan_time).getTime();
          setCountdown(Math.max(FIXED_INTERVAL / 1000 - Math.floor(elapsed / 1000), 0));
        }
      }
    };
    init();

    const channel = supabase
      .channel("device_scanning_rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning", filter: "id=eq.1" },
        (payload) => {
          const running = payload.new.status === 1;
          setAutoScanRunning(running);

          if (payload.new.last_scan_time) {
            const last = new Date(payload.new.last_scan_time).getTime();
            const elapsed = Date.now() - last;
            setCountdown(Math.max(FIXED_INTERVAL / 1000 - Math.floor(elapsed / 1000), 0));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Start/Stop loop based on realtime status
  useEffect(() => {
    if (autoScanRunning) startAutoScanLoop();
    else stopAutoScanLoop();
  }, [autoScanRunning, startAutoScanLoop, stopAutoScanLoop]);

  // Sensor status color
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
          {["ph", "turbidity", "temp", "tds"].map(key => (
            <div key={key} className={`sensor-card ${getSensorStatus(key, sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>
                {sensorData[key]}{" "}
                {key === "turbidity" ? "NTU" : key === "temp" ? "°C" : key === "tds" ? "ppm" : ""}
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
