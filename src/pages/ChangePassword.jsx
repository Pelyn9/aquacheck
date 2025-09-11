// src/pages/ChangePassword.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../assets/login.css";

const ChangePassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Check if user session was restored via Supabase reset link
    const getSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMessage("❌ Invalid or expired reset link.");
        setLoading(false);
      } else {
        setEmail(data.user.email);
        setLoading(false);
      }
    };
    getSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      return setMessage("❌ Passwords do not match.");
    }

    if (newPassword.length < 6) {
      return setMessage("❌ Password must be at least 6 characters.");
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage("❌ " + error.message);
      } else {
        setMessage("✅ Password updated! Redirecting to login...");
        setTimeout(() => navigate("/admin"), 3000);
      }
    } catch (err) {
      setMessage("❌ " + err.message);
    }
  };

  if (loading) {
    return (
      <main className="login-wrapper modern">
        <section className="login-card modern">
          <p>Loading reset link...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-wrapper modern">
      <section className="login-card modern" role="main" aria-labelledby="changeTitle">
        <h1 id="changeTitle">Change Password</h1>

        {email && (
          <p className="highlight" style={{ marginBottom: "20px" }}>
            Resetting password for: <b>{email}</b>
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 320 }}>
          <div className="input-group modern">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              placeholder="Enter new password"
              className="input-modern"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="input-group modern">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              className="input-modern"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Update Password
          </button>
        </form>

        {message && (
          <p
            role="alert"
            aria-live="assertive"
            className={message.startsWith("✅") ? "highlight" : "error-message"}
            style={{ marginTop: "15px" }}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
};

export default ChangePassword;
