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
  
  const [viewMode, setViewMode] = useState(JSON.parse(localStorage.getItem('user'))?.role === 'admin' ? 'team' : 'profile');
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    sex: ''
  });
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const { addNotification } = useNotification();
  
  // Government IDs State
  const [governmentIds, setGovernmentIds] = useState([]);
  const [govIdLoading, setGovIdLoading] = useState(false);
  const [govIdForm, setGovIdForm] = useState({ id_type: '', id_number: '', file: null });
  const [govIdUploading, setGovIdUploading] = useState(false);

  const location = useLocation();

  useEffect(() => {
    if (viewMode === 'team' && teamMembers.length === 0) {
      setLoadingTeam(true);
      axios.get(`${API_BASE}/employees.php?action=list`)
        .then(res => {
          if (res.data.status === 'success') {
            const admins = res.data.data.filter(emp => emp.role === 'admin');
            setTeamMembers(admins);
          }
        })
        .catch(err => console.error("Error fetching team", err))
        .finally(() => setLoadingTeam(false));
    }
  }, [viewMode, teamMembers.length]);

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

  const displayUser = selectedMember || user;
  const isViewingOther = !!selectedMember;

  // Fetch Government IDs
  useEffect(() => {
    if (displayUser && activeTab === 'government') {
      setGovIdLoading(true);
      axios.get(`${API_BASE}/government_ids.php?user_id=${displayUser.id}`)
        .then(res => {
          if (res.data.status === 'success') {
            setGovernmentIds(res.data.data);
          }
        })
        .catch(err => console.error("Error fetching government IDs", err))
        .finally(() => setGovIdLoading(false));
    }
  }, [displayUser, activeTab]);

  const handleGovIdUpload = async (e) => {
    e.preventDefault();
    if (!govIdForm.id_type || !govIdForm.id_number || !govIdForm.file) {
      addNotification({ type: 'warning', message: 'Please fill all fields and select a picture.' });
      return;
    }
    setGovIdUploading(true);
    const formData = new FormData();
    formData.append('user_id', user.id);
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
        const fetchRes = await axios.get(`${API_BASE}/government_ids.php?user_id=${displayUser.id}`);
        if (fetchRes.data.status === 'success') {
          setGovernmentIds(fetchRes.data.data);
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
        setGovernmentIds(prev => prev.filter(gid => gid.id !== id));
      } else {
        addNotification({ type: 'error', message: res.data.message });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to delete ID.' });
    }
  };

  const memberSince = new Date(displayUser.created_at);
  const daysSince = Math.floor((new Date() - memberSince) / (1000 * 60 * 60 * 24));

  const baseTabs = [
    { id: 'account', label: 'Account Details', icon: <User size={16} /> }
  ];

  const employeeTabs = [
    { id: 'government', label: 'Government ID', icon: <Shield size={16} /> }
  ];

  const tabs = displayUser.role === 'admin' ? baseTabs : [...baseTabs, ...employeeTabs];

  return (
    <div className="page-container profile-page">

      {/* ── View Toggle ── */}
      {!isViewingOther && user?.role === 'admin' && (
        <div className="profile-view-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'profile' ? 'active' : ''}`}
            onClick={() => setViewMode('profile')}
          >
            My Profile
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'team' ? 'active' : ''}`}
            onClick={() => setViewMode('team')}
          >
            My Team
          </button>
        </div>
      )}

      {isViewingOther && (
        <div className="back-to-team" onClick={() => setSelectedMember(null)}>
          <button className="back-btn">&larr; Back to Team</button>
        </div>
      )}

      {viewMode === 'team' && !selectedMember ? (
        <div className="team-grid-container animate-panel">
          <div className="team-grid-header">
            <h2>Management Team</h2>
            <p>Select a profile to view details.</p>
          </div>
          {loadingTeam ? (
            <div className="team-loading"><span className="spinner"></span> Loading team...</div>
          ) : (
            <div className="team-grid">
              {teamMembers.map(member => (
                <div key={member.id} className="team-card" onClick={() => {
                  if (member.id === user.id) {
                    setViewMode('profile');
                    setSelectedMember(null);
                  } else {
                    setSelectedMember(member);
                  }
                }}>
                  <div className="team-card-avatar">
                    {member.profile_picture ? (
                      <img src={renderProfilePicture(member.profile_picture)} alt={member.full_name} />
                    ) : (
                      <span>{member.full_name?.charAt(0) || 'A'}</span>
                    )}
                  </div>
                  <div className="team-card-info">
                    <h3>{member.full_name}</h3>
                    <p>@{member.username}</p>
                    <span className="team-role-badge"><Shield size={12}/> Administrator</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
              {displayUser.profile_picture ? (
                <img src={renderProfilePicture(displayUser.profile_picture)} alt="Profile" />
              ) : (
                <span className="hero-avatar-letter">{displayUser.full_name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="avatar-status-ring">
              <div className="avatar-status"></div>
            </div>
          </div>

          <div className="hero-info">
            <h1 className="hero-name">{displayUser.full_name}</h1>
            <div className="hero-meta">
              <span className={`hero-role-badge ${displayUser.role}`}>
                {displayUser.role === 'admin' ? <Shield size={14} /> : <Briefcase size={14} />}
                {displayUser.role === 'admin' ? 'Administrator' : 'Employee'}
              </span>
              <span className="hero-separator">•</span>
              <span className="hero-handle">@{displayUser.username}</span>
            </div>
          </div>

          {!isViewingOther && displayUser.role === 'admin' && (
            <button className="edit-profile-btn" onClick={openEditModal}>
              <Edit2 size={16} />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>



      {/* ── Tab Navigation ── */}
      {displayUser.role !== 'admin' && (
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
      )}

      {/* ── Tab Content ── */}
      <div className="profile-body">

        {(activeTab === 'account' || displayUser.role === 'admin') && (
          <div className="detail-panel animate-panel">
            <div className="panel-header">
              <div className="panel-icon-title">
                <div className="panel-icon blue"><User size={20} /></div>
                <div>
                  <h3>{displayUser.role === 'admin' ? 'Admin Profile' : 'Account Details'}</h3>
                  <p className="panel-subtitle">{displayUser.role === 'admin' ? 'Identity & contact information' : 'Your identity & login information'}</p>
                </div>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-row">
                <div className="detail-icon"><User size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">@{displayUser.username}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><Briefcase size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Department Role</span>
                  <span className="detail-value" style={{ textTransform: 'capitalize' }}>{displayUser.role}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-icon"><User size={18} /></div>
                <div className="detail-content">
                  <span className="detail-label">Sex</span>
                  <span className="detail-value">{displayUser.sex || 'Not specified'}</span>
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
                  <span className="detail-value">EMP-{String(displayUser.id).padStart(4, '0')}</span>
                </div>
              </div>
              
                <div className="detail-row">
                  <div className="detail-icon"><Mail size={18} /></div>
                  <div className="detail-content">
                    <span className="detail-label">Email Address</span>
                    <span className={`detail-value ${!displayUser.email ? 'muted-val' : ''}`}>{displayUser.email || 'Not specified'}</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-icon"><Phone size={18} /></div>
                  <div className="detail-content">
                    <span className="detail-label">Phone Number</span>
                    <span className={`detail-value ${!displayUser.phone ? 'muted-val' : ''}`}>{displayUser.phone || 'Not specified'}</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-icon"><MapPin size={18} /></div>
                  <div className="detail-content">
                    <span className="detail-label">Address</span>
                    <span className={`detail-value ${!displayUser.address ? 'muted-val' : ''}`}>{displayUser.address || 'Not specified'}</span>
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
            
            <div className="detail-content-wrap" style={{ padding: '20px' }}>
              <div className="primary-id-section" style={{ marginBottom: '30px', padding: '20px', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-color)' }}>Primary Government ID</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID Number</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: '500' }}>{displayUser.id_number || 'Not provided'}</span>
                </div>
              </div>

              <h4 style={{ marginBottom: '16px', fontSize: '15px', color: 'var(--text-color)' }}>Uploaded IDs</h4>
              {govIdLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading IDs...</div>
              ) : governmentIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', background: 'var(--surface-color)', borderRadius: '12px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                  No Government IDs found.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {governmentIds.map(idRec => (
                    <div key={idRec.id} style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield size={18} style={{ color: 'var(--primary-color)' }} />
                          <span style={{ fontWeight: '500', color: 'var(--text-color)' }}>{idRec.id_type}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID Number</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{idRec.id_number}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Uploaded</span>
                        <span style={{ fontSize: '13px' }}>{new Date(idRec.uploaded_at).toLocaleDateString()}</span>
                      </div>
                      <a 
                        href={idRec.file_path.startsWith('img/') ? `/${idRec.file_path}` : `${API_BASE.replace('/api', '') === '' ? '/backend' : API_BASE.replace('/api', '')}/${idRec.file_path}`} 
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
          </div>
        )}

      </div>
      </>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3>Edit Profile</h3>
              <button type="button" className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            {error && <div className="modal-error">{error}</div>}
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-avatar-section" style={{ marginBottom: '12px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
