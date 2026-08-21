import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, UserPlus, Trash2, Edit2, X, Calendar, Clock, DollarSign,
  Briefcase, Search, Download, CheckCircle, ChevronDown, Building, FileText, User, Eye, EyeOff
} from 'lucide-react';
import './EmployeeManagement.css';
import API_BASE from '../../config/api';
import { useNotification } from '../../context/NotificationContext';

const EmployeeManagement = () => {
  const { addNotification } = useNotification();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('profile');
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Employee Details View State
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState(null);
  const [employeeDtrRecords, setEmployeeDtrRecords] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [employeeGovIds, setEmployeeGovIds] = useState([]);
  const [govIdForm, setGovIdForm] = useState({ id_type: '', id_number: '', file: null });
  const [govIdUploading, setGovIdUploading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'government', 'dtr', 'schedules'

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
    if (selectedEmployeeForView && activeTab === 'government') {
      axios.get(`${API_BASE}/government_ids.php?user_id=${selectedEmployeeForView.id}`)
        .then(res => {
          if (res.data.status === 'success') {
            setEmployeeGovIds(res.data.data);
          }
        })
        .catch(err => console.error("Error fetching government IDs", err));
    }
  }, [selectedEmployeeForView, activeTab]);

  const handleGovIdUpload = async (e) => {
    e.preventDefault();
    if (!govIdForm.id_type || !govIdForm.id_number || !govIdForm.file || !selectedEmployeeForView) {
      addNotification({ type: 'warning', message: 'Please fill all fields and select a picture.' });
      return;
    }
    setGovIdUploading(true);
    const formData = new FormData();
    formData.append('user_id', selectedEmployeeForView.id);
    formData.append('id_type', govIdForm.id_type);
    formData.append('id_number', govIdForm.id_number);
    formData.append('file', govIdForm.file);

    try {
      const res = await axios.post(`${API_BASE}/government_ids.php`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Government ID uploaded successfully!' });
        setGovIdForm({ id_type: '', id_number: '', file: null });
        // Refresh list
        const fetchRes = await axios.get(`${API_BASE}/government_ids.php?user_id=${selectedEmployeeForView.id}`);
        if (fetchRes.data.status === 'success') {
          setEmployeeGovIds(fetchRes.data.data);
        }
      } else {
        addNotification({ type: 'error', message: res.data.message });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to upload Government ID.' });
    }
    setGovIdUploading(false);
  };
  
  const handleDeleteGovId = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Government ID?")) return;
    try {
      const res = await axios.delete(`${API_BASE}/government_ids.php?id=${id}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Government ID deleted.' });
        setEmployeeGovIds(prev => prev.filter(gid => gid.id !== id));
      } else {
        addNotification({ type: 'error', message: res.data.message });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to delete ID.' });
    }
  };

  useEffect(() => {
    let result = employees;
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      if (query.length >= 2) {
        result = result.filter(emp =>
          (emp.full_name && emp.full_name.toLowerCase().includes(query)) ||
          (emp.username && emp.username.toLowerCase().includes(query))
        );
      }
    }
    if (roleFilter !== 'all') {
      result = result.filter(emp => emp.role === roleFilter);
    }
    setFilteredEmployees(result);
  }, [employees, searchQuery, roleFilter]);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    hourly_rate: '',
    role: 'user',
    email: '',
    phone: '',
    address: '',
    id_number: '',
    sex: ''
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
    setFormError('');
    setLoading(true);

    if (!formData.full_name || !formData.username || !formData.sex || !formData.role || (!editingId && !formData.password)) {
      setFormError('Please fill out all required fields (Name, Username, Sex, Password).');
      setLoading(false);
      return;
    }

    try {
      const data = new FormData();
      data.append('username', formData.username);
      data.append('full_name', formData.full_name);
      data.append('hourly_rate', formData.hourly_rate || '0');
      data.append('role', formData.role);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('address', formData.address);
      data.append('id_number', formData.id_number);
      if (formData.sex) {
        data.append('sex', formData.sex);
      }

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

      if (res.data.status === 'success') {
        if (editingId) {
          const actionText = `Updated employee: ${formData.username}`;

          if (editingId == user.id) {
            const updatedUser = { ...user, ...formData };
            if (res.data.profile_picture) {
              updatedUser.profile_picture = res.data.profile_picture;
            }
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.dispatchEvent(new Event('userUpdated'));
          }
        }

        setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '', sex: '' });
        setProfilePictureFile(null);
        setPreviewImage(null);
        setEditingId(null);
        setIsModalOpen(false);
        fetchEmployees();
        addNotification({ type: 'success', message: editingId ? 'Employee updated successfully' : 'Employee created successfully' });
      } else {
        setFormError(res.data.message || 'An error occurred during save.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Network or server error.');
    }
    setLoading(false);
  };

  const handleEditClick = (emp) => {
    setFormError('');
    setFormData({
      username: emp.username || '',
      password: '',
      full_name: emp.full_name || '',
      hourly_rate: emp.hourly_rate || '',
      role: emp.role || 'user',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      id_number: emp.id_number || '',
      sex: emp.sex || ''
    });
    setProfilePictureFile(null);
    setPreviewImage(emp.profile_picture || null);
    setEditingId(emp.id);
    setActiveModalTab('profile');
    setIsModalOpen(true);
  };

  const toggleForm = () => {
    setFormError('');
    if (editingId) {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '', sex: '' });
      setEditingId(null);
    }
    setProfilePictureFile(null);
    setPreviewImage(null);
    setActiveModalTab('profile');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(false);
    setTimeout(() => {
      setFormData({ username: '', password: '', full_name: '', hourly_rate: '', role: 'user', email: '', phone: '', address: '', id_number: '', sex: '' });
      setProfilePictureFile(null);
      setPreviewImage(null);
      setEditingId(null);
    }, 200);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
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
    setGovIdForm({ id_type: '', id_number: '', file: null });
    setTimeout(() => {
      setEmployeeDtrRecords([]);
      setEmployeeSchedules([]);
      setEmployeeGovIds([]);
    }, 300);
  };

  const handleExport = () => {
    if (filteredEmployees.length === 0) {
      addNotification({ type: 'warning', message: 'No employees to export.' });
      return;
    }

    const headers = ['Employee ID', 'Full Name', 'Username', 'Role', 'Email', 'Phone', 'Address', 'Hourly Rate'];
    const csvRows = [headers.join(',')];

    filteredEmployees.forEach(emp => {
      const row = [
        `EMP-${String(emp.id).padStart(4, '0')}`,
        `"${(emp.full_name || '').replace(/"/g, '""')}"`,
        `"${(emp.username || '').replace(/"/g, '""')}"`,
        `"${emp.role || 'user'}"`,
        `"${(emp.email || '').replace(/"/g, '""')}"`,
        `"${(emp.phone || '').replace(/"/g, '""')}"`,
        `"${(emp.address || '').replace(/"/g, '""')}"`,
        `${emp.hourly_rate || 0}`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification({ type: 'success', message: 'Export completed successfully.' });
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
          <div className="dropdown-box" style={{ padding: 0, position: 'relative' }}>
            <select
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '10px 32px 10px 16px', appearance: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)', fontFamily: 'inherit' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">Agent</option>
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="mgmt-toolbar-right">
          <button className="btn btn-primary mgmt-btn" onClick={toggleForm}>
            <UserPlus size={18} /> New User
          </button>
          <button className="btn btn-outline mgmt-btn export-btn" onClick={handleExport}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'row', width: '850px', maxWidth: '95vw', padding: 0, maxHeight: '85vh', overflow: 'hidden', borderRadius: '16px' }}>

            {/* Left Sidebar */}
            <div style={{ flex: '0 0 250px', borderRight: '1px solid var(--card-border)', padding: '24px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--sidebar-bg, rgba(0,0,0,0.02))' }}>
              <div style={{ marginBottom: '32px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>{editingId ? 'Edit Employee' : 'Add Employee'}</h3>
              </div>

              <div className="modal-avatar-section" style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div className="modal-avatar-preview" style={{ width: '80px', height: '80px', margin: '0 auto 12px' }}>
                  {previewImage ? (
                    <img src={renderProfilePicture(previewImage)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={32} style={{ opacity: 0.4 }} />
                    </div>
                  )}
                </div>
                <label className="modal-avatar-upload" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-color, #3b82f6)', cursor: 'pointer', fontWeight: '500' }}>
                  Change Picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'profile', label: 'Profile Details' },
                  { id: 'compensation', label: formData.role === 'admin' ? 'Contact' : 'Compensation' },
                  ...(formData.role === 'admin' ? [] : [
                    { id: 'government', label: 'Government ID' },
                    { id: 'schedule', label: 'Schedule' }
                  ])
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveModalTab(tab.id)}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: activeModalTab === tab.id ? 'var(--primary-color, #3b82f6)' : 'transparent',
                      color: activeModalTab === tab.id ? '#fff' : 'var(--text-main)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: activeModalTab === tab.id ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0' }}>
                <button className="modal-close-btn" onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column' }}>
                {activeModalTab === 'profile' && (
                  <div className="form-section animate-panel">
                    <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Profile Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="modal-field">
                        <label>Full Name</label>
                        <input type="text" className="input-field" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
                      </div>
                      <div className="modal-field">
                        <label>Username</label>
                        <input type="text" className="input-field" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                      </div>
                      <div className="modal-field">
                        <label>Sex</label>
                        <select className="input-field" value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })}>
                          <option value="">Select Sex</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="modal-field">
                        <label>Role</label>
                        <select className="input-field" value={formData.role} onChange={e => {
                          const newRole = e.target.value;
                          setFormData({ ...formData, role: newRole });
                          if (newRole === 'admin' && (activeModalTab === 'government' || activeModalTab === 'schedule')) {
                            setActiveModalTab('profile');
                          }
                        }}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="modal-field" style={{ marginTop: '16px' }}>
                      <label>Password {editingId && <span className="field-hint">(leave blank to keep current)</span>}</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input-field"
                          style={{ paddingRight: '40px', width: '100%' }}
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px'
                          }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === 'compensation' && (
                  <div className="form-section animate-panel">
                    <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>{formData.role === 'admin' ? 'Contact Details' : 'Compensation & Contact'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="modal-field">
                        <label>Email Address</label>
                        <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <div className="modal-field">
                        <label>Phone Number</label>
                        <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                      <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Address</label>
                        <input type="text" className="input-field" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                      </div>
                      {formData.role !== 'admin' && (
                        <div className="modal-field">
                          <label>Hourly Rate ($)</label>
                          <input type="number" step="0.01" className="input-field" required value={formData.hourly_rate} onChange={e => setFormData({ ...formData, hourly_rate: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeModalTab === 'government' && (
                  <div className="form-section animate-panel">
                    <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Government ID</h4>
                    <div className="modal-field">
                      <label>Government ID Number</label>
                      <input type="text" className="input-field" value={formData.id_number} onChange={e => setFormData({ ...formData, id_number: e.target.value })} />
                    </div>
                  </div>
                )}

                {activeModalTab === 'schedule' && (
                  <div className="form-section animate-panel">
                    <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Schedule</h4>
                    <div className="modal-field">
                      <p className="field-hint" style={{ margin: 0 }}>User schedules are managed via the Calendar module.</p>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                  {formError && (
                    <div style={{ color: '#ef4444', fontSize: '0.9rem', marginRight: 'auto', fontWeight: '500' }}>
                      {formError}
                    </div>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={closeModal} style={{ padding: '10px 24px', borderRadius: '8px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '10px 24px', borderRadius: '8px' }}>
                    {loading ? <><span className="spinner"></span> Saving...</> : (editingId ? "Update Employee" : "Save Employee")}
                  </button>
                </div>
              </form>
            </div>
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
                        <div className="user-avatar" style={{ backgroundColor: `hsl(${(emp.id * 137) % 360}, 70%, 40%)` }}>
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
                  <td colSpan="5" className="empty-state">
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
                <div className="avatar-large" style={{ backgroundColor: `hsl(${(selectedEmployeeForView.id * 137) % 360}, 70%, 40%)` }}>
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
                    {selectedEmployeeForView.role !== 'admin' && (
                      <span className="rate-badge">
                        <DollarSign size={12} /> {selectedEmployeeForView.hourly_rate}/hr
                      </span>
                    )}
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
                          <label>Employee ID</label>
                          <p>EMP-{String(selectedEmployeeForView.id).padStart(4, '0')}</p>
                        </div>
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
                          <label>Sex</label>
                          <p>{selectedEmployeeForView.sex || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Address</label>
                          <p>{selectedEmployeeForView.address || '--'}</p>
                        </div>
                        <div className="info-group">
                          <label>Role</label>
                          <p>{selectedEmployeeForView.role === 'admin' ? 'Administrator' : 'User'}</p>
                        </div>
                        {selectedEmployeeForView.role !== 'admin' && (
                        <div className="info-group">
                          <label>Hourly Rate</label>
                          <p className="highlight-text">${selectedEmployeeForView.hourly_rate || '0.00'}/hr</p>
                        </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'government' && (
                    <div className="details-info-panel animate-panel">
                      <div className="primary-id-section" style={{ marginBottom: '30px', padding: '20px', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-color)' }}>Primary Government ID</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID Number</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '16px', color: 'var(--text-main)', fontWeight: '500' }}>{selectedEmployeeForView.id_number || 'Not provided'}</span>
                        </div>
                      </div>

                      <div className="upload-gov-id-section" style={{ marginBottom: '30px', padding: '20px', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ marginBottom: '16px', fontSize: '15px', color: 'var(--text-color)' }}>Upload New Government ID</h4>
                        <form onSubmit={handleGovIdUpload} style={{ display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
                          <div className="modal-field">
                            <label>ID Type (e.g. Passport, Driver's License)</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="Driver's License"
                              value={govIdForm.id_type} 
                              onChange={e => setGovIdForm({...govIdForm, id_type: e.target.value})}
                              required
                            />
                          </div>
                          <div className="modal-field">
                            <label>ID Number</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="XXX-XXXX-XXXX"
                              value={govIdForm.id_number} 
                              onChange={e => setGovIdForm({...govIdForm, id_number: e.target.value})}
                              required
                            />
                          </div>
                          <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                            <label>ID Picture</label>
                            <input 
                              type="file" 
                              className="input-field"
                              accept="image/jpeg, image/png, image/gif, application/pdf"
                              onChange={e => setGovIdForm({...govIdForm, file: e.target.files[0]})}
                              required
                              style={{ padding: '8px' }}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="modal-submit-btn" disabled={govIdUploading} style={{ width: 'auto', padding: '10px 24px' }}>
                              {govIdUploading ? 'Uploading...' : 'Upload ID'}
                            </button>
                          </div>
                        </form>
                      </div>

                      <h4 style={{ marginBottom: '16px', fontSize: '15px', color: 'var(--text-main)' }}>Uploaded Government IDs</h4>
                      {employeeGovIds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', background: 'var(--sidebar-bg)', borderRadius: '12px', color: 'var(--text-muted)', border: '1px dashed var(--card-border)' }}>
                          No Government IDs found for this employee.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                          {employeeGovIds.map(idRec => (
                            <div key={idRec.id} style={{ background: 'var(--sidebar-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: 'var(--primary-color)' }} />
                                  <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>{idRec.id_type}</span>
                                </div>
                                <button onClick={() => handleDeleteGovId(idRec.id)} style={{ background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', padding: '4px' }}>
                                  <X size={16} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID Number</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-main)' }}>{idRec.id_number}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uploaded</span>
                                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{new Date(idRec.uploaded_at).toLocaleDateString()}</span>
                              </div>
                              <a 
                                href={`${API_BASE.replace('/api', '')}/${idRec.file_path}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ marginTop: 'auto', background: 'var(--bg-color)', color: 'var(--primary-color)', padding: '8px', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}
                              >
                                View Document
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
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

