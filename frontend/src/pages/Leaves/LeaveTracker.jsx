import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../../context/NotificationContext';
import { Plus, X } from 'lucide-react';
import API_BASE from '../../config/api';

const LeaveTracker = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const user = JSON.parse(localStorage.getItem('user'));
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="event-badge" style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Approved</span>;
      case 'rejected': return <span className="event-badge" style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Rejected</span>;
      case 'pending': default: return <span className="event-badge" style={{ background: '#f59e0b', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>Pending</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();

  const isLeaveDay = (monthIndex, day) => {
    const currentDate = new Date(year, monthIndex, day);

    for (const req of requests) {
      if (req.status !== 'approved') continue;
      
      const [sYear, sMonth, sDay] = req.start_date.split('-');
      const start = new Date(sYear, sMonth - 1, sDay);
      
      const [eYear, eMonth, eDay] = req.end_date.split('-');
      const end = new Date(eYear, eMonth - 1, eDay);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      if (currentDate >= start && currentDate <= end) {
        return true;
      }
    }
    return false;
  };

  const exportCSV = () => {
    let csv = 'Month,';
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
          const isLeave = isLeaveDay(mIndex, day);
          if (isLeave) totalLeaves++;
          row += isLeave ? '1,' : '0,';
        }
      }
      row += `${totalLeaves}\n`;
      csv += row;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_tracker_${year}.csv`;
    a.click();
  };

  const currentYearRequests = requests.filter(req => {
    const [sYear] = req.start_date.split('-');
    return parseInt(sYear, 10) === new Date().getFullYear();
  });

  const hasReachedLimit = currentYearRequests.length >= 3;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">My Leave Tracker</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select className="input-field" style={{ width: '120px', minWidth: '120px' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[year - 2, year - 1, year, year + 1, year + 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn" style={{ background: '#10b981', color: 'white' }} onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div className="glass table-container" style={{ marginBottom: '30px', background: '#fff' }}>
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

                      const isLeave = isLeaveDay(mIndex, day);
                      if (isLeave) totalLeaves++;

                      return (
                        <td key={day} style={{
                          textAlign: 'center',
                          padding: '6px',
                          background: isLeave ? '#10b981' : '#fff',
                          color: isLeave ? '#fff' : 'inherit',
                          border: '1px solid #000'
                        }}>
                          {isLeave ? '✓' : ''}
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

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px' }}>
        <h2 style={{ margin: 0 }}>Leave History</h2>
      </div>

      <div className="glass table-container">
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
              </tr>
            </thead>
            <tbody>
              {requests.length > 0 ? (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td>{req.leave_type}</td>
                    <td>{formatDate(req.start_date)} to {formatDate(req.end_date)}</td>
                    <td>{req.total_days}</td>
                    <td>{req.reason}</td>
                    <td>{getStatusBadge(req.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No leave requests found.
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

export default LeaveTracker;

