import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserPlus, Trash2, Edit2, X, Calendar, Clock, DollarSign, Briefcase } from 'lucide-react';
import './EmployeeManagement.css';
import API_BASE from '../../config/api';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Employee Details View State
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState(null);
  const [employeeDtrRecords, setEmployeeDtrRecords] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dtr'); // 'dtr' or 'schedules'
  
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchEmployees();
    }
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees.php?action=list`);
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    hourly_rate: '',
    role: 'user'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/employees.php`, { ...formData, id: editingId });
      } else {
        await axios.post(`${API_BASE}/employees.php`, formData);
      }
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user' });
      setEditingId(null);
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleEditClick = (emp) => {
    setFormData({
      username: emp.username,
      password: '',
      full_name: emp.full_name,
      hourly_rate: emp.hourly_rate,
      role: emp.role
    });
    setEditingId(emp.id);
    setIsModalOpen(true);
  };

  const toggleForm = () => {
    if (editingId) {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user' });
      setEditingId(null);
    }, 200); // delay clear to let animation finish smoothly
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await axios.delete(`${API_BASE}/employees.php?id=${id}`);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewDetails = async (emp) => {
    setSelectedEmployeeForView(emp);
    setDetailsLoading(true);
    setActiveTab('dtr');
    try {
      // Fetch DTR
      const dtrRes = await axios.get(`${API_BASE}/dtr.php?action=get_records&user_id=${emp.id}`);
      if (dtrRes.data.status === 'success') {
        setEmployeeDtrRecords(dtrRes.data.data);
      }
      
      // Fetch Schedules
      const schedRes = await axios.get(`${API_BASE}/calendar.php?role=admin`);
      if (schedRes.data.status === 'success') {
        const allEvents = schedRes.data.data;
        const userEvents = allEvents.filter(e => e.user_id == emp.id);
        setEmployeeSchedules(userEvents);
      }
    } catch (err) {
      console.error(err);
    }
    setDetailsLoading(false);
  };

  const closeDetailsModal = () => {
    setSelectedEmployeeForView(null);
    setTimeout(() => {
      setEmployeeDtrRecords([]);
      setEmployeeSchedules([]);
    }, 200);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="page-container">
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">Add, remove, and manage employee records.</p>
        </div>
        <button className="btn btn-primary" onClick={toggleForm}>
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Employee' : 'Add Employee'}</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="emp-grid-form">
              <input type="text" className="input-field" placeholder="Full Name" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
              <input type="text" className="input-field" placeholder="Username" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              <input type="password" className="input-field" placeholder={editingId ? "Password (leave blank to keep)" : "Password"} required={!editingId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <input type="number" step="0.01" className="input-field" placeholder="Hourly Rate ($)" required value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} />
              <select className="input-field" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {editingId ? "Update Employee" : "Save Employee"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="glass table-container">
        <div className="table-header">
          <h3>Employee List</h3>
        </div>
        
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Rate/Hr</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length > 0 ? (
                employees.map((emp, index) => (
                  <tr key={index} className="clickable-row" onClick={() => handleViewDetails(emp)}>
                    <td>#{emp.id}</td>
                    <td style={{fontWeight: 600}}>{emp.full_name}</td>
                    <td>{emp.username}</td>
                    <td>
                      <span className={`role-badge ${emp.role}`}>{emp.role}</span>
                    </td>
                    <td>${emp.hourly_rate}</td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="action-pill edit" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="action-pill delete" onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      {selectedEmployeeForView && (
        <div className="modal-overlay" onClick={closeDetailsModal}>
          <div className="modal-content glass details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="details-header-info">
                <div className="avatar-large">
                  {selectedEmployeeForView.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="modal-title">{selectedEmployeeForView.full_name}</h3>
                  <div className="emp-badges">
                    <span className={`role-badge ${selectedEmployeeForView.role}`}>
                      <Briefcase size={12} /> {selectedEmployeeForView.role}
                    </span>
                    <span className="rate-badge">
                      <DollarSign size={12} /> {selectedEmployeeForView.hourly_rate}/hr
                    </span>
                  </div>
                </div>
              </div>
              <button className="modal-close-btn" onClick={closeDetailsModal}>
                <X size={20} />
              </button>
            </div>

            <div className="details-tabs">
              <button 
                className={`tab-btn ${activeTab === 'dtr' ? 'active' : ''}`}
                onClick={() => setActiveTab('dtr')}
              >
                <Clock size={16} /> DTR Records
              </button>
              <button 
                className={`tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedules')}
              >
                <Calendar size={16} /> Schedules
              </button>
            </div>

            <div className="details-body">
              {detailsLoading ? (
                <div className="loading-state">Loading data...</div>
              ) : (
                <>
                  {activeTab === 'dtr' && (
                    <div className="table-responsive">
                      <table className="premium-table small-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Hours</th>
                            <th>Earnings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeDtrRecords.length > 0 ? (
                            employeeDtrRecords.map(record => (
                              <tr key={record.id}>
                                <td>{new Date(record.date).toLocaleDateString()}</td>
                                <td>{record.am_in ? new Date(record.am_in).toLocaleTimeString() : '--'}</td>
                                <td>{record.pm_out ? new Date(record.pm_out).toLocaleTimeString() : '--'}</td>
                                <td>{record.total_hours || '0.00'}</td>
                                <td>${record.earnings || '0.00'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="empty-cell">No DTR records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'schedules' && (
                    <div className="table-responsive">
                      <table className="premium-table small-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeSchedules.length > 0 ? (
                            employeeSchedules.map(sched => (
                              <tr key={sched.id}>
                                <td>{new Date(sched.event_date).toLocaleDateString()}</td>
                                <td>
                                  <span className="type-badge">{sched.event_type}</span>
                                </td>
                                <td>
                                  <span className={`status-badge ${sched.status}`}>{sched.status}</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="empty-cell">No schedules found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
