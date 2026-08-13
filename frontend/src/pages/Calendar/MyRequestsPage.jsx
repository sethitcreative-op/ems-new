import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const MyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));
  const { addNotification } = useNotification();

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="event-badge event-type-Meeting" style={{ cursor: 'default' }}>Approved</span>;
      case 'rejected':
        return <span className="event-badge" style={{ cursor: 'default', background: '#ef4444', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }}>Rejected</span>;
      case 'pending':
        return <span className="event-badge" style={{ cursor: 'default', background: '#64748b', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(100, 116, 139, 0.3)' }}>Pending</span>;
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at || Date.now()).toLocaleDateString()}</td>
                    <td>
                      <span className={`event-badge event-type-${req.event_type}`}>
                        {req.event_type}
                      </span>
                    </td>
                    <td>{new Date(req.event_date).toLocaleDateString()}</td>
                    <td>
                      <div><strong>{req.title}</strong></div>
                      {req.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.description}</div>}
                    </td>
                    <td>
                      {getStatusBadge(req.status)}
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleCancel(req.id)}
                          disabled={loading}
                          title="Cancel Request"
                        >
                          <X size={14} /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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
    </div>
  );
};

export default MyRequestsPage;
