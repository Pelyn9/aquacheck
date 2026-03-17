import React, { useCallback, useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../supabaseClient";
import "../assets/VisitorPage.css";
import peejayPhoto from "../assets/picture/peejay1.jpg";
import aldricPhoto from "../assets/picture/aldric.png";
import lawrencePhoto from "../assets/picture/lawrence.png";
import wencePhoto from "../assets/picture/wence.jpg";

const SENSOR_META = [
  { key: "ph", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "temperature", label: "Temperature", unit: "C" },
  { key: "tds", label: "TDS", unit: "ppm" },
];

const EMPTY_SENSOR_DATA = {
  ph: "N/A",
  turbidity: "N/A",
  temperature: "N/A",
  tds: "N/A",
};

const toFixedOrNA = (value, digits) => {
  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : "N/A";
};

const normalizeSensorData = (raw = {}) => ({
  ph: toFixedOrNA(raw.ph, 2),
  turbidity: toFixedOrNA(raw.turbidity, 1),
  temperature: toFixedOrNA(raw.temperature ?? raw.temp, 1),
  tds: toFixedOrNA(raw.tds, 0),
});

const getToneClass = (status) => {
  if (status === "Safe") return "safe";
  if (status === "Moderate") return "moderate";
  if (status === "Unsafe") return "unsafe";
  return "unknown";
};

const VisitorPage = () => {
  const esp32Url =
    process.env.NODE_ENV === "production"
      ? "/api/data"
      : "http://aquacheck.local:5000/data";

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveVisible, setLiveVisible] = useState(false);
  const [isAdminLive, setIsAdminLive] = useState(false);
  const [sensorData, setSensorData] = useState(EMPTY_SENSOR_DATA);
  const [trendView, setTrendView] = useState("daily");
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [trendData, setTrendData] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);

  useEffect(() => {
    document.title = "SafeShore";
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const toggleLivePanel = () => setLiveVisible((prev) => !prev);

  const computeOverallStatus = (data = sensorData) => {
    if (!data || Object.values(data).every((value) => value === "N/A")) {
      return "N/A";
    }

    const scores = Object.entries(data).map(([key, value]) => {
      if (value === "N/A") return 0;
      const numericValue = parseFloat(value);

      switch (key) {
        case "ph":
          return numericValue >= 6.5 && numericValue <= 8.5 ? 2 : 0;
        case "turbidity":
          return numericValue <= 5 ? 2 : numericValue <= 10 ? 1 : 0;
        case "temperature":
          return numericValue >= 24 && numericValue <= 32 ? 2 : 0;
        case "tds":
          return numericValue <= 500 ? 2 : 0;
        default:
          return 0;
      }
    });

    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    if (totalScore >= 7) return "Safe";
    if (totalScore >= 4) return "Moderate";
    return "Unsafe";
  };

  const getStatus = (type, value) => {
    if (value === "N/A") return "Unknown";
    const numericValue = parseFloat(value);

    switch (type) {
      case "ph":
        if (numericValue >= 6.5 && numericValue <= 8.5) return "Safe";
        if (
          (numericValue > 6 && numericValue < 6.5) ||
          (numericValue > 8.5 && numericValue <= 9)
        ) {
          return "Moderate";
        }
        return "Unsafe";
      case "turbidity":
        if (numericValue <= 5) return "Safe";
        if (numericValue > 5 && numericValue <= 10) return "Moderate";
        return "Unsafe";
      case "temperature":
        if (numericValue >= 24 && numericValue <= 32) return "Safe";
        if (
          (numericValue >= 20 && numericValue < 24) ||
          (numericValue > 32 && numericValue <= 35)
        ) {
          return "Moderate";
        }
        return "Unsafe";
      case "tds":
        if (numericValue <= 500) return "Safe";
        if (numericValue > 500 && numericValue <= 1000) return "Moderate";
        return "Unsafe";
      default:
        return "Unknown";
    }
  };

  const formatReading = (value, unit) =>
    value === "N/A" ? "N/A" : `${value}${unit ? ` ${unit}` : ""}`;

  const formatDateLabel = (dateValue) =>
    dateValue.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("Server unreachable");
      const payload = await response.json();
      const latest = payload.latestData || payload;
      setSensorData(normalizeSensorData(latest));
    } catch {
      // Keep last known reading; only clear when admin stops live scan.
      return;
    }
  }, [esp32Url]);

  useEffect(() => {
    if (!isAdminLive) {
      setSensorData(EMPTY_SENSOR_DATA);
      return;
    }

    fetchSensorData();
    const intervalId = setInterval(fetchSensorData, 2000);
    return () => clearInterval(intervalId);
  }, [isAdminLive, fetchSensorData]);

  const syncVisitorLiveState = useCallback((scanState) => {
    if (!scanState) return;

    const running = Boolean(scanState.status);
    setIsAdminLive(running);

    if (!running) {
      setSensorData(EMPTY_SENSOR_DATA);
      return;
    }

    if (scanState.latest_sensor) {
      setSensorData(normalizeSensorData(scanState.latest_sensor));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchInitialScanState = async () => {
      const { data } = await supabase
        .from("device_scanning")
        .select("status, latest_sensor")
        .eq("id", 1)
        .single();

      if (!mounted || !data) return;
      syncVisitorLiveState(data);
    };

    fetchInitialScanState();

    const channel = supabase
      .channel("device_scanning_visitor_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_scanning", filter: "id=eq.1" },
        (payload) => {
          if (!payload?.new) return;
          syncVisitorLiveState(payload.new);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [syncVisitorLiveState]);

  useEffect(() => {
    const fetchAvailableDates = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      const uniqueDates = [...new Set((rows || []).map((item) => item.created_at.split("T")[0]))];
      setAvailableDates(uniqueDates);
      setSelectedDate((previous) => {
        if (previous && uniqueDates.includes(previous)) return previous;
        return uniqueDates[0] || "";
      });
    };

    fetchAvailableDates();
  }, []);

  useEffect(() => {
    const fetchTrendData = async () => {
      setLoadingTrend(true);

      try {
        if (!selectedDate) {
          setTrendData([]);
          return;
        }

        const selectedStart = new Date(`${selectedDate}T00:00:00`);
        const safeSelectedStart = Number.isNaN(selectedStart.getTime())
          ? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")
          : selectedStart;
        const selectedEnd = new Date(safeSelectedStart);
        selectedEnd.setDate(selectedEnd.getDate() + 1);

        if (trendView === "daily") {
          const { data: rows } = await supabase
            .from("dataset_history")
            .select("created_at, ph, turbidity, temperature, tds")
            .gte("created_at", safeSelectedStart.toISOString())
            .lt("created_at", selectedEnd.toISOString())
            .order("created_at", { ascending: true });

          const chartData =
            rows?.map((item) => ({
              time: new Date(item.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              ph: Number.parseFloat(item.ph) || 0,
              turbidity: Number.parseFloat(item.turbidity) || 0,
              temperature: Number.parseFloat(item.temperature) || 0,
              tds: Number.parseFloat(item.tds) || 0,
            })) || [];

          setTrendData(chartData);
          return;
        }

        const startOfRange = new Date(safeSelectedStart);
        startOfRange.setDate(startOfRange.getDate() - 6);

        const { data: rows } = await supabase
          .from("dataset_history")
          .select("created_at, ph, turbidity, temperature, tds")
          .gte("created_at", startOfRange.toISOString())
          .lt("created_at", selectedEnd.toISOString())
          .order("created_at", { ascending: true });

        const grouped = new Map();

        (rows || []).forEach((item) => {
          const dateKey = item.created_at.split("T")[0];
          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, {
              count: 0,
              ph: 0,
              turbidity: 0,
              temperature: 0,
              tds: 0,
            });
          }

          const totals = grouped.get(dateKey);
          totals.count += 1;
          totals.ph += Number.parseFloat(item.ph) || 0;
          totals.turbidity += Number.parseFloat(item.turbidity) || 0;
          totals.temperature += Number.parseFloat(item.temperature) || 0;
          totals.tds += Number.parseFloat(item.tds) || 0;
        });

        const chartData = Array.from(grouped.entries()).map(([dateKey, totals]) => {
          const safeCount = totals.count || 1;
          return {
            time: new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            ph: Number((totals.ph / safeCount).toFixed(2)),
            turbidity: Number((totals.turbidity / safeCount).toFixed(2)),
            temperature: Number((totals.temperature / safeCount).toFixed(2)),
            tds: Number((totals.tds / safeCount).toFixed(2)),
          };
        });

        setTrendData(chartData);
      } catch {
        setTrendData([]);
      } finally {
        setLoadingTrend(false);
      }
    };

    fetchTrendData();
  }, [trendView, selectedDate]);

  const selectedStart = new Date(`${selectedDate}T00:00:00`);
  const safeSelectedStart = Number.isNaN(selectedStart.getTime())
    ? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")
    : selectedStart;
  const weeklyStart = new Date(safeSelectedStart);
  weeklyStart.setDate(weeklyStart.getDate() - 6);

  const latestSnapshot = trendData[trendData.length - 1] || sensorData;
  const latestStatus = computeOverallStatus({
    ph: latestSnapshot.ph,
    turbidity: latestSnapshot.turbidity,
    temperature: latestSnapshot.temperature,
    tds: latestSnapshot.tds,
  });

  return (
    <div className="visitor-container">
      <nav className="navbar">
        <a href="#home" className="navbar-logo">
          <span>Safe</span>Shore
        </a>

        <button
          type="button"
          className={`visitor-hamburger ${menuOpen ? "active" : ""}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`navbar-links ${menuOpen ? "active" : ""}`}>
          {["features", "about", "developers", "contact"].map((section) => (
            <a key={section} href={`#${section}`} onClick={() => setMenuOpen(false)}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </a>
          ))}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-button"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <FaMoon size={16} /> : <FaSun size={16} />}
          </button>
          <button
            type="button"
            onClick={toggleLivePanel}
            className={`live-toggle-button ${liveVisible ? "active" : "inactive"}`}
            aria-pressed={liveVisible}
          >
            {liveVisible ? "Live On" : "Live Off"}
          </button>
        </div>
      </nav>

      <section id="home" className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <p className="hero-kicker">AquaCheck Public Monitor</p>
            <h1>Know if the water is safe before you swim.</h1>
            <p>
              SafeShore reports pH, turbidity, temperature, and TDS in a clear public
              dashboard so everyone can check pool conditions in seconds.
            </p>
            <div className="hero-actions">
              <a className="cta-button" href="#weekly-analysis">
                View Data Trend
              </a>
            </div>
          </div>

          <div className="hero-panel">
            <h3>Current Snapshot</h3>
            <ul className="snapshot-list">
              {SENSOR_META.map(({ key, label, unit }) => {
                const readingStatus = getStatus(key, sensorData[key]);
                return (
                  <li key={key}>
                    <span>{label}</span>
                    <strong>{formatReading(sensorData[key], unit)}</strong>
                    <em className={`tone ${getToneClass(readingStatus)}`}>{readingStatus}</em>
                  </li>
                );
              })}
            </ul>
            <div className={`overall-chip ${getToneClass(computeOverallStatus())}`}>
              Overall: {computeOverallStatus()}
            </div>
          </div>
        </div>
      </section>

      {liveVisible && (
        <aside className="live-card" aria-live="polite">
          <div className="live-head">
            <h4>Live Sensor Reading</h4>
            <span>{isAdminLive ? "Mirrored from admin (updates every 2s)" : "Waiting for admin live scan"}</span>
          </div>
          <ul>
            {SENSOR_META.map(({ key, label, unit }) => {
              const readingStatus = getStatus(key, sensorData[key]);
              return (
                <li key={key}>
                  <p>{label}</p>
                  <strong>{formatReading(sensorData[key], unit)}</strong>
                  <span className={`tone ${getToneClass(readingStatus)}`}>{readingStatus}</span>
                </li>
              );
            })}
          </ul>
          <p className={`live-overall ${getToneClass(computeOverallStatus())}`}>
            Overall Status: {computeOverallStatus()}
          </p>
          <p className="reference-note">
            {isAdminLive
              ? "Based on WHO and EPA water quality references."
              : "Live data appears automatically when admin starts auto scan."}
          </p>
        </aside>
      )}

      <section id="weekly-analysis" className="analysis-section">
        <div className="section-head">
          <h2>Water Quality Over Time</h2>
          <div className="analysis-controls">
            <div className="view-mode-toggle" role="group" aria-label="Water quality trend view">
              <button
                type="button"
                className={`view-mode-button ${trendView === "daily" ? "active" : ""}`}
                onClick={() => setTrendView("daily")}
                aria-pressed={trendView === "daily"}
              >
                Daily
              </button>
              <button
                type="button"
                className={`view-mode-button ${trendView === "weekly" ? "active" : ""}`}
                onClick={() => setTrendView("weekly")}
                aria-pressed={trendView === "weekly"}
              >
                Weekly
              </button>
            </div>
            <label className="trend-date-picker">
              <span>{trendView === "daily" ? "Date" : "Week ending"}</span>
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                disabled={!availableDates.length}
              >
                {!availableDates.length ? <option value="">No saved dates</option> : null}
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="chart-card">
          {loadingTrend ? (
            <p className="chart-message">Loading data...</p>
          ) : !availableDates.length ? (
            <p className="chart-message">No admin-saved dates available yet.</p>
          ) : trendData.length === 0 ? (
            <p className="chart-message">
              No data available for {trendView === "daily" ? "daily" : "weekly"} view.
            </p>
          ) : (
            <>
              <p className="chart-day">
                {trendView === "daily"
                  ? `Daily View (${formatDateLabel(safeSelectedStart)})`
                  : `Weekly View (${formatDateLabel(weeklyStart)} - ${formatDateLabel(safeSelectedStart)})`}
              </p>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={trendData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="phGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#27c5a5" stopOpacity={0.65} />
                        <stop offset="95%" stopColor="#27c5a5" stopOpacity={0.06} />
                      </linearGradient>
                      <linearGradient id="turbidityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#56b5d6" stopOpacity={0.65} />
                        <stop offset="95%" stopColor="#56b5d6" stopOpacity={0.06} />
                      </linearGradient>
                      <linearGradient id="temperatureGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f58a45" stopOpacity={0.65} />
                        <stop offset="95%" stopColor="#f58a45" stopOpacity={0.06} />
                      </linearGradient>
                      <linearGradient id="tdsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f2bf42" stopOpacity={0.65} />
                        <stop offset="95%" stopColor="#f2bf42" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>

                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />

                    <Area type="monotone" dataKey="ph" stroke="#27c5a5" fill="url(#phGradient)" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="turbidity"
                      stroke="#56b5d6"
                      fill="url(#turbidityGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f58a45"
                      fill="url(#temperatureGradient)"
                      strokeWidth={2}
                    />
                    <Area type="monotone" dataKey="tds" stroke="#f2bf42" fill="url(#tdsGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div className={`quality-summary ${getToneClass(latestStatus)}`}>
          <span>Overall Water Quality</span>
          <strong>{latestStatus}</strong>
        </div>
      </section>

      <section id="features" className="features">
        <h2>Features</h2>
        <div className="features-grid-2x2">
          <div className="feature-card">
            <h3>Real-time Monitoring</h3>
            <p>Track water quality instantly with live sensor readings.</p>
          </div>
          <div className="feature-card">
            <h3>Safe Alerts</h3>
            <p>Get clear safe, caution, and unsafe indicators from measured values.</p>
          </div>
          <div className="feature-card">
            <h3>Theme Mode</h3>
            <p>Switch between light and dark modes for better viewing comfort.</p>
          </div>
          <div className="feature-card">
            <h3>Historical Insight</h3>
            <p>Review time-based trends to understand how water quality changes daily.</p>
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <h2>About SafeShore</h2>
        <p>
          SafeShore is a public-facing water monitoring platform that shows pH,
          turbidity, temperature, and TDS metrics in one accessible interface.
        </p>
      </section>

      <section id="developers" className="developers">
        <h2>Meet the Developers</h2>
        <div className="developer-grid">
          {[
            { img: peejayPhoto, name: "Peejay Marco A. Apale" },
            { img: aldricPhoto, name: "Aldric Rholen Calatrava" },
            { img: lawrencePhoto, name: "Lawrence Jay Saludes" },
            { img: wencePhoto, name: "Wence Dante De Vera" },
          ].map((developer, index) => (
            <div key={index} className="developer-item">
              <img src={developer.img} alt={developer.name} className="dev-photo" />
              <p className="dev-name">{developer.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="contact">
        <h2>Contact</h2>
        <p>
          Email:{" "}
          <a href="mailto:contact@SafeShore.com" className="highlight">
            safeshore@gmail.com
          </a>
        </p>
        <p>
          Phone: <span className="highlight">+63 912 345 6789</span>
        </p>
      </section>

      <footer className="footer">
        &copy; {new Date().getFullYear()} SafeShore. All rights reserved.
      </footer>
    </div>
  );
};

export default VisitorPage;
