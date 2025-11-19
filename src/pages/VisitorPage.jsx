//updated title SafeShore
import React, { useState, useEffect } from "react";
import "../assets/VisitorPage.css";
import peejayPhoto from "../assets/picture/peejay1.jpg";
import aldricPhoto from "../assets/picture/aldric.png";
import lawrencePhoto from "../assets/picture/lawrence.png";
import wencePhoto from "../assets/picture/wence.jpg";
import { FaSun, FaMoon } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const SENSOR_LIMITS = {
  ph: { safe: [6.5, 8.5], moderate: [6, 6.5, 8.5, 9] },
  turbidity: { safe: 5, moderate: 10 },
  temperature: { safe: [20, 32], moderate: [15, 20, 32, 35] },
  tds: { safe: 500, moderate: 1000 },
};

const VisitorPage = () => {
  useEffect(() => { document.title = "SafeShore"; }, []);

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveVisible, setLiveVisible] = useState(false);
  const [sensorData, setSensorData] = useState({ ph: "N/A", turbidity: "N/A", temperature: "N/A", tds: "N/A" });
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");
  const toggleMenu = () => setMenuOpen(prev => !prev);

  // Determine water quality status
  const getStatus = (type, value) => {
    if (value === "N/A") return "Unknown";
    const val = parseFloat(value);

    switch (type) {
      case "ph":
        if (val >= SENSOR_LIMITS.ph.safe[0] && val <= SENSOR_LIMITS.ph.safe[1]) return "Safe";
        if ((val >= SENSOR_LIMITS.ph.moderate[0] && val < SENSOR_LIMITS.ph.moderate[1]) ||
          (val > SENSOR_LIMITS.ph.moderate[2] && val <= SENSOR_LIMITS.ph.moderate[3])) return "Moderate";
        return "Unsafe";

      case "turbidity":
        if (val <= SENSOR_LIMITS.turbidity.safe) return "Safe";
        if (val <= SENSOR_LIMITS.turbidity.moderate) return "Moderate";
        return "Unsafe";

      case "temperature":
        if (val >= SENSOR_LIMITS.temperature.safe[0] && val <= SENSOR_LIMITS.temperature.safe[1]) return "Safe";
        if ((val >= SENSOR_LIMITS.temperature.moderate[0] && val < SENSOR_LIMITS.temperature.moderate[1]) ||
          (val > SENSOR_LIMITS.temperature.moderate[2] && val <= SENSOR_LIMITS.temperature.moderate[3])) return "Moderate";
        return "Unsafe";

      case "tds":
        if (val <= SENSOR_LIMITS.tds.safe) return "Safe";
        if (val <= SENSOR_LIMITS.tds.moderate) return "Moderate";
        return "Unsafe";

      default:
        return "Unknown";
    }
  };

  const getColor = status => ({ Safe: "green", Moderate: "orange", Unsafe: "red", Unknown: "gray" }[status]);

  const computeOverallStatus = (data = sensorData) => {
    const statuses = Object.keys(data).map(type => getStatus(type, data[type]));
    if (statuses.includes("Unsafe")) return "Unsafe";
    if (statuses.includes("Moderate")) return "Moderate";
    if (statuses.every(s => s === "Safe")) return "Safe";
    return "Unknown";
  };

  // Fetch live sensor data
  const fetchSensorData = async () => {
    try {
      const response = await fetch("http://aquacheck.local:5000/data");
      if (!response.ok) throw new Error("Server unreachable");
      const data = await response.json();

      setSensorData({
        ph: data.ph !== undefined ? parseFloat(data.ph).toFixed(2) : "N/A",
        turbidity: data.turbidity !== undefined ? parseFloat(data.turbidity).toFixed(1) : "N/A",
        temperature: data.temperature !== undefined ? parseFloat(data.temperature).toFixed(1) : "N/A",
        tds: data.tds !== undefined ? parseFloat(data.tds).toFixed(0) : "N/A",
      });
    } catch {
      setSensorData({ ph: "N/A", turbidity: "N/A", temperature: "N/A", tds: "N/A" });
    }
  };

  useEffect(() => {
    if (!liveVisible) return;
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 2000);
    return () => clearInterval(interval);
  }, [liveVisible]);

  const handleLiveClick = () => {
    setLiveVisible(prev => {
      if (prev) setSensorData({ ph: "N/A", turbidity: "N/A", temperature: "N/A", tds: "N/A" });
      return !prev;
    });
  };

  // Fetch available dates from Supabase
  useEffect(() => {
    const fetchDates = async () => {
      const { data: rows } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (rows?.length) {
        const uniqueDates = [...new Set(rows.map(r => r.created_at.split("T")[0]))];
        setAvailableDates(uniqueDates);
        setSelectedDate(uniqueDates[0]);
      }
    };
    fetchDates();
  }, []);

  // Fetch daily chart data
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

      const chartData = rows?.map(item => ({
        time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

  return (
    <div className="visitor-container">

      {/* NAVBAR */}
      <nav className="navbar">
        <a href="#home" className="navbar-logo">SafeShore</a>
        <div className={`hamburger ${menuOpen ? "active" : ""}`} onClick={toggleMenu}><span></span><span></span><span></span></div>
        <div className={`navbar-links ${menuOpen ? "active" : ""}`}>
          {["features", "about", "developers", "contact"].map(section => (
            <a key={section} href={`#${section}`} onClick={() => setMenuOpen(false)}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </a>
          ))}
          <button onClick={toggleTheme} className="theme-toggle-button">{theme === "light" ? <FaMoon size={18} /> : <FaSun size={18} />}</button>
          <button onClick={handleLiveClick} className="live-toggle-button">🔴 Live</button>
        </div>
      </nav>

      {/* LIVE SENSOR CARD */}
      {liveVisible && (
        <div className="live-card">
          <h4>Live Sensor Reading</h4>
          <ul>
            {Object.entries(sensorData).map(([key, value]) => (
              <li key={key} style={{ color: getColor(getStatus(key, value)) }}>
                {key.toUpperCase()}: {value} → {getStatus(key, value)}
              </li>
            ))}
          </ul>
          <hr />
          <p><b>Overall Status:</b> <span style={{ color: getColor(computeOverallStatus()) }}>{computeOverallStatus()}</span></p>
          <p><i>Based on WHO & EPA water quality standards</i></p>
        </div>
      )}

      {/* WATER QUALITY CHART */}
      <section id="weekly-analysis" className="features">
        <h2>Water Quality Over Time</h2>
        <div className="filter-section">
          <label>Select Date:</label>
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </option>
            ))}
          </select>
        </div>

        {loadingDaily ? (
          <p>Loading data...</p>
        ) : dailyData.length === 0 ? (
          <p>No data available for this date.</p>
        ) : (
          <div style={{ width: "100%", marginTop: "20px" }}>
            <h2 style={{ marginBottom: "5px", fontSize: "28px", fontWeight: "700" }}>
              {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long" })}
            </h2>

            <ResponsiveContainer width="100%" height={330}>
              <AreaChart data={dailyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="PH" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0bef17ff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#7EE8FA" stopOpacity={0.1} />
                  </linearGradient>

                  <linearGradient id="Turbidity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4BB7A7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4BB7A7" stopOpacity={0.1} />
                  </linearGradient>

                  <linearGradient id="Temperature" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6010ebff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#67C6F2" stopOpacity={0.1} />
                  </linearGradient>

                  <linearGradient id="TDS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9e20aff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#435B9A" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend
                  verticalAlign="top"
                  height={40}
                  formatter={(value) => <span style={{ fontSize: "14px" }}>{value}</span>}
                />

                <Area type="monotone" dataKey="ph" stroke="#0bef17ff" fill="url(#PH)" strokeWidth={2} name="PH" />
                <Area type="monotone" dataKey="turbidity" stroke="#4BB7A7" fill="url(#Turbidity)" strokeWidth={2} name="Turbidity" />
                <Area type="monotone" dataKey="temperature" stroke="#6010ebff" fill="url(#Temperature)" strokeWidth={2} name="Temperature" />
                <Area type="monotone" dataKey="tds" stroke="#c9e20aff" fill="url(#TDS)" strokeWidth={2} name="TDS" />
              </AreaChart>
            </ResponsiveContainer>

            {/* ---------------- OVERALL STATUS BOX ---------------- */}
            <div
              style={{
                margin: "2vh auto",               // vertical spacing responsive
                padding: "1vh 2vw",               // responsive padding
                width: "80%",                      // responsive width, max 300px
                maxWidth: "300px",                 // caps width for larger screens
                borderRadius: "1rem",              // scalable radius
                textAlign: "center",
                fontSize: "1.2rem",                // scales with root font size
                fontWeight: "600",
                background: "#f5f5f5",
              }}
            >
              {(() => {
                const latest = dailyData[dailyData.length - 1];

                // Sensor status helper
                const getSensorStatus = (type, value) => {
                  if (value === null || value === undefined || value === "N/A") return "unknown";
                  const val = parseFloat(value);
                  if (isNaN(val)) return "unknown";

                  switch (type) {
                    case "ph":
                      if (val >= 6.5 && val <= 8.5) return "safe";
                      if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "moderate";
                      return "unsafe";
                    case "turbidity":
                      if (val <= 5) return "safe";
                      if (val > 5 && val <= 10) return "moderate";
                      return "unsafe";
                    case "temperature":
                      if (val >= 24 && val <= 32) return "safe";
                      if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "moderate";
                      return "unsafe";
                    case "tds":
                      if (val <= 500) return "safe";
                      if (val > 500 && val <= 1000) return "moderate";
                      return "unsafe";
                    default:
                      return "unknown";
                  }
                };

                const statuses = [
                  getSensorStatus("ph", latest.ph),
                  getSensorStatus("turbidity", latest.turbidity),
                  getSensorStatus("temperature", latest.temperature),
                  getSensorStatus("tds", latest.tds),
                ];

                let overall = "Safe";
                if (statuses.includes("unsafe")) overall = "Unsafe";
                else if (statuses.includes("moderate")) overall = "Moderate";
                else if (statuses.includes("unknown")) overall = "Unknown";

                const color =
                  overall === "Safe" ? "green" : overall === "Moderate" ? "orange" : overall === "Unsafe" ? "red" : "gray";

                return <span style={{ color }}>Overall Water Quality: {overall.charAt(0).toUpperCase() + overall.slice(1)}</span>;
              })()}
            </div>
          </div>
        )}


      </section>

      {/* OTHER SECTIONS */}
      <section id="features" className="features">
        <h2>Features</h2>
        <div className="features-grid-2x2">
          <div className="feature-card"><h3>Real-time Monitoring</h3><p>Track water quality instantly with live sensor readings.</p></div>
          <div className="feature-card"><h3>Safe Alerts</h3><p>Get alerts if water quality falls into caution or unsafe levels.</p></div>
          <div className="feature-card"><h3>Dark/Light Mode</h3><p>Switch between themes for day or night viewing comfort.</p></div>
          <div className="feature-card"><h3>Eco-Friendly</h3><p>Promotes sustainable water use and eco-conscious habits.</p></div>
        </div>
      </section>

      <section id="about" className="about">
        <h2>About SafeShore</h2>
        <p>SafeShore is a water monitoring system providing real-time readings of pH, turbidity, temperature, and TDS.</p>
      </section>

      <section id="developers" className="developers">
        <h2>Meet the Developers</h2>
        <div className="developer-grid">
          {[{ img: peejayPhoto, name: "Peejay Marco A. Apale" },
          { img: aldricPhoto, name: "Aldric Rholen Calatrava" },
          { img: lawrencePhoto, name: "Lawrence Jay Saludes" },
          { img: wencePhoto, name: "Wence Dante De Vera" }]
            .map((dev, idx) => (
              <div key={idx} className="developer-item">
                <img src={dev.img} alt={dev.name} className="dev-photo" />
                <div className="dev-name"><b>{dev.name}</b></div>
              </div>
            ))}
        </div>
      </section>

      <section id="contact" className="contact">
        Email: <a href="mailto:contact@SafeShore.com" className="highlight">contact@SafeShore.com</a>
        <p>Phone: <span className="highlight">+63 912 345 6789</span></p>
      </section>

      <footer className="footer">&copy; {new Date().getFullYear()} SafeShore. All rights reserved.</footer>
    </div>
  );
};

export default VisitorPage;
