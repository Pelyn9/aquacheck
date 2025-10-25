import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const {
    autoScanRunning,
    startAutoScan,
    stopAutoScan,
    intervalTime,
    setIntervalTime,
  } = useContext(AutoScanContext);

  const [sensorData, setSensorData] = useState({
    ph: localStorage.getItem("ph") || "N/A",
    turbidity: localStorage.getItem("turbidity") || "N/A",
    temp: localStorage.getItem("temp") || "N/A",
    tds: localStorage.getItem("tds") || "N/A",
  });

  const [status, setStatus] = useState("Awaiting sensor data...");
  const [, setMasterPassword] = useState("");
  const [countdown, setCountdown] = useState(intervalTime / 1000);

  const countdownRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const isScanning = useRef(false);
  const hasSaved = useRef(false); // prevents saving multiple times per interval

  // Master Password setup
  useEffect(() => {
    const storedPass = localStorage.getItem("masterPassword");
    if (storedPass) {
      setMasterPassword(storedPass);
    } else {
      const defaultPass = "watercheck123";
      localStorage.setItem("masterPassword", defaultPass);
      setMasterPassword(defaultPass);
    }
  }, []);

  // Fetch data from ESP32
  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch("http://aquacheck.local:5000/data");
      if (!response.ok) throw new Error("ESP32 not reachable");

      const data = await response.json();
      const newData = {
        ph: data.ph ? parseFloat(data.ph).toFixed(2) : "N/A",
        turbidity: data.turbidity ? parseFloat(data.turbidity).toFixed(1) : "N/A",
        temp: data.temperature ? parseFloat(data.temperature).toFixed(1) : "N/A",
        tds: data.tds ? parseFloat(data.tds).toFixed(0) : "N/A",
      };

      setSensorData(newData);
      Object.keys(newData).forEach((key) =>
        localStorage.setItem(key, newData[key])
      );

      return newData;
    } catch (error) {
      console.error("❌ Error fetching sensor data:", error);
      setStatus("❌ Failed to fetch data. Check ESP32 or Wi-Fi connection.");
      return null;
    }
  }, []);

  // Manual Save
  const handleSave = useCallback(async () => {
    try {
      if (Object.values(sensorData).every((v) => v === "N/A")) {
        setStatus("⚠ No valid data to save. Please scan first.");
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStatus("⚠ User not authenticated. Please log in.");
        return;
      }

      const data = {
        user_id: user.id,
        ph: parseFloat(sensorData.ph) || null,
        turbidity: parseFloat(sensorData.turbidity) || null,
        temperature: parseFloat(sensorData.temp) || null,
        tds: parseFloat(sensorData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([data]);
      if (error) throw error;

      setStatus("✅ Sensor data saved successfully to history!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error saving data. Please check Supabase connection.");
    }
  }, [sensorData]);

  // Auto Save (once per interval)
  const handleAutoSave = useCallback(async () => {
    if (!isScanning.current || hasSaved.current) return;
    hasSaved.current = true; // mark as saved once

    const newData = await fetchSensorData();
    if (!newData || Object.values(newData).every((v) => v === "N/A")) {
      setStatus("⚠ No valid data to auto-save.");
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStatus("⚠ User not authenticated. Auto-save skipped.");
        return;
      }

      const saveData = {
        user_id: user.id,
        ph: parseFloat(newData.ph) || null,
        turbidity: parseFloat(newData.turbidity) || null,
        temperature: parseFloat(newData.temp) || null,
        tds: parseFloat(newData.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      setStatus(`✅ Auto-saved once at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error("❌ Auto-save error:", err);
      setStatus("❌ Auto-save failed. Check Supabase connection.");
    }
  }, [fetchSensorData]);

  // Stop Auto Scan
  const stopContinuousAutoScan = useCallback(() => {
    clearInterval(countdownRef.current);
    clearInterval(liveIntervalRef.current);
    countdownRef.current = null;
    liveIntervalRef.current = null;
    isScanning.current = false;
    hasSaved.current = false;

    setSensorData({
      ph: "N/A",
      turbidity: "N/A",
      temp: "N/A",
      tds: "N/A",
    });

    setCountdown(intervalTime / 1000);
    setStatus("🛑 Auto Scan stopped. Countdown paused.");
  }, [intervalTime]);

  // Start Auto Scan
  const startContinuousAutoScan = useCallback(() => {
  stopContinuousAutoScan();
  isScanning.current = true;
  hasSaved.current = false;
  setCountdown(intervalTime / 1000);

    // Countdown timer
    countdownRef.current = setInterval(() => {
    setCountdown((prev) => {
      if (prev <= 1) {
        if (!hasSaved.current) {
          handleAutoSave(); // ✅ save once
          hasSaved.current = true; // prevent duplicate save
        }
        setTimeout(() => {
          hasSaved.current = false; // reset flag *after* interval restarts
        }, 1000); // small delay to avoid double trigger
        return intervalTime / 1000; // reset countdown
      }
      return prev - 1;
    });
  }, 1000);

    // Live update every second
    liveIntervalRef.current = setInterval(fetchSensorData, 1000);

     setStatus(`🔄 Auto Scan started (every ${intervalTime / 60000} mins)...`);
}, [fetchSensorData, handleAutoSave, intervalTime, stopContinuousAutoScan]);

  // Toggle Auto Scan
  const toggleAutoScan = useCallback(() => {
    if (autoScanRunning) {
      stopAutoScan();
      stopContinuousAutoScan();
    } else {
      startAutoScan(handleAutoSave);
      startContinuousAutoScan();
    }
  }, [autoScanRunning, stopAutoScan, stopContinuousAutoScan, startAutoScan, startContinuousAutoScan, handleAutoSave]);

  // Manual Scan redirect
  const handleManualScanClick = useCallback(() => {
    if (!autoScanRunning) navigate("/manual-scan");
    else setStatus("⚠️ Stop Auto Scan before using Manual Scan.");
  }, [autoScanRunning, navigate]);

  // Status color logic
  const getSensorStatus = (type, value) => {
    if (value === "N/A") return "";
    const val = parseFloat(value);
    switch (type) {
      case "ph":
        if (val >= 6.5 && val <= 8.5) return "safe";
        if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "moderate";
        return "unsafe";
      case "turbidity":
        if (val <= 5) return "safe";
        if (val > 5 && val <= 10) return "moderate";
        return "unsafe";
      case "temp":
        if (val >= 24 && val <= 32) return "safe";
        if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "moderate";
        return "unsafe";
      case "tds":
        if (val <= 500) return "safe";
        if (val > 500 && val <= 1000) return "moderate";
        return "unsafe";
      default:
        return "";
    }
  };


  useEffect(() => {
    return () => stopContinuousAutoScan();
  }, [stopContinuousAutoScan]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        <section className="scan-controls">
          <div className="interval-setting">
            <label htmlFor="scanInterval">Set Auto Scan Interval:</label>
            <select
              id="scanInterval"
              value={intervalTime}
              onChange={(e) => setIntervalTime(Number(e.target.value))}
              disabled={autoScanRunning}
            >
              <option value={60000}>Every 1 Minute</option>
              <option value={1800000}>Every 30 Minutes</option>
              <option value={3600000}>Every 1 Hour</option>
              <option value={7200000}>Every 2 Hours</option>
              <option value={10800000}>Every 3 Hours</option>
              <option value={14400000}>Every 4 Hours</option>
              <option value={86400000}>Every 24 Hours</option>
            </select>
          </div>

          <div className="button-group">
            <button
              className={`manual-scan-btn ${autoScanRunning ? "disabled" : ""}`}
              onClick={handleManualScanClick}
              disabled={autoScanRunning}
            >
              Manual Scan
            </button>
            <button className="save-btn" onClick={handleSave}>
              Save
            </button>
            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in: {Math.floor(countdown / 60)}m {countdown % 60}s
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
              <p className="status-label">
                {getSensorStatus(key, sensorData[key]).toUpperCase()}
              </p>
            </div>
          ))}
        </section>

        <div className="status-card">{status}</div>
      </main>
    </div>
  );
};

export default AdminDashboard;
