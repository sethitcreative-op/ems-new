import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Calendar as CalendarIcon, Clock as ClockIcon, Activity, Globe, User, LogOut, ChevronDown } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './Header.css';
import API_BASE from '../../config/api';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { notifications, unreadCount, markAllAsRead, addNotification } = useNotification();
  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const [currentTime, setCurrentTime] = useState(new Date());

  // Let's actually add a state for user so header updates dynamically too
  const [userState, setUserState] = useState(user);

  useEffect(() => {
    const handleUserUpdate = () => {
      setUserState(JSON.parse(localStorage.getItem('user')));
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getUSTime = () => {
    return currentTime.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getLocalDate = () => {
    return currentTime.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };




  return (
    <header className="global-header">
      <div className="header-left-widget">
        <div className="header-logo-section">
          <div className="logo-icon-wrapper">
            <Activity size={18} className="logo-icon" />
          </div>
          <span className="logo-text">Schedule Management Tracker</span>
        </div>

        <div className="header-divider"></div>

        <div className="header-date-section">
          <CalendarIcon size={16} />
          <span>{getLocalDate()}</span>
        </div>

        <div className="header-divider"></div>

        <div className="us-time-badge">
          <Globe size={14} className="globe-icon" />
          <span className="time-label">US (ET)</span>
          <span className="time-value">{getUSTime()}</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="notification-container" ref={dropdownRef}>
          <button
            className="icon-btn notification-btn"
            title="Notifications"
            onClick={() => {
              setShowDropdown(!showDropdown);
              if (unreadCount > 0) markAllAsRead();
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {showDropdown && (
            <div className="notification-dropdown glass">
              <div className="notification-header">
                <h4>Notifications</h4>
                {notifications.length > 0 && (
                  <button className="clear-btn" onClick={() => setShowDropdown(false)}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-state">No notifications</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="notification-item">
                      <div className="notification-icon">
                        <Check size={16} />
                      </div>
                      <div className="notification-content">
                        <p>{notif.message}</p>
                        <span className="time">{new Date(notif.timestamp || notif.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="profile-container" ref={profileDropdownRef} style={{ position: 'relative', marginLeft: '16px' }}>
          <div
            className="profile-trigger"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <div className="avatar-circle enhanced-avatar">
              {userState?.profile_picture ? (
                <img src={userState.profile_picture.startsWith('http') || userState.profile_picture.startsWith('data:image') ? userState.profile_picture : (userState.profile_picture.startsWith('img/') ? `/${userState.profile_picture}` : `${API_BASE.replace('/api', '')}/${userState.profile_picture}`)} alt="avatar" />
              ) : (
                userState?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
              )}
            </div>
            <div className="profile-info-trigger">
              <span className="profile-name-trigger">{userState?.full_name || 'User'}</span>
              <span className="profile-role-trigger">{userState?.role || 'Employee'}</span>
            </div>
            <ChevronDown size={16} className={`profile-chevron ${showProfileDropdown ? 'open' : ''}`} />
          </div>

          {showProfileDropdown && (
            <div className="profile-dropdown glass">
              <div className="profile-dropdown-header">
                <span className="profile-name">{userState?.full_name || 'User'}</span>
                <span className="profile-role">{userState?.role || 'Employee'}</span>
              </div>
              <div className="profile-dropdown-body">
                <button className="profile-dropdown-item" onClick={() => window.location.href = '/profile'}>
                  <User size={16} /> My Profile
                </button>
                <div className="dropdown-divider"></div>
                <button className="profile-dropdown-item text-danger" onClick={handleLogout}>
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
