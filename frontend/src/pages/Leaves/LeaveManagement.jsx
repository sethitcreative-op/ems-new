import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../../context/NotificationContext';
import { Check, X, Edit2, Settings } from 'lucide-react';
import API_BASE from '../../config/api';

const LeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'balances'
  
  const [actionModal, setActionModal] = useState({ open: false, req: null, action: '' });
  const [remarks, setRemarks] = useState('');
  
  const [balanceModal, setBalanceModal] = useState({ open: false, user_id: '' });
  const [balanceForm, setBalanceForm] = useState({ leave_type: 'Vacation Leave', total_days: 15 });

  const { addNotification } = useNotification();

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/leaves.php?action=requests&role=admin`);
      if (res.data.status === 'success') {
        setRequests(res.data.data);
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to fetch leave requests' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees.php?action=list`);
      if (res.data.status === 'success') {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        action: 'update_status',
        id: actionModal.req.id,
        status: actionModal.action,
        admin_remarks: remarks,
        user_id: actionModal.req.user_id,
        leave_type: actionModal.req.leave_type,
        total_days: actionModal.req.total_days,
        start_date: actionModal.req.start_date
      };
      const res = await axios.put(`${API_BASE}/leaves.php`, payload);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: `Request ${actionModal.action} successfully` });
        setActionModal({ open: false, req: null, action: '' });
        setRemarks('');
        fetchRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Error updating request' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Error updating request' });
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceSubmit = async (e) => {
    e.preventDefault();
    if (!balanceModal.user_id) return addNotification({ type: 'error', message: 'Select an employee' });
    setLoading(true);
    try {
      const payload = {
        action: 'update_balance',
        user_id: balanceModal.user_id,
        leave_type: balanceForm.leave_type,
        total_days: balanceForm.total_days
      };
      const res = await axios.put(`${API_BASE}/leaves.php`, payload);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Leave balance updated successfully' });
        setBalanceModal({ open: false, user_id: '' });
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Error updating balance' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Error updating balance' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="event-badge" style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>Approved</span>;
      case 'rejected': return <span className="event-badge" style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>Rejected</span>;
      case 'pending': default: return <span className="event-badge" style={{ background: '#f59e0b', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>Pending</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Manage employee leave requests and balances.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('requests')}>
            Requests
          </button>
          <button className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('balances')}>
            <Settings size={18} style={{ marginRight: '5px' }} /> Update Balances
          </button>
        </div>
      </div>

      {activeTab === 'requests' && (
        <div className="glass table-container">
          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  requests.map(req => (
                    <tr key={req.id}>
                      <td><strong>{req.user_name}</strong></td>
                      <td>{req.leave_type}</td>
                      <td>{new Date(req.start_date).toLocaleDateString()} to {new Date(req.end_date).toLocaleDateString()}</td>
                      <td>{req.total_days}</td>
                      <td>{req.reason}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {req.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn btn-primary" style={{ padding: '6px', minWidth: '32px' }} title="Approve" onClick={() => setActionModal({ open: true, req, action: 'approved' })}>
                              <Check size={16} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '6px', minWidth: '32px' }} title="Reject" onClick={() => setActionModal({ open: true, req, action: 'rejected' })}>
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{req.admin_remarks || 'No remarks'}</span>
                        )}
                      </td>
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
      )}

      {activeTab === 'balances' && (
        <div className="glass" style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', borderRadius: '12px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Update Employee Leave Balance</h2>
          <form onSubmit={handleBalanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="input-group">
              <label>Select Employee</label>
              <select className="input-field" value={balanceModal.user_id} onChange={e => setBalanceModal({ ...balanceModal, user_id: e.target.value })} required>
                <option value="">-- Select Employee --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Leave Type</label>
              <select className="input-field" value={balanceForm.leave_type} onChange={e => setBalanceForm({ ...balanceForm, leave_type: e.target.value })} required>
                <option value="Vacation Leave">Vacation Leave</option>
              </select>
            </div>
            <div className="input-group">
              <label>Total Days (Allocated for Year)</label>
              <input type="number" step="0.5" className="input-field" value={balanceForm.total_days} onChange={e => setBalanceForm({ ...balanceForm, total_days: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              Update Balance
            </button>
          </form>
        </div>
      )}

      {/* Action Modal (Approve/Reject) */}
      {actionModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>{actionModal.action} Request</h3>
              <button className="close-btn" onClick={() => setActionModal({ open: false, req: null, action: '' })}><X size={20} /></button>
            </div>
            <form onSubmit={handleActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p>Are you sure you want to <strong>{actionModal.action}</strong> the request from {actionModal.req?.user_name}?</p>
              <div className="input-group">
                <label>Remarks (Optional)</label>
                <textarea className="input-field" value={remarks} onChange={e => setRemarks(e.target.value)} rows="3" placeholder="Enter any remarks..."></textarea>
              </div>
              <button type="submit" className={`btn ${actionModal.action === 'approved' ? 'btn-primary' : 'btn-danger'}`} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                Confirm {actionModal.action}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
