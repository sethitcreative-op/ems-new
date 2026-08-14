import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, UserPlus, Trash2, Edit2, X, Calendar, Clock, DollarSign, 
  Briefcase, Search, Download, CheckCircle, ChevronDown, Building, FileText, User
} from 'lucide-react';
import './EmployeeManagement.css';
import API_BASE from '../../config/api';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('profile');
  
  // Employee Details View State
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState(null);
  const [employeeDtrRecords, setEmployeeDtrRecords] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'compensation', 'government', 'dtr', 'schedules'
  
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

  useEffect(() => {
    let result = employees;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp => 
        (emp.full_name && emp.full_name.toLowerCase().includes(query)) ||
        (emp.username && emp.username.toLowerCase().includes(query)) ||
        (emp.role && emp.role.toLowerCase().includes(query))
      );
    }
    setFilteredEmployees(result);
  }, [employees, searchQuery]);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    hourly_rate: '',
    role: 'user',
    email: '',
    phone: '',
    address: '',
    id_number: ''
  });
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('username', formData.username);
      data.append('full_name', formData.full_name);
      data.append('hourly_rate', formData.hourly_rate);
      data.append('role', formData.role);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('address', formData.address);
      data.append('id_number', formData.id_number);
      
      if (formData.password) {
        data.append('password', formData.password);
      }
      
      if (profilePictureFile) {
        data.append('profile_picture', profilePictureFile);
      }
      
      if (editingId) {
        data.append('id', editingId);
        data.append('_method', 'PUT');
      }

      const res = await axios.post(`${API_BASE}/employees.php`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.status === 'success' && editingId == user?.id) {
        const updatedUser = { ...user, full_name: formData.full_name, role: formData.role };
        if (res.data.profile_picture) {
          updatedUser.profile_picture = res.data.profile_picture;
        }
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('userUpdated'));
      }
      
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '' });
      setProfilePictureFile(null);
      setPreviewImage(null);
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
      username: emp.username || '',
      password: '',
      full_name: emp.full_name || '',
      hourly_rate: emp.hourly_rate || '',
      role: emp.role || 'user',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      id_number: emp.id_number || ''
    });
    setProfilePictureFile(null);
    setPreviewImage(emp.profile_picture || null);
    setEditingId(emp.id);
    setActiveModalTab('profile');
    setIsModalOpen(true);
  };

  const toggleForm = () => {
    if (editingId) {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '' });
      setEditingId(null);
    }
    setProfilePictureFile(null);
    setPreviewImage(null);
    setActiveModalTab('profile');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '' });
      setProfilePictureFile(null);
      setPreviewImage(null);
      setEditingId(null);
    }, 200);
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
    setActiveTab('profile');
    try {
      const dtrRes = await axios.get(`${API_BASE}/dtr.php?action=get_records&user_id=${emp.id}`);
      if (dtrRes.data.status === 'success') {
        setEmployeeDtrRecords(dtrRes.data.data);
      }
      
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

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const renderProfilePicture = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http') || pic.startsWith('data:image')) return pic;
    if (pic.startsWith('img/')) return `/${pic}`;
    return `${API_BASE.replace('/api', '')}/${pic}`;
  };

  return (
    <div className="page-container mgmt-container">
      <div className="mgmt-header-section">
        <h1 className="mgmt-title">Management</h1>
        <p className="mgmt-subtitle">Manage users, departments, and view team performance reports.</p>
      </div>

      <div className="mgmt-toolbar glass">
        <div className="mgmt-toolbar-left">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name, email..." 
              className="search-input" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown-box">
            <span>All Departments</span>
            <ChevronDown size={16} />
          </div>
          <div className="dropdown-box">
            <span>Sort by Newest</span>
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="mgmt-toolbar-right">
          <button className="btn btn-primary mgmt-btn" onClick={toggleForm}>
            <UserPlus size={18} /> New User
          </button>
          <button className="btn btn-outline mgmt-btn export-btn">
            <Download size={18} /> Export
          </button>
        </div>
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
            
            <div className="modal-tabs">
              <button className={`modal-tab ${activeModalTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveModalTab('profile')}>Profile</button>
              <button className={`modal-tab ${activeModalTab === 'compensation' ? 'active' : ''}`} onClick={() => setActiveModalTab('compensation')}>Compensation</button>
              <button className={`modal-tab ${activeModalTab === 'government' ? 'active' : ''}`} onClick={() => setActiveModalTab('government')}>Gov ID</button>
              <button className={`modal-tab ${activeModalTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveModalTab('schedule')}>Sched</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {activeModalTab === 'profile' && (
                <div className="form-section animate-panel">
                  <div className="modal-avatar-section" style={{ marginBottom: '20px' }}>
                    <div className="modal-avatar-preview">
                       {previewImage ? (
                         <img src={renderProfilePicture(previewImage)} alt="Preview" />
                       ) : (
                         <User size={36} style={{ opacity: 0.4 }} />
                       )}
                    </div>
                    <label className="modal-avatar-upload">
                      Change Picture
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                    </label>
                  </div>

                  <div className="modal-field">
                    <label>Full Name</label>
                    <input type="text" className="input-field" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required />
                  </div>
                  <div className="modal-field">
                    <label>Username</label>
                    <input type="text" className="input-field" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                  </div>
                  <div className="modal-field">
                    <label>New Password {editingId && <span className="field-hint">(leave blank to keep current)</span>}</label>
                    <input type="password" className="input-field" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingId} />
                  </div>
                  <div className="modal-field">
                    <label>Role</label>
                    <select className="input-field" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}

              {activeModalTab === 'compensation' && (
                <div className="form-section animate-panel">
                  <div className="modal-field">
                    <label>Email Address</label>
                    <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="modal-field">
                    <label>Phone Number</label>
                    <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="modal-field">
                    <label>Address</label>
                    <input type="text" className="input-field" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="modal-field">
                    <label>Hourly Rate ($)</label>
                    <input type="number" step="0.01" className="input-field" required value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} />
                  </div>
                </div>
              )}

              {activeModalTab === 'government' && (
                <div className="form-section animate-panel">
                  <div className="modal-field">
                    <label>Government ID Number</label>
                    <input type="text" className="input-field" value={formData.id_number} onChange={e => setFormData({...formData, id_number: e.target.value})} />
                  </div>
                </div>
              )}

              {activeModalTab === 'schedule' && (
                <div className="form-section animate-panel">
                  <div className="modal-field">
                    <p className="field-hint" style={{ margin: 0 }}>User schedules are managed via the Calendar module.</p>
                  </div>
                </div>
              )}

              <button type="submit" className="modal-submit-btn" disabled={loading}>
                {loading ? <><span className="spinner"></span> Saving...</> : (editingId ? "Update Employee" : "Save Employee")}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="glass mgmt-table-container">
        <div className="table-responsive">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE</th>
                <th>DEPARTMENT</th>
                <th>RATE</th>
                <th>STATUS</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp, index) => (
                  <tr key={index} className="clickable-row" onClick={() => handleViewDetails(emp)}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar" style={{backgroundColor: `hsl(${(emp.id * 137) % 360}, 70%, 40%)`}}>
                          {emp.profile_picture ? (
                            <img src={renderProfilePicture(emp.profile_picture)} alt={emp.full_name} className="user-avatar-img" />
                          ) : (
                            getInitials(emp.full_name)
                          )}
                        </div>
                        <div className="user-info">
                          <span className="user-name">{emp.full_name}</span>
                          <span className="user-email">{emp.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`mgmt-role-badge ${emp.role}`}>
                        <Users size={14} className="role-icon" /> 
                        {emp.role === 'admin' ? 'ADMIN' : 'AGENT'}
                      </span>
                    </td>
                    <td className="text-muted">—</td>
                    <td className="rate-cell">${emp.hourly_rate}/hr</td>
                    <td>
                      <span className="status-badge-active">
                        <CheckCircle size={14} /> ACTIVE
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="mgmt-action-btn" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }} title="Edit User">
                          <Edit2 size={16} />
                        </button>
                        <button className="mgmt-action-btn" onClick={(e) => { e.stopPropagation(); handleViewDetails(emp); }} title="User Details">
                          <Briefcase size={16} />
                        </button>
                        <button className="mgmt-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }} title="Delete User">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
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
                <div className="avatar-large" style={{backgroundColor: `hsl(${(selectedEmployeeForView.id * 137) % 360}, 70%, 40%)`}}>
                  {selectedEmployeeForView.profile_picture ? (
                    <img src={renderProfilePicture(selectedEmployeeForView.profile_picture)} alt={selectedEmployeeForView.full_name} className="user-avatar-img" />
                  ) : (
                    getInitials(selectedEmployeeForView.full_name)
                  )}
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

            <div className="details-tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
              <button 
                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={16} /> Profile
              </button>
              <button 
                className={`tab-btn ${activeTab === 'compensation' ? 'active' : ''}`}
                onClick={() => setActiveTab('compensation')}
              >
                <DollarSign size={16} /> Compensation
              </button>
              <button 
                className={`tab-btn ${activeTab === 'government' ? 'active' : ''}`}
                onClick={() => setActiveTab('government')}
              >
                <FileText size={16} /> Gov ID
              </button>
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
                <Calendar size={16} /> Sched
              </button>
            </div>

            <div className="details-body">
              {detailsLoading ? (
                <div className="loading-state">Loading data...</div>
              ) : (
                <>
                  {activeTab === 'profile' && (
                    <div className="details-info-panel animate-panel">
                      <div className="info-grid">
                        <div className="info-group">
                          <label>Full Name</label>
                          <p>{selectedEmployeeForView.full_name || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Username</label>
                          <p>{selectedEmployeeForView.username || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Email Address</label>
                          <p>{selectedEmployeeForView.email || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Phone Number</label>
                          <p>{selectedEmployeeForView.phone || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Address</label>
                          <p>{selectedEmployeeForView.address || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Role</label>
                          <p>{selectedEmployeeForView.role === 'admin' ? 'Administrator' : 'User'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'compensation' && (
                    <div className="details-info-panel animate-panel">
                      <div className="info-grid">
                        <div className="info-group">
                          <label>Hourly Rate</label>
                          <p className="highlight-text">${selectedEmployeeForView.hourly_rate || '0.00'}/hr</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'government' && (
                    <div className="details-info-panel animate-panel">
                      <div className="info-grid">
                        <div className="info-group">
                          <label>Government ID Number</label>
                          <p>{selectedEmployeeForView.id_number || '--'}</p>
                        </div>
                      </div>
                    </div>
                  )}

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

