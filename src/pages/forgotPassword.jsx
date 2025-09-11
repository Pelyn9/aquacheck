// src/pages/ResetPassword.jsx
import { useState } from "react";
import { supabase } from "../supabaseClient"; 
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
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: "http://localhost:3000/update-password", 
          // 👆 Change to your deployed app URL in production
        }
      );

      if (error) throw error;

      // ✅ Debugging (optional) — remove this in production
      console.log("Password reset response:", data);

      setMessage("✅ Reset link sent! Please check your email.");
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-wrapper modern">
      <section
        className="login-card modern"
        role="main"
        aria-labelledby="resetTitle"
      >
        <h1 id="resetTitle" className="title" style={{ marginBottom: "8px" }}>
          AquaCheck
        </h1>
        <p className="subtitle" style={{ marginBottom: "24px" }}>
          Reset Password
        </p>

        <form onSubmit={handleReset} noValidate>
          <div className="input-group modern">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              autoComplete="username"
              className="input-modern"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            aria-label="Send password reset link"
          >
            {loading ? "Sending..." : "Send Reset Link"}
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

        <p style={{ marginTop: "20px", textAlign: "center" }}>
          Remember your password?{" "}
          <Link
            to="/admin"
            style={{ color: "#00b4d8", textDecoration: "underline" }}
          >
            Login here
          </Link>
        </p>
      </section>
    </main>
  );
};

export default ResetPassword;
