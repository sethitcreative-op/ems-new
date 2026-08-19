import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../../context/NotificationContext';
import { Calendar, Plus, X } from 'lucide-react';
import API_BASE from '../../config/api';

const LeaveTracker = () => {
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    leave_type: 'Vacation Leave',
    start_date: '',
    end_date: '',
    total_days: 1,
    reason: ''
  });

  const user = JSON.parse(localStorage.getItem('user'));
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Balances
      const balRes = await axios.get(`${API_BASE}/leaves.php?action=balances&user_id=${user.id}`);
      if (balRes.data.status === 'success') {
        setBalances(balRes.data.data);
      }
      // Fetch Requests
      const reqRes = await axios.get(`${API_BASE}/leaves.php?action=requests&user_id=${user.id}&role=user`);
      if (reqRes.data.status === 'success') {
        setRequests(reqRes.data.data);
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to fetch leave data' });
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 1;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (updated.start_date && updated.end_date) {
        updated.total_days = calculateDays(updated.start_date, updated.end_date);
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        user_id: user.id
      };
      const res = await axios.post(`${API_BASE}/leaves.php`, payload);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Leave request submitted successfully' });
        setIsModalOpen(false);
        setFormData({ leave_type: 'Vacation Leave', start_date: '', end_date: '', total_days: 1, reason: '' });
        fetchData();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Error submitting request' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Error submitting request' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="event-badge" style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Approved</span>;
      case 'rejected':
        return <span className="event-badge" style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Rejected</span>;
      case 'pending':
      default:
        return <span className="event-badge" style={{ background: '#f59e0b', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Pending</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">My Leave Tracker</h1>
          <p className="page-subtitle">Track your leave balances and submit time off requests.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Apply for Leave
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {balances.map(b => (
          <div key={b.id} className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{b.leave_type}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <span>Total: {b.total_days}</span>
              <span style={{ color: 'var(--accent)' }}>Used: {b.used_days}</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              Remaining: {b.total_days - b.used_days}
            </div>
          </div>
        ))}
        {balances.length === 0 && (
          <div className="glass" style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
            No leave balances found for the current year.
          </div>
        )}
      </div>

      <div className="glass table-container">
        <h2 style={{ padding: '20px', margin: 0, borderBottom: '1px solid var(--border-color)' }}>Leave History</h2>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date Applied</th>
                <th>Leave Type</th>
                <th>Duration</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Remarks</th>
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td>{req.leave_type}</td>
                    <td>{new Date(req.start_date).toLocaleDateString()} to {new Date(req.end_date).toLocaleDateString()}</td>
                    <td>{req.total_days}</td>
                    <td>{req.reason}</td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{req.admin_remarks || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Apply for Leave</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>Leave Type</label>
                <select 
                  className="input-field" 
                  name="leave_type" 
                  value={formData.leave_type} 
                  onChange={handleDateChange}
                  required
                >
                  <option value="Vacation Leave">Vacation Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Paternity Leave">Paternity Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input type="date" className="input-field" name="start_date" value={formData.start_date} onChange={handleDateChange} required />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>End Date</label>
                  <input type="date" className="input-field" name="end_date" value={formData.end_date} onChange={handleDateChange} required />
                </div>
              </div>
              <div className="input-group">
                <label>Total Days</label>
                <input type="number" className="input-field" name="total_days" value={formData.total_days} readOnly style={{ background: 'var(--bg-secondary)' }} />
              </div>
              <div className="input-group">
                <label>Reason</label>
                <textarea className="input-field" name="reason" value={formData.reason} onChange={handleDateChange} rows="3" required></textarea>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTracker;
