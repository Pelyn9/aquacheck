import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AdminContext } from "../App"; // adjust path if needed
import "../assets/login.css"; // ensure this has your CSS

const AdminLogin = () => {
  const { setIsAdmin } = useContext(AdminContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  const TEST_ADMIN_EMAIL = "admin";
  const TEST_ADMIN_PASSWORD = "admin123";

  useEffect(() => {
    let timer;
    if (showWelcome && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (showWelcome && countdown === 0) {
      navigate("/dashboard");
    }
    return () => clearTimeout(timer);
  }, [showWelcome, countdown, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (email.trim() === TEST_ADMIN_EMAIL && password.trim() === TEST_ADMIN_PASSWORD) {
      localStorage.setItem("isAdmin", "true");
      setIsAdmin(true);
      setShowWelcome(true);
      setCountdown(5);
    } else {
      setError("❌ Invalid admin email or password.");
    }
  };

  if (showWelcome) {
    return (
      <div className="login-wrapper modern" role="alert" aria-live="polite">
        <div className="login-card modern">
          <h1>
            Welcome, <span className="highlight">{email.trim()}</span>!
          </h1>
          <p>You will be redirected to the dashboard shortly...</p>
          <p className="countdown-text">
            Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="login-wrapper modern">
      <section className="login-card modern" role="main" aria-labelledby="loginTitle">
        <h1 id="loginTitle" className="title" style={{ marginBottom: "8px" }}>
          AquaCheck
        </h1>
        <p className="subtitle" style={{ marginBottom: "24px" }}>
          Admin Login
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group modern">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              className="input-modern"
            />
          </div>
          <div className="input-group modern" style={{ position: "relative" }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="admin123"
              autoComplete="current-password"
              className="input-modern"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div style={{ textAlign: "right", marginBottom: "20px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.9rem", borderRadius: "8px" }}
              onClick={() => navigate("/forgot-password")} // adjust route accordingly
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            aria-label="Login to Admin Dashboard"
          >
            Login
          </button>

          {error && (
            <p className="error-message" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
};

export default AdminLogin;
