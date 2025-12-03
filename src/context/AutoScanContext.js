import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000); // default 15 min
  const intervalRef = useRef(null);

  // -------------------------------
  // Start AutoScan
  // -------------------------------
  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    if (typeof window === "undefined") return;

    // Save global reference
    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchSensorData(); // run immediately
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);

    if (updateDB) {
      // Persist scan status in Supabase
      await supabase
        .from("device_scanning")
        .update({ status: 1, interval_ms: intervalTime })
        .eq("id", 1);
    }
  }, [intervalTime]);

  // -------------------------------
  // Stop AutoScan (admins only)
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
  // Ensure fetchSensorData exists globally
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.fetchSensorData) window.fetchSensorData = () => {};
  }, []);

  // -------------------------------
  // Load scan state from Supabase on page load
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

        // If scan was running, resume it
        if (data.status === 1 && typeof window.fetchSensorData === "function") {
          startAutoScan(window.fetchSensorData, false); // false = don't update DB
        }

        setAutoScanRunning(data.status === 1);
      }
    };

    loadState();
  }, [startAutoScan]);

  // -------------------------------
  // Real-time subscription: sync scan across admins
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

          // Auto-start or stop scan based on DB
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
