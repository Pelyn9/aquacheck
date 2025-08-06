import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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

    try {
      if (forgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccess("📧 Password reset link sent!");
        return;
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess("✅ Login successful!");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccess("✅ Account created!");
      }
    } catch (err) {
      setError("❌ " + err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>AquaCheck</h1>
        <p className="subtitle">{isLogin ? "User Login" : "User Registration"}</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {!forgotPassword && (
            <div className="input-group">
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <button type="submit">
            {forgotPassword ? "Send Reset Link" : isLogin ? "Login" : "Register"}
          </button>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
        <p>
          <span
            style={{ color: "#0077b6", cursor: "pointer" }}
            onClick={() => setForgotPassword(!forgotPassword)}
          >
            {forgotPassword ? "Back to Login/Register" : "Forgot Password?"}
          </span>
        </p>
        {!forgotPassword && (
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <span
              style={{ color: "#0077b6", cursor: "pointer" }}
              onClick={() => setIsLogin(!isLogin)}
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
