import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import DtrPage from './pages/DTR/DtrPage';
import CalendarPage from './pages/Calendar/CalendarPage';
import EmployeeManagement from './pages/Employees/EmployeeManagement';
import ProfilePage from './pages/Profile/ProfilePage';
import ApprovalRequestsPage from './pages/Calendar/ApprovalRequestsPage';
import MyRequestsPage from './pages/Calendar/MyRequestsPage';
import ScheduleTrackerPage from './pages/Calendar/ScheduleTrackerPage';
import SystemLogsPage from './pages/SystemLogs/SystemLogsPage';
import LeaveTracker from './pages/Leaves/LeaveTracker';
import LeaveManagement from './pages/Leaves/LeaveManagement';
import { NotificationProvider } from './context/NotificationContext';

const ProtectedRoute = ({ children }) => {
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const now = new Date().getTime();

    if (!token || !tokenExpiry || now >= parseInt(tokenExpiry, 10)) {
      if (token) {
        // Token exists but is expired or missing expiry
        localStorage.removeItem('token');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('user');
      }
      return false;
    }
    return true;
  };

  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth());
  const location = useLocation();

  useEffect(() => {
    const authStatus = checkAuth();
    setIsAuthenticated(authStatus);
    
    // Periodically check if the token has expired while idle (every 1 minute)
    const interval = setInterval(() => {
      const currentAuth = checkAuth();
      if (!currentAuth) {
        setIsAuthenticated(false);
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dtr" />} />
            <Route path="dtr" element={<DtrPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="calendar/requests" element={<ApprovalRequestsPage />} />
            <Route path="calendar/my-requests" element={<MyRequestsPage />} />
            <Route path="calendar/tracker" element={<ScheduleTrackerPage />} />
            <Route path="employees" element={<EmployeeManagement />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="logs" element={<SystemLogsPage />} />
            <Route path="leave-tracker" element={<LeaveTracker />} />
            <Route path="leave-management" element={<LeaveManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
