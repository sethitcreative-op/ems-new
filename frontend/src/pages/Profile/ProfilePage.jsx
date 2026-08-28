import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { User, Briefcase, DollarSign, Clock, Mail, Phone, Shield, Edit2, X, Calendar, Hash, MapPin, Award, TrendingUp, Zap, Eye } from 'lucide-react';
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
    sex: '',
    phone_code: '+1',
    phone_number: ''
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
        let pCode = '+1';
        let pNum = '';
        if (user.phone) {
          if (user.phone.startsWith('+63 ')) {
            pCode = '+63';
            pNum = user.phone.substring(4);
          } else if (user.phone.startsWith('+1 ')) {
            pCode = '+1';
            pNum = user.phone.substring(3);
          } else {
            pNum = user.phone;
          }
        }
        setFormData({
          username: user.username,
          full_name: user.full_name,
          password: '',
          sex: user.sex || '',
          phone_code: pCode,
          phone_number: pNum
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
    let pCode = '+1';
    let pNum = '';
    if (user.phone) {
      if (user.phone.startsWith('+63 ')) {
        pCode = '+63';
        pNum = user.phone.substring(4);
      } else if (user.phone.startsWith('+1 ')) {
        pCode = '+1';
        pNum = user.phone.substring(3);
      } else {
        pNum = user.phone;
      }
    }
    setFormData({
      username: user.username,
      full_name: user.full_name,
      password: '',
      sex: user.sex || '',
      phone_code: pCode,
      phone_number: pNum
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
      const fullPhone = formData.phone_number ? `${formData.phone_code} ${formData.phone_number}` : '';
      data.append('phone', fullPhone);
      
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

  const handlePhoneChange = (e) => {
    const rawValue = e.target.value.replace(/[^\d]/g, '');
    let formattedValue = rawValue;
    if (rawValue.length > 3 && rawValue.length <= 6) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 6) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 6)}-${rawValue.slice(6, 10)}`;
    }
    setFormData({ ...formData, phone_number: formattedValue });
  };

  const renderProfilePicture = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http') || pic.startsWith('data:image')) return pic;
    if (pic.startsWith('img/')) return `/${pic}`;
    return `${API_BASE.replace('/api', '')}/${pic}`;
  };

  const maskGovId = (id) => {
    if (!id) return 'Not provided';
    if (id.length <= 4) return '*'.repeat(id.length);
    return '*'.repeat(id.length - 4) + id.slice(-4);
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID Number</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{maskGovId(idRec.id_number)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date</span>
                          <span style={{ fontSize: '13px' }}>{new Date(idRec.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ position: 'relative', marginTop: 'auto', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{
                          position: 'absolute', top: '-10px', left: '-10px', right: '-10px', bottom: '-10px',
                          backgroundImage: `url(${idRec.file_path.startsWith('img/') ? `/${idRec.file_path}` : `${API_BASE.replace('/api', '') === '' ? '/backend' : API_BASE.replace('/api', '')}/${idRec.file_path}`})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: 'blur(5px)',
                          opacity: 0.5,
                          zIndex: 0
                        }}></div>
                        <a 
                          href={idRec.file_path.startsWith('img/') ? `/${idRec.file_path}` : `${API_BASE.replace('/api', '') === '' ? '/backend' : API_BASE.replace('/api', '')}/${idRec.file_path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                        >
                          <div style={{ background: 'var(--primary-color, #3b82f6)', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                            <Eye size={18} /> View Full Image
                          </div>
                        </a>
                      </div>
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
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'row', width: '850px', maxWidth: '95vw', padding: 0, maxHeight: '85vh', overflow: 'hidden', borderRadius: '16px' }}>

            {/* Left Sidebar */}
            <div style={{ flex: '0 0 250px', borderRight: '1px solid var(--card-border)', padding: '24px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--sidebar-bg, rgba(0,0,0,0.02))' }}>
              <div style={{ marginBottom: '32px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Edit Profile</h3>
              </div>

              <div className="modal-avatar-section" style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div className="modal-avatar-preview" style={{ width: '80px', height: '80px', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px solid var(--card-border)', overflow: 'hidden' }}>
                   {previewImage ? (
                     <img src={renderProfilePicture(previewImage)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   ) : (
                     <User size={36} style={{ opacity: 0.4 }} />
                   )}
                </div>
                <label className="modal-avatar-upload" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-color, #3b82f6)', cursor: 'pointer', fontWeight: '500' }}>
                  Change Picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                </label>
              </div>
            </div>

            {/* Right Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0' }}>
                <button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px', display: 'flex', flexDirection: 'column' }}>
                {error && <div className="modal-error" style={{ marginBottom: '16px' }}>{error}</div>}
                
                <div className="form-section animate-panel">
                  <h4 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Profile Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                      <label>Phone Number</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select 
                          className="input-field" 
                          style={{ width: '100px', flexShrink: 0, padding: '10px 8px' }}
                          value={formData.phone_code} 
                          onChange={e => setFormData({ ...formData, phone_code: e.target.value })}
                        >
                          <option value="+1">US (+1)</option>
                          <option value="+63">PH (+63)</option>
                        </select>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="000-000-0000"
                          value={formData.phone_number} 
                          onChange={handlePhoneChange} 
                        />
                      </div>
                    </div>
                    <div className="modal-field" style={{ gridColumn: '1 / -1' }}>
                      <label>New Password <span className="field-hint">(leave blank to keep current)</span></label>
                      <input 
                        type="password" 
                        className="input-field" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)} style={{ padding: '10px 24px', borderRadius: '8px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '10px 24px', borderRadius: '8px' }}>
                    {loading ? <><span className="spinner"></span> Saving...</> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
