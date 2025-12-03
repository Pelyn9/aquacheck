import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // default 15 minutes
  const intervalRef = useRef(null);

  // -------------------------------
  // 1. Start AutoScan
  // -------------------------------
  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (typeof window === "undefined") return; // ✅ client only

    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchSensorData(); // run immediately
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 1, interval_ms: intervalTime })
        .eq("id", 1);
    }
  }, [intervalTime]);

  // -------------------------------
  // 2. Stop AutoScan
  // -------------------------------
  const stopAutoScan = useCallback(async (updateDB = true) => {
    if (typeof window === "undefined") return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    setAutoScanRunning(false);

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({ status: 0 })
        .eq("id", 1);
    }
  }, []);

  // -------------------------------
  // 3. Initialize fetchSensorData globally (client-only)
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.fetchSensorData) window.fetchSensorData = () => {};
  }, []);

  // -------------------------------
  // 4. Load state from Supabase on mount (client-only)
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadState = async () => {
      const { data, error } = await supabase
        .from("device_scanning")
        .select("status, interval_ms")
        .eq("id", 1)
        .single();

      if (!error && data) {
        setIntervalTime(data.interval_ms ?? 900000);

        const running = data.status === 1;
        setAutoScanRunning(running);

        if (running && typeof window.fetchSensorData === "function") {
          startAutoScan(window.fetchSensorData, false); // resume without DB write
        }
      }
    };

    loadState();
  }, [startAutoScan]);

  // -------------------------------
  // 5. Realtime subscription (client-only)
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const channel = supabase
      .channel("scan_status_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_scanning" },
        (payload) => {
          const isRunning = payload.new.status === 1;
          setAutoScanRunning(isRunning);
          setIntervalTime(payload.new.interval_ms);

          if (isRunning) startAutoScan(window.fetchSensorData, false);
          else stopAutoScan(false);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [startAutoScan, stopAutoScan]);

  return (
    <AutoScanContext.Provider
      value={{
        autoScanRunning,
        startAutoScan,
        stopAutoScan,
        intervalTime,
        setIntervalTime,
      }}
    >
      {children}
    </AutoScanContext.Provider>
  );
};
