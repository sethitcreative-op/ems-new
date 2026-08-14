import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X } from 'lucide-react';
import './CalendarPage.css'; // Reuse existing table and page styles
import API_BASE from '../../config/api';

const ApprovalRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=admin&user_id=${user.id}`);
      if (res.data.status === 'success') {
        const pending = res.data.data.filter(evt => evt.status === 'pending');
        setRequests(pending);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/calendar.php`, {
        id: id,
        status: status,
        admin_id: user.id,
        approved_by_name: user.full_name
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval Requests</h1>
          <p className="page-subtitle">Review and manage pending calendar requests from employees.</p>
        </div>
      </div>

      <div className="glass table-container">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date Requested</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Event Date</th>
                <th>Title / Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{req.user_name}</td>
                    <td>
                      <span className={`event-badge event-type-${req.event_type}`}>
                        {req.event_type}
                      </span>
                    </td>
                    <td>{new Date(req.event_date).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>{req.title}</strong>
                        {req.reschedule_for_event_id && (
                          <span className="event-badge" style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'var(--accent)', color: '#fff', border: 'none' }}>Reschedule</span>
                        )}
                      </div>
                      {req.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.description}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-success" 
                          style={{ padding: '6px 12px' }}
                          onClick={() => handleUpdateStatus(req.id, 'approved')}
                          disabled={loading}
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px' }}
                          onClick={() => handleUpdateStatus(req.id, 'rejected')}
                          disabled={loading}
                          title="Reject"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No pending approval requests.
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

export default ApprovalRequestsPage;
