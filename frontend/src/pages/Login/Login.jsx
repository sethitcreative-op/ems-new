import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User, Eye, EyeOff, Activity, CheckCircle } from 'lucide-react';
import './Login.css';
import API_BASE from '../../config/api';

const backgroundImages = [
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80'
];

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Add a slight artificial delay so the user can see the loading state (system preparing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real environment, replace this with actual local IP or URL
      const response = await axios.post(`${API_BASE}/auth.php`, {
        action: 'login',
        username,
        password
      });

      if (response.data && response.data.status === 'success') {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dtr');
      } else {
        setError(response.data?.message || 'Invalid response from server. Check backend connection.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Connection to backend failed. Make sure your local server is running.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {isLoading && (
        <div className="fullscreen-loader">
          <div className="loader-logo-container">
            <img src="/img/logo.jpg" alt="WorkTrack Logo" className="loader-logo" />
            <div className="loader-spinner"></div>
          </div>
          <div className="loader-text">Preparing System...</div>
        </div>
      )}
      <div className="login-left-pane">
        {backgroundImages.map((img, index) => (
          <div
            key={index}
            className={`slideshow-bg ${bgIndex === index ? 'active' : ''}`}
            style={{ backgroundImage: `url('${img}')` }}
          />
        ))}
        <div className="slideshow-overlay" />

        <div className="floating-elements">
          <div className="float-card card-1 glass">
            <div className="card-icon"><Activity size={24} /></div>
            <div className="card-info">
              <h4>Active Users</h4>
              <p>2,543</p>
            </div>
          </div>
          <div className="float-card card-2 glass">
            <div className="card-icon success"><CheckCircle size={24} /></div>
            <div className="card-info">
              <h4>System Status</h4>
              <p>Online</p>
            </div>
          </div>
        </div>

        <div className="brand-content">
          <div className="brand-icon-wrapper">
            <img src="/img/logo.jpg" alt="WorkTrack Logo" className="logo-image-huge" />
          </div>
          <h1 className="brand-title">WorkTrack</h1>
          <p className="brand-subtitle">Elevate your workforce with our state-of-the-art management system.</p>
        </div>
      </div>

      <div className="login-right-pane">
        <div className="login-card glass">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>
          </div>

          {error && <div className="error-alert">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label className="input-label">User name:</label>
              <div className="input-wrapper">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password:</label>
              <div className="input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-actions">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>Forgot password?</a>
            </div>

            <button type="submit" className="btn btn-primary login-btn">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
