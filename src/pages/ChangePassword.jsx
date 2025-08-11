import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

const ChangePassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) {
      setMessage("❌ No reset code found.");
      setLoading(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setLoading(false);
      })
      .catch(() => {
        setMessage("❌ Invalid or expired reset link.");
        setLoading(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setMessage("❌ Passwords do not match.");
    }
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage("✅ Password updated! Redirecting to login...");
      setTimeout(() => navigate("/admin"), 3000);
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
      <section className="login-card modern">
        <h1>Change Password</h1>
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
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Update Password
          </button>
        </form>
        {message && (
          <p
            className={
              message.startsWith("✅") ? "highlight" : "error-message"
            }
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
};

export default ChangePassword;
