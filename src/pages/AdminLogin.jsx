import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AdminContext } from "../App";
import {
  signInWithEmailAndPassword,
  // GoogleAuthProvider,
  // signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

const AdminLogin = () => {
  const { setIsAdmin } = useContext(AdminContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (showWelcome && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (showWelcome && countdown === 0) {
      navigate("/dashboard");
    }
    return () => clearTimeout(timer);
  }, [showWelcome, countdown, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("isAdmin", "true");
      setIsAdmin(true);
      setShowWelcome(true);
      setCountdown(5);
    } catch (err) {
      setError("❌ " + err.message);
    }
  };

  /*
  // Google login temporarily disabled
  const handleGoogleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      localStorage.setItem("isAdmin", "true");
      setIsAdmin(true);
      setEmail(result.user.email || "Google User");
      setShowWelcome(true);
      setCountdown(5);
    } catch (err) {
      setError("❌ Google login failed: " + err.message);
    }
  };
  */

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
      <section
        className="login-card modern"
        role="main"
        aria-labelledby="loginTitle"
      >
        <h1
          id="loginTitle"
          className="title"
          style={{ marginBottom: "8px" }}
        >
          AquaCheck
        </h1>
        <p className="subtitle" style={{ marginBottom: "24px" }}>
          Admin Login
        </p>

        <form onSubmit={handleEmailLogin} noValidate>
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
          <div
            className="input-group modern"
            style={{ position: "relative" }}
          >
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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

          <div
            style={{ textAlign: "right", marginBottom: "20px" }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.9rem", borderRadius: "8px" }}
              onClick={() => navigate("/forgot-password")}
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
        </form>

        {/*
        <div style={{ margin: "20px 0", textAlign: "center" }}>
          <span style={{ fontSize: "0.9rem", color: "#888" }}>OR</span>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="btn btn-secondary"
          style={{ backgroundColor: "#fff", color: "#000", border: "1px solid #ccc" }}
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google Logo"
            style={{ width: "20px", height: "20px", marginRight: "8px", verticalAlign: "middle" }}
          />
          Sign in with Google
        </button>
        */}

        {error && (
          <p
            className="error-message"
            role="alert"
            aria-live="assertive"
            style={{ marginTop: "10px" }}
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
};

export default AdminLogin;
