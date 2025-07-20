import { useNavigate } from "react-router-dom";
import { useState } from "react";

const LoginPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const password = e.target.password.value.trim();
    if (username === "admin" && password === "admin123") {
      navigate("/dashboard");
    } else {
      setError("❌ Invalid credentials. Try again.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>☁ AquaCheck</h1>
        <p className="subtitle">Admin Login</p>
        <form id="loginForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input type="text" id="username" name="username" required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" required />
          </div>
          <button type="submit">Login</button>
          <p className="error-message">{error}</p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
