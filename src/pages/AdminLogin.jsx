import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { AdminContext } from "../App";
import "../assets/login.css";

const REDIRECT_SECONDS = 5;

const formatAuthError = (message) => {
  if (!message) return "Login failed. Please try again.";
  if (/Invalid login credentials/i.test(message)) return "Invalid email or password.";
  if (/Email not confirmed/i.test(message)) return "Please confirm your email before logging in.";
  return message;
};

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [clicks, setClicks] = useState(0);

  const navigate = useNavigate();
  const { setIsAdmin } = useContext(AdminContext);

  useEffect(() => {
    let timer;
    if (showWelcome && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else if (showWelcome && countdown === 0) {
      navigate("/dashboard");
    }
    return () => clearTimeout(timer);
  }, [showWelcome, countdown, navigate]);

  useEffect(() => {
    if (clicks >= 10) {
      setClicks(0);
      navigate("/create-admin");
    }
  }, [clicks, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;
      if (!data?.user) throw new Error("No user returned from authentication.");

      setIsAdmin(true);
      localStorage.setItem("isAdmin", "true");
      setShowWelcome(true);
      setCountdown(REDIRECT_SECONDS);
    } catch (err) {
      setError(formatAuthError(err?.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTitleClick = () => {
    setClicks((prev) => prev + 1);
  };

  if (showWelcome) {
    return (
      <main className="login-wrapper modern admin-login-page">
        <section className="login-card modern admin-login-card">
          <div className="admin-login-head">
            <p className="admin-login-badge">Access Granted</p>
            <h1>Welcome back</h1>
            <p className="admin-login-subtitle">
              Signed in as <span className="highlight">{email.trim()}</span>
            </p>
          </div>
          <p className="countdown-text">
            Redirecting to dashboard in {countdown} second{countdown !== 1 ? "s" : ""}...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-wrapper modern admin-login-page">
      <section className="login-card modern admin-login-card" role="main" aria-labelledby="adminLoginTitle">
        <div className="admin-login-head">
          <p className="admin-login-badge">Secure Admin Access</p>
          <h1 id="adminLoginTitle" className="title" onClick={handleTitleClick}>
            SafeShore
          </h1>
          <p className="admin-login-subtitle">Sign in to monitor water quality, saves, and analytics.</p>
        </div>

        <form onSubmit={handleEmailLogin} noValidate className="admin-login-form">
          <div className="input-group modern">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@company.com"
              className="input-modern"
              autoComplete="email"
            />
          </div>

          <div className="input-group modern password-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="input-modern"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="admin-login-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login"}
            </button>

            <button
              type="button"
              className="btn btn-secondary admin-login-inline-btn"
              onClick={() => navigate("/forgot-password")}
              disabled={isSubmitting}
            >
              Forgot Password?
            </button>

            <button type="button" className="btn btn-visitor" onClick={() => navigate("/visitor")}>
              Continue as Visitor
            </button>
          </div>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>
    </main>
  );
};

export default AdminLogin;
