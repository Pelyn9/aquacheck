import React, { useState, useEffect } from "react";
import "../assets/VisitorPage.css";
import cuacoImage from "../assets/picture/cuaco.jpg";
import peejayPhoto from "../assets/picture/peejay.jpg";
import { FaSun, FaMoon } from "react-icons/fa"; // ✅ Added

const VisitorPage = () => {
  // ✅ Load saved theme from localStorage (persistent)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const [liveVisible, setLiveVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sensorData, setSensorData] = useState({
    ph: "N/A",
    turbidity: "N/A",
    temp: "N/A",
    tds: "N/A",
  });

  // ✅ Apply and save theme whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const toggleLive = async () => {
    setLiveVisible((prev) => !prev);
    try {
      const response = await fetch("http://192.168.0.100:5000/sensor-data");
      if (!response.ok) throw new Error("Failed to fetch sensor data");
      const data = await response.json();
      setSensorData({
        ph: parseFloat(data.ph).toFixed(2),
        turbidity: parseFloat(data.turbidity).toFixed(1),
        temp: parseFloat(data.temp).toFixed(1),
        tds: parseFloat(data.tds).toFixed(0),
      });
    } catch (error) {
      console.error(error);
    }
  };

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

  const getColor = (status) => {
    switch (status) {
      case "Safe":
        return "white";
      case "Caution":
        return "orange";
      case "Unsafe":
        return "red";
      default:
        return "gray";
    }
  };

  const computeOverallStatus = () => {
    const statuses = Object.keys(sensorData).map((type) =>
      getStatus(type, sensorData[type])
    );
    if (statuses.includes("Unsafe")) return "Unsafe";
    if (statuses.includes("Caution")) return "Caution";
    if (statuses.every((s) => s === "Safe")) return "Safe";
    return "Unknown";
  };

  return (
    <div className="visitor-container">
      {/* ================= Navbar ================= */}
      <nav className="navbar">
        <a href="#home" className="navbar-logo">
          AquaCheck
        </a>

        {/* Hamburger icon */}
        <div
          className={`hamburger ${menuOpen ? "active" : ""}`}
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* Navbar links */}
        <div className={`navbar-links ${menuOpen ? "active" : ""}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>
            Home
          </a>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="#developers" onClick={() => setMenuOpen(false)}>
            Developers
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>

          {/* ✅ Persistent Dark/Light Mode Toggle */}
          <button onClick={toggleTheme} className="theme-toggle-button">
            {theme === "light" ? <FaMoon size={18} /> : <FaSun size={18} />}
          </button>

          <button onClick={toggleLive} className="live-toggle-button">
            🔴 Live
          </button>
        </div>
      </nav>

      {/* ================= Live Card ================= */}
      {liveVisible && (
        <div className="live-card">
          <h4>Live Sensor Reading</h4>
          <ul>
            {Object.keys(sensorData).map((key) => (
              <li
                key={key}
                style={{ color: getColor(getStatus(key, sensorData[key])) }}
              >
                {key.toUpperCase()}: {sensorData[key]} →{" "}
                {getStatus(key, sensorData[key])}
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

      {/* ================= Hero Section ================= */}
      <section id="home" className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1>Discover</h1>
            <h1>
              <span>Cuaco Beach</span>
            </h1>
            <p>
              Crystal-clear waters, relaxing vibes, and safe monitoring with{" "}
              <b>AquaCheck</b>.
            </p>
          </div>
          <div className="hero-image">
            <img src={cuacoImage} alt="Cuaco Beach" />
          </div>
        </div>
      </section>

      {/* ================= Features Section ================= */}
      <section id="features" className="features">
        <h2>Features</h2>
        <div className="features-grid-2x2">
          <div className="feature-card">
            <h3>Real-time Monitoring</h3>
            <p>Track water quality instantly with live sensor readings.</p>
          </div>
          <div className="feature-card">
            <h3>Safe Alerts</h3>
            <p>Get alerts if water quality falls into caution or unsafe levels.</p>
          </div>
          <div className="feature-card">
            <h3>Dark/Light Mode</h3>
            <p>Switch between themes for day or night viewing comfort.</p>
          </div>
          <div className="feature-card">
            <h3>Eco-Friendly</h3>
            <p>Encourages sustainable water use and eco-conscious practices.</p>
          </div>
        </div>
      </section>

      {/* ================= About Section ================= */}
      <section id="about" className="about">
        <h2>About AquaCheck</h2>
        <p>
          AquaCheck is a modern water monitoring system designed to provide
          accurate readings for pH, turbidity, temperature, and TDS. It helps
          ensure safe water conditions for everyone.
        </p>
      </section>

      {/* ================= Developers Section ================= */}
      <section id="developers" className="developers">
        <h2>Meet the Developers</h2>
        <div className="developer-grid">
          <div className="developer-item">
            <img src={peejayPhoto} alt="" className="dev-photo" />
            <div className="dev-name">
              <b>Peejay Marco A. Apale</b>
            </div>
          </div>
          <div className="developer-item">
            <img src="placeholder.jpg" alt="" className="dev-photo" />
            <div className="dev-name">
              <b>Aldric Rholen Calatrava</b>
            </div>
          </div>
          <div className="developer-item">
            <img src="placeholder.jpg" alt="" className="dev-photo" />
            <div className="dev-name">
              <b>Lawrence Jay Saludes</b>
            </div>
          </div>
          <div className="developer-item">
            <img src="placeholder.jpg" alt="" className="dev-photo" />
            <div className="dev-name">
              <b>Wence Dante De Vera</b>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Contact Section ================= */}
      <section id="contact" className="contact">
        Email:{" "}
        <a href="mailto:contact@aquacheck.com" className="highlight">
          contact@aquacheck.com
        </a>
        <p>
          Phone: <span className="highlight"></span>+63 912 345 6789
        </p>
      </section>

      {/* ================= Footer ================= */}
      <footer className="footer">
        &copy; {new Date().getFullYear()} AquaCheck. All rights reserved.
      </footer>
    </div>
  );
};

export default VisitorPage;
