import React, { useState, useEffect } from "react";
import "../assets/VisitorPage.css";
import cuacoImage from "../assets/picture/cuaco.jpg";
import peejayPhoto from "../assets/picture/peejay1.jpg";
import aldricPhoto from "../assets/picture/aldric.png";
import lawrencePhoto from "../assets/picture/lawrence.png";
import wencePhoto from "../assets/picture/wence.jpg";
import { FaSun, FaMoon } from "react-icons/fa";

const VisitorPage = () => {
  useEffect(() => {
    document.title = "AquaCheck";
  }, []);

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [liveVisible, setLiveVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));
  const toggleMenu = () => setMenuOpen(prev => !prev);

  const getStatus = (type, value) => {
    if (value === "N/A") return "Unknown";
    const val = parseFloat(value);
    switch (type) {
      case "ph":
        if (val >= 6.5 && val <= 8.5) return "Safe";
        if ((val >= 6 && val < 6.5) || (val > 8.5 && val <= 9)) return "Caution";
        return "Unsafe";
      case "turbidity":
        if (val <= 5) return "Safe";
        if (val > 5 && val <= 10) return "Caution";
        return "Unsafe";
      case "temp":
        if (val >= 24 && val <= 32) return "Safe";
        if ((val >= 20 && val < 24) || (val > 32 && val <= 35)) return "Caution";
        return "Unsafe";
      case "tds":
        if (val <= 500) return "Safe";
        if (val > 500 && val <= 1000) return "Caution";
        return "Unsafe";
      default:
        return "Unknown";
    }
  };

  const getColor = status => {
    switch (status) {
      case "Safe": return "white";
      case "Caution": return "orange";
      case "Unsafe": return "red";
      default: return "gray";
    }
  };

  const computeOverallStatus = (data = sensorData) => {
    const statuses = Object.keys(data).map(type => getStatus(type, data[type]));
    if (statuses.includes("Unsafe")) return "Unsafe";
    if (statuses.includes("Caution")) return "Caution";
    if (statuses.every(s => s === "Safe")) return "Safe";
    return "Unknown";
  };

  const fetchSensorData = async () => {
    const API_URL = "http://aquacheck.local:5000/data";
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Server unreachable");
      const data = await response.json();
      const formattedData = {
        ph: data.ph !== undefined ? parseFloat(data.ph).toFixed(2) : "N/A",
        turbidity: data.turbidity !== undefined ? parseFloat(data.turbidity).toFixed(1) : "N/A",
        temp: data.temperature !== undefined ? parseFloat(data.temperature).toFixed(1) : "N/A",
        tds: data.tds !== undefined ? parseFloat(data.tds).toFixed(0) : "N/A",
      };
      setSensorData(formattedData);
      console.log("=== Live Sensor Data ===", formattedData);
    } catch (error) {
      console.error("Error fetching live data:", error);
      // Fallback: set Unknown values
      setSensorData({
        ph: "N/A",
        turbidity: "N/A",
        temp: "N/A",
        tds: "N/A",
      });
    }
  };

  // Auto-fetch live data every 5 seconds when liveVisible is true
  useEffect(() => {
    if (!liveVisible) return;
    fetchSensorData(); // fetch immediately
    const interval = setInterval(fetchSensorData, 1000);
    return () => clearInterval(interval);
  }, [liveVisible]);

  const handleLiveClick = () => {
    setLiveVisible(prev => {
      if (prev) {
        // Reset readings when hiding live card
        setSensorData({
          ph: "N/A",
          turbidity: "N/A",
          temp: "N/A",
          tds: "N/A",
        });
      }
      return !prev;
    });
  };

  return (
    <div className="visitor-container">
      {/* Navbar */}
      <nav className="navbar">
        <a href="#home" className="navbar-logo">AquaCheck</a>
        <div className={`hamburger ${menuOpen ? "active" : ""}`} onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className={`navbar-links ${menuOpen ? "active" : ""}`}>
          {["home", "features", "about", "developers", "contact"].map(section => (
            <a key={section} href={`#${section}`} onClick={() => setMenuOpen(false)}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </a>
          ))}
          <button onClick={toggleTheme} className="theme-toggle-button">
            {theme === "light" ? <FaMoon size={18} /> : <FaSun size={18} />}
          </button>
          <button onClick={handleLiveClick} className="live-toggle-button">🔴 Live</button>
        </div>
      </nav>

      {/* Live Sensor Card */}
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
          <p>
            <b>Overall Status:</b>{" "}
            <span style={{ color: getColor(computeOverallStatus()) }}>
              {computeOverallStatus()}
            </span>
          </p>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1>Discover</h1>
            <h1><span>Cuaco Beach</span></h1>
            <p>Crystal-clear waters, relaxing vibes, and safe monitoring with <b>AquaCheck</b>.</p>
          </div>
          <div className="hero-image"><img src={cuacoImage} alt="Cuaco Beach" /></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <h2>Features</h2>
        <div className="features-grid-2x2">
          <div className="feature-card"><h3>Real-time Monitoring</h3><p>Track water quality instantly with live sensor readings.</p></div>
          <div className="feature-card"><h3>Safe Alerts</h3><p>Get alerts if water quality falls into caution or unsafe levels.</p></div>
          <div className="feature-card"><h3>Dark/Light Mode</h3><p>Switch between themes for day or night viewing comfort.</p></div>
          <div className="feature-card"><h3>Eco-Friendly</h3><p>Encourages sustainable water use and eco-conscious practices.</p></div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about">
        <h2>About AquaCheck</h2>
        <p>
          AquaCheck is an advanced water quality monitoring system designed to deliver precise, real-time readings
          of key parameters such as pH, turbidity, temperature, and total dissolved solids (TDS). It empowers users
          to maintain safe and healthy water conditions.
        </p>
      </section>

      {/* Developers Section */}
      <section id="developers" className="developers">
        <h2>Meet the Developers</h2>
        <div className="developer-grid">
          {[{img: peejayPhoto, name: "Peejay Marco A. Apale"},
            {img: aldricPhoto, name: "Aldric Rholen Calatrava"},
            {img: lawrencePhoto, name: "Lawrence Jay Saludes"},
            {img: wencePhoto, name: "Wence Dante De Vera"}].map((dev, idx) => (
            <div key={idx} className="developer-item">
              <img src={dev.img} alt="" className="dev-photo" />
              <div className="dev-name"><b>{dev.name}</b></div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        Email: <a href="mailto:contact@aquacheck.com" className="highlight">contact@aquacheck.com</a>
        <p>Phone: <span className="highlight"></span>+63 912 345 6789</p>
      </section>

      {/* Footer */}
      <footer className="footer">&copy; {new Date().getFullYear()} AquaCheck. All rights reserved.</footer>
    </div>
  );
};

export default VisitorPage;
