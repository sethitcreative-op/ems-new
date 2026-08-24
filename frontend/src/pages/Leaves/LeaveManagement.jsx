import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../../context/NotificationContext';
import { Check, X, Calendar as CalendarIcon, List } from 'lucide-react';
import API_BASE from '../../config/api';

const LeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [actionModal, setActionModal] = useState({ open: false, req: null, action: '' });
  const [remarks, setRemarks] = useState('');
  
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="event-badge" style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Approved</span>;
      case 'rejected': return <span className="event-badge" style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Rejected</span>;
      case 'pending': default: return <span className="event-badge" style={{ background: '#f59e0b', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Pending</span>;
    }
  };

  const filteredRequests = employeeFilter 
    ? requests.filter(req => req.user_id.toString() === employeeFilter)
    : requests;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  // Calendar logic
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();

  const getLeavesForDay = (monthIndex, day) => {
    const currentDate = new Date(year, monthIndex, day);
    const leavesOnDay = [];
    
    for (const req of filteredRequests) {
      if (req.status !== 'approved') continue;
      
      const [sYear, sMonth, sDay] = req.start_date.split('-');
      const start = new Date(sYear, sMonth - 1, sDay);
      
      const [eYear, eMonth, eDay] = req.end_date.split('-');
      const end = new Date(eYear, eMonth - 1, eDay);

      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      currentDate.setHours(0,0,0,0);
      
      if (currentDate >= start && currentDate <= end) {
        leavesOnDay.push(req);
      }
    }
    return leavesOnDay;
  };

  const exportCSV = () => {
    let csv = '';
    
    if (viewMode === 'calendar') {
      csv += 'Month,';
      for (let i = 1; i <= 31; i++) csv += `${i},`;
      csv += 'Total\n';

      months.forEach((monthName, mIndex) => {
        let row = `${monthName},`;
        const dInM = daysInMonth(mIndex, year);
        let totalLeaves = 0;
        
        for (let day = 1; day <= 31; day++) {
          if (day > dInM) {
            row += ',';
          } else {
            const leaves = getLeavesForDay(mIndex, day);
            const isLeave = leaves.length > 0;
            if (isLeave) totalLeaves++;
            row += isLeave ? `${leaves.length},` : '0,';
          }
        }
        row += `${totalLeaves}\n`;
        csv += row;
      });
    } else {
      csv += 'Employee,Leave Type,Start Date,End Date,Days,Reason,Status,Admin Remarks\n';
      filteredRequests.forEach(req => {
        const formatCsvDate = (dStr) => {
          if (!dStr) return '';
          const parts = dStr.split('-');
          if (parts.length !== 3) return dStr;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${months[parseInt(parts[1], 10)-1]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
        };
        const sDate = formatCsvDate(req.start_date);
        const eDate = formatCsvDate(req.end_date);
        csv += `"${req.user_name}","${req.leave_type}","${sDate}","${eDate}","${req.total_days}","${req.reason.replace(/"/g, '""')}","${req.status}","${req.admin_remarks || ''}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = viewMode === 'calendar' ? `leave_calendar_${year}.csv` : `leave_requests.csv`;
    a.click();
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Manage employee leave requests.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
            <button 
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', 
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent', 
                color: viewMode === 'list' ? '#fff' : 'var(--text-primary)', 
                cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                transition: 'all 0.2s', flexShrink: 0
              }}
              onClick={() => setViewMode('list')}
            >
              <List size={18} /> List
            </button>
            <button 
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none',
                background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent', 
                color: viewMode === 'calendar' ? '#fff' : 'var(--text-primary)', 
                cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                transition: 'all 0.2s', flexShrink: 0
              }}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={18} /> Calendar
            </button>
          </div>
          {viewMode === 'calendar' && (
            <select className="input-field" style={{ width: '120px', minWidth: '120px' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[year - 2, year - 1, year, year + 1, year + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <button className="btn" style={{ background: '#10b981', color: 'white' }} onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="glass table-container" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label style={{ fontWeight: 'bold' }}>Filter Employee:</label>
          <select className="input-field" style={{ width: '250px', margin: 0 }} value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
            <option value="">All Employees</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="glass table-container">
          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  {!employeeFilter && <th style={{ width: '40px', textAlign: 'center' }}>#</th>}
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
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((req, index) => (
                    <tr key={req.id}>
                      {!employeeFilter && <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>{index + 1}</td>}
                      <td><strong>{req.user_name}</strong></td>
                      <td>{req.leave_type}</td>
                      <td>{formatDate(req.start_date)} to {formatDate(req.end_date)}</td>
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
      ) : (
        <div className="glass table-container" style={{ background: '#fff' }}>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="premium-table" style={{ minWidth: '1200px', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>Month</th>
                  {Array.from({ length: 31 }, (_, i) => (
                    <th key={i + 1} style={{ textAlign: 'center', padding: '6px' }}>{i + 1}</th>
                  ))}
                  <th style={{ textAlign: 'center', background: '#f8fafc' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {months.map((monthName, mIndex) => {
                  const dInM = daysInMonth(mIndex, year);
                  let totalLeaves = 0;
                  return (
                    <tr key={monthName}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 'bold', zIndex: 1, borderRight: '1px solid var(--border-color)' }}>
                        {monthName}
                      </td>
                      {Array.from({ length: 31 }, (_, dIndex) => {
                        const day = dIndex + 1;
                        if (day > dInM) return <td key={day} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}></td>;
                        
                        const leaves = getLeavesForDay(mIndex, day);
                        const count = leaves.length;
                        totalLeaves += count;
                        
                        return (
                          <td key={day} style={{ 
                            textAlign: 'center', 
                            padding: '6px',
                            background: '#fff',
                            color: count > 0 ? '#10b981' : 'inherit',
                            fontWeight: count > 0 ? 700 : 400,
                            border: '1px solid #e2e8f0',
                            cursor: count > 0 ? 'help' : 'default',
                            fontSize: '0.85rem'
                          }}
                          title={count > 0 ? leaves.map(l => l.user_name).join(', ') : ''}
                          >
                            {count > 0 ? count : ''}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', background: '#f8fafc', borderLeft: '1px solid var(--border-color)' }}>{totalLeaves}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

