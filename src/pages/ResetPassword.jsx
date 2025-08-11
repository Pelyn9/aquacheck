import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";
import "../assets/login.css";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: "http://localhost:3000/change-password", // ✅ your app’s page
        handleCodeInApp: true
      });
      setMessage("✅ Reset link sent! Please check your email.");
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-wrapper modern">
      <section className="login-card modern">
        <h1 className="title">AquaCheck</h1>
        <p className="subtitle">Reset Password</p>
        <form onSubmit={handleReset}>
          <div className="input-group modern">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          {message && (
            <p className={message.startsWith("✅") ? "highlight" : "error-message"}>
              {message}
            </p>
          )}
        </form>
        <p style={{ marginTop: "20px", textAlign: "center" }}>
          Remember your password?{" "}
          <Link to="/admin" style={{ color: "#00b4d8" }}>Login here</Link>
        </p>
      </section>
    </main>
  );
};

export default ResetPassword;
