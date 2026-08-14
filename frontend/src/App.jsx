import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
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
import { NotificationProvider } from './context/NotificationContext';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" />;
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
          </Route>
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
