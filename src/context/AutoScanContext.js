import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const AutoScanContext = createContext();

export const AutoScanProvider = ({ children }) => {
  const [autoScanRunning, setAutoScanRunning] = useState(false);
  const [intervalTime, setIntervalTime] = useState(900000);
  const intervalRef = useRef(null);

  // Wrap startAutoScan in useCallback to avoid missing dependency warning
  const startAutoScan = useCallback(async (fetchSensorData, updateDB = true) => {
    window.fetchSensorData = fetchSensorData;

    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchSensorData();
    intervalRef.current = setInterval(fetchSensorData, intervalTime);

    setAutoScanRunning(true);

    if (updateDB) {
      await supabase
        .from("device_scanning")
        .update({
          status: 1,
          interval_ms: intervalTime,
        })
        .eq("id", 1);
    }
  }, [intervalTime]); // ✅ depends only on intervalTime

  const stopAutoScan = useCallback(async (updateDB = true) => {
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

  // useEffect to load state on mount
  useEffect(() => {
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
          startAutoScan(window.fetchSensorData, false); // ✅ safe, included in deps
        }
      }
    };
    loadState();
  }, [startAutoScan]); // ✅ add startAutoScan here

  // Realtime effect
  useEffect(() => {
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
  }, [startAutoScan, stopAutoScan]); // ✅ include callbacks

  return (
    <AutoScanContext.Provider
      value={{ autoScanRunning, startAutoScan, stopAutoScan, intervalTime, setIntervalTime }}
    >
      {children}
    </AutoScanContext.Provider>
  );
};
