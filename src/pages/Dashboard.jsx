import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { AutoScanContext } from "../context/AutoScanContext";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const { autoScanRunning, startAutoScan, stopAutoScan } = useContext(AutoScanContext);

  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(0);
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [intervalMs, setIntervalMs] = useState(900000); // default 15min
  const [nextAutoSaveTs, setNextAutoSaveTs] = useState(null);

  const countdownRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const isScanning = useRef(false);
  const hasSaved = useRef(false);

  const esp32Url = process.env.NODE_ENV === "production"
    ? "/api/data"
    : "http://aquacheck.local:5000/data";

  // ---------------- COMPUTE SAFETY ----------------
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

  // ---------------- FETCH SENSOR ----------------
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
      setStatus("❌ Failed to fetch data.");
      setOverallSafety("N/A");
      return null;
    }
  }, [esp32Url, computeOverallSafety]);

  // ---------------- AUTO SAVE ----------------
  const handleAutoSave = useCallback(async () => {
    if(!isScanning.current || hasSaved.current) return;
    hasSaved.current = true;

    const newData = await fetchSensorData();
    if(!newData || Object.values(newData).every(v=>"N/A")) { hasSaved.current=false; return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) { hasSaved.current=false; return; }

      // save sensor data
      const saveData = {
        user_id: user.id,
        ph: parseFloat(newData.ph)||null,
        turbidity: parseFloat(newData.turbidity)||null,
        temperature: parseFloat(newData.temp)||null,
        tds: parseFloat(newData.tds)||null
      };
      await supabase.from("dataset_history").insert([saveData]);

      // update next_auto_save_ts in DB
      const nextTs = Date.now() + intervalMs;
      await supabase.from("device_scanning").update({ next_auto_save_ts: nextTs }).eq("id", 1);
      setNextAutoSaveTs(nextTs);
    } catch(err){ console.error(err); }
    finally { hasSaved.current=false; }
  }, [fetchSensorData, intervalMs]);

  // ---------------- START / STOP ----------------
  const stopContinuousAutoScan = useCallback(() => {
    clearInterval(countdownRef.current);
    clearInterval(liveIntervalRef.current);
    countdownRef.current = null;
    liveIntervalRef.current = null;
    isScanning.current = false;
    hasSaved.current = false;
    localStorage.setItem("autoScanRunning","false");
    // Do not reset sensorData
  }, []);

  const startContinuousAutoScan = useCallback(() => {
    if(!nextAutoSaveTs) return; // ensure next timestamp is loaded
    stopContinuousAutoScan();
    isScanning.current = true;

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(Math.floor((nextAutoSaveTs - Date.now())/1000), 0);
      setCountdown(remaining);
      if(remaining <= 0) handleAutoSave();
    }, 1000);

    liveIntervalRef.current = setInterval(fetchSensorData, 5000);
    localStorage.setItem("autoScanRunning","true");
  }, [fetchSensorData, handleAutoSave, stopContinuousAutoScan, nextAutoSaveTs]);

  // ---------------- INIT & SYNC ----------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from("device_scanning").select("*").eq("id", 1).single();
      if(data){
        setIntervalMs(data.interval_ms || 900000);
        const ts = data.next_auto_save_ts || (Date.now() + (data.interval_ms || 900000));
        setNextAutoSaveTs(ts);
        if(data.status === 1){
          startContinuousAutoScan();
        }
      }
    };
    init();

    // Supabase Realtime for multi-device sync
    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        payload => {
          const d = payload.new;
          setIntervalMs(d.interval_ms || 900000);
          setNextAutoSaveTs(d.next_auto_save_ts || (Date.now() + (d.interval_ms || 900000)));
          if(d.status === 1 && !isScanning.current) startContinuousAutoScan();
          if(d.status === 0 && isScanning.current) stopContinuousAutoScan();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopContinuousAutoScan();
    };
  }, [fetchSensorData, startContinuousAutoScan, stopContinuousAutoScan]);

  // ---------------- TOGGLE ----------------
  const toggleAutoScan = useCallback(() => {
    if(autoScanRunning) stopAutoScan();
    else startAutoScan(handleAutoSave);
    startContinuousAutoScan();
  }, [autoScanRunning, stopAutoScan, startAutoScan, handleAutoSave, startContinuousAutoScan]);

  const getSensorStatus = (type, value) => {
    if(value==="N/A") return "";
    const val = parseFloat(value);
    switch(type){
      case "ph": return val>=6.5&&val<=8.5?"safe":"unsafe";
      case "turbidity": return val<=5?"safe":val<=10?"moderate":"unsafe";
      case "temp": return val>=24&&val<=32?"safe":"unsafe";
      case "tds": return val<=500?"safe":"unsafe";
      default: return "";
    }
  };

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
            <button className="save-btn" onClick={handleAutoSave}>Save</button>
            <button className={`start-stop-btn ${autoScanRunning?"stop":"start"}`} onClick={toggleAutoScan}>
              {autoScanRunning?"Stop Auto Scan":"Start Auto Scan"}
            </button>
          </div>
          {nextAutoSaveTs && <div className="countdown-timer">
            ⏱ Next auto-save in: {Math.floor(countdown/60)}m {countdown%60}s
          </div>}
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
