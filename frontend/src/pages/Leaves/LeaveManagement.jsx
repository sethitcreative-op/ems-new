import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNotification } from '../../context/NotificationContext';
import { Check, X, Calendar as CalendarIcon, List, Pencil, Trash2, Users } from 'lucide-react';
import API_BASE from '../../config/api';
import { logSystemAction } from '../../utils/logger';

const LEAVE_TYPES = ['Leave', 'Sick Leave', 'Emergency Leave', 'Maternity Leave', 'Paternity Leave', 'Other'];

const LeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list', 'calendar', or 'summary'
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [actionModal, setActionModal] = useState({ open: false, req: null, action: '' });
  const [remarks, setRemarks] = useState('');

  // Edit modal
  const [editModal, setEditModal] = useState({ open: false, req: null });
  const [editForm, setEditForm] = useState({});

  // Delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, req: null });
  
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

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEditModal = (req) => {
    setEditForm({
      leave_type:    req.leave_type,
      start_date:    req.start_date,
      end_date:      req.end_date,
      total_days:    req.total_days,
      reason:        req.reason,
      status:        req.status,
      admin_remarks: req.admin_remarks || ''
    });
    setEditModal({ open: true, req });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const updated = { ...prev, [name]: value };
      if ((name === 'start_date' || name === 'end_date') && updated.start_date && updated.end_date) {
        const s = new Date(updated.start_date);
        const en = new Date(updated.end_date);
        const diff = Math.round((en - s) / (1000 * 60 * 60 * 24)) + 1;
        updated.total_days = diff > 0 ? diff : 1;
      }
      return updated;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        action: 'update_request',
        id: editModal.req.id,
        user_id: editModal.req.user_id,
        ...editForm
      };
      const res = await axios.put(`${API_BASE}/leaves.php`, payload);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Leave request updated successfully' });
        setEditModal({ open: false, req: null });
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

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}/leaves.php?id=${deleteModal.req.id}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Leave request deleted successfully' });
        setDeleteModal({ open: false, req: null });
        fetchRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Error deleting request' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Error deleting request' });
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
    const dateOnly = dateStr.split(' ')[0];
    const [y, m, d] = dateOnly.split('-');
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  const isPastLeave = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d) < today;
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
    
    logSystemAction('DOWNLOAD_LEAVE_TRACKER', `Admin downloaded Leave Tracker CSV (${a.download}).`);
  };

  const exportSummaryPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait' });
    
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Approved Leave Summary (${year})`, 14, 20);

    const summaryData = {};
    filteredRequests.forEach(req => {
      if (req.status !== 'approved') return;
      if (req.leave_type !== 'Leave') return;
      if (!req.start_date || !req.start_date.startsWith(year.toString())) return;

      const uid = req.user_id;
      if (!summaryData[uid]) {
        summaryData[uid] = {
          user_name: req.user_name,
          total_days: 0,
          records: []
        };
      }
      const days = parseInt(req.total_days || 0, 10);
      summaryData[uid].total_days += days;
      summaryData[uid].records.push(req);
    });

    const rows = Object.values(summaryData).sort((a, b) => b.total_days - a.total_days);

    const tableColumn = ["EMPLOYEE", "DATE SUBMITTED", "REASON", "TOTAL DAYS"];
    const tableRows = [];

    rows.forEach(row => {
      const datesList = row.records.map(r => formatDate(r.created_at || r.start_date)).join('\n');
      const reasonsList = row.records.map(r => `${r.reason} (${r.total_days} day${r.total_days > 1 ? 's' : ''})`).join('\n');
      
      tableRows.push([
        row.user_name,
        datesList,
        reasonsList,
        row.total_days.toString()
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.5, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0] },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4, lineWidth: 0.5, lineColor: [0, 0, 0] }
    });

    doc.save(`Leave_Summary_${year}.pdf`);
    logSystemAction('DOWNLOAD_LEAVE_SUMMARY', `Admin downloaded Leave Summary PDF for ${year}.`);
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
            <button 
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none',
                background: viewMode === 'summary' ? 'var(--primary)' : 'transparent', 
                color: viewMode === 'summary' ? '#fff' : 'var(--text-primary)', 
                cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                transition: 'all 0.2s', flexShrink: 0
              }}
              onClick={() => setViewMode('summary')}
            >
              <Users size={18} /> Summary
            </button>
          </div>
          {(viewMode === 'calendar' || viewMode === 'summary') && (
            <select className="input-field" style={{ width: '120px', minWidth: '120px', margin: 0 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[year - 2, year - 1, year, year + 1, year + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          {viewMode === 'summary' && (
            <button className="btn btn-primary" style={{ background: '#3b82f6', color: 'white' }} onClick={exportSummaryPDF}>
              Export PDF
            </button>
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
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'nowrap' }}>

                          {!isPastLeave(req.start_date) && (
                            <button className="btn" style={{ padding: '5px 8px', minWidth: '32px', background: '#6366f1', color: '#fff' }} title="Edit" onClick={() => openEditModal(req)}>
                              <Pencil size={15} />
                            </button>
                          )}
                          <button className="btn btn-danger" style={{ padding: '5px 8px', minWidth: '32px', background: '#dc2626' }} title="Delete" onClick={() => setDeleteModal({ open: true, req })}>
                            <Trash2 size={15} />
                          </button>
                        </div>
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
      ) : viewMode === 'calendar' ? (
        <div className="glass table-container" style={{ background: '#fff' }}>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="premium-table" style={{ minWidth: '1200px', fontSize: '0.85rem', borderCollapse: 'collapse', border: '2px solid #000' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1, border: '1px solid #000' }}>Month</th>
                  {Array.from({ length: 31 }, (_, i) => (
                    <th key={i + 1} style={{ textAlign: 'center', padding: '6px', border: '1px solid #000' }}>{i + 1}</th>
                  ))}
                  <th style={{ textAlign: 'center', background: '#f8fafc', border: '1px solid #000' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {months.map((monthName, mIndex) => {
                  const dInM = daysInMonth(mIndex, year);
                  let totalLeaves = 0;
                  return (
                    <tr key={monthName}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 'bold', zIndex: 1, border: '1px solid #000' }}>
                        {monthName}
                      </td>
                      {Array.from({ length: 31 }, (_, dIndex) => {
                        const day = dIndex + 1;
                        if (day > dInM) return <td key={day} style={{ background: '#f1f5f9', border: '1px solid #000' }}></td>;
                        
                        const leaves = getLeavesForDay(mIndex, day);
                        const count = leaves.length;
                        totalLeaves += count;
                        
                        return (
                          <td key={day} style={{ 
                            textAlign: 'center', 
                            padding: '6px',
                            background: '#fff',
                            color: count > 0 ? '#000' : 'inherit',
                            fontWeight: count > 0 ? 800 : 400,
                            border: '1px solid #000',
                            cursor: count > 0 ? 'help' : 'default',
                            fontSize: '1rem'
                          }}
                          title={count > 0 ? leaves.map(l => l.user_name).join(', ') : ''}
                          >
                            {count > 0 ? count : ''}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 'bold', background: '#f8fafc', border: '1px solid #000' }}>{totalLeaves}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        (() => {
          const summaryData = {};
          filteredRequests.forEach(req => {
            if (req.status !== 'approved') return;
            if (req.leave_type !== 'Leave') return;
            
            // Year filter based on start_date
            if (!req.start_date || !req.start_date.startsWith(year.toString())) return;

            const uid = req.user_id;
            if (!summaryData[uid]) {
              summaryData[uid] = {
                user_name: req.user_name,
                total_days: 0,
                records: []
              };
            }
            const days = parseInt(req.total_days || 0, 10);
            summaryData[uid].total_days += days;
            summaryData[uid].records.push(req);
          });

          const rows = Object.values(summaryData).sort((a, b) => b.total_days - a.total_days);

          return (
            <div className="glass table-container" style={{ background: '#fff', padding: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>Approved Leave Summary ({year})</h3>
              <div className="table-responsive">
                <table className="premium-table" style={{ borderCollapse: 'collapse', border: '2px solid #000' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', background: '#f8fafc', width: '25%' }}>Employee</th>
                      <th style={{ border: '1px solid #000', background: '#f8fafc', width: '25%' }}>Date Submitted</th>
                      <th style={{ border: '1px solid #000', background: '#f8fafc', width: '35%' }}>Reason</th>
                      <th style={{ textAlign: 'center', border: '1px solid #000', background: '#e2e8f0', fontWeight: 'bold', width: '15%' }}>Total Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map(row => (
                        <tr key={row.user_name}>
                          <td style={{ border: '1px solid #000', fontWeight: 'bold', verticalAlign: 'top' }}>{row.user_name}</td>
                          <td style={{ border: '1px solid #000', verticalAlign: 'top' }}>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {row.records.map((r, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>
                                  {formatDate(r.created_at || r.start_date)}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ border: '1px solid #000', verticalAlign: 'top' }}>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {row.records.map((r, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>
                                  {r.reason} ({r.total_days} day{r.total_days > 1 ? 's' : ''})
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ textAlign: 'center', border: '1px solid #000', fontWeight: 'bold', background: '#f8fafc', verticalAlign: 'top' }}>
                            {row.total_days}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '30px', border: '1px solid #000' }}>
                          No approved leaves found for {year}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      )}

      {/* ── Approve / Reject Modal ─────────────────────────────────────────── */}
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

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '100%' }}>
            <div className="modal-header">
              <h3>Edit Leave Request</h3>
              <button className="close-btn" onClick={() => setEditModal({ open: false, req: null })}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Editing request for <strong>{editModal.req?.user_name}</strong>
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Leave Type</label>
                  <select className="input-field" name="leave_type" value={editForm.leave_type} onChange={handleEditChange} required>
                    {LEAVE_TYPES.map(lt => <option key={lt} value={lt}>{lt}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Status</label>
                  <select className="input-field" name="status" value={editForm.status} onChange={handleEditChange}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Start Date</label>
                  <input className="input-field" type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} required />
                </div>
                <div className="input-group">
                  <label>End Date</label>
                  <input className="input-field" type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} required />
                </div>

                <div className="input-group">
                  <label>Total Days</label>
                  <input className="input-field" type="number" name="total_days" value={editForm.total_days} onChange={handleEditChange} min="1" required />
                </div>
                <div></div>

                <div className="input-group">
                  <label>Reason</label>
                  <textarea className="input-field" name="reason" value={editForm.reason} onChange={handleEditChange} rows="4" required></textarea>
                </div>
                <div className="input-group">
                  <label>Admin Remarks</label>
                  <textarea className="input-field" name="admin_remarks" value={editForm.admin_remarks} onChange={handleEditChange} rows="4" placeholder="Optional remarks..."></textarea>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditModal({ open: false, req: null })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center', background: '#6366f1' }}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', width: '100%' }}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>Delete Leave Request</h3>
              <button className="close-btn" onClick={() => setDeleteModal({ open: false, req: null })}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ margin: 0 }}>
                Are you sure you want to <strong style={{ color: '#dc2626' }}>permanently delete</strong> the{' '}
                <strong>{deleteModal.req?.leave_type}</strong> request from{' '}
                <strong>{deleteModal.req?.user_name}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleteModal({ open: false, req: null })}>Cancel</button>
                <button className="btn btn-danger" disabled={loading} style={{ flex: 1, justifyContent: 'center', background: '#dc2626' }} onClick={handleDeleteConfirm}>
                  {loading ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;

