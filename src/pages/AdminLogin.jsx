import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient"; 
import { AdminContext } from "../App";
import "../assets/login.css";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [clicks, setClicks] = useState(0); // ✅ Track title clicks safely

  const navigate = useNavigate();
  const { setIsAdmin } = useContext(AdminContext);

  // Countdown for welcome message redirect
  useEffect(() => {
    let timer;
    if (showWelcome && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (showWelcome && countdown === 0) {
      navigate("/dashboard");
    }
    return () => clearTimeout(timer);
  }, [showWelcome, countdown, navigate]);

  // Navigate to create-admin after 10 clicks (Easter egg)
  useEffect(() => {
    if (clicks === 10) {
      navigate("/create-admin");
    }
  }, [clicks, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setIsAdmin(true);
      localStorage.setItem("isAdmin", "true");

      console.log("Logged in user ID:", data.user.id);
      setShowWelcome(true);
      setCountdown(5);
    } catch (err) {
      if (err.message.includes("Email not confirmed")) {
        setIsAdmin(true);
        localStorage.setItem("isAdmin", "true");

        setShowWelcome(true);
        setCountdown(5);
      } else {
        setError("❌ " + err.message);
      }
    }
  };

  const handleTitleClick = () => {
    setClicks(prev => prev + 1); // only update state here
  };

  if (showWelcome) {
    return (
      <div className="login-wrapper modern">
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
      <section className="login-card modern">
        {/* 👇 Hidden shortcut Easter egg */}
        <h1 className="title" onClick={handleTitleClick}>
          AquaCheck
        </h1>
        <p className="subtitle">Admin Login</p>

        <form onSubmit={handleEmailLogin} noValidate>
          <div className="input-group modern">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="input-modern"
              autoComplete="email"
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
              placeholder="Password"
              className="input-modern"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button type="submit" className="btn btn-primary">
            Login
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.9rem", borderRadius: "8px"}}
            onClick={() => navigate("/forgot-password")}
          >
            Forgot Password?
          </button>
          <button
            type="button"
            className="btn btn-visitor"
            onClick={() => navigate("/visitor")}
          >
            Continue as Visitor
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>
    </main>
  );
};

export default AdminLogin;
