import { useState, useEffect } from "react";
import { ArrowLeft, Eye, EyeOff, Sun, Moon, AudioLines } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from 'react-hot-toast';
import "./SignIn.css";

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SignIn = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const location = useLocation();

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setIsDarkMode(savedTheme === 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Check for OAuth token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const name = params.get('name');
    if (token) {
      localStorage.setItem('token', token);
      if (name) {
        localStorage.setItem('userName', decodeURIComponent(name));
      }
      toast.success("Signed in with Google!");
      navigate("/");
    }
  }, [location, navigate]);

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userName', data.user.name);
        toast.success("Signed in successfully!");
        navigate("/");
      } else {
        toast.error(data.error || "Invalid email or password!");
      }
    } catch (error) {
      console.error("Signin error:", error);
      toast.error("Error connecting to the server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-container">
      {/* Floating Theme Toggle */}
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
          <Link to="/" className="signin-back-link">
            <ArrowLeft className="signin-back-icon" />
            Back to HomePage
          </Link>

          <div className="signin-title-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <h1 className="signin-title" style={{ marginTop: 0 }}>Sign In</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="signin-form">
          <div>
            <label htmlFor="email" className="signin-label">Email</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="signin-input"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="signin-password-wrapper">
            <label htmlFor="password" className="signin-label">Password</label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="signin-input"
                placeholder="Enter your password"
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

          <div className="signin-forgot-row">
            <Link to="/forgot-password" className="signin-forgot-link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="signin-button" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="oauth-divider">
          <span>or</span>
        </div>

        <button type="button" className="google-auth-button" onClick={handleGoogleSignIn}>
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
              <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
              <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
              <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
              <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
            </g>
          </svg>
          Continue with Google
        </button>

        <p className="signin-footer">
          Don't have an account?{" "}
          <Link to="/signup" className="signin-signup-link">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
