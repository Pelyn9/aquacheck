import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../assets/login.css";

const resolveCreateUserEndpoints = () => {
  const endpoints = [];
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  endpoints.push("/api/users");
  if (isLocalHost) endpoints.push("http://localhost:4000/api/users");

  return [...new Set(endpoints)];
};

const syncUserRecord = async (authId, email) => {
  const endpoints = resolveCreateUserEndpoints();

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_id: authId, email }),
      });

      if (response.ok) return true;
    } catch {
      // continue fallback chain
    }
  }

  return false;
};

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || (!password && !forgotPassword)) {
      setError("❌ Please fill all fields");
      return;
    }

    try {
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: "http://localhost:5173/update-password",
        });
        if (error) throw error;
        setSuccess("📧 Password reset link sent!");
        setEmail("");
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setSuccess("✅ Login successful!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        const userSynced = await syncUserRecord(data.user.id, data.user.email);
        setSuccess(
          userSynced
            ? "✅ Account created! Please check your email to verify."
            : "✅ Account created! Please check your email to verify. (Profile sync pending)"
        );
      }

      setEmail("");
      setPassword("");
    } catch (err) {
      console.error(err);
      setError("❌ " + err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card" role="main">
        <h1>AquaCheck</h1>
        <p className="subtitle">{isLogin ? "User Login" : "User Registration"}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!forgotPassword && (
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit">
            {forgotPassword
              ? "Send Reset Link"
              : isLogin
              ? "Login"
              : "Register"}
          </button>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>

        <p>
          <span
            style={{ color: "#0077b6", cursor: "pointer" }}
            onClick={() => {
              setForgotPassword(!forgotPassword);
              setError("");
              setSuccess("");
            }}
          >
            {forgotPassword ? "Back to Login/Register" : "Forgot Password?"}
          </span>
        </p>

        {!forgotPassword && (
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <span
              style={{ color: "#0077b6", cursor: "pointer" }}
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setSuccess("");
              }}
            >
              {isLogin ? "Register" : "Login"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
