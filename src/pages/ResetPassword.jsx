import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("✅ Reset link sent! Please check your email.");
    } catch (error) {
      setMessage("❌ Failed to send reset email. Try again.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>AquaCheck</h1>
        <p className="subtitle">Reset Password</p>
        <form onSubmit={handleReset}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit">Send Reset Link</button>
          <p className="info-message">{message}</p>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
