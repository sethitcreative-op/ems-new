import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User } from 'lucide-react';
import './Login.css';
import API_BASE from '../../config/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
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
      }
    } catch (err) {
      setError('Connection to backend failed. Make sure your local server is running.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-pane">
        <div className="brand-content">
          <div className="brand-icon-wrapper">
            <div className="logo-icon-huge">E</div>
          </div>
          <h1 className="brand-title">EMS Pro</h1>
          <p className="brand-subtitle">Elevate your workforce with our state-of-the-art management system.</p>
          <div className="floating-elements">
            <div className="float-card card-1 glass"></div>
            <div className="float-card card-2 glass"></div>
          </div>
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
              <User size={20} className="input-icon" />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input 
                type="password" 
                className="input-field" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
