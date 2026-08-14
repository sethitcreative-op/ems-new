import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const EVENT_TYPES = ['WS', 'VL', 'HL'];

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'list'
  const dateInputRef = useRef(null);

  // Request Schedule State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';

  const location = useLocation();
  const navigate = useNavigate();

  // Reschedule State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');

  // Add Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('VL');
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (location.state?.openRescheduleModal && location.state?.requestData) {
      setRescheduleData(location.state.requestData);
      setNewRescheduleDate(location.state.requestData.event_date);
      setShowRescheduleModal(true);
      // Clear the state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=${user.role}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        const activeEvents = res.data.data.filter(e => e.status === 'approved');
        setEvents(activeEvents);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!title || !eventDate) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/calendar.php`, {
        user_id: user.id,
        title,
        description,
        event_date: eventDate,
        event_type: eventType,
        status: isAdmin ? 'approved' : 'pending'
      });
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventType('VL');
      setShowAddModal(false);
      addNotification({
        type: 'success',
        message: isAdmin ? `Calendar event "${title}" created` : `Leave request "${title}" submitted for approval`
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleStartDate || !scheduleEndDate) return;
    setLoading(true);

    let currentDateObj = new Date(scheduleStartDate);
    const endDateObj = new Date(scheduleEndDate);

    let createdCount = 0;

    while (currentDateObj <= endDateObj) {
      // Format date to YYYY-MM-DD
      const yyyy = currentDateObj.getFullYear();
      const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDateObj.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      try {
        await axios.post(`${API_BASE}/calendar.php`, {
          user_id: user.id,
          title: 'Work Shift',
          description: 'Requested working schedule',
          event_date: dateStr,
          event_type: 'WS',
          status: 'pending'
        });
        createdCount++;
      } catch (err) {
        console.error('Failed to create schedule for', dateStr, err);
      }
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }

    setShowScheduleModal(false);
    setLoading(false);

    if (createdCount > 0) {
      addNotification({
        type: 'success',
        message: `Submitted ${createdCount} schedule requests for approval.`
      });
      fetchEvents();
    } else {
      addNotification({
        type: 'warning',
        message: `Invalid date range selected.`
      });
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedEvent) return;
    try {
      await axios.put(`${API_BASE}/calendar.php`, {
        id: selectedEvent.id,
        status: status
      });
      setShowApproveModal(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!newRescheduleDate) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API_BASE}/calendar.php`, {
        id: rescheduleData.id,
        action: 'edit',
        title: rescheduleData.title,
        description: rescheduleData.description,
        event_date: newRescheduleDate,
        event_type: rescheduleData.event_type,
        user_id: user.id,
        status: 'pending'
      });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Request rescheduled successfully.' });
        setShowRescheduleModal(false);
        fetchEvents();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to reschedule request.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Failed to reschedule request.' });
    }
    setLoading(false);
  };

  const prevPeriod = () => {
    if (viewMode === 'month' || viewMode === 'list') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month' || viewMode === 'list') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const getDateDisplay = () => {
    if (viewMode === 'month' || viewMode === 'list') {
       return `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
       const start = new Date(currentDate);
       start.setDate(start.getDate() - start.getDay());
       const end = new Date(start);
       end.setDate(end.getDate() + 6);
       
       if (start.getMonth() === end.getMonth()) {
         return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
       } else if (start.getFullYear() === end.getFullYear()) {
         return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`;
       } else {
         return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()}, ${start.getFullYear()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
       }
    }
  };

  const getMonthStr = (d) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  
  const getWeekStr = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const handleDateFilterChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    
    if (viewMode === 'month' || viewMode === 'list') {
      const [y, m] = val.split('-');
      setCurrentDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    } else if (viewMode === 'week') {
      const [yearStr, weekNumStr] = val.split('-W');
      if (yearStr && weekNumStr) {
        const year = parseInt(yearStr, 10);
        const week = parseInt(weekNumStr, 10);
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
          ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
          ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        setCurrentDate(ISOweekStart);
      }
    }
  };

  // Calendar Grid Logic (Month)
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const daysInPrevMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth() - 1);

  const calendarCells = [];

  // Previous month overflow days
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push({
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, daysInPrevMonth - firstDay + i + 1),
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      isCurrentMonth: true
    });
  }

  // Next month overflow days
  const remainingCells = 42 - calendarCells.length; // 6 rows of 7
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
      isCurrentMonth: false
    });
  }

  // Calendar Grid Logic (Week)
  const getWeekDays = (baseDate) => {
    const date = new Date(baseDate);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push({ date: d, isCurrentMonth: d.getMonth() === baseDate.getMonth() });
    }
    return days;
  };
  const weekCells = getWeekDays(currentDate);

  // List View Logic
  const getEventsForMonth = () => {
    return events.filter(e => {
      if (!e.event_date) return false;
      const parts = e.event_date.split(' ')[0].split('-');
      if (parts.length !== 3) return false;
      const eYear = parseInt(parts[0], 10);
      const eMonth = parseInt(parts[1], 10) - 1;
      return eMonth === currentDate.getMonth() && eYear === currentDate.getFullYear();
    }).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  };

  const getEventsForDate = (date) => {
    return events.filter(e => {
      if (!e.event_date) return false;
      // Parse YYYY-MM-DD explicitly to avoid timezone shift
      const parts = e.event_date.split(' ')[0].split('-');
      if (parts.length !== 3) return false;
      const eYear = parseInt(parts[0], 10);
      const eMonth = parseInt(parts[1], 10) - 1;
      const eDay = parseInt(parts[2], 10);

      return eDay === date.getDate() &&
        eMonth === date.getMonth() &&
        eYear === date.getFullYear();
    });
  };

  const handleEventClick = (evt) => {
    if (isAdmin && evt.status === 'pending') {
      setSelectedEvent(evt);
      setShowApproveModal(true);
    }
  };

  return (
    <div className="page-container">
      <div className="premium-calendar-header">
        <div className="header-single-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 className="calendar-main-title" style={{ fontSize: '1.4rem', margin: 0 }}>Calendar</h1>
            
            <div className="view-mode-toggle" style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.04)', borderRadius: '8px', padding: '4px' }}>
              <button className={`view-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
              <button className={`view-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
              <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List</button>
            </div>
          </div>
          
          <div className="date-navigation" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={prevPeriod} className="nav-arrow-btn"><ChevronLeft size={16} /></button>
            <div 
              style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: '160px', cursor: 'pointer' }}
              onClick={() => {
                if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
                  dateInputRef.current.showPicker();
                }
              }}
            >
              <h2 className="current-date-text" style={{ fontSize: '1.1rem', margin: 0, textAlign: 'center' }}>{getDateDisplay()}</h2>
              <input 
                ref={dateInputRef}
                type={viewMode === 'week' ? 'week' : 'month'}
                value={viewMode === 'week' ? getWeekStr(currentDate) : getMonthStr(currentDate)}
                onChange={handleDateFilterChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
                title="Select date"
              />
            </div>
            <button onClick={nextPeriod} className="nav-arrow-btn"><ChevronRight size={16} /></button>
            <button onClick={today} className="today-btn">Today</button>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
            {!isAdmin ? (
              <button className="action-btn huddle-btn" onClick={() => setShowScheduleModal(true)}>
                <Clock size={16} /> Request Schedule
              </button>
            ) : (
              <button className="action-btn create-btn" onClick={() => setShowAddModal(true)}>
                <Plus size={16} /> Create
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="calendar-content-area">
        {viewMode === 'month' && (
          <div className="calendar-grid-container glass">
            <div className="calendar-days-header">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="calendar-grid">
              {calendarCells.map((cell, idx) => {
                const dayEvents = getEventsForDate(cell.date);
                const isToday = new Date().toDateString() === cell.date.toDateString();
                const MAX_EVENTS = 2;
                const displayedEvents = dayEvents.slice(0, MAX_EVENTS);
                const extraEventsCount = dayEvents.length - MAX_EVENTS;

                return (
                  <div
                    key={idx}
                    className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => { setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                  >
                    <div className="date-header-row">
                      <span className="date-number">{cell.date.getDate()}</span>
                      {dayEvents.length > 0 && <span className="date-badge">{dayEvents.length}/{dayEvents.length}</span>}
                    </div>
                    <div className="events-container">
                      {displayedEvents.map(evt => {
                        let Icon = null;
                        if (evt.event_type === 'WS' || evt.title === 'Work Shift') Icon = '💼';
                        else if (evt.event_type === 'VL') Icon = '🌴';
                        else if (evt.event_type === 'HL' || evt.event_type === 'Holiday') Icon = '🎉';
                        
                        return (
                          <div
                            key={evt.id}
                            className={`event-badge event-status-${evt.status} event-type-${evt.event_type} ${evt.status === 'pending' ? 'pending' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                            title={`${evt.title} - ${evt.user_name} (${evt.status})`}
                          >
                            {Icon && <span className="event-icon">{Icon}</span>}
                            <span className="event-text">
                              {evt.event_type === 'WS' || evt.title === 'Work Shift' ? `WS - ${evt.user_name}` : `${evt.event_type === 'Other' ? '' : evt.event_type + ' - '}${evt.title}`}
                            </span>
                          </div>
                        )
                      })}
                      {extraEventsCount > 0 && (
                        <div
                          className="more-events-link"
                          onClick={(e) => { e.stopPropagation(); setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                        >
                          +{extraEventsCount} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'week' && (
          <div className="calendar-grid-container glass week-view">
            <div className="calendar-days-header">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="calendar-grid week-grid">
              {weekCells.map((cell, idx) => {
                const dayEvents = getEventsForDate(cell.date);
                const isToday = new Date().toDateString() === cell.date.toDateString();

                return (
                  <div
                    key={idx}
                    className={`calendar-cell week-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => { setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                  >
                    <div className="date-header-row">
                      <div className="week-day-info">
                        <span className="week-day-name">{cell.date.toLocaleString('default', { weekday: 'short' })}</span>
                        <span className="date-number">{cell.date.getDate()}</span>
                      </div>
                    </div>
                    <div className="events-container week-events-container">
                      {dayEvents.map(evt => {
                        let Icon = null;
                        if (evt.event_type === 'WS' || evt.title === 'Work Shift') Icon = '💼';
                        else if (evt.event_type === 'VL') Icon = '🌴';
                        else if (evt.event_type === 'HL' || evt.event_type === 'Holiday') Icon = '🎉';
                        
                        return (
                          <div
                            key={evt.id}
                            className={`event-badge week-event-badge event-status-${evt.status} event-type-${evt.event_type} ${evt.status === 'pending' ? 'pending' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                            title={`${evt.title} - ${evt.user_name} (${evt.status})`}
                          >
                            {Icon && <span className="event-icon">{Icon}</span>}
                            <span className="event-text">
                              {evt.event_type === 'WS' || evt.title === 'Work Shift' ? `WS - ${evt.user_name}` : evt.title}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="calendar-list-view fade-in-up">
            {getEventsForMonth().length === 0 ? (
              <div className="no-events-state glass">
                <CalendarIcon size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '20px' }} />
                <h3>No Events Found</h3>
                <p>There are no events scheduled for {getDateDisplay()}.</p>
                {isAdmin && (
                  <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setShowAddModal(true)}>
                    Create First Event
                  </button>
                )}
              </div>
            ) : (
              <div className="list-events-container">
                {Object.entries(
                  getEventsForMonth().reduce((acc, evt) => {
                    const dateStr = evt.event_date.split(' ')[0];
                    if (!acc[dateStr]) acc[dateStr] = [];
                    acc[dateStr].push(evt);
                    return acc;
                  }, {})
                ).map(([dateStr, dayEvents]) => (
                  <div key={dateStr} className="list-day-group glass">
                    <div className="list-day-header">
                      <div className="list-day-date">{new Date(dateStr).getDate()}</div>
                      <div className="list-day-info">
                        <span className="list-day-name">{new Date(dateStr).toLocaleString('default', { weekday: 'long' })}</span>
                        <span className="list-day-month">{new Date(dateStr).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="list-day-events">
                      {dayEvents.map(evt => {
                         let Icon = null;
                         if (evt.event_type === 'WS' || evt.title === 'Work Shift') Icon = '💼';
                         else if (evt.event_type === 'VL') Icon = '🌴';
                         else if (evt.event_type === 'HL' || evt.event_type === 'Holiday') Icon = '🎉';
                         
                         return (
                           <div key={evt.id} className={`list-event-card event-status-${evt.status}`} onClick={() => handleEventClick(evt)}>
                             <div className={`list-event-icon-bg event-type-${evt.event_type}`}>{Icon}</div>
                             <div className="list-event-content">
                               <h4 className="list-event-title">{evt.event_type === 'WS' || evt.title === 'Work Shift' ? `WS - ${evt.user_name}` : evt.title}</h4>
                               {evt.description && <p className="list-event-desc">{evt.description}</p>}
                             </div>
                             <div className="list-event-meta">
                               <span className={`leave-request-pill event-type-${evt.event_type}`}>
                                 {evt.event_type === 'WS' || evt.title === 'Work Shift' ? 'Work Shift' : (evt.event_type === 'Other' ? 'Other' : evt.event_type)}
                               </span>
                               <span className={`status-badge status-${evt.status}`}>{evt.status}</span>
                             </div>
                           </div>
                         )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Request Event Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isAdmin ? 'Create Event' : 'Request Date'}</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>Event Type</label>
                <select className="input-field" value={eventType} onChange={e => setEventType(e.target.value)}>
                  {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Title</label>
                <input type="text" className="input-field" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Date</label>
                <input type="date" className="input-field" value={eventDate} onChange={e => setEventDate(e.target.value)} max="9999-12-31" required />
              </div>
              <div className="input-group">
                <label>Description (Optional)</label>
                <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} rows="3" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {isAdmin ? 'Save Event' : 'Submit for Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {showApproveModal && selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Review Request</h3>
              <button className="close-btn" onClick={() => setShowApproveModal(false)}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Requested By:</strong> {selectedEvent.user_name}</p>
              <p><strong>Type:</strong> {selectedEvent.event_type}</p>
              <p><strong>Date:</strong> {selectedEvent.event_date}</p>
              <p><strong>Title:</strong> {selectedEvent.title}</p>
              {selectedEvent.description && <p><strong>Description:</strong> {selectedEvent.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleUpdateStatus('approved')}>Approve</button>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleUpdateStatus('rejected')}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Day Events Modal */}
      {showDayModal && selectedDateForModal && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="day-modal-content" onClick={e => e.stopPropagation()}>
            <div className="day-modal-header">
              <div className="day-modal-date-big">{selectedDateForModal.getDate()}</div>
              <div className="day-modal-date-details">
                <div className="day-modal-day">{selectedDateForModal.toLocaleString('default', { weekday: 'long' })}</div>
                <div className="day-modal-month-year">
                  {selectedDateForModal.toLocaleString('default', { month: 'long' })} {selectedDateForModal.getFullYear()}
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDayModal(false)}><X size={20} /></button>
            </div>

            <div className="day-modal-body">
              {getEventsForDate(selectedDateForModal).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>No events for this day.</div>
              ) : (
                getEventsForDate(selectedDateForModal).map(evt => {
                  let Icon = null;
                  if (evt.event_type === 'WS' || evt.title === 'Work Shift') Icon = '💼';
                  else if (evt.event_type === 'VL') Icon = '🌴';
                  else if (evt.event_type === 'HL' || evt.event_type === 'Holiday') Icon = '🎉';

                  return (
                    <div key={evt.id} className={`day-modal-event-card event-status-${evt.status}`} onClick={() => { setShowDayModal(false); handleEventClick(evt); }}>
                      <div className="day-modal-event-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {Icon ? <span style={{ fontSize: '18px', lineHeight: 1 }}>{Icon}</span> : <div style={{ width: '16px' }} />}
                        {evt.event_type === 'WS' || evt.title === 'Work Shift' ? `WS - ${evt.user_name}` : evt.title}
                      </div>
                      <div className="day-modal-event-details-row">
                        {evt.event_type !== 'HL' && evt.event_type !== 'Holiday' && (
                          <div className="time-pill">
                            <Clock size={12} /> All Day
                          </div>
                        )}
                        <div className="leave-request-pill">
                          {evt.event_type === 'WS' || evt.title === 'Work Shift' ? 'Work Shift' : (evt.event_type === 'Other' ? 'Other' : evt.event_type)}
                        </div>
                      </div>
                      {evt.description && <div style={{ fontSize: '0.85rem', opacity: 0.9, fontStyle: 'italic', marginTop: '4px' }}>{evt.description}</div>}
                    </div>
                  )
                })
              )}
            </div>

            <div className="day-modal-footer">
              <div className="event-count">{getEventsForDate(selectedDateForModal).length} events</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isAdmin && (
                  <button
                    className="btn btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      const year = selectedDateForModal.getFullYear();
                      const month = String(selectedDateForModal.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDateForModal.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;
                      setScheduleStartDate(dateStr);
                      setScheduleEndDate(dateStr);
                      setShowDayModal(false);
                      setShowScheduleModal(true);
                    }}
                  >
                    + Schedule
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const year = selectedDateForModal.getFullYear();
                      const month = String(selectedDateForModal.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDateForModal.getDate()).padStart(2, '0');
                      setEventDate(`${year}-${month}-${day}`);
                      setShowDayModal(false);
                      setShowAddModal(true);
                    }}
                  >
                    + Event
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Request Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="schedule-modal-content">
            <div className="modal-header">
              <h3>Request Schedule</h3>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label>Schedule Type</label>
                <input
                  type="text"
                  className="input-field fixed-input"
                  value="Work Shift"
                  readOnly
                />
              </div>
              <div className="date-range-container">
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input type="date" className="input-field" value={scheduleStartDate} onChange={e => setScheduleStartDate(e.target.value)} max="9999-12-31" required />
                </div>
                <div className="date-separator">to</div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>End Date</label>
                  <input type="date" className="input-field" value={scheduleEndDate} onChange={e => setScheduleEndDate(e.target.value)} max="9999-12-31" required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary schedule-submit-btn" disabled={loading}>
                Submit Schedule Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reschedule Request</h3>
              <button className="close-btn" onClick={() => setShowRescheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>New Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={newRescheduleDate}
                  onChange={e => setNewRescheduleDate(e.target.value)}
                  max="9999-12-31"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                Submit Reschedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
