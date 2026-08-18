import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as CalendarIcon, User as UserIcon, Search, MoreVertical, Filter, Plus, X, Edit2, Trash2 } from 'lucide-react';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const ScheduleTrackerPage = () => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));

  // New Schedule State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [formData, setFormData] = useState({
    user_id: '',
    event_date: '',
    event_type: 'WS',
    title: '',
    description: ''
  });
  const [editingEventId, setEditingEventId] = useState(null);

  useEffect(() => {
    fetchSchedules();
    fetchEmployees();
  }, []);

  useEffect(() => {
    let filtered = events;
    if (selectedEmployee) {
      filtered = filtered.filter(evt => evt.user_name === selectedEmployee);
    }
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(evt => 
        evt.user_name.toLowerCase().includes(lowercasedTerm) ||
        evt.title.toLowerCase().includes(lowercasedTerm) ||
        evt.event_type.toLowerCase().includes(lowercasedTerm)
      );
    }
    setFilteredEvents(filtered);
  }, [searchTerm, selectedEmployee, events]);

  const uniqueEmployees = [...new Set(events.map(e => e.user_name))];

  const getStatusBadge = (evt) => {
    switch (evt.status) {
      case 'approved':
        return <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 500, fontSize: '0.85rem' }}><span className="status-dot approved"></span>Approved {evt.approved_by_name ? `by ${evt.approved_by_name}` : ''}</span>;
      case 'rejected':
        return <span className="event-badge" style={{ cursor: 'default', background: '#ef4444', color: '#ffffff', border: 'none', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Rejected</span>;
      case 'pending':
        return <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontWeight: 500, fontSize: '0.85rem' }}><span className="status-dot pending"></span>Pending</span>;
      default:
        return <span>{evt.status}</span>;
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=admin&user_id=${user.id}`);
      if (res.data.status === 'success') {
        // Only show approved and pending schedules (or all)
        const allEvents = res.data.data.filter(evt => evt.status !== 'rejected');
        setEvents(allEvents);
        setFilteredEvents(allEvents);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees.php?action=list`);
      if (res.data.status === 'success') {
        setAllEmployees(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const day = dateObj.getDay();
      if (day === 0 || day === 6) {
        alert("Weekends (Saturdays and Sundays) cannot be selected for schedules.");
        setFormData({ ...formData, event_date: '' });
        return;
      }
    }
    setFormData({ ...formData, event_date: selectedDate });
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      if (editingEventId) {
        const res = await axios.put(`${API_BASE}/calendar.php`, {
          id: editingEventId,
          action: 'edit',
          is_admin: true,
          ...formData
        });
        if (res.data && res.data.status === 'success') {
          alert("Schedule updated successfully!");
          setIsModalOpen(false);
          setEditingEventId(null);
          setFormData({ user_id: '', event_date: '', event_type: 'WS', title: '', description: '' });
          fetchSchedules();
        } else {
          alert("Failed to update schedule. Server responded with: " + (typeof res.data === 'object' ? JSON.stringify(res.data) : res.data));
        }
      } else {
        const res = await axios.post(`${API_BASE}/calendar.php`, {
          ...formData,
          is_admin_assigning: true,
          admin_name: user.full_name
        });
        if (res.data.status === 'success') {
          alert("Schedule assigned successfully!");
          setIsModalOpen(false);
          setFormData({ user_id: '', event_date: '', event_type: 'WS', title: '', description: '' });
          fetchSchedules();
        } else {
          alert("Failed to assign schedule: " + res.data.message);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error saving schedule.");
    }
  };

  const handleEditClick = (evt) => {
    // Format date string properly for input type="date"
    const dateStr = evt.event_date ? evt.event_date.split(' ')[0] : '';
    setFormData({
      user_id: evt.user_id,
      event_date: dateStr,
      event_type: evt.event_type,
      title: evt.title,
      description: evt.description || ''
    });
    setEditingEventId(evt.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        const res = await axios.delete(`${API_BASE}/calendar.php?id=${id}&is_admin=true&user_id=${user.id}`);
        if (res.data.status === 'success') {
          fetchSchedules();
        } else {
          alert("Failed to delete: " + res.data.message);
        }
      } catch (err) {
        console.error(err);
        alert("Error deleting schedule.");
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '4px', color: 'white' }}>Change Schedule Tracker</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Track schedules and leave dates for all employees.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px 16px', gap: '8px', color: 'var(--text-main)', fontSize: '0.85rem' }}>
            <span>May 1 - May 31, 2026</span>
            <CalendarIcon size={14} color="var(--text-muted)" />
          </div>
          
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
            <Filter size={14} />
            Filters
          </button>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search employee, title, or type..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px 16px 8px 36px', color: 'var(--text-main)', fontSize: '0.85rem', width: '250px', outline: 'none' }}
            />
          </div>

          <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => {
            setEditingEventId(null);
            setFormData({ user_id: '', event_date: '', event_type: 'WS', title: '', description: '' });
            setIsModalOpen(true);
          }}>
            <Plus size={16} /> New Schedule
          </button>
        </div>
      </div>

      <div className="glass table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading schedules...</div>
        ) : (
          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Title / Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="avatar-circle" style={{ width: '32px', height: '32px', fontSize: '11px', flexShrink: 0 }}>
                            {evt.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          {evt.user_name}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {new Date(evt.event_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        {(() => {
                          let Icon = null;
                          let textColor = '#64748b';
                          let bgColor = 'rgba(100, 116, 139, 0.2)';
                          
                          if (evt.event_type === 'WS' || evt.title === 'Work Shift') {
                            Icon = '💼';
                            textColor = '#10b981'; // Green
                            bgColor = 'rgba(16, 185, 129, 0.2)';
                          } else if (evt.event_type === 'VL') {
                            Icon = '🌴';
                            textColor = '#3b82f6'; // Blue
                            bgColor = 'rgba(59, 130, 246, 0.2)';
                          } else if (evt.event_type === 'HL' || evt.event_type === 'Holiday') {
                            Icon = '🎉';
                            textColor = '#8b5cf6'; // Purple
                            bgColor = 'rgba(139, 92, 246, 0.2)';
                          }
                          
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: bgColor, color: textColor, padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {Icon && <span style={{ fontSize: '14px', lineHeight: 1 }}>{Icon}</span>}
                              {evt.event_type}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 500 }}>{evt.title}</div>
                        {evt.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{evt.description}</div>}
                      </td>
                      <td>
                        {getStatusBadge(evt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="action-pill edit" onClick={() => handleEditClick(evt)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="action-pill delete" onClick={() => handleDelete(evt.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                      No schedules found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Schedule Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', margin: 0 }}>
                {editingEventId ? 'Edit Schedule' : 'Assign New Schedule'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Employee</label>
                <select 
                  className="input-field" 
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Date</label>
                <input 
                  type="date" 
                  className="input-field"
                  required
                  value={formData.event_date}
                  onChange={handleDateChange}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Type</label>
                <select 
                  className="input-field" 
                  value={formData.event_type}
                  onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                >
                  <option value="WS">Work Shift (WS)</option>
                  <option value="VL">Vacation Leave (VL)</option>
                  <option value="HL">Holiday (HL)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Title</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  placeholder="e.g., Regular Shift"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Description (Optional)</label>
                <textarea 
                  className="input-field"
                  rows="3"
                  placeholder="Any additional details..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingEventId ? 'Save Changes' : 'Assign Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleTrackerPage;
