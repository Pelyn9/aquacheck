import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import "../assets/login.css";

const CreateAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [master, setMaster] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const MASTER_KEY = "AquaCheckH2O";

  const handleCreate = async (e) => {
    e.preventDefault();
    if (master !== MASTER_KEY) {
      setError("❌ Invalid master password.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess("✅ Admin account created!");
      setError("");
    } catch (err) {
      setError("❌ Failed to create account. Maybe email already used.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>AquaCheck</h1>
        <p className="subtitle">Create Admin</p>
        <form onSubmit={handleCreate}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Master Password</label>
            <input
              type="password"
              required
              value={master}
              onChange={(e) => setMaster(e.target.value)}
            />
          </div>
          <button type="submit">Create Admin</button>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </div>
  );
};

export default CreateAdmin;
