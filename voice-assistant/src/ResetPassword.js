import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import "./SignIn.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [formData, setFormData] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

    if (!token) {
      toast.error("Reset token missing. Please use the link from your email.");
      return;
    }
    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Password reset successful.");
        navigate("/signin");
      } else {
        toast.error(data.error || "Failed to reset password.");
      }
    } catch (error) {
      console.error("Reset password error:", error);
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
            <h1 className="signin-title" style={{ marginTop: 0 }}>Reset Password</h1>
          </div>
        </div>

        {!token ? (
          <p className="signin-footer">Invalid reset link. Please request a new password reset email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="signin-form">
            <div className="signin-password-wrapper">
              <label htmlFor="newPassword" className="signin-label">New Password</label>
              <div className="password-input-container">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="signin-input"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="signin-password-wrapper">
              <label htmlFor="confirmPassword" className="signin-label">Confirm Password</label>
              <div className="password-input-container">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="signin-input"
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="signin-button" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
