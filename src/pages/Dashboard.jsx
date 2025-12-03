import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const { autoScanRunning, startAutoScan, stopAutoScan } = useContext(AutoScanContext);

  const FIXED_INTERVAL = 900000; // 15 minutes
  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(FIXED_INTERVAL / 1000);
  const [overallSafety, setOverallSafety] = useState("N/A");

  const countdownRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const isScanning = useRef(false);
  const hasSaved = useRef(false);

  const esp32Url = process.env.NODE_ENV === "production"
    ? "/api/data" // Vercel
    : "http://aquacheck.local:5000/data"; // Local ESP32

  const computeOverallSafety = useCallback((data) => {
    if (!data || Object.values(data).every(v => v === "N/A")) {
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

    const total = scores.reduce((a,b)=>a+b,0);
    if (total >= 7) setOverallSafety("Safe");
    else if (total >= 4) setOverallSafety("Moderate");
    else setOverallSafety("Unsafe");
  }, []);

  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url);
      if (!response.ok) throw new Error("Primary source failed");
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
      setStatus("✅ Data fetched successfully.");
      return formatted;
    } catch {
      try {
        const cloudRes = await fetch("/api/data");
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
        setStatus("🌐 Fetched from Vercel backup.");
        return formatted;
      } catch (err) {
        console.error("❌ Both sources failed", err);
        setStatus("❌ Failed to fetch data.");
        setOverallSafety("N/A");
        return null;
      }
    }
  }, [esp32Url, computeOverallSafety]);

  const handleSave = useCallback(async () => {
    if (Object.values(sensorData).every(v=>"N/A")) {
      setStatus("⚠ No valid data to save.");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setStatus("⚠ User not authenticated.");
      const saveData = {
        user_id: user.id,
        ph: parseFloat(sensorData.ph)||null,
        turbidity: parseFloat(sensorData.turbidity)||null,
        temperature: parseFloat(sensorData.temp)||null,
        tds: parseFloat(sensorData.tds)||null
      };
      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if(error) throw error;
      setStatus("✅ Data saved successfully!");
    } catch(err){
      console.error(err);
      setStatus("❌ Error saving data.");
    }
  }, [sensorData]);

  const handleAutoSave = useCallback(async () => {
    if(!isScanning.current || hasSaved.current) return;
    hasSaved.current = true;
    const newData = await fetchSensorData();
    if(!newData || Object.values(newData).every(v=>"N/A")){
      setStatus("⚠ No valid data to auto-save.");
      hasSaved.current = false;
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) { setStatus("⚠ User not authenticated."); hasSaved.current=false; return; }
      const saveData = {
        user_id: user.id,
        ph: parseFloat(newData.ph)||null,
        turbidity: parseFloat(newData.turbidity)||null,
        temperature: parseFloat(newData.temp)||null,
        tds: parseFloat(newData.tds)||null
      };
      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if(error) throw error;
      setStatus(`✅ Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch(err){
      console.error(err);
      setStatus("❌ Auto-save failed.");
    } finally{ hasSaved.current=false; }
  }, [fetchSensorData]);

  const stopContinuousAutoScan = useCallback(()=>{
    clearInterval(countdownRef.current);
    clearInterval(liveIntervalRef.current);
    countdownRef.current = null;
    liveIntervalRef.current = null;
    isScanning.current = false;
    hasSaved.current = false;
    localStorage.removeItem("nextAutoSaveTime");
    setCountdown(FIXED_INTERVAL/1000);
    setStatus("🛑 Auto Scan stopped.");
    localStorage.setItem("autoScanRunning","false");
  },[]);

  const startContinuousAutoScan = useCallback(()=>{
    stopContinuousAutoScan();
    isScanning.current = true;
    hasSaved.current = false;

    // persistent timer
    let endTime = localStorage.getItem("nextAutoSaveTime");
    if (!endTime) {
      endTime = Date.now() + FIXED_INTERVAL;
      localStorage.setItem("nextAutoSaveTime", endTime);
    } else endTime = parseInt(endTime);

    countdownRef.current = setInterval(()=>{
      const now = Date.now();
      const remainingSec = Math.max(Math.ceil((endTime - now)/1000), 0);
      setCountdown(remainingSec);

      if (remainingSec <= 0) {
        handleAutoSave();
        const newEndTime = Date.now() + FIXED_INTERVAL;
        localStorage.setItem("nextAutoSaveTime", newEndTime);
      }
    }, 1000);

    liveIntervalRef.current = setInterval(fetchSensorData, 5000);
    setStatus("🔄 Auto Scan started (every 15 minutes).");
    localStorage.setItem("autoScanRunning","true");
  }, [fetchSensorData, handleAutoSave, stopContinuousAutoScan]);

  const toggleAutoScan = useCallback(()=>{
    if(autoScanRunning){ stopAutoScan(); stopContinuousAutoScan(); }
    else { startAutoScan(handleAutoSave); startContinuousAutoScan(); }
  }, [autoScanRunning, stopAutoScan, stopContinuousAutoScan, startAutoScan, startContinuousAutoScan, handleAutoSave]);

  const getSensorStatus = (type, value) => {
    if(value==="N/A") return "";
    const val=parseFloat(value);
    switch(type){
      case "ph": return val>=6.5&&val<=8.5?"safe":"unsafe";
      case "turbidity": return val<=5?"safe":val<=10?"moderate":"unsafe";
      case "temp": return val>=24&&val<=32?"safe":"unsafe";
      case "tds": return val<=500?"safe":"unsafe";
      default: return "";
    }
  };

  // resume auto scan on page reload
  useEffect(()=>{
    if(localStorage.getItem("autoScanRunning")==="true") startContinuousAutoScan();
    return ()=>stopContinuousAutoScan();
  }, [startContinuousAutoScan, stopContinuousAutoScan]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar"><h1>Admin Dashboard</h1></header>
        <section className="scan-controls">
          <div className="interval-setting">
            <label>Auto Scan Interval:</label>
            <select disabled><option>Every 15 Minutes</option></select>
          </div>
          <div className="button-group">
            <button className="save-btn" onClick={handleSave}>Save</button>
            <button className={`start-stop-btn ${autoScanRunning?"stop":"start"}`} onClick={toggleAutoScan}>
              {autoScanRunning?"Stop Auto Scan":"Start Auto Scan"}
            </button>
          </div>
          {autoScanRunning && <div className="countdown-timer">⏱ Next auto-save in: {Math.floor(countdown/60)}m {countdown%60}s</div>}
        </section>
        <section className="sensor-grid">
          {["ph","turbidity","temp","tds"].map(key=>(
            <div key={key} className={`sensor-card ${getSensorStatus(key,sensorData[key])}`}>
              <h3>{key.toUpperCase()}</h3>
              <p>{sensorData[key]} {key==="turbidity"?"NTU":key==="temp"?"°C":key==="tds"?"ppm":""}</p>
              <p className={`status-label ${getSensorStatus(key,sensorData[key])}`}>{getSensorStatus(key,sensorData[key]).toUpperCase()}</p>
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
