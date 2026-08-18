import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ClipboardCheck, FileText, LogOut } from 'lucide-react';
import './Sidebar.css';
import API_BASE from '../../config/api';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(JSON.parse(localStorage.getItem('user')));
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  const [hasNewApproval, setHasNewApproval] = useState(false);
  const [approvalCount, setApprovalCount] = useState(0);
  const [hasNewTracker, setHasNewTracker] = useState(false);
  const [trackerCount, setTrackerCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      const fetchCalendarData = async () => {
        try {
          const res = await fetch(`${API_BASE}/calendar.php?role=admin&user_id=${user.id}`);
          const data = await res.json();
          if (data.status === 'success') {
            const events = data.data;
            
            // Check for new pending approvals
            const pendingEvents = events.filter(e => e.status === 'pending');
            const pCount = pendingEvents.length;
            setApprovalCount(pCount);
            const lastSeenApproval = localStorage.getItem('calendarApprovalCount');
            // Show NEW if there are pending items and the count is different from last seen (specifically, if it increased or if they haven't seen it)
            if (pCount > 0 && lastSeenApproval !== pCount.toString()) {
                if (!lastSeenApproval || pCount > parseInt(lastSeenApproval)) {
                    setHasNewApproval(true);
                }
            } else if (pCount === 0) {
                setHasNewApproval(false);
            }

            // Check for new tracker items (approved or pending)
            const trackerEvents = events.filter(e => e.status !== 'rejected');
            const tCount = trackerEvents.length;
            setTrackerCount(tCount);
            const lastSeenTracker = localStorage.getItem('calendarTrackerCount');
            if (tCount > 0 && lastSeenTracker !== tCount.toString()) {
                if (!lastSeenTracker || tCount > parseInt(lastSeenTracker)) {
                    setHasNewTracker(true);
                }
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

  const hasNewCalendarData = hasNewApproval || hasNewTracker;

  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(
    location.pathname.includes('/calendar')
  );

  useEffect(() => {
    if (location.pathname.includes('/calendar')) {
      setIsCalendarDropdownOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    document.body.classList.add('fade-out-exit');
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      document.body.classList.remove('fade-out-exit');
      navigate('/login');
    }, 2000);
  };

  return (
    <>
      {isLoggingOut && (
        <div className="fullscreen-loader">
          <div className="loader-logo-container">
            <img src="/img/logo.jpg" alt="WorkTrack Logo" className="loader-logo" />
            <div className="loader-spinner"></div>
          </div>
          <div className="loader-text">Logging out...</div>
        </div>
      )}
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
              // Do not clear the badges here, let the user click the specific sub-menus to clear them
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
                <NavLink 
                  to="/calendar/requests" 
                  className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (hasNewApproval) {
                      setHasNewApproval(false);
                      localStorage.setItem('calendarApprovalCount', approvalCount.toString());
                    }
                  }}
                >
                  <ClipboardCheck size={16} style={{ marginRight: '8px' }} />
                  <span style={{ flex: 1 }}>Approval Requests</span>
                  {hasNewApproval && <span className="badge-new" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>NEW</span>}
                </NavLink>
                <NavLink 
                  to="/calendar/tracker" 
                  className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (hasNewTracker) {
                      setHasNewTracker(false);
                      localStorage.setItem('calendarTrackerCount', trackerCount.toString());
                    }
                  }}
                >
                  <FileText size={16} style={{ marginRight: '8px' }} />
                  <span style={{ flex: 1 }}>Change Schedule Tracker</span>
                  {hasNewTracker && <span className="badge-new" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>NEW</span>}
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
    </>
  );
};

export default Sidebar;
