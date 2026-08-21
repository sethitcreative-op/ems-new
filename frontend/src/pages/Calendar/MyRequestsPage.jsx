import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, Calendar as CalendarIcon, Trash2, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const MyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const itemsPerPage = 10;

  useEffect(() => {
    fetchMyRequests();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, selectedMonth, requests, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredRequests = requests.filter(req => {
    if (selectedMonth && !req.event_date?.startsWith(selectedMonth)) return false;
    if (filterType !== 'All') {
      if (filterType === 'VL' && req.event_type !== 'VL') return false;
      if (filterType === 'WS' && req.event_type !== 'WS' && req.title !== 'Work Shift') return false;
    }
    return true;
  });

  if (sortConfig.key) {
    filteredRequests.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      // For dates, handle parsing
      if (sortConfig.key === 'created_at' || sortConfig.key === 'event_date') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this request?")) return;
    
    setLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}/calendar.php?id=${id}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Request deleted successfully.' });
        fetchMyRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to delete request.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to delete request.' });
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">My Schedule Requests</h1>
          <p className="page-subtitle">View the status of your submitted schedule and date requests.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '9px 12px',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
          >
            <option value="All">All Types</option>
            <option value="WS">Work Shift</option>
            <option value="VL">Vacation Leave</option>
          </select>
          <button 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
            onClick={() => navigate('/calendar', { state: { openRequestModal: true } })}
          >
            <Plus size={18} />
            Request Schedule
          </button>
        </div>
      </div>

      {/* Pagination Controls */}
      {!loading && filteredRequests.length > itemsPerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <div>
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredRequests.length)} of {filteredRequests.length} entries
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 12px', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
            >
              Previous
            </button>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              {[...Array(totalPages)].map((_, index) => {
                const pageNum = index + 1;
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      style={{
                        background: currentPage === pageNum ? 'var(--primary)' : 'var(--card-bg)',
                        border: '1px solid',
                        borderColor: currentPage === pageNum ? 'var(--primary)' : 'var(--card-border)',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: currentPage === pageNum ? '#fff' : 'var(--text-main)',
                        cursor: 'pointer',
                        fontWeight: currentPage === pageNum ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 || 
                  pageNum === currentPage + 2
                ) {
                  return <span key={pageNum} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', color: 'var(--text-muted)' }}>...</span>;
                }
                return null;
              })}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 12px', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="glass table-container">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Date Submitted
                    {sortConfig.key === 'created_at' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ChevronsUpDown size={14} opacity={0.3} />
                    )}
                  </div>
                </th>
                <th>Type</th>
                <th onClick={() => handleSort('event_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Event Date
                    {sortConfig.key === 'event_date' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ChevronsUpDown size={14} opacity={0.3} />
                    )}
                  </div>
                </th>
                <th>Title / Description</th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Status
                    {sortConfig.key === 'status' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ChevronsUpDown size={14} opacity={0.3} />
                    )}
                  </div>
                </th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (currentItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No schedule requests found for the selected filter.
                      </td>
                    </tr>
                  );
                }

                return currentItems.map((req) => {
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
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}
                            onClick={() => navigate('/calendar', { state: { openRescheduleModal: true, requestData: req } })}
                            disabled={loading}
                            title="Reschedule"
                          >
                            <CalendarIcon size={16} />
                          </button>
                        )}
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', background: '#ef4444', borderColor: '#ef4444', color: 'white' }}
                          onClick={() => handleDelete(req.id)}
                          disabled={loading}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })})()}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};

export default MyRequestsPage;
