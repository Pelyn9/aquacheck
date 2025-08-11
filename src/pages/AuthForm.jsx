import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

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

    if (forgotPassword && !email) {
      setError("❌ Please enter your email to reset password.");
      return;
    }

    try {
      if (forgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccess("📧 Password reset link sent!");
        setEmail(""); // Clear email after sending reset link
        return;
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess("✅ Login successful!");
        // Optionally clear fields or redirect user here
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccess("✅ Account created!");
        // Optionally clear fields or redirect user here
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      setError("❌ " + err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card" role="main" aria-label="Authentication form">
        <h1>AquaCheck</h1>
        <p className="subtitle">{isLogin ? "User Login" : "User Registration"}</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="emailHelp"
            />
          </div>

          {!forgotPassword && (
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            aria-label={
              forgotPassword
                ? "Send password reset link"
                : isLogin
                ? "Login"
                : "Register"
            }
          >
            {forgotPassword
              ? "Send Reset Link"
              : isLogin
              ? "Login"
              : "Register"}
          </button>

          {error && (
            <p
              className="error-message"
              role="alert"
              aria-live="assertive"
              style={{ marginTop: "8px" }}
            >
              {error}
            </p>
          )}
          {success && (
            <p
              className="success"
              role="status"
              aria-live="polite"
              style={{ marginTop: "8px" }}
            >
              {success}
            </p>
          )}
        </form>

        <p>
          <span
            style={{ color: "#0077b6", cursor: "pointer" }}
            onClick={() => {
              setForgotPassword(!forgotPassword);
              setError("");
              setSuccess("");
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setForgotPassword(!forgotPassword);
                setError("");
                setSuccess("");
              }
            }}
            role="button"
            aria-pressed={forgotPassword}
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
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccess("");
                }
              }}
              role="button"
              aria-pressed={isLogin}
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
