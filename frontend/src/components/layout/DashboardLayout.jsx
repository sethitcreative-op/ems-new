import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import FloatingEmail from '../FloatingEmail';

const DashboardLayout = () => {
  const location = useLocation();
  const mainContentRef = useRef(null);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content" ref={mainContentRef}>
        <Header />
        <div key={location.pathname} className="page-transition-wrapper">
          <Outlet />
        </div>
      </div>
      <FloatingEmail />
    </div>
  );
};

export default DashboardLayout;
