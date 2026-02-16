// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes
  const intervalRef = useRef(null);
  const autoSaveLockRef = useRef(false);

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

  // --------------------------
  // Compute Overall Safety
  // --------------------------
  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every((value) => value === "N/A")) {
      setOverallSafety("N/A");
      return;
    }

    const scores = Object.entries(data).map(([key, value]) => {
      if (value === "N/A") return 0;
      const numericValue = parseFloat(value);

      switch (key) {
        case "ph":
          return numericValue >= 6.5 && numericValue <= 8.5 ? 2 : 0;
        case "turbidity":
          return numericValue <= 5 ? 2 : numericValue <= 10 ? 1 : 0;
        case "temp":
          return numericValue >= 24 && numericValue <= 32 ? 2 : 0;
        case "tds":
          return numericValue <= 500 ? 2 : 0;
        default:
          return 0;
      }
    });

    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    if (totalScore >= 7) setOverallSafety("Safe");
    else if (totalScore >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  // --------------------------
  // Fetch Sensor Data
  // --------------------------
  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("ESP32 fetch failed");

      const payload = await response.json();
      const latest = payload.latestData || payload;

      const formatted = {
        ph: latest.ph !== undefined ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity:
          latest.turbidity !== undefined
            ? parseFloat(latest.turbidity).toFixed(1)
            : "N/A",
        temp:
          latest.temperature !== undefined
            ? parseFloat(latest.temperature).toFixed(1)
            : "N/A",
        tds: latest.tds !== undefined ? parseFloat(latest.tds).toFixed(0) : "N/A",
      };

      setSensorData(formatted);
      computeOverallSafety(formatted);
      return formatted;
    } catch {
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // --------------------------
  // Auto Save
  // --------------------------
  const handleAutoSave = useCallback(async () => {
    if (!autoScanRunning || autoSaveLockRef.current) return;

    autoSaveLockRef.current = true;

    try {
      const data = await fetchSensorData();
      if (!data) return;

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

      const nextTimestamp = Date.now() + FIXED_INTERVAL;

      await supabase
        .from("device_scanning")
        .update({
          last_scan_time: new Date().toISOString(),
          next_auto_save_ts: nextTimestamp,
          latest_sensor: data,
        })
        .eq("id", 1);

      setStatus(`Auto-saved at ${new Date().toLocaleTimeString()}`);
      return nextTimestamp;
    } catch (error) {
      console.error("Auto-save error:", error);
      setStatus("Auto-save failed.");
      return Date.now() + FIXED_INTERVAL;
    } finally {
      autoSaveLockRef.current = false;
    }
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // Countdown logic
  // --------------------------
  const startCountdown = useCallback(
    (nextTimestamp) => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(async () => {
        const remaining = nextTimestamp - Date.now();
        setCountdown(Math.max(Math.floor(remaining / 1000), 0));

        if (remaining <= 0) {
          const newNextTimestamp = await handleAutoSave();
          startCountdown(newNextTimestamp);
        }
      }, 1000);
    },
    [handleAutoSave]
  );

  // --------------------------
  // Toggle Auto Scan
  // --------------------------
  const toggleAutoScan = useCallback(async () => {
    const newStatus = !autoScanRunning;
    setAutoScanRunning(newStatus);

    try {
      const nextTimestamp = newStatus ? Date.now() + FIXED_INTERVAL : null;

      await supabase.from("device_scanning").upsert({
        id: 1,
        status: newStatus ? 1 : 0,
        next_auto_save_ts: nextTimestamp,
      });

      if (newStatus) {
        const data = await fetchSensorData();
        if (data) setSensorData(data);

        if (nextTimestamp) startCountdown(nextTimestamp);
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCountdown(0);
        setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
        setOverallSafety("N/A");
        setStatus("Auto-scan stopped.");
      }
    } catch (error) {
      console.error("Failed to update scan status:", error);
    }
  }, [autoScanRunning, fetchSensorData, startCountdown]);

  // --------------------------
  // Live Sensor Updates for UI only
  // --------------------------
  useEffect(() => {
    if (!autoScanRunning) return;

    const liveInterval = setInterval(fetchSensorData, 1000);
    return () => clearInterval(liveInterval);
  }, [autoScanRunning, fetchSensorData]);

  // --------------------------
  // Initialize Dashboard
  // --------------------------
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("*")
        .eq("id", 1)
        .single();

      if (!data) return;

      setAutoScanRunning(data.status === 1);

      if (data.status === 1 && data.latest_sensor) {
        setSensorData(data.latest_sensor);
        computeOverallSafety(data.latest_sensor);
      }

      let nextTimestamp;
      if (data.next_auto_save_ts && data.next_auto_save_ts > Date.now()) {
        nextTimestamp = data.next_auto_save_ts;
      } else if (data.status === 1) {
        nextTimestamp = Date.now() + FIXED_INTERVAL;
        await supabase
          .from("device_scanning")
          .update({ next_auto_save_ts: nextTimestamp })
          .eq("id", 1);
      }

      if (nextTimestamp) startCountdown(nextTimestamp);
    };

    fetchInitial();
  }, [computeOverallSafety, startCountdown]);

  // --------------------------
  // Sensor Status Color
  // --------------------------
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const numericValue = parseFloat(value);

    switch (type) {
      case "ph":
        return numericValue >= 6.5 && numericValue <= 8.5 ? "safe" : "unsafe";
      case "turbidity":
        return numericValue <= 5 ? "safe" : numericValue <= 10 ? "moderate" : "unsafe";
      case "temp":
        return numericValue >= 24 && numericValue <= 32 ? "safe" : "unsafe";
      case "tds":
        return numericValue <= 500 ? "safe" : "unsafe";
      default:
        return "";
    }
  };

  // --------------------------
  // Manual Save
  // --------------------------
  const handleManualSave = useCallback(async () => {
    try {
      setStatus("Saving manually...");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        setStatus("No logged-in user.");
        return;
      }

      const saveData = {
        user_id: userData.user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) setStatus("Manual save failed.");
      else setStatus(`Manual save successful at ${new Date().toLocaleTimeString()}`);
    } catch {
      setStatus("Manual save error.");
    }
  }, [sensorData]);

  const overallSafetyTone =
    overallSafety === "Safe"
      ? "tone-safe"
      : overallSafety === "Moderate"
      ? "tone-moderate"
      : overallSafety === "Unsafe"
      ? "tone-unsafe"
      : "tone-unknown";

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="dashboard-main-content">
        <div className="dashboard-page-shell">
          <header className="dashboard-topbar">
            <h1>Admin Dashboard</h1>
            <p>Live pool monitoring and scheduled saving</p>
          </header>

          <section className="dashboard-scan-controls">
            <div className="dashboard-button-group">
              <button
                type="button"
                className="dashboard-button dashboard-save-btn"
                onClick={handleManualSave}
              >
                Save Now
              </button>
              <button
                type="button"
                className={`dashboard-button dashboard-start-stop-btn ${
                  autoScanRunning ? "stop" : "start"
                }`}
                onClick={toggleAutoScan}
              >
                {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
              </button>
            </div>

            {autoScanRunning && (
              <div className="dashboard-countdown-timer">
                Next auto-save in: <strong>{Math.floor(countdown / 60)}m {countdown % 60}s</strong>
              </div>
            )}
          </section>

          <section className="dashboard-sensor-grid">
            {["ph", "turbidity", "temp", "tds"].map((key) => {
              const sensorStatus = getSensorStatus(key, sensorData[key]);
              const sensorToneClass = sensorStatus ? `status-${sensorStatus}` : "status-unknown";

              return (
                <div key={key} className={`dashboard-sensor-card ${sensorToneClass}`}>
                  <h3>{key.toUpperCase()}</h3>
                  <p className="dashboard-sensor-value">
                    {sensorData[key]} {key === "turbidity" ? "NTU" : key === "temp" ? "C" : key === "tds" ? "ppm" : ""}
                  </p>
                  <p className={`dashboard-status-label ${sensorToneClass}`}>
                    {sensorData[key] === "N/A" ? "NO DATA" : sensorStatus.toUpperCase()}
                  </p>
                </div>
              );
            })}
          </section>

          <section className={`dashboard-overall-safety ${overallSafetyTone}`}>
            <h2>Swimming Safety: {overallSafety}</h2>
          </section>

          <div className="dashboard-status-card">{status}</div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
