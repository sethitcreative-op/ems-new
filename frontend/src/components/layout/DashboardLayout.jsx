import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import FloatingEmail from '../FloatingEmail';

const DashboardLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        <Outlet />
      </div>
      <FloatingEmail />
    </div>
  );
};

export default DashboardLayout;
