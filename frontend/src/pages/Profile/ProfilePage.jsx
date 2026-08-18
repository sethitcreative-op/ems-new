import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { User, Briefcase, DollarSign, Clock, Mail, Phone, Shield, Edit2, X, Calendar, Hash, MapPin, Award, TrendingUp, Zap } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './ProfilePage.css';
import API_BASE from '../../config/api';

const ProfilePage = () => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    sex: ''
  });
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const { addNotification } = useNotification();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.openEditModal && user?.role === 'admin') {
      if (user) {
        setFormData({
          username: user.username,
          full_name: user.full_name,
          password: '',
          sex: user.sex || ''
        });
        setProfilePictureFile(null);
        setPreviewImage(user.profile_picture || null);
        setShowEditModal(true);
        window.history.replaceState({}, '');
      }
    }
  }, [location.state, user]);

  if (!user) {
    return (
      <div className="page-container">
        <h2>Profile Not Found</h2>
        <p>Please log in again.</p>
      </div>
    );
  }

  const openEditModal = () => {
    setFormData({
      username: user.username,
      full_name: user.full_name,
      password: '',
      sex: user.sex || ''
    });
    setProfilePictureFile(null);
    setPreviewImage(user.profile_picture || null);
    setError('');
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = new FormData();
      data.append('id', user.id);
      data.append('username', formData.username);
      data.append('full_name', formData.full_name);
      if (formData.sex) {
        data.append('sex', formData.sex);
      }
      
      if (formData.password) {
        data.append('password', formData.password);
      }
      
      if (profilePictureFile) {
        data.append('profile_picture', profilePictureFile);
      }
      
      const res = await axios.post(`${API_BASE}/profile.php`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.status === 'success') {
        const updatedUser = res.data.user;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('userUpdated'));
        setShowEditModal(false);
        addNotification({ type: 'success', message: 'Profile updated successfully' });
      } else {
        setError(res.data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while updating profile.');
    }
    setLoading(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      setProfilePictureFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderProfilePicture = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http') || pic.startsWith('data:image')) return pic;
    if (pic.startsWith('img/')) return `/${pic}`;
    return `${API_BASE.replace('/api', '')}/${pic}`;
  };

  const memberSince = new Date(user.created_at);
  const daysSince = Math.floor((new Date() - memberSince) / (1000 * 60 * 60 * 24));

  const tabs = [
    { id: 'account', label: 'Account Details', icon: <User size={16} /> },
    { id: 'compensation', label: 'Compensation & Contact', icon: <DollarSign size={16} /> },
    { id: 'government', label: 'Government ID', icon: <Shield size={16} /> },
    { id: 'schedule', label: 'Schedule', icon: <Calendar size={16} /> },
  ];

  return (
    <div className="page-container profile-page">

      {/* ── Hero Section ── */}
      <div className="profile-hero">
        <div className="hero-mesh"></div>
        <div className="hero-particles">
          <div className="particle p1"></div>
          <div className="particle p2"></div>
          <div className="particle p3"></div>
          <div className="particle p4"></div>
          <div className="particle p5"></div>
        </div>

        <div className="hero-content">
          <div className="hero-avatar-ring">
            <div className="hero-avatar">
              {user.profile_picture ? (
                <img src={renderProfilePicture(user.profile_picture)} alt="Profile" />
              ) : (
                <span className="hero-avatar-letter">{user.full_name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="avatar-status-ring">
              <div className="avatar-status"></div>
            </div>
          </div>

          <div className="hero-info">
            <h1 className="hero-name">{user.full_name}</h1>
            <div className="hero-meta">
              <span className={`hero-role-badge ${user.role}`}>
                {user.role === 'admin' ? <Shield size={14} /> : <Briefcase size={14} />}
                {user.role === 'admin' ? 'Administrator' : 'Employee'}
              </span>
              <span className="hero-separator">•</span>
              <span className="hero-handle">@{user.username}</span>
            </div>
          </div>

          {user.role === 'admin' && (
            <button className="edit-profile-btn" onClick={openEditModal}>
              <Edit2 size={16} />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Quick Stats Strip ── */}
      <div className="stats-strip">
        <div className="stat-card">
          <div className="stat-icon-wrap blue">
            <TrendingUp size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">${parseFloat(user.hourly_rate || 0).toFixed(2)}</span>
            <span className="stat-label">Hourly Rate</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap purple">
            <Calendar size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{memberSince.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="stat-label">Member Since</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap green">
            <Zap size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{daysSince}d</span>
            <span className="stat-label">Active Days</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap amber">
            <Award size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{user.role}</span>
            <span className="stat-label">Access Level</span>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="profile-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`ptab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="profile-body">

        {activeTab === 'account' && (
          <div className="detail-panel animate-panel">
            <div className="panel-header">
              <div className="panel-icon-title">
                <div className="panel-icon blue"><User size={20} /></div>
                <div>
                  <h3>Account Details</h3>
                  <p className="panel-subtitle">Your identity & login information</p>
                </div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-row">
                <div className="detail-icon"><User size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">@{user.username}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Briefcase size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Department Role</span>
                  <span className="detail-value" style={{ textTransform: 'capitalize' }}>{user.role}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><User size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Sex</span>
                  <span className="detail-value">{user.sex || 'Not specified'}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Clock size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Member Since</span>
                  <span className="detail-value">{memberSince.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Hash size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Employee ID</span>
                  <span className="detail-value">EMP-{String(user.id).padStart(4, '0')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compensation' && (
          <div className="detail-panel animate-panel">
            <div className="panel-header">
              <div className="panel-icon-title">
                <div className="panel-icon green"><DollarSign size={20} /></div>
                <div>
                  <h3>Compensation & Contact</h3>
                  <p className="panel-subtitle">Pay rate and contact details</p>
                </div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-row highlight-row">
                <div className="detail-icon success"><DollarSign size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Hourly Rate</span>
                  <span className="detail-value success-val">${parseFloat(user.hourly_rate || 0).toFixed(2)} / hr</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Mail size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Email Address</span>
                  <span className={`detail-value ${!user.email ? 'muted-val' : ''}`}>{user.email || 'Not specified'}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Phone size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Phone Number</span>
                  <span className={`detail-value ${!user.phone ? 'muted-val' : ''}`}>{user.phone || 'Not specified'}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><MapPin size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Address</span>
                  <span className={`detail-value ${!user.address ? 'muted-val' : ''}`}>{user.address || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'government' && (
          <div className="detail-panel animate-panel">
            <div className="panel-header">
              <div className="panel-icon-title">
                <div className="panel-icon purple"><Shield size={20} /></div>
                <div>
                  <h3>Government ID</h3>
                  <p className="panel-subtitle">Official identification records</p>
                </div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-row">
                <div className="detail-icon"><Shield size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">ID Number</span>
                  <span className={`detail-value ${!user.id_number ? 'muted-val' : ''}`}>{user.id_number || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="detail-panel animate-panel">
            <div className="panel-header">
              <div className="panel-icon-title">
                <div className="panel-icon amber"><Calendar size={20} /></div>
                <div>
                  <h3>Schedule Information</h3>
                  <p className="panel-subtitle">Your assigned work schedule</p>
                </div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-row">
                <div className="detail-icon"><Clock size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Working Hours</span>
                  <span className="detail-value">Standard Schedule (Mon – Fri)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            {error && <div className="modal-error">{error}</div>}
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-avatar-section">
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
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.full_name} 
                  onChange={e => setFormData({...formData, full_name: e.target.value})} 
                  required 
                />
              </div>
              <div className="modal-field">
                <label>Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                  required 
                />
              </div>
              <div className="modal-field">
                <label>Sex</label>
                <select className="input-field" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}>
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="modal-field">
                <label>New Password <span className="field-hint">(leave blank to keep current)</span></label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
              <button type="submit" className="modal-submit-btn" disabled={loading}>
                {loading ? (
                  <><span className="spinner"></span> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
