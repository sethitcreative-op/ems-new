import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './Header.css';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { notifications, unreadCount, markAllAsRead, addNotification } = useNotification();
  const dropdownRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute to save renders, or 1000 for seconds
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);




  return (
    <header className="global-header">
      <div className="header-left-widget" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <CalendarIcon size={18} color="var(--primary)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 500, letterSpacing: '0.5px' }}>
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <ClockIcon size={18} color="var(--accent)" />
          <span style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.5px' }}>
            {currentTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
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
        
        <div style={{ position: 'relative', marginLeft: '8px' }}>
          <div className="avatar-circle" style={{ width: '36px', height: '36px', fontSize: '13px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}>
            {user?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
          </div>
          <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', border: '2px solid var(--bg-gradient)' }}></span>
        </div>
      </div>
    </header>
  );
};

export default Header;
