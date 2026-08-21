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

  const groupRequests = (reqs) => {
    const sorted = [...reqs].sort((a, b) => {
      if (a.user_id !== b.user_id) return a.user_id - b.user_id;
      if (a.event_type !== b.event_type) return a.event_type.localeCompare(b.event_type);
      if (a.title !== b.title) return a.title.localeCompare(b.title);
      return new Date(a.event_date) - new Date(b.event_date);
    });

    const grouped = [];
    let currentGroup = null;

    for (const req of sorted) {
      if (!currentGroup) {
        currentGroup = { ...req, event_ids: [req.id], start_date: req.event_date, end_date: req.event_date };
        grouped.push(currentGroup);
        continue;
      }

      const prevDate = new Date(currentGroup.end_date);
      const currDate = new Date(req.event_date);
      const diffTime = Math.abs(currDate - prevDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Same request batch if contiguous date and same metadata
      if (
        currentGroup.user_id === req.user_id &&
        currentGroup.event_type === req.event_type &&
        currentGroup.title === req.title &&
        diffDays === 1
      ) {
        currentGroup.end_date = req.event_date;
        currentGroup.event_ids.push(req.id);
      } else {
        currentGroup = { ...req, event_ids: [req.id], start_date: req.event_date, end_date: req.event_date };
        grouped.push(currentGroup);
      }
    }
    return grouped;
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=admin&user_id=${user.id}`);
      if (res.data.status === 'success') {
        const pending = res.data.data.filter(evt => evt.status === 'pending');
        setRequests(groupRequests(pending));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (ids, status) => {
    setLoading(true);
    try {
      await Promise.all(ids.map(id => 
        axios.put(`${API_BASE}/calendar.php`, {
          id: id,
          status: status,
          admin_id: user.id,
          approved_by_name: user.full_name
        })
      ));
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
                <th>Submitted On</th>
                <th>Schedule Date</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Title / Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map((req, index) => {
                  const formatLocalDate = (dateStr) => {
                    if (!dateStr) return '';
                    const [year, month, day] = dateStr.split('-');
                    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
                  };
                  
                  const formatSubmittedDate = (dateStr) => {
                    if (!dateStr) return '';
                    // Convert from ISO or SQL timestamp to a readable format
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return dateStr;
                    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                  };

                  const startDateStr = formatLocalDate(req.start_date);
                  const endDateStr = formatLocalDate(req.end_date);
                  const dateDisplay = req.start_date === req.end_date 
                    ? startDateStr 
                    : `${startDateStr} - ${endDateStr}`;

                  return (
                    <tr key={index}>
                      <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {formatSubmittedDate(req.created_at)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{dateDisplay}</td>
                      <td style={{ fontWeight: 600 }}>{req.user_name}</td>
                      <td>
                        <span className={`event-badge event-type-${req.event_type}`}>
                          {req.event_type}
                        </span>
                      </td>
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
                            onClick={() => handleUpdateStatus(req.event_ids, 'approved')}
                            disabled={loading}
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px' }}
                            onClick={() => handleUpdateStatus(req.event_ids, 'rejected')}
                            disabled={loading}
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
