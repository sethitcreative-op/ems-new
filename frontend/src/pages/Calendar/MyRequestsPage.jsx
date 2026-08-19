import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Calendar as CalendarIcon, Edit2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const MyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ id: '', title: '', description: '', event_type: '', event_date: '' });

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=user&user_id=${user.id}`);
      if (res.data.status === 'success') {
        const myRequests = res.data.data.filter(evt => evt.user_id === user.id);
        setRequests(myRequests);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this request?")) return;
    
    setLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}/calendar.php?id=${id}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Request cancelled successfully.' });
        fetchMyRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to cancel request.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to cancel request.' });
    }
    setLoading(false);
  };

  const handleEditClick = (req) => {
    setEditData({
      id: req.id,
      title: req.title || '',
      description: req.description || '',
      event_type: req.event_type || 'WS',
      event_date: req.event_date ? req.event_date.split(' ')[0] : ''
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editData.event_date || !editData.title) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API_BASE}/calendar.php`, {
        id: editData.id,
        action: 'edit',
        title: editData.title,
        description: editData.description,
        event_date: editData.event_date,
        event_type: editData.event_type,
        user_id: user.id,
        status: 'pending' // resets status so admin can review
      });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Request updated successfully.' });
        setEditModalOpen(false);
        fetchMyRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to update request.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to update request.' });
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="event-badge" style={{ cursor: 'default', background: '#10b981', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>Approved</span>;
      case 'rejected':
        return <span className="event-badge" style={{ cursor: 'default', background: '#ef4444', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }}>Rejected</span>;
      case 'pending':
        return <span className="event-badge" style={{ cursor: 'default', background: '#f59e0b', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)' }}>Pending</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Schedule Requests</h1>
          <p className="page-subtitle">View the status of your submitted schedule and date requests.</p>
        </div>
      </div>

      <div className="glass table-container">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Type</th>
                <th>Event Date</th>
                <th>Title / Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map((req) => {
                  const formatLocalDate = (dateStr) => {
                    if (!dateStr) return '';
                    // Handle both YYYY-MM-DD and YYYY-MM-DD HH:MM:SS
                    const datePart = dateStr.split(' ')[0];
                    const [year, month, day] = datePart.split('-');
                    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
                  };
                  
                  return (
                  <tr key={req.id}>
                    <td>{req.created_at ? formatLocalDate(req.created_at) : new Date().toLocaleDateString()}</td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <span className={`event-badge event-type-${req.event_type === 'Other' ? 'WS' : req.event_type}`} style={{ display: 'inline-block', width: 'max-content' }}>
                        {req.event_type === 'WS' || req.title === 'Work Shift' ? 'Work Shift' : req.event_type === 'VL' ? 'Vacation Leave' : req.event_type === 'HL' ? 'Holiday' : req.event_type}
                      </span>
                    </td>
                    <td>{formatLocalDate(req.event_date)}</td>
                    <td>
                      <div><strong>{req.title}</strong></div>
                      {req.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.description}</div>}
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        {getStatusBadge(req.status)}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                        {req.status !== 'rejected' && (
                          <>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}
                              onClick={() => navigate('/calendar', { state: { openRescheduleModal: true, requestData: req } })}
                              disabled={loading}
                              title="Reschedule"
                            >
                              <CalendarIcon size={16} />
                            </button>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', background: 'var(--accent)', borderColor: 'var(--accent)' }}
                              onClick={() => handleEditClick(req)}
                              disabled={loading}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                          </>
                        )}
                        {req.status === 'pending' && (
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}
                            onClick={() => handleCancel(req.id)}
                            disabled={loading}
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    You have not submitted any schedule requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Reschedule Modal */}
      {editModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Request</h3>
              <button className="close-btn" onClick={() => setEditModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editData.title} 
                  onChange={e => setEditData({...editData, title: e.target.value})} 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea 
                  className="input-field" 
                  value={editData.description} 
                  onChange={e => setEditData({...editData, description: e.target.value})} 
                  rows="3"
                ></textarea>
              </div>
              <div className="input-group">
                <label>Event Type</label>
                <select 
                  className="input-field" 
                  value={editData.event_type} 
                  onChange={e => setEditData({...editData, event_type: e.target.value})}
                  required
                >
                  <option value="WS">Work Shift</option>
                  <option value="VL">Vacation Leave</option>
                  <option value="HL">Holiday</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRequestsPage;
