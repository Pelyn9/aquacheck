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
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temperature: "N/A",
    tds: "N/A",
  });
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

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

  const fetchSensorData = useCallback(async () => {
    try {
      const response = await fetch(esp32Url, { cache: "no-store" });
      if (!response.ok) throw new Error("Server unreachable");
      const payload = await response.json();
      const latest = payload.latestData || payload;

      setSensorData({
        ph: latest.ph !== undefined ? parseFloat(latest.ph).toFixed(2) : "N/A",
        turbidity:
          latest.turbidity !== undefined
            ? parseFloat(latest.turbidity).toFixed(1)
            : "N/A",
        temperature:
          latest.temperature !== undefined
            ? parseFloat(latest.temperature).toFixed(1)
            : "N/A",
        tds: latest.tds !== undefined ? parseFloat(latest.tds).toFixed(0) : "N/A",
      });
    } catch {
      setSensorData({
        ph: "N/A",
        turbidity: "N/A",
        temperature: "N/A",
        tds: "N/A",
      });
    }
  }, [esp32Url]);

  useEffect(() => {
    if (!liveVisible) return;
    fetchSensorData();
    const intervalId = setInterval(fetchSensorData, 2000);
    return () => clearInterval(intervalId);
  }, [liveVisible, fetchSensorData]);

  const handleLiveClick = () => {
    setLiveVisible((prev) => {
      if (prev) {
        setSensorData({
          ph: "N/A",
          turbidity: "N/A",
          temperature: "N/A",
          tds: "N/A",
        });
      }
      return !prev;
    });
  };

  useEffect(() => {
    const fetchDates = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (rows?.length) {
        const uniqueDates = [...new Set(rows.map((row) => row.created_at.split("T")[0]))];
        setAvailableDates(uniqueDates);
        setSelectedDate(uniqueDates[0]);
      } else {
        setAvailableDates([]);
        setSelectedDate("");
        setLoadingDaily(false);
      }
    };

    fetchDates();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingDaily(true);

    const fetchDailyData = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: true });

      const chartData =
        rows?.map((item) => ({
          time: new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          ph: parseFloat(item.ph?.toFixed(2)) || 0,
          turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
          temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
          tds: parseFloat(item.tds?.toFixed(2)) || 0,
        })) || [];

      setDailyData(chartData);
      setLoadingDaily(false);
    };

    fetchDailyData();
  }, [selectedDate]);

  const latestSnapshot = dailyData[dailyData.length - 1] || sensorData;
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
          className={`hamburger ${menuOpen ? "active" : ""}`}
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
          <button type="button" onClick={toggleTheme} className="theme-toggle-button">
            {theme === "light" ? <FaMoon size={16} /> : <FaSun size={16} />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button type="button" onClick={handleLiveClick} className="live-toggle-button">
            {liveVisible ? "Stop Live" : "Start Live"}
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
              <button type="button" className="ghost-button" onClick={handleLiveClick}>
                {liveVisible ? "Hide Live Panel" : "Open Live Panel"}
              </button>
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
            <span>Updates every 2s</span>
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
          <p className="reference-note">Based on WHO and EPA water quality references.</p>
        </aside>
      )}

      <section id="weekly-analysis" className="analysis-section">
        <div className="section-head">
          <h2>Water Quality Over Time</h2>
          <div className="filter-section">
            <label htmlFor="date-select">Date</label>
            <select
              id="date-select"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            >
              {!availableDates.length ? <option value="">No dates available</option> : null}
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="chart-card">
          {loadingDaily ? (
            <p className="chart-message">Loading data...</p>
          ) : dailyData.length === 0 ? (
            <p className="chart-message">No data available for this date.</p>
          ) : (
            <>
              <p className="chart-day">
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={dailyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
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
            contact@SafeShore.com
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
