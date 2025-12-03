import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes

  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  const esp32Url = process.env.NODE_ENV === "production" ? "/api/data" : "http://aquacheck.local:5000/data";

  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every(v => v === "N/A")) { setOverallSafety("N/A"); return; }
    const scores = Object.entries(data).map(([k, v]) => {
      if (v === "N/A") return 0;
      const val = parseFloat(v);
      switch (k) {
        case "ph": return val >= 6.5 && val <= 8.5 ? 2 : 0;
        case "turbidity": return val <= 5 ? 2 : val <= 10 ? 1 : 0;
        case "temp": return val >= 24 && val <= 32 ? 2 : 0;
        case "tds": return val <= 500 ? 2 : 0;
        default: return 0;
      }
    });
    const total = scores.reduce((a, b) => a + b, 0);
    setOverallSafety(total >= 7 ? "Safe" : total >= 4 ? "Moderate" : "Unsafe");
  }, []);

  const fetchSensorData = useCallback(async () => {
    try {
      const res = await fetch(esp32Url, { cache: "no-store" });
      if (!res.ok) throw new Error("ESP32 fetch failed");
      const data = await res.json();
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
      } catch {
        setStatus("❌ Failed to fetch data");
        setOverallSafety("N/A");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  const handleAutoSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("dataset_history").insert([{
        user_id: user.id,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      }]);

      // Update last_scan_time in Supabase for cross-device sync
      await supabase.from("device_scanning")
        .update({ last_scan_time: new Date().toISOString() })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setStatus("❌ Auto-save failed.");
      console.error(err);
    }
  }, [fetchSensorData]);

  // -------------------
  // Countdown timer based on last_scan_time
  // -------------------
  const updateCountdown = useCallback((lastScanTime) => {
    if (!lastScanTime) return setCountdown(FIXED_INTERVAL / 1000);
    const elapsed = Date.now() - new Date(lastScanTime).getTime();
    setCountdown(Math.max(Math.ceil((FIXED_INTERVAL - elapsed) / 1000), 0));
  }, []);

  // -------------------
  // Real-time listener & auto-save trigger
  // -------------------
  useEffect(() => {
    let localInterval = null;

    const setup = async () => {
      const { data } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if (data?.status === 1) setAutoScanRunning(true);

      updateCountdown(data?.last_scan_time);

      localInterval = setInterval(async () => {
        const { data: updated } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
        const lastTime = updated?.last_scan_time;
        const isRunning = updated?.status === 1;
        setAutoScanRunning(isRunning);
        updateCountdown(lastTime);

        if (isRunning && lastTime) {
          const remaining = FIXED_INTERVAL - (Date.now() - new Date(lastTime).getTime());
          if (remaining <= 1000) await handleAutoSave();
        }
      }, 1000);
    };

    setup();

    const channel = supabase.channel("scan_status_live")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning", filter: "id=eq.1" },
        payload => {
          const lastTime = payload.new.last_scan_time;
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);
          updateCountdown(lastTime);
        }
      ).subscribe();

    return () => {
      if (localInterval) clearInterval(localInterval);
      supabase.removeChannel(channel);
    };
  }, [handleAutoSave, updateCountdown]);

  const toggleAutoScan = useCallback(async () => {
    const newStatus = !autoScanRunning;
    setAutoScanRunning(newStatus);

    await supabase.from("device_scanning").upsert({
      id: 1,
      status: newStatus ? 1 : 0,
      interval_ms: FIXED_INTERVAL,
      last_scan_time: newStatus ? new Date().toISOString() : null
    });
  }, [autoScanRunning]);

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

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>
        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleAutoSave}>Save Now</button>
            <button className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`} onClick={toggleAutoScan}>
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>
          {autoScanRunning && <div className="countdown-timer">⏱ Next auto-save in: <strong>{Math.floor(countdown / 60)}m {countdown % 60}s</strong></div>}
        </section>
        <section className="sensor-grid">
          {["ph","turbidity","temp","tds"].map(key => (
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
