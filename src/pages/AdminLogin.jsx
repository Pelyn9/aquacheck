import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (forgot) {
        await sendPasswordResetEmail(auth, email);
        setSuccess("📧 Password reset link sent!");
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
      setSuccess("✅ Admin login successful!");
    } catch (err) {
      setError("❌ " + err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>AquaCheck</h1>
        <p className="subtitle">Admin Login</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {!forgot && (
            <div className="input-group">
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <button type="submit">{forgot ? "Send Reset Link" : "Login"}</button>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
        <p>
          <span
            style={{ color: "#0077b6", cursor: "pointer" }}
            onClick={() => setForgot(!forgot)}
          >
            {forgot ? "Back to Login" : "Forgot Password?"}
          </span>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
