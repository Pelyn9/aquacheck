import React, { useState, useContext } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { AdminContext } from "../App";
import "../assets/createadmin.css";

const ADMIN_SECRET_KEY = "SuperSecretAdminKey123"; // For testing only

const CreateAdmin = () => {
  const [email, setEmail] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { setIsAdmin } = useContext(AdminContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== rePassword) {
      setError("❌ Passwords do not match.");
      return;
    }

    if (adminKey !== ADMIN_SECRET_KEY) {
      setError("❌ Invalid Admin Key.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      localStorage.setItem("isAdmin", "true");
      setIsAdmin(true);
      setSuccess("✅ Admin account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      setError("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper modern">
      <div className="login-card modern">
        <h1>AquaCheck</h1>
        <p className="subtitle highlight">Create Admin Account</p>

        <form onSubmit={handleSubmit} className="grid-form">
          {/* Email */}
          <div className="input-group modern">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="input-modern"
              placeholder="Enter your email"
            />
          </div>

          {/* Admin Key */}
          <div className="input-group modern">
            <label htmlFor="adminKey">Admin Key</label>
            <input
              id="adminKey"
              type="password"
              required
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="input-modern"
              placeholder="Enter secret admin key"
            />
          </div>

          {/* Password */}
          <div className="input-group modern">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="input-modern"
              placeholder="Create a password"
            />
          </div>

          {/* Re-enter Password */}
          <div className="input-group modern">
            <label htmlFor="rePassword">Re-enter Password</label>
            <input
              id="rePassword"
              type="password"
              required
              value={rePassword}
              onChange={(e) => setRePassword(e.target.value)}
              autoComplete="new-password"
              className="input-modern"
              placeholder="Confirm your password"
            />
          </div>

          {/* Submit button */}
          <div className="full-width">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Creating..." : "Create Admin"}
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="highlight">{success}</p>}
        </form>

        <p>
          Already have an account?{" "}
          <Link
            to="/admin"
            className="btn btn-secondary"
            style={{
              textDecoration: "none",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CreateAdmin;
