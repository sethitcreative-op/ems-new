import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Clock, Calendar, Users, LogOut, User as UserIcon, ChevronDown, ClipboardCheck, FileText, Briefcase } from 'lucide-react';
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
      const interval = setInterval(fetchCalendarData, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAdmin, user?.id]);

  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(
    location.pathname.includes('/calendar')
  );

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-icon">E</div>
        <h2>EMS Pro</h2>
      </div>



      <nav className="nav-menu">
        <NavLink to="/dtr" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Clock size={20} />
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
            <Calendar size={20} />
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
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '2px'
              }}
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
                  <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                    <ClipboardCheck size={16} />
                  </div>
                  <span>Approval Requests</span>
                </NavLink>
                <NavLink to="/calendar/tracker" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                  <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                    <FileText size={16} />
                  </div>
                  <span>Schedule Tracker</span>
                </NavLink>
              </>
            ) : (
              <NavLink to="/calendar/my-requests" className={({ isActive }) => `nav-item sub-item ${isActive ? 'active' : ''}`}>
                <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                  <ClipboardCheck size={16} />
                </div>
                <span>My Requests</span>
              </NavLink>
            )}
          </div>
        </div>

        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <UserIcon size={20} />
          <span>My Profile</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/employees" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>Employee Management</span>
          </NavLink>
        )}
        
        {isAdmin && (
          <NavLink to="/logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} />
            <span>System Logs</span>
          </NavLink>
        )}
      </nav>

      <div 
        ref={profileRef}
        className={`user-profile ${isProfileMenuOpen ? 'active' : ''}`} 
        style={{ cursor: 'pointer', position: 'relative', transition: 'background 0.3s ease' }} 
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
        title="Account Options"
      >
        <div className="avatar" style={{ overflow: 'hidden', padding: user?.profile_picture ? '0' : undefined }}>
          {user?.profile_picture ? (
            <img src={user.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.full_name?.charAt(0) || 'U'
          )}
        </div>
        <div className="user-info" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              {user?.full_name || 'User'}
            </p>
            <p className="role" style={{ display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
              {user?.role === 'admin' ? 'Administrator' : 'Employee'}
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
            </p>
          </div>
          <ChevronDown size={16} style={{ 
            color: 'var(--text-muted)', 
            transition: 'transform 0.3s ease',
            transform: isProfileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} />
        </div>

        {/* Profile Dropdown Menu */}
        {isProfileMenuOpen && (
          <div className="profile-dropdown glass" style={{
            position: 'absolute',
            bottom: '100%',
            left: '24px',
            right: '24px',
            marginBottom: '12px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            zIndex: 100,
            animation: 'slideUp 0.2s ease-out'
          }}>
            <button 
              className="dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileMenuOpen(false);
                navigate('/profile', { state: { openEditModal: true } });
              }}
            >
              <UserIcon size={16} /> Edit Profile
            </button>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '4px 0' }}></div>
            <button 
              className="dropdown-item text-danger"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
