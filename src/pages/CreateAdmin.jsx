import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../assets/createadmin.css";

const CreateAdmin = () => {
  const [email, setEmail] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== rePassword) {
      setError("❌ Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const keyRes = await fetch("http://localhost:4000/api/admin/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey }),
      });

      if (!keyRes.ok) {
        const data = await keyRes.json();
        setError("❌ " + (data.message || "Invalid admin key"));
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: "admin" },
        },
      });

      if (error) {
        setError("❌ " + error.message);
      } else {
        setSuccess(`✅ Admin account created for ${data.user.email}`);
        navigate("/admin");
      }
    } catch (err) {
      setError("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-wrapper modern">
      <section className="login-card modern">
        <h1 className="title">AquaCheck</h1>
        <p className="subtitle">Create Admin Account</p>

        <form onSubmit={handleSubmit} noValidate>
          {/* 2x2 Grid */}
          <div className="form-grid">
            <div className="input-group modern">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-modern"
                autoComplete="email"
              />
            </div>

            <div className="input-group modern">
              <label htmlFor="adminKey">Admin Key</label>
              <input
                id="adminKey"
                type="password"
                required
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter secret admin key"
                className="input-modern"
              />
            </div>

            <div className="input-group modern">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="input-modern"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="input-group modern">
              <label htmlFor="rePassword">Re-enter Password</label>
              <input
                id="rePassword"
                type={showRePassword ? "text" : "password"}
                required
                value={rePassword}
                onChange={(e) => setRePassword(e.target.value)}
                placeholder="Confirm your password"
                className="input-modern"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowRePassword(!showRePassword)}
              >
                {showRePassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Buttons below */}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Creating..." : "Create Admin"}
          </button>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="highlight">{success}</p>}
        </form>

        <p style={{ marginTop: "12px" }}>
          Already have an account?{" "}
          <Link to="/admin" className="btn btn-secondary">
            Login here
          </Link>
        </p>
      </section>
    </main>
  );
};

export default CreateAdmin;