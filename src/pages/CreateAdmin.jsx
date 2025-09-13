// frontend/src/pages/CreateAdmin.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

    // ✅ Validation
    if (!email || !adminKey || !password || !rePassword) {
      setError("❌ Please fill in all fields.");
      return;
    }

    if (password !== rePassword) {
      setError("❌ Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("❌ Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, key: adminKey }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError("❌ " + (result.error || "Failed to create admin user"));
        return;
      }

      setSuccess(result.message);

      // Redirect after success
      setTimeout(() => {
        navigate("/admin");
      }, 2000);
    } catch (err) {
      console.error(err);
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
          <div className="form-grid">
            {/* Email */}
            <div className="input-group modern">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="input-modern"
                disabled={loading}
              />
            </div>

            {/* Admin Key */}
            <div className="input-group modern">
              <label>Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter secret admin key"
                required
                className="input-modern"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="input-group modern">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="input-modern"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Re-enter Password */}
            <div className="input-group modern">
              <label>Re-enter Password</label>
              <div className="password-wrapper">
                <input
                  type={showRePassword ? "text" : "password"}
                  value={rePassword}
                  onChange={(e) => setRePassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="input-modern"
                  disabled={loading}
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
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Creating..." : "Create Admin"}
          </button>

          {/* Messages */}
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
