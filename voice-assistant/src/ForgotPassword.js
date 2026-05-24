import { useState, useEffect } from "react";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import "./SignIn.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setIsDarkMode(savedTheme === "dark");
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark";
    setIsDarkMode(!isDarkMode);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Password reset link sent if account exists.");
        if (data.devResetLink) {
          toast("Dev reset link received in response. Open browser console to copy it.");
          console.log("DEV RESET LINK:", data.devResetLink);
        }
      } else {
        toast.error(data.error || "Unable to process request.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error("Error connecting to the server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle Theme"
        title="Toggle Theme"
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="signin-box">
        <div className="signin-header">
          <Link to="/signin" className="signin-back-link">
            <ArrowLeft className="signin-back-icon" />
            Back to Sign In
          </Link>
          <div className="signin-title-row" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <h1 className="signin-title" style={{ marginTop: 0 }}>Forgot Password</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="signin-form">
          <div>
            <label htmlFor="email" className="signin-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="signin-input"
              placeholder="Enter your registered email"
              required
            />
          </div>

          <button type="submit" className="signin-button" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
