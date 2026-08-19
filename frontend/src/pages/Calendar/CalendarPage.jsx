import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './CalendarPage.css';
import API_BASE from '../../config/api';
import CustomWeekPicker from '../../components/common/CustomWeekPicker';

const EVENT_TYPES = ['WS', 'VL', 'HL'];

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'month', 'week', 'list'
  const dateInputRef = useRef(null);

  // Request Schedule State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleType, setScheduleType] = useState('WS');
  const [employees, setEmployees] = useState([]);

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
  const [targetUserId, setTargetUserId] = useState(user?.id || '');
  const { addNotification } = useNotification();

  // Holidays Management State (Admin)
  const [holidayTableYear, setHolidayTableYear] = useState(new Date().getFullYear());
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [editHolidayName, setEditHolidayName] = useState('');
  const [editHolidayDate, setEditHolidayDate] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const seededYearsRef = useRef(new Set());

  useEffect(() => {
    fetchEvents();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [isAdmin]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees.php?action=list`);
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch holidays when calendar year changes (auto-seed if needed)
  useEffect(() => {
    const year = currentDate.getFullYear();
    autoSeedAndFetchHolidays(year);
  }, [currentDate]);

  // Fetch holidays when the admin table year filter changes
  useEffect(() => {
    fetchHolidaysForYear(holidayTableYear);
  }, [holidayTableYear]);

  useEffect(() => {
    if (location.state?.openRescheduleModal && location.state?.requestData) {
      setRescheduleData(location.state.requestData);
      setNewRescheduleDate(location.state.requestData.event_date);
      setShowRescheduleModal(true);
      // Clear the state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // ---- Holidays API Functions ----

  const autoSeedAndFetchHolidays = async (year) => {
    // Don't re-seed the same year within this session
    if (seededYearsRef.current.has(year)) {
      return;
    }
    try {
      // Check if holidays exist for this year
      const checkRes = await axios.get(`${API_BASE}/holidays.php?check_year=${year}`);
      if (checkRes.data.status === 'success' && checkRes.data.count === 0) {
        // Auto-seed
        await axios.post(`${API_BASE}/holidays.php`, { action: 'seed', year });
      }
      seededYearsRef.current.add(year);
      // Now fetch all holidays (we fetch all to cover cross-month views)
      await fetchHolidaysForYear(year);
    } catch (err) {
      console.error('Failed to auto-seed/fetch holidays:', err);
    }
  };

  const fetchHolidaysForYear = async (year) => {
    try {
      const res = await axios.get(`${API_BASE}/holidays.php?year=${year}`);
      if (res.data.status === 'success') {
        setHolidays(prev => {
          // Merge: keep holidays from other years, replace this year's
          const otherYears = prev.filter(h => {
            const hYear = parseInt(h.holiday_date.split('-')[0], 10);
            return hYear !== year;
          });
          return [...otherYears, ...res.data.data];
        });
      }
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    }
  };

  const handleSeedYear = async (year) => {
    try {
      const res = await axios.post(`${API_BASE}/holidays.php`, { action: 'seed', year });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: res.data.message });
        seededYearsRef.current.add(year);
        await fetchHolidaysForYear(year);
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to seed holidays' });
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayDate) return;
    try {
      const res = await axios.post(`${API_BASE}/holidays.php`, {
        name: newHolidayName,
        holiday_date: newHolidayDate
      });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: res.data.message });
        setShowAddHolidayModal(false);
        setNewHolidayName('');
        setNewHolidayDate('');
        const year = parseInt(newHolidayDate.split('-')[0], 10);
        await fetchHolidaysForYear(year);
      } else {
        addNotification({ type: 'error', message: res.data.message });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to add holiday' });
    }
  };

  const handleEditHoliday = async (id) => {
    if (!editHolidayName || !editHolidayDate) return;
    try {
      const res = await axios.put(`${API_BASE}/holidays.php`, {
        id,
        name: editHolidayName,
        holiday_date: editHolidayDate
      });
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Holiday updated' });
        setEditingHolidayId(null);
        await fetchHolidaysForYear(holidayTableYear);
      } else {
        addNotification({ type: 'error', message: res.data.message });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to update holiday' });
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/holidays.php?id=${id}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: 'Holiday deleted' });
        await fetchHolidaysForYear(holidayTableYear);
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to delete holiday' });
    }
  };

  // ---- Events API Functions ----

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=${user.role}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        const filteredEvents = res.data.data.filter(e => e.status !== 'rejected' && e.status !== 'pending');
        setEvents(filteredEvents);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!eventDate || !title) return;

    // Prevent past dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (eventDate < todayStr) {
      addNotification({ type: 'warning', message: 'Cannot assign a schedule in the past.' });
      return;
    }

    setLoading(true);
    try {
      if (editingEventId) {
        await axios.put(`${API_BASE}/calendar.php`, {
          id: editingEventId,
          action: 'edit',
          user_id: targetUserId,
          title,
          description,
          event_date: eventDate,
          event_type: eventType,
          status: 'approved',
          is_admin: true
        });
        addNotification({ type: 'success', message: 'Event updated successfully.' });
      } else {
        await axios.post(`${API_BASE}/calendar.php`, {
          user_id: isAdmin ? targetUserId : user.id,
          title,
          description,
          event_date: eventDate,
          event_type: eventType,
          status: isAdmin ? 'approved' : 'pending'
        });
        addNotification({ type: 'success', message: isAdmin ? 'Event assigned successfully.' : 'Event requested successfully.' });
      }
      
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventType('VL');
      setTargetUserId(user.id);
      setEditingEventId(null);
      setShowAddModal(false);
      fetchEvents();
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: editingEventId ? 'Failed to update event.' : 'Failed to save event.' });
    }
    setLoading(false);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleStartDate || !scheduleEndDate) return;
    
    // Prevent past dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (scheduleStartDate < todayStr) {
      addNotification({ type: 'warning', message: 'Cannot request a schedule in the past.' });
      return;
    }

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
          title: scheduleType === 'WS' ? 'Work Shift' : 'Vacation Leave',
          description: scheduleType === 'WS' ? 'Requested working schedule' : 'Requested vacation leave',
          event_date: dateStr,
          event_type: scheduleType,
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

    // Prevent past dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (newRescheduleDate < todayStr) {
      addNotification({ type: 'warning', message: 'Cannot reschedule to a past date.' });
      return;
    }

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
       const day = start.getDay();
       const diff = (day + 7 - 4) % 7;
       start.setDate(start.getDate() - diff);
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
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day + 7 - 4) % 7;
    date.setDate(date.getDate() - diff);
    const yStr = date.getFullYear();
    const mStr = String(date.getMonth() + 1).padStart(2, '0');
    const dStr = String(date.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  };

  const handleDateFilterChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    
    if (viewMode === 'month' || viewMode === 'list') {
      const [y, m] = val.split('-');
      setCurrentDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  };

  const handleWeekPickerChange = (val) => {
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d));
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
    const diff = (day + 7 - 4) % 7;
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - diff);
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

  // Get holidays for a specific date
  const getHolidaysForDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return holidays.filter(h => h.holiday_date === dateStr);
  };

  // Get holidays for current month (for list view)
  const getHolidaysForMonth = () => {
    return holidays.filter(h => {
      const parts = h.holiday_date.split('-');
      const hYear = parseInt(parts[0], 10);
      const hMonth = parseInt(parts[1], 10) - 1;
      return hMonth === currentDate.getMonth() && hYear === currentDate.getFullYear();
    });
  };

  // Get holidays filtered for admin table
  const getHolidaysForTable = () => {
    return holidays.filter(h => {
      const hYear = parseInt(h.holiday_date.split('-')[0], 10);
      return hYear === holidayTableYear;
    });
  };

  const handleEventClick = (evt) => {
    if (isAdmin && evt.status === 'pending') {
      setSelectedEvent(evt);
      setShowApproveModal(true);
    } else if (isAdmin && evt.event_type !== 'holiday' && !evt._isHoliday) {
      // Admin editing an approved/existing event
      setEditingEventId(evt.id);
      setTitle(evt.title);
      setDescription(evt.description || '');
      setEventDate(evt.event_date.split(' ')[0]);
      setEventType(evt.event_type);
      setTargetUserId(evt.user_id);
      setShowAddModal(true);
    } else if (!isAdmin) {
      if (String(evt.user_id) === String(user.id)) {
        setRescheduleData(evt);
        setNewRescheduleDate(evt.event_date);
        setShowRescheduleModal(true);
      } else {
        addNotification({
          type: 'warning',
          message: 'You can only edit or view details of your own schedule.'
        });
      }
    }
  };

  // Helper: render event icon
  const getEventIcon = (evt) => {
    if (evt.event_type === 'WS' || evt.title === 'Work Shift') return '💼';
    if (evt.event_type === 'VL') return '🌴';
    if (evt.event_type === 'HL' || evt.event_type === 'Holiday') return '🎉';
    return null;
  };

  // Helper: render event display text
  const getEventText = (evt) => {
    if (evt.event_type === 'WS' || evt.title === 'Work Shift') return `WS - ${evt.user_name}`;
    if (['VL', 'SL', 'PDO'].includes(evt.event_type)) return `${evt.event_type} - ${evt.user_name}`;
    return `${evt.event_type === 'Other' ? '' : evt.event_type + ' - '}${evt.user_name} (${evt.title})`;
  };

  // Render a combined list of events + holidays for a date (used in all views)
  const getCombinedItemsForDate = (date) => {
    const dayEvents = getEventsForDate(date);
    const dayHolidays = getHolidaysForDate(date);
    // Convert holidays to a display format compatible with events
    const holidayItems = dayHolidays.map(h => ({
      id: `holiday-${h.id}`,
      _isHoliday: true,
      title: h.name,
      event_type: 'holiday',
      status: 'approved',
      user_name: 'US Holiday',
      description: h.is_observed === '1' || h.is_observed === 1 ? 'Observed date' : '',
      event_date: h.holiday_date
    }));
    return [...holidayItems, ...dayEvents];
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
            {viewMode === 'week' ? (
              <CustomWeekPicker 
                value={getWeekStr(currentDate)}
                onChange={handleWeekPickerChange}
                className="calendar-week-picker"
              />
            ) : (
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
                  type="month"
                  value={getMonthStr(currentDate)}
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
            )}
            <button onClick={nextPeriod} className="nav-arrow-btn"><ChevronRight size={16} /></button>
            <button onClick={today} className="today-btn">Today</button>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
            {!isAdmin ? (
              <button className="action-btn huddle-btn" onClick={() => setShowScheduleModal(true)}>
                <Clock size={16} /> Request Schedule
              </button>
            ) : (
              <>
                <button 
                  className={`action-btn ${viewMode === 'holidays' ? 'create-btn' : 'huddle-btn'}`} 
                  onClick={() => setViewMode(viewMode === 'holidays' ? 'month' : 'holidays')}
                >
                  <CalendarIcon size={16} /> {viewMode === 'holidays' ? 'Show Calendar' : 'Check Holiday'}
                </button>
                <button className="action-btn create-btn" onClick={() => setShowAddModal(true)}>
                  <Plus size={16} /> Create
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      <div className="calendar-content-area" style={{ display: viewMode === 'holidays' ? 'none' : 'flex' }}>
        {viewMode === 'month' && (
          <div className="calendar-grid-container glass">
            <div className="calendar-days-header">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div className="calendar-grid">
              {calendarCells.map((cell, idx) => {
                const combined = getCombinedItemsForDate(cell.date);
                const dayHolidays = getHolidaysForDate(cell.date);
                const isToday = new Date().toDateString() === cell.date.toDateString();
                const hasHoliday = dayHolidays.length > 0;
                const MAX_EVENTS = 2;
                const displayedItems = combined.slice(0, MAX_EVENTS);
                const extraCount = combined.length - MAX_EVENTS;

                return (
                  <div
                    key={idx}
                    className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasHoliday ? 'has-holiday' : ''}`}
                    onClick={() => { setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                  >
                    <div className="date-header-row">
                      <span className="date-number">{cell.date.getDate()}</span>
                      {combined.length > 0 && <span className="date-badge">{combined.length}</span>}
                    </div>
                    <div className="events-container">
                      {displayedItems.map(item => {
                        if (item._isHoliday) {
                          return (
                            <div
                              key={item.id}
                              className="event-badge event-type-holiday"
                              title={item.title}
                            >
                              <span className="event-icon">🎄</span>
                              <span className="event-text">{item.title}</span>
                            </div>
                          );
                        }
                        const Icon = getEventIcon(item);
                        return (
                          <div
                            key={item.id}
                            className={`event-badge event-status-${item.status} event-type-${item.event_type} ${item.status === 'pending' ? 'pending' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(item); }}
                            title={`${item.title} - ${item.user_name} (${item.status})`}
                          >
                            {Icon && <span className="event-icon">{Icon}</span>}
                            <span className="event-text">{getEventText(item)}</span>
                          </div>
                        );
                      })}
                      {extraCount > 0 && (
                        <div
                          className="more-events-link"
                          onClick={(e) => { e.stopPropagation(); setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                        >
                          +{extraCount} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'week' && !isAdmin && (
          <div className="calendar-grid-container glass week-view">
            <div className="calendar-days-header">
              <div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
            </div>
            <div className="calendar-grid week-grid">
              {weekCells.map((cell, idx) => {
                const combined = getCombinedItemsForDate(cell.date);
                const dayHolidays = getHolidaysForDate(cell.date);
                const isToday = new Date().toDateString() === cell.date.toDateString();
                const hasHoliday = dayHolidays.length > 0;

                return (
                  <div
                    key={idx}
                    className={`calendar-cell week-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasHoliday ? 'has-holiday' : ''}`}
                    onClick={() => { setSelectedDateForModal(cell.date); setShowDayModal(true); }}
                  >
                    <div className="date-header-row">
                      <div className="week-day-info">
                        <span className="week-day-name">{cell.date.toLocaleString('default', { weekday: 'short' })}</span>
                        <span className="date-number">{cell.date.getDate()}</span>
                      </div>
                    </div>
                    <div className="events-container week-events-container">
                      {combined.map(item => {
                        if (item._isHoliday) {
                          return (
                            <div key={item.id} className="event-badge week-event-badge event-type-holiday" title={item.title}>
                              <span className="event-icon">🎄</span>
                              <span className="event-text">{item.title}</span>
                            </div>
                          );
                        }
                        const Icon = getEventIcon(item);
                        return (
                          <div
                            key={item.id}
                            className={`event-badge week-event-badge event-status-${item.status} event-type-${item.event_type} ${item.status === 'pending' ? 'pending' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(item); }}
                            title={`${item.title} - ${item.user_name} (${item.status})`}
                          >
                            {Icon && <span className="event-icon">{Icon}</span>}
                            <span className="event-text">{getEventText(item)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'week' && isAdmin && (
          <div className="admin-week-grid-container glass">
            <div className="table-responsive">
              <table className="admin-week-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px', textAlign: 'left', paddingLeft: '16px' }}>EMPLOYEE</th>
                    {weekCells.map((cell, idx) => {
                      const isToday = new Date().toDateString() === cell.date.toDateString();
                      return (
                        <th key={idx} className={isToday ? 'today-col' : ''}>
                          <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {cell.date.toLocaleString('default', { weekday: 'short' })}
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-main)', marginTop: '2px' }}>
                            {cell.date.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="holidays-row">
                     <td style={{ textAlign: 'left', paddingLeft: '16px', fontWeight: 600, color: 'var(--primary)' }}>Holidays / Global</td>
                     {weekCells.map((cell, idx) => {
                       const dayHolidays = getHolidaysForDate(cell.date);
                       const isToday = new Date().toDateString() === cell.date.toDateString();
                       return (
                         <td key={idx} className={`admin-week-cell ${isToday ? 'today-cell' : ''}`}>
                            <div className="admin-cell-events">
                              {dayHolidays.map(h => (
                                 <div key={h.id} className="event-badge event-type-holiday" style={{ margin: '2px 0', fontSize: '0.75rem', padding: '2px 6px', display: 'inline-flex' }}>
                                   <span className="event-icon" style={{ fontSize: '10px' }}>🎄</span>
                                   <span className="event-text">{h.name}</span>
                                 </div>
                              ))}
                            </div>
                         </td>
                       );
                     })}
                  </tr>
                  {employees.map(emp => (
                    <tr key={emp.id} className="employee-row">
                      <td style={{ textAlign: 'left', paddingLeft: '16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.employee_id || emp.id}</div>
                      </td>
                      {weekCells.map((cell, idx) => {
                        const dayEvents = events.filter(e => {
                          if (!e.event_date) return false;
                          const dateMatch = e.event_date.split(' ')[0] === cell.date.toISOString().split('T')[0];
                          return dateMatch && String(e.user_id) === String(emp.id);
                        });
                        const isToday = new Date().toDateString() === cell.date.toDateString();
                        return (
                          <td key={idx} className={`admin-week-cell ${isToday ? 'today-cell' : ''}`} onClick={() => { setSelectedDateForModal(cell.date); setShowDayModal(true); }}>
                            <div className="admin-cell-events">
                              {dayEvents.map(item => {
                                const Icon = getEventIcon(item);
                                return (
                                  <div
                                    key={item.id}
                                    className={`event-badge event-status-${item.status} event-type-${item.event_type} ${item.status === 'pending' ? 'pending' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleEventClick(item); }}
                                    title={`${item.title} (${item.status})`}
                                    style={{ margin: '2px 0', fontSize: '0.75rem', padding: '2px 6px', display: 'inline-flex' }}
                                  >
                                    {Icon && <span className="event-icon" style={{ fontSize: '10px' }}>{Icon}</span>}
                                    <span className="event-text">{item.event_type === 'WS' ? 'WS' : item.event_type}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="calendar-list-view fade-in-up">
            {(() => {
              const monthEvents = getEventsForMonth();
              const monthHolidays = getHolidaysForMonth();
              // Create combined items grouped by date
              const allItems = {};
              
              monthHolidays.forEach(h => {
                const dateStr = h.holiday_date;
                if (!allItems[dateStr]) allItems[dateStr] = [];
                allItems[dateStr].push({
                  id: `holiday-${h.id}`,
                  _isHoliday: true,
                  title: h.name,
                  event_type: 'holiday',
                  status: 'approved',
                  user_name: 'US Holiday',
                  description: h.is_observed === '1' || h.is_observed === 1 ? 'Observed date' : '',
                  event_date: h.holiday_date
                });
              });

              monthEvents.forEach(evt => {
                const dateStr = evt.event_date.split(' ')[0];
                if (!allItems[dateStr]) allItems[dateStr] = [];
                allItems[dateStr].push(evt);
              });

              const sortedEntries = Object.entries(allItems).sort(([a], [b]) => new Date(a) - new Date(b));

              if (sortedEntries.length === 0) {
                return (
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
                );
              }

              return (
                <div className="list-events-container">
                  {sortedEntries.map(([dateStr, dayItems]) => (
                    <div key={dateStr} className="list-day-group glass">
                      <div className="list-day-header">
                        <div className="list-day-date">{new Date(dateStr + 'T00:00:00').getDate()}</div>
                        <div className="list-day-info">
                          <span className="list-day-name">{new Date(dateStr + 'T00:00:00').toLocaleString('default', { weekday: 'long' })}</span>
                          <span className="list-day-month">{new Date(dateStr + 'T00:00:00').toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="list-day-events">
                        {dayItems.map(item => {
                          if (item._isHoliday) {
                            return (
                              <div key={item.id} className="list-event-card event-status-approved">
                                <div className="list-event-icon-bg event-type-holiday">🎄</div>
                                <div className="list-event-content">
                                  <h4 className="list-event-title">{item.title}</h4>
                                  {item.description && <p className="list-event-desc">{item.description}</p>}
                                </div>
                                <div className="list-event-meta">
                                  <span className="leave-request-pill event-type-holiday" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                                    Holiday
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          const Icon = getEventIcon(item);
                          return (
                            <div key={item.id} className={`list-event-card event-status-${item.status}`} onClick={() => handleEventClick(item)}>
                              <div className={`list-event-icon-bg event-type-${item.event_type}`}>{Icon}</div>
                              <div className="list-event-content">
                                <h4 className="list-event-title">{getEventText(item)}</h4>
                                {item.description && <p className="list-event-desc">{item.description}</p>}
                              </div>
                              <div className="list-event-meta">
                                <span className={`leave-request-pill event-type-${item.event_type}`}>
                                  {item.event_type === 'WS' || item.title === 'Work Shift' ? 'Work Shift' : (item.event_type === 'Other' ? 'Other' : item.event_type)}
                                </span>
                                <span className={`status-badge status-${item.status}`}>{item.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========== HOLIDAYS MANAGEMENT TABLE (Admin Only) ========== */}
      {isAdmin && viewMode === 'holidays' && (
        <div className="holidays-section" style={{ marginTop: 0 }}>
          <div className="holidays-section-header">
            <h2><span className="holiday-icon">🎄</span> US Holidays</h2>
            <div className="holidays-header-actions">
              <select
                className="holidays-year-select"
                value={holidayTableYear}
                onChange={(e) => setHolidayTableYear(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="seed-btn" onClick={() => handleSeedYear(holidayTableYear)}>
                <RefreshCw size={14} /> Re-seed {holidayTableYear}
              </button>
              <button className="add-holiday-btn" onClick={() => setShowAddHolidayModal(true)}>
                <Plus size={14} /> Add Holiday
              </button>
            </div>
          </div>

          <div className="holidays-table-container">
            {getHolidaysForTable().length === 0 ? (
              <div className="holidays-empty">
                <span style={{ fontSize: '2rem' }}>🎄</span>
                <p>No holidays for {holidayTableYear}.</p>
                <button className="seed-btn" style={{ margin: '16px auto 0' }} onClick={() => handleSeedYear(holidayTableYear)}>
                  <RefreshCw size={14} /> Seed US Holidays
                </button>
              </div>
            ) : (
              <table className="holidays-table">
                <thead>
                  <tr>
                    <th>Holiday</th>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Observed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getHolidaysForTable().map(h => (
                    <tr key={h.id}>
                      <td>
                        {editingHolidayId === h.id ? (
                          <input
                            className="holiday-edit-input"
                            value={editHolidayName}
                            onChange={e => setEditHolidayName(e.target.value)}
                          />
                        ) : (
                          <div className="holiday-name-cell">
                            <span className="holiday-dot"></span>
                            {h.name}
                          </div>
                        )}
                      </td>
                      <td>
                        {editingHolidayId === h.id ? (
                          <input
                            type="date"
                            className="holiday-edit-input"
                            value={editHolidayDate}
                            onChange={e => setEditHolidayDate(e.target.value)}
                            max="9999-12-31"
                          />
                        ) : (
                          <span className="holiday-date-cell">
                            {new Date(h.holiday_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(h.holiday_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                      </td>
                      <td>
                        <span className={`holiday-observed-badge ${h.is_observed === '1' || h.is_observed === 1 ? 'observed-yes' : 'observed-no'}`}>
                          {h.is_observed === '1' || h.is_observed === 1 ? '⚠ Observed' : '—'}
                        </span>
                      </td>
                      <td>
                        {editingHolidayId === h.id ? (
                          <div className="holiday-edit-actions">
                            <button className="holiday-save-btn" onClick={() => handleEditHoliday(h.id)}>Save</button>
                            <button className="holiday-cancel-btn" onClick={() => setEditingHolidayId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="holiday-actions">
                            <button
                              className="holiday-action-btn"
                              onClick={() => { setEditingHolidayId(h.id); setEditHolidayName(h.name); setEditHolidayDate(h.holiday_date); }}
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button className="holiday-action-btn delete" onClick={() => handleDeleteHoliday(h.id)}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add/Request/Edit Event Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="clean-modal-content">
            <div className="clean-modal-header">
              <h3>{isAdmin ? (editingEventId ? 'Edit Event' : 'New Event') : 'Request Date'}</h3>
              <button className="clean-close-btn" onClick={() => { setShowAddModal(false); setEditingEventId(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEvent}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                <div className="input-group">
                  <label>Event Title</label>
                  <input type="text" placeholder="Add title" value={title} onChange={e => setTitle(e.target.value)} required style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }} />
                </div>
                {isAdmin && (
                  <div className="input-group">
                    <label>Employee</label>
                    <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                      <option value={user.id}>Me ({user.full_name || 'Admin'})</option>
                      {employees.filter(emp => String(emp.id) !== String(user.id)).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="date-range-container">
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Date</label>
                    <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} max="9999-12-31" required style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Category</label>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                      {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Description (Optional)</label>
                  <textarea placeholder="Add description" value={description} onChange={e => setDescription(e.target.value)} rows="3" style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {eventDate && eventDate < new Date().toISOString().split('T')[0] && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    ⚠️ Cannot schedule events in the past.
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => { setShowAddModal(false); setEditingEventId(null); }}>Cancel</button>
                  <button type="submit" className="schedule-submit-btn" style={{ flex: 1, margin: 0 }} disabled={loading || (eventDate && eventDate < new Date().toISOString().split('T')[0])}>
                    {isAdmin ? (editingEventId ? 'Update Event' : 'Save Event') : 'Submit'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {showApproveModal && selectedEvent && (
        <div className="modal-overlay">
          <div className="schedule-modal-content">
            <div className="modal-header">
              <h3>Review Request</h3>
              <button className="close-btn" onClick={() => setShowApproveModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0', fontSize: '0.95rem' }}>
              <p style={{ margin: 0 }}><strong>Requested By:</strong> {selectedEvent.user_name}</p>
              <p style={{ margin: 0 }}><strong>Type:</strong> {selectedEvent.event_type}</p>
              <p style={{ margin: 0 }}><strong>Date:</strong> {selectedEvent.event_date}</p>
              <p style={{ margin: 0 }}><strong>Title:</strong> {selectedEvent.title}</p>
              {selectedEvent.description && <p style={{ margin: 0 }}><strong>Description:</strong> {selectedEvent.description}</p>}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button className="schedule-submit-btn" style={{ flex: 1, margin: 0, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }} onClick={() => handleUpdateStatus('rejected')}>Reject</button>
              <button className="schedule-submit-btn" style={{ flex: 1, margin: 0, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }} onClick={() => handleUpdateStatus('approved')}>Approve</button>
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
              {(() => {
                const combined = getCombinedItemsForDate(selectedDateForModal);
                if (combined.length === 0) {
                  return <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>No events for this day.</div>;
                }
                return combined.map(item => {
                  if (item._isHoliday) {
                    return (
                      <div key={item.id} className="day-modal-event-card event-status-approved holiday-card">
                        <div className="day-modal-event-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '18px', lineHeight: 1 }}>🎄</span>
                          {item.title}
                        </div>
                        <div className="day-modal-event-details-row">
                          <div className="leave-request-pill" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                            US Holiday
                          </div>
                          {item.description && (
                            <div className="leave-request-pill">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const Icon = getEventIcon(item);
                  return (
                    <div key={item.id} className={`day-modal-event-card event-status-${item.status}`} onClick={() => { setShowDayModal(false); handleEventClick(item); }}>
                      <div className="day-modal-event-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {Icon ? <span style={{ fontSize: '18px', lineHeight: 1 }}>{Icon}</span> : <div style={{ width: '16px' }} />}
                        {getEventText(item)}
                      </div>
                      <div className="day-modal-event-details-row">
                        {item.event_type !== 'HL' && item.event_type !== 'Holiday' && (
                          <div className="time-pill">
                            <Clock size={12} /> All Day
                          </div>
                        )}
                        <div className="leave-request-pill">
                          {item.event_type === 'WS' || item.title === 'Work Shift' ? 'Work Shift' : (item.event_type === 'Other' ? 'Other' : item.event_type)}
                        </div>
                      </div>
                      {item.description && <div style={{ fontSize: '0.85rem', opacity: 0.9, fontStyle: 'italic', marginTop: '4px' }}>{item.description}</div>}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="day-modal-footer">
              <div className="event-count">{getCombinedItemsForDate(selectedDateForModal).length} events</div>
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
            <form onSubmit={handleScheduleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                <div className="input-group">
                  <label>Schedule Type</label>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value)}
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                  >
                    <option value="WS">Work Shift</option>
                    <option value="VL">Vacation Leave</option>
                  </select>
                </div>
                <div className="date-range-container">
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={scheduleStartDate}
                      onChange={(e) => setScheduleStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      max="9999-12-31"
                      required
                      style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div className="date-separator">to</div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>End Date</label>
                    <input
                      type="date"
                      value={scheduleEndDate}
                      onChange={(e) => setScheduleEndDate(e.target.value)}
                      min={scheduleStartDate || new Date().toISOString().split('T')[0]}
                      max="9999-12-31"
                      required
                      style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(scheduleStartDate < new Date().toISOString().split('T')[0] || scheduleEndDate < new Date().toISOString().split('T')[0]) && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    ⚠️ Past dates cannot be requested.
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setShowScheduleModal(false)}>Cancel</button>
                  <button type="submit" className="schedule-submit-btn" style={{ flex: 1, margin: 0 }} disabled={loading || scheduleStartDate < new Date().toISOString().split('T')[0] || scheduleEndDate < new Date().toISOString().split('T')[0]}>Submit</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="schedule-modal-content">
            <div className="modal-header">
              <h3>Reschedule Request</h3>
              <button className="close-btn" onClick={() => setShowRescheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                <div className="input-group">
                  <label>New Date</label>
                  <input
                    type="date"
                    value={newRescheduleDate}
                    onChange={e => setNewRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    max="9999-12-31"
                    required
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {newRescheduleDate && newRescheduleDate < new Date().toISOString().split('T')[0] && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    ⚠️ Cannot reschedule to a past date.
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setShowRescheduleModal(false)}>Cancel</button>
                  <button type="submit" className="schedule-submit-btn" style={{ flex: 1, margin: 0 }} disabled={loading || (newRescheduleDate && newRescheduleDate < new Date().toISOString().split('T')[0])}>Submit</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {showAddHolidayModal && (
        <div className="modal-overlay">
          <div className="holiday-modal-content">
            <div className="modal-header">
              <h3>🎄 Add Custom Holiday</h3>
              <button className="close-btn" onClick={() => setShowAddHolidayModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddHoliday} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <label>Holiday Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={newHolidayName}
                  onChange={e => setNewHolidayName(e.target.value)}
                  placeholder="e.g. Company Anniversary"
                  required
                />
              </div>
              <div className="input-group">
                <label>Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={newHolidayDate}
                  onChange={e => setNewHolidayDate(e.target.value)}
                  max="9999-12-31"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}>
                Add Holiday
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
