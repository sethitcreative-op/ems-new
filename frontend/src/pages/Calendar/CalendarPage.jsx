import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';

const EVENT_TYPES = ['VL', 'SL', 'PDO', 'Birthday', 'Meeting', 'Holiday', 'Other'];

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null);

  // Request Schedule State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleTitle, setScheduleTitle] = useState('Desired Schedule');
  const [selectedDays, setSelectedDays] = useState({
    1: true, // Monday
    2: true, // Tuesday
    3: true, // Wednesday
    4: true, // Thursday
    5: true, // Friday
    6: false, // Saturday
    0: false, // Sunday
  });

  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';

  // Add Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('VL');
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=${user.role}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        // Filter out rejected events to remove them from the calendar view
        const activeEvents = res.data.data.filter(e => e.status !== 'rejected');
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
      const dayOfWeek = currentDateObj.getDay();
      
      if (selectedDays[dayOfWeek]) {
        // Format date to YYYY-MM-DD
        const yyyy = currentDateObj.getFullYear();
        const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDateObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        try {
          await axios.post(`${API_BASE}/calendar.php`, {
            user_id: user.id,
            title: scheduleTitle,
            description: 'Requested working schedule',
            event_date: dateStr,
            event_type: 'Other',
            status: 'pending'
          });
          createdCount++;
        } catch (err) {
          console.error('Failed to create schedule for', dateStr, err);
        }
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
        message: `No working days selected in the given date range.` 
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

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // Calendar Grid Logic
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
      <div className="calendar-header-controls">
        <div className="calendar-nav">
          <button onClick={today}>Today</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button onClick={prevMonth} style={{ padding: '4px' }}><ChevronLeft size={20} /></button>
            <h2>
              {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
            </h2>
            <button onClick={nextMonth} style={{ padding: '4px' }}><ChevronRight size={20} /></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isAdmin && (
            <button className="btn btn-ghost" onClick={() => setShowScheduleModal(true)}>
              <Clock size={18} /> Request Schedule
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> {isAdmin ? 'Create Event' : 'Request Date'}
          </button>
        </div>
      </div>

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
                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}
              >
                <div className="date-header-row">
                  <span className="date-number">{cell.date.getDate()}</span>
                  {dayEvents.length > 0 && <span className="date-badge">{dayEvents.length}/{dayEvents.length}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  {displayedEvents.map(evt => (
                    <div 
                      key={evt.id} 
                      className={`event-badge event-type-${evt.event_type} ${evt.status === 'pending' ? 'pending' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                      title={`${evt.title} - ${evt.user_name} (${evt.status})`}
                    >
                      {evt.event_type} - {evt.title} {evt.status === 'approved' ? '(Approved)' : evt.status === 'pending' ? '(Pending)' : ''}
                    </div>
                  ))}
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
                getEventsForDate(selectedDateForModal).map(evt => (
                  <div key={evt.id} className={`day-modal-event-card event-type-${evt.event_type}`} onClick={() => { setShowDayModal(false); handleEventClick(evt); }}>
                    <div className="day-modal-event-title-row">
                      {evt.event_type === 'Birthday' ? '🎂' : evt.event_type === 'Holiday' ? '🎉' : '🔹'}
                      {evt.title}
                    </div>
                    <div className="day-modal-event-details-row">
                      {evt.event_type !== 'Birthday' && evt.event_type !== 'Holiday' && (
                        <div className="time-pill">
                          <Clock size={12} /> All Day
                        </div>
                      )}
                      <div className="leave-request-pill">
                        {evt.event_type} {evt.status === 'pending' ? '(Pending)' : evt.status === 'approved' ? '(Approved)' : ''}
                      </div>
                    </div>
                    {evt.description && <div style={{ fontSize: '0.85rem', opacity: 0.9, fontStyle: 'italic', marginTop: '4px' }}>{evt.description}</div>}
                  </div>
                ))
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
                      // Select just the day of week
                      const dayOfWeek = selectedDateForModal.getDay();
                      setSelectedDays({
                        0: dayOfWeek === 0,
                        1: dayOfWeek === 1,
                        2: dayOfWeek === 2,
                        3: dayOfWeek === 3,
                        4: dayOfWeek === 4,
                        5: dayOfWeek === 5,
                        6: dayOfWeek === 6,
                      });
                      setShowDayModal(false);
                      setShowScheduleModal(true);
                    }}
                  >
                    + Schedule
                  </button>
                )}
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
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Request Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h3>Request Schedule</h3>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>Schedule Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={scheduleTitle} 
                  onChange={e => setScheduleTitle(e.target.value)} 
                  required 
                  placeholder="e.g., Morning Shift, 9AM - 6PM"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input type="date" className="input-field" value={scheduleStartDate} onChange={e => setScheduleStartDate(e.target.value)} max="9999-12-31" required />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>End Date</label>
                  <input type="date" className="input-field" value={scheduleEndDate} onChange={e => setScheduleEndDate(e.target.value)} max="9999-12-31" required />
                </div>
              </div>
              
              <div className="input-group">
                <label style={{ marginBottom: '10px', display: 'block' }}>Working Days</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--glass-border)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', border: '1px solid var(--card-border)' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedDays[idx]}
                        onChange={(e) => setSelectedDays({...selectedDays, [idx]: e.target.checked})}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.85rem' }}>{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                Submit Schedule Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
