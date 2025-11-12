import React, { useState, useEffect } from "react";
import "../assets/VisitorPage.css";
import peejayPhoto from "../assets/picture/peejay1.jpg";
import aldricPhoto from "../assets/picture/aldric.png";
import lawrencePhoto from "../assets/picture/lawrence.png";
import wencePhoto from "../assets/picture/wence.jpg";
import { FaSun, FaMoon } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const VisitorPage = () => {
  useEffect(() => { document.title = "H2Go"; }, []);

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
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

  // Get water safety status
  const getStatus = (type, value) => {
    if (value === "N/A") return "Unknown";
    const val = parseFloat(value);
    switch (type) {
      case "ph": return val >= 6.5 && val <= 8.5 ? "Safe" : (val >= 6 && val < 6.5) || (val > 8.5 && val <= 9) ? "Moderate" : "Unsafe";
      case "turbidity": return val <= 5 ? "Safe" : val <= 10 ? "Moderate" : "Unsafe";
      case "temperature": return val >= 20 && val <= 32 ? "Safe" : (val >= 15 && val < 20) || (val > 32 && val <= 35) ? "Moderate" : "Unsafe";
      case "tds": return val <= 500 ? "Safe" : val <= 1000 ? "Moderate" : "Unsafe";
      default: return "Unknown";
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
      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (!error && rows.length > 0) {
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
      const { data: rows, error } = await supabase
        .from("dataset_history")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (!error && rows) {
        const chartData = rows.map(item => ({
          time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          ph: parseFloat(item.ph?.toFixed(2)) || 0,
          turbidity: parseFloat(item.turbidity?.toFixed(2)) || 0,
          temperature: parseFloat(item.temperature?.toFixed(2)) || 0,
          tds: parseFloat(item.tds?.toFixed(2)) || 0,
        }));
        setDailyData(chartData);
      } else {
        setDailyData([]);
      }

      setLoadingDaily(false);
    };

    fetchDailyData();
  }, [selectedDate]);

  return (
    <div className="visitor-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <a href="#home" className="navbar-logo">H2Go</a>
        <div className={`hamburger ${menuOpen ? "active" : ""}`} onClick={toggleMenu}>
          <span></span><span></span><span></span>
        </div>
        <div className={`navbar-links ${menuOpen ? "active" : ""}`}>
          {["features","about","developers","contact"].map(section => (
            <a key={section} href={`#${section}`} onClick={() => setMenuOpen(false)}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </a>
          ))}
          <button onClick={toggleTheme} className="theme-toggle-button">
            {theme === "light" ? <FaMoon size={18}/> : <FaSun size={18}/>}
          </button>
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
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {new Date(date).toLocaleDateString("en-US",{ year:"numeric", month:"long", day:"numeric" })}
              </option>
            ))}
          </select>
        </div>

        {loadingDaily ? <p>Loading data...</p> :
          dailyData.length === 0 ? <p>No data available for this date.</p> :
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="time"/>
                <YAxis/>
                <Tooltip/>
                <Legend/>
                <Line dataKey="ph" stroke="#8884d8" name="pH"/>
                <Line dataKey="turbidity" stroke="#82ca9d" name="Turbidity"/>
                <Line dataKey="temperature" stroke="#ffc658" name="Temp (°C)"/>
                <Line dataKey="tds" stroke="#ff7300" name="TDS (ppm)"/>
              </LineChart>
            </ResponsiveContainer>
        }
      </section>

      {/* FEATURES */}
      <section id="features" className="features">
        <h2>Features</h2>
        <div className="features-grid-2x2">
          <div className="feature-card"><h3>Real-time Monitoring</h3><p>Track water quality instantly with live sensor readings.</p></div>
          <div className="feature-card"><h3>Safe Alerts</h3><p>Get alerts if water quality falls into caution or unsafe levels.</p></div>
          <div className="feature-card"><h3>Dark/Light Mode</h3><p>Switch between themes for day or night viewing comfort.</p></div>
          <div className="feature-card"><h3>Eco-Friendly</h3><p>Encourages sustainable water use and eco-conscious practices.</p></div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="about">
        <h2>About H2Go</h2>
        <p>H2Go is an advanced water quality monitoring system designed to deliver precise, real-time readings of pH, turbidity, temperature, and TDS.</p>
      </section>

      {/* DEVELOPERS */}
      <section id="developers" className="developers">
        <h2>Meet the Developers</h2>
        <div className="developer-grid">
          {[{img:peejayPhoto,name:"Peejay Marco A. Apale"},
            {img:aldricPhoto,name:"Aldric Rholen Calatrava"},
            {img:lawrencePhoto,name:"Lawrence Jay Saludes"},
            {img:wencePhoto,name:"Wence Dante De Vera"}].map((dev,idx)=>(
              <div key={idx} className="developer-item">
                <img src={dev.img} alt="" className="dev-photo"/>
                <div className="dev-name"><b>{dev.name}</b></div>
              </div>
            ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="contact">
        Email: <a href="mailto:contact@H2Go.com" className="highlight">contact@H2Go.com</a>
        <p>Phone: <span className="highlight">+63 912 345 6789</span></p>
      </section>

      <footer className="footer">&copy; {new Date().getFullYear()} H2Go. All rights reserved.</footer>
    </div>
  );
};

export default VisitorPage;
