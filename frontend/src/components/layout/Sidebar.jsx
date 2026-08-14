import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ClipboardCheck, FileText, LogOut } from 'lucide-react';
import './Sidebar.css';
import API_BASE from '../../config/api';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(JSON.parse(localStorage.getItem('user')));
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  const [hasNewCalendarData, setHasNewCalendarData] = useState(false);
  const [calendarItemsCount, setCalendarItemsCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      const fetchCalendarData = async () => {
        try {
          const res = await fetch(`${API_BASE}/calendar.php?role=admin&user_id=${user.id}`);
          const data = await res.json();
          if (data.status === 'success') {
            const totalEvents = data.data.length;
            setCalendarItemsCount(totalEvents);
            const lastSeenCount = localStorage.getItem('calendarTotalCount');
            if (totalEvents > 0 && lastSeenCount !== totalEvents.toString()) {
              setHasNewCalendarData(true);
            }
          }
        } catch (err) {
          console.error("Failed to fetch calendar data for sidebar badge", err);
        }
      };

      fetchCalendarData();
      const interval = setInterval(fetchCalendarData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, user?.id]);

  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(
    location.pathname.includes('/calendar')
  );

  useEffect(() => {
    if (location.pathname.includes('/calendar')) {
      setIsCalendarDropdownOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    document.body.classList.add('fade-out-exit');
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.body.classList.remove('fade-out-exit');
      navigate('/login');
    }, 400);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-profile-section">
        <div className="avatar-wrapper">
          {user?.profile_picture ? (
            <img src={user.profile_picture.startsWith('http') || user.profile_picture.startsWith('data:image') ? user.profile_picture : (user.profile_picture.startsWith('img/') ? `/${user.profile_picture}` : `${API_BASE.replace('/api', '')}/${user.profile_picture}`)} alt="Profile" />
          ) : (
            <div className="avatar-placeholder">{user?.full_name?.charAt(0) || 'U'}</div>
          )}
        </div>
        <h3 className="profile-name">{user?.full_name || 'User'}</h3>
        <p className="profile-role">{user?.role === 'admin' ? 'Administrator' : 'Employee'}</p>
        <p className="profile-dept">{user?.role === 'admin' ? 'Management' : 'Staff'}</p>
      </div>

      <nav className="nav-menu">
        <NavLink to="/dtr" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Daily Time Record</span>
        </NavLink>

        <div className="nav-group">
          <NavLink
            to="/calendar"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end
            onClick={(e) => {
              setIsCalendarDropdownOpen(true);
              if (hasNewCalendarData) {
                setHasNewCalendarData(false);
                localStorage.setItem('calendarTotalCount', calendarItemsCount.toString());
              }
            }}
          >
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Calendar {hasNewCalendarData && <span className="badge-new">NEW</span>}
            </span>
            <div
              className="chevron-wrapper"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCalendarDropdownOpen(!isCalendarDropdownOpen);
                if (hasNewCalendarData) {
                  setHasNewCalendarData(false);
                  localStorage.setItem('calendarTotalCount', calendarItemsCount.toString());
                }
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
            >
              <ChevronDown
                size={16}
                style={{
                  transition: 'transform 0.3s ease',
                  transform: isCalendarDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              />
            </div>
          </NavLink>

          <div
            className="submenu-wrapper"
            style={{
              overflow: 'hidden',
              transition: 'max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease',
              maxHeight: isCalendarDropdownOpen ? '150px' : '0px',
              opacity: isCalendarDropdownOpen ? 1 : 0,
              marginTop: isCalendarDropdownOpen ? '4px' : '0px'
            }}
          >
            {isAdmin ? (
              <>
                <NavLink to="/calendar/requests" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <ClipboardCheck size={16} style={{ marginRight: '8px' }} />
                  <span>Approval Requests</span>
                </NavLink>
                <NavLink to="/calendar/tracker" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <FileText size={16} style={{ marginRight: '8px' }} />
                  <span>Change Schedule Tracker</span>
                </NavLink>
              </>
            ) : (
              <NavLink to="/calendar/my-requests" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                <ClipboardCheck size={16} style={{ marginRight: '8px' }} />
                <span>My Requests</span>
              </NavLink>
            )}
          </div>
        </div>

        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>My Profile</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/employees" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>Employee Management</span>
          </NavLink>
        )}

        {isAdmin && (
          <NavLink to="/logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>System Logs</span>
          </NavLink>
        )}


        <div style={{ flex: 1 }}></div>

        <button onClick={handleLogout} className="nav-item logout-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <LogOut size={16} style={{ marginRight: '8px' }} />
          <span>Log Out</span>
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
