import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "../assets/databoard.css";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const FIXED_INTERVAL = 900000; // 15 minutes (ms)
  const intervalRef = useRef(null);

  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });
  const [status, setStatus] = useState("Awaiting sensor data...");
  const [countdown, setCountdown] = useState(Math.floor(FIXED_INTERVAL / 1000));
  const [overallSafety, setOverallSafety] = useState("N/A");
  const [autoScanRunning, setAutoScanRunning] = useState(false);

  // owner = the device (user.id) that started the loop
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  // --------------------------
  // Compute Overall Safety
  // --------------------------
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

  // --------------------------
  // Fetch Sensor Data (ESP32 + Cloud)
  // --------------------------
  const fetchSensorData = useCallback(async () => {
    const format = (latest) => ({
      ph: latest.ph ? parseFloat(latest.ph).toFixed(2) : "N/A",
      turbidity: latest.turbidity ? parseFloat(latest.turbidity).toFixed(1) : "N/A",
      temp: latest.temperature ? parseFloat(latest.temperature).toFixed(1) : "N/A",
      tds: latest.tds ? parseFloat(latest.tds).toFixed(0) : "N/A",
    });

    try {
      const res = await fetch(esp32Url, { cache: "no-store" });
      if (!res.ok) throw new Error("ESP32 fetch failed");
      const json = await res.json();
      const latest = json.latestData || json;
      const formatted = format(latest);
      setSensorData(formatted);
      computeOverallSafety(formatted);
      setStatus("✅ ESP32 data fetched.");
      return formatted;
    } catch (err) {
      console.warn("ESP32 failed, using cloud backup...", err);
      try {
        const cloud = await fetch("/api/data", { cache: "no-store" });
        const json = await cloud.json();
        const latest = json.latestData || {};
        const formatted = format(latest);
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

  // --------------------------
  // Manual Save / Auto Save (owner auto-saves)
  // --------------------------
  const handleAutoSave = useCallback(async () => {
    const data = await fetchSensorData();
    if (!data) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      const saveData = {
        user_id: user?.id || null,
        ph: parseFloat(data.ph) || null,
        turbidity: parseFloat(data.turbidity) || null,
        temperature: parseFloat(data.temp) || null,
        tds: parseFloat(data.tds) || null,
      };

      const { error } = await supabase.from("dataset_history").insert([saveData]);
      if (error) throw error;

      // Only owner should update last_scan_time (owner's loop or manual save is okay)
      // update global last_scan_time so all mirrors sync countdown
      await supabase.from("device_scanning")
        .update({ last_scan_time: new Date().toISOString() })
        .eq("id", 1);

      setStatus(`💾 Auto-saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error("Auto-save failed:", err);
      setStatus("❌ Auto-save failed.");
    }
  }, [fetchSensorData]);

  // --------------------------
  // Start Auto Scan Loop (only owner runs this)
  // --------------------------
  const startAutoScanLoop = useCallback(async () => {
    // clear any previous intervals on this client
    if (intervalRef.current) clearInterval(intervalRef.current);

    // read last_scan_time from DB so countdown is global
    const { data } = await supabase
      .from("device_scanning")
      .select("last_scan_time")
      .eq("id", 1)
      .single();

    let lastScan = data?.last_scan_time ? new Date(data.last_scan_time).getTime() : Date.now();

    // run interval locally only for owner
    intervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - lastScan;
      const remaining = FIXED_INTERVAL - (elapsed % FIXED_INTERVAL);
      setCountdown(Math.max(Math.floor(remaining / 1000), 0));

      // owner triggers autosave when timer hits
      if (remaining <= 1000) {
        // perform auto-save (this will update last_scan_time in DB)
        await handleAutoSave();

        // update local lastScan to now (DB is already updated by handleAutoSave)
        lastScan = Date.now();
      }
    }, 1000);

    // initial fetch to populate sensors
    fetchSensorData();
  }, [fetchSensorData, handleAutoSave]);

  const stopAutoScanLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Mirrors should keep displaying last fetched sensor data; owner might clear it if desired.
    // We'll not wipe sensorData here to avoid surprising UX, but original code cleared — keep original clearing:
    setSensorData({ ph: "N/A", turbidity: "N/A", temp: "N/A", tds: "N/A" });
    setOverallSafety("N/A");
  }, []);

  // --------------------------
  // Toggle Auto Scan (start/stop). This writes started_by so we can determine owner.
  // --------------------------
  const toggleAutoScan = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;
      const newState = !autoScanRunning;

      if (newState) {
        // starting: set status, started_by and last_scan_time so countdown begins now
        await supabase.from("device_scanning").upsert({
          id: 1,
          status: 1,
          started_by: user?.id || null,
          last_scan_time: new Date().toISOString(),
          interval_ms: FIXED_INTERVAL,
        });
      } else {
        // stopping: clear status and started_by
        await supabase.from("device_scanning").upsert({
          id: 1,
          status: 0,
          started_by: null,
          interval_ms: FIXED_INTERVAL,
        });
      }

      // local state will be updated by realtime payload, but optimistic set is fine:
      setAutoScanRunning(newState);
      setIsOwner(newState && user?.id ? user.id === currentUserId : false);
    } catch (err) {
      console.error("Failed to toggle auto scan:", err);
    }
  }, [autoScanRunning, currentUserId]);

  // --------------------------
  // Realtime listener for device_scanning and owner logic
  // --------------------------
  useEffect(() => {
    let mounted = true;

    // get current user id
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user || null;
        if (mounted) setCurrentUserId(user?.id || null);
      } catch (err) {
        console.warn("Could not get user:", err);
      }
    })();

    // initial read & setup
    (async () => {
      try {
        const { data } = await supabase
          .from("device_scanning")
          .select("*")
          .eq("id", 1)
          .single();

        if (!mounted) return;
        if (data) {
          setAutoScanRunning(data.status === 1);

          // set owner if started_by matches currentUserId (we fetch currentUserId above; if null it will be set once known)
          // If currentUserId is not yet set, this will re-evaluate when auth data is set.
          setIsOwner(data.started_by && currentUserId ? data.started_by === currentUserId : false);

          if (data.last_scan_time) {
            const elapsed = Date.now() - new Date(data.last_scan_time).getTime();
            setCountdown(Math.max(Math.floor((FIXED_INTERVAL - (elapsed % FIXED_INTERVAL)) / 1000), 0));
          } else {
            setCountdown(Math.floor(FIXED_INTERVAL / 1000));
          }
        }
      } catch (err) {
        console.error("Initial device_scanning fetch failed:", err);
      }
    })();

    // subscribe to changes on device_scanning row id=1
    const channel = supabase
      .channel("device_scanning_channel")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning", filter: "id=eq.1" },
        (payload) => {
          const newRow = payload.new;
          setAutoScanRunning(newRow.status === 1);

          // update owner flag
          setIsOwner(() => {
            // if we have currentUserId, compare
            if (!currentUserId) return false;
            return newRow.started_by === currentUserId;
          });

          // update countdown based on last_scan_time
          if (newRow.last_scan_time) {
            const last = new Date(newRow.last_scan_time).getTime();
            const elapsed = Date.now() - last;
            setCountdown(Math.max(Math.floor((FIXED_INTERVAL - (elapsed % FIXED_INTERVAL)) / 1000), 0));
          } else {
            setCountdown(Math.floor(FIXED_INTERVAL / 1000));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // currentUserId intentionally not in deps to avoid re-subscribing; we use setIsOwner when currentUserId becomes available elsewhere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure owner logic: start loop only if running AND this client is the owner
  useEffect(() => {
    if (autoScanRunning && isOwner) {
      startAutoScanLoop();
    } else {
      // If not owner or stopped, ensure we don't run an interval locally
      stopAutoScanLoop();
    }
  }, [autoScanRunning, isOwner, startAutoScanLoop, stopAutoScanLoop]);

  // If currentUserId becomes available after initial subscription, re-evaluate owner
  useEffect(() => {
    const checkOwner = async () => {
      try {
        const { data } = await supabase
          .from("device_scanning")
          .select("started_by, last_scan_time, status")
          .eq("id", 1)
          .single();

        if (!data) return;
        setIsOwner(data.started_by ? data.started_by === currentUserId : false);
        setAutoScanRunning(data.status === 1);

        if (data.last_scan_time) {
          const last = new Date(data.last_scan_time).getTime();
          const elapsed = Date.now() - last;
          setCountdown(Math.max(Math.floor((FIXED_INTERVAL - (elapsed % FIXED_INTERVAL)) / 1000), 0));
        }
      } catch (err) {
        // ignore
      }
    };

    if (currentUserId !== null) checkOwner();
  }, [currentUserId]);

  // --------------------------
  // Manual fetch UI or initial fetch
  // --------------------------
  useEffect(() => {
    fetchSensorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------
  // Sensor status color helper
  // --------------------------
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

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <h1>Admin Dashboard</h1>
        </header>

        <section className="scan-controls">
          <div className="button-group">
            <button className="save-btn" onClick={handleAutoSave}>
              Save Now
            </button>

            <button
              className={`start-stop-btn ${autoScanRunning ? "stop" : "start"}`}
              onClick={toggleAutoScan}
            >
              {autoScanRunning ? "Stop Auto Scan" : "Start Auto Scan"}
            </button>
          </div>

          <div className="owner-indicator" style={{ marginTop: 8 }}>
            {autoScanRunning ? (
              <small>
                {isOwner ? "You started the auto-scan (owner)" : "Auto-scan running (mirroring)"}
              </small>
            ) : (
              <small>Auto-scan stopped</small>
            )}
          </div>

          {autoScanRunning && (
            <div className="countdown-timer">
              ⏱ Next auto-save in:{" "}
              <strong>
                {Math.floor(countdown / 60)}m {countdown % 60}s
              </strong>
            </div>
          )}
        </section>

        <section className="sensor-grid">
          {["ph", "turbidity", "temp", "tds"].map((key) => (
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
