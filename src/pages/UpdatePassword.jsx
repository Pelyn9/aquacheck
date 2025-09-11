// src/pages/UpdatePassword.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../assets/login.css";

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const navigate = useNavigate();

  // ✅ Extract access token from URL hash
  useEffect(() => {
    const hash = window.location.hash; // e.g., #access_token=...
    if (hash) {
      const params = new URLSearchParams(hash.substring(1)); // remove #
      const token = params.get("access_token");
      if (token) setAccessToken(token);
    }
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!accessToken) {
      setMessage("❌ Invalid or expired link.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { password: newPassword },
        { access_token: accessToken }
      );

      if (error) throw error;

      setMessage("✅ Password updated successfully!");
      setTimeout(() => {
        navigate("/admin"); // redirect to login after successful reset
      }, 2000);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-wrapper modern">
      <section className="login-card modern">
        <h1 className="title">AquaCheck</h1>
        <p className="subtitle">Set New Password</p>

        <form onSubmit={handleUpdate} noValidate>
          <div className="input-group modern">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="input-modern"
            />
          </div>

          <div className="input-group modern">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="input-modern"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Updating..." : "Update Password"}
          </button>

          {message && (
            <p
              className={message.startsWith("✅") ? "highlight" : "error-message"}
              role="alert"
              aria-live="assertive"
              style={{ marginTop: "15px" }}
            >
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
};

export default UpdatePassword;
