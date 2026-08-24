import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Clock, Edit2, Trash2, RefreshCw, User, Tag, AlignLeft, Info, Save, Briefcase } from 'lucide-react';
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

  // Legend State
  const [showLegend, setShowLegend] = useState(false);

  // Request Schedule State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleType, setScheduleType] = useState('WS');
  const [scheduleDateMode, setScheduleDateMode] = useState('range'); // 'range' | 'pick'
  const [selectedDates, setSelectedDates] = useState([]); // for 'pick' mode
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [employees, setEmployees] = useState([]);

  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';

  const location = useLocation();
  const navigate = useNavigate();

  // Reschedule State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState('reschedule');
  const [rescheduleTitle, setRescheduleTitle] = useState('');
  const [rescheduleDesc, setRescheduleDesc] = useState('');
  const [rescheduleType, setRescheduleType] = useState('WS');
  const [rescheduleOption, setRescheduleOption] = useState('');

  const [showOwnScheduleModal, setShowOwnScheduleModal] = useState(false);
  const [ownScheduleData, setOwnScheduleData] = useState(null);

  // Add Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('VL');
  const [scheduleOption, setScheduleOption] = useState('');
  const [targetUserId, setTargetUserId] = useState(user?.id || '');
  const [adminDateMode, setAdminDateMode] = useState('single'); // 'single' | 'pick'
  const [adminSelectedDates, setAdminSelectedDates] = useState([]);
  const [adminMiniCalMonth, setAdminMiniCalMonth] = useState(new Date());
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
    } else if (location.state?.openRequestModal) {
      setShowScheduleModal(true);
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

    const computedTitle = eventType === 'WS' ? 'Work Schedule' : eventType === 'VL' ? 'Vacation Leave' : eventType;
    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    if (adminDateMode === 'single' || editingEventId) {
      // --- Single date / edit mode ---
      if (!eventDate) return;
      if (eventDate < todayStr) {
        addNotification({ type: 'warning', message: 'Cannot assign a schedule in outdated date.' });
        return;
      }
      setLoading(true);
      try {
        if (editingEventId) {
          await axios.put(`${API_BASE}/calendar.php`, {
            id: editingEventId,
            action: 'edit',
            user_id: targetUserId,
            title: computedTitle,
            description,
            event_date: eventDate,
            event_type: eventType,
            schedule_option: scheduleOption,
            status: 'approved',
            is_admin: true
          });
          addNotification({ type: 'success', message: 'Event updated successfully.' });
        } else {
          await axios.post(`${API_BASE}/calendar.php`, {
            user_id: isAdmin ? targetUserId : user.id,
            title: computedTitle,
            description,
            event_date: eventDate,
            event_type: eventType,
            schedule_option: scheduleOption,
            status: isAdmin ? 'approved' : 'pending'
          });
          addNotification({ type: 'success', message: isAdmin ? 'Event assigned successfully.' : 'Event requested successfully.' });
        }
        setTitle('');
        setDescription('');
        setEventDate('');
        setEventType('VL');
        setScheduleOption('');
        setTargetUserId(user.id);
        setEditingEventId(null);
        setAdminSelectedDates([]);
        setShowAddModal(false);
        fetchEvents();
      } catch (err) {
        console.error(err);
        addNotification({ type: 'error', message: editingEventId ? 'Failed to update event.' : 'Failed to save event.' });
      }
      setLoading(false);
    } else {
      // --- Multi-date pick mode ---
      if (adminSelectedDates.length === 0) {
        addNotification({ type: 'warning', message: 'Please select at least one date.' });
        return;
      }
      const pastDates = adminSelectedDates.filter(d => d < todayStr);
      if (pastDates.length > 0) {
        addNotification({ type: 'warning', message: 'Cannot request a schedule in outdated date.' });
        return;
      }
      setLoading(true);
      let createdCount = 0;
      for (const dateStr of adminSelectedDates) {
        try {
          await axios.post(`${API_BASE}/calendar.php`, {
            user_id: isAdmin ? targetUserId : user.id,
            title: computedTitle,
            description,
            event_date: dateStr,
            event_type: eventType,
            schedule_option: scheduleOption,
            status: isAdmin ? 'approved' : 'pending'
          });
          createdCount++;
        } catch (err) {
          console.error('Failed to create event for', dateStr, err);
        }
      }
      setLoading(false);
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventType('VL');
      setScheduleOption('');
      setTargetUserId(user.id);
      setAdminSelectedDates([]);
      setShowAddModal(false);
      if (createdCount > 0) {
        addNotification({ type: 'success', message: `${createdCount} event${createdCount > 1 ? 's' : ''} ${isAdmin ? 'assigned' : 'requested'} successfully.` });
        fetchEvents();
      } else {
        addNotification({ type: 'error', message: 'Failed to save events.' });
      }
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    // Build list of dates to submit
    let datesToSubmit = [];

    if (scheduleDateMode === 'range') {
      if (!scheduleStartDate || !scheduleEndDate) return;
      if (scheduleStartDate < todayStr) {
        addNotification({ type: 'warning', message: 'Cannot request a schedule in outdated date.' });
        return;
      }
      let currentDateObj = new Date(scheduleStartDate + 'T00:00:00');
      const endDateObj = new Date(scheduleEndDate + 'T00:00:00');
      while (currentDateObj <= endDateObj) {
        const yyyy = currentDateObj.getFullYear();
        const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDateObj.getDate()).padStart(2, '0');
        datesToSubmit.push(`${yyyy}-${mm}-${dd}`);
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }
    } else {
      // 'pick' mode
      if (selectedDates.length === 0) {
        addNotification({ type: 'warning', message: 'Please select at least one date.' });
        return;
      }
      const pastDates = selectedDates.filter(d => d < todayStr);
      if (pastDates.length > 0) {
        addNotification({ type: 'warning', message: 'Cannot request a schedule in outdated date.' });
        return;
      }
      datesToSubmit = [...selectedDates];
    }

    if (datesToSubmit.length === 0) {
      addNotification({ type: 'warning', message: 'Invalid date selection.' });
      return;
    }

    setLoading(true);
    let createdCount = 0;

    for (const dateStr of datesToSubmit) {
      try {
        await axios.post(`${API_BASE}/calendar.php`, {
          user_id: user.id,
          title: scheduleType === 'WS' ? 'Work Shift' : 'Vacation Leave',
          description: description || (scheduleType === 'WS' ? 'Requested working schedule' : 'Requested vacation leave'),
          event_date: dateStr,
          event_type: scheduleType,
          schedule_option: scheduleOption,
          status: 'pending'
        });
        createdCount++;
      } catch (err) {
        console.error('Failed to create schedule for', dateStr, err);
      }
    }

    setShowScheduleModal(false);
    setSelectedDates([]);
    setDescription('');
    setScheduleOption('');
    setLoading(false);

    if (createdCount > 0) {
      addNotification({
        type: 'success',
        message: `Submitted ${createdCount} schedule request${createdCount > 1 ? 's' : ''} for approval.`
      });
      fetchEvents();
    } else {
      addNotification({
        type: 'warning',
        message: `No schedules were created. Please check your selection.`
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
    const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    if (newRescheduleDate < todayStr) {
      addNotification({ type: 'warning', message: 'Cannot reschedule to a past date.' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put(`${API_BASE}/calendar.php`, {
        id: rescheduleData.id,
        action: 'edit',
        title: rescheduleMode === 'cancel' ? `[Cancel Request] ${rescheduleData.title}` : rescheduleTitle,
        description: rescheduleDesc,
        event_date: newRescheduleDate,
        event_type: rescheduleMode === 'cancel' ? 'Cancel' : rescheduleType,
        schedule_option: rescheduleMode === 'cancel' ? rescheduleData.schedule_option : rescheduleOption,
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
      setScheduleOption(evt.schedule_option || '');
      setTargetUserId(evt.user_id);
      setShowAddModal(true);
    } else if (!isAdmin) {
      if (String(evt.user_id) === String(user.id)) {
        setOwnScheduleData(evt);
        setShowOwnScheduleModal(true);
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
            <div className="legend-dropdown-container" style={{ position: 'relative' }}>
              <button className="action-btn huddle-btn" onClick={() => setShowLegend(!showLegend)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--card-bg)' }}>
                Legend <ChevronRight size={16} style={{ transform: showLegend ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showLegend && (
                <div className="legend-dropdown-menu glass" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', padding: '12px', borderRadius: '12px', zIndex: 100, minWidth: '220px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-color)' }}><span className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span> WS</div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-color)' }}><span className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span> VL</div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-color)' }}><span className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }}></span> Alternate on Sat/Sun</div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-color)' }}><span className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#9ca3af', display: 'inline-block' }}></span> Available on warehouse</div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-color)' }}><span className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span> Holiday</div>
                </div>
              )}
            </div>

            {!isAdmin ? (
              <>
                <button className="action-btn huddle-btn" onClick={() => setShowScheduleModal(true)}>
                  <Clock size={16} /> Request Schedule
                </button>
                <button className="action-btn" style={{ background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/leave-tracker')}>
                  <CalendarIcon size={16} /> Request Leave
                </button>
              </>
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
                <button className="action-btn" style={{ background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/leave-management')}>
                  <CalendarIcon size={16} /> Manage Leaves
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
                            className={`event-badge event-status-${item.status} event-type-${item.event_type} schedule-option-${item.schedule_option || 'none'} ${item.status === 'pending' ? 'pending' : ''}`}
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
                            className={`event-badge week-event-badge event-status-${item.status} event-type-${item.event_type} schedule-option-${item.schedule_option || 'none'} ${item.status === 'pending' ? 'pending' : ''}`}
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

                  {employees.map(emp => (
                    <tr key={emp.id} className="employee-row">
                      <td style={{ textAlign: 'left', paddingLeft: '16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.employee_id || emp.id}</div>
                      </td>
                      {weekCells.map((cell, idx) => {
                        const dayEvents = events.filter(e => {
                          if (!e.event_date) return false;
                          const cellDateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
                          const dateMatch = e.event_date.split(' ')[0] === cellDateStr;
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
                                    className={`event-badge event-status-${item.status} event-type-${item.event_type} schedule-option-${item.schedule_option || 'none'} ${item.status === 'pending' ? 'pending' : ''}`}
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
      {showAddModal && (() => {
        const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

        // Mini calendar helpers for admin pick mode
        const adminMiniYear = adminMiniCalMonth.getFullYear();
        const adminMiniMonthIdx = adminMiniCalMonth.getMonth();
        const adminMiniFirstDay = new Date(adminMiniYear, adminMiniMonthIdx, 1).getDay();
        const adminMiniDaysInMonth = new Date(adminMiniYear, adminMiniMonthIdx + 1, 0).getDate();
        const adminMiniDaysInPrev = new Date(adminMiniYear, adminMiniMonthIdx, 0).getDate();
        const adminMiniCells = [];
        for (let i = 0; i < adminMiniFirstDay; i++) {
          adminMiniCells.push({ d: adminMiniDaysInPrev - adminMiniFirstDay + i + 1, inMonth: false, dateStr: null });
        }
        for (let i = 1; i <= adminMiniDaysInMonth; i++) {
          const mm = String(adminMiniMonthIdx + 1).padStart(2, '0');
          const dd = String(i).padStart(2, '0');
          adminMiniCells.push({ d: i, inMonth: true, dateStr: `${adminMiniYear}-${mm}-${dd}` });
        }
        const adminMiniRemaining = 42 - adminMiniCells.length;
        for (let i = 1; i <= adminMiniRemaining; i++) {
          adminMiniCells.push({ d: i, inMonth: false, dateStr: null });
        }

        const toggleAdminDate = (dateStr) => {
          if (!dateStr || dateStr < todayStr) return;
          setAdminSelectedDates(prev =>
            prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
          );
        };

        const isPastDate = eventDate && eventDate < todayStr;
        const isEditMode = !!editingEventId;
        const isPickMode = !isEditMode && adminDateMode === 'pick';

        // Compact field styles
        const selStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%' };
        const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' };
        const labelStyle = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' };

        return (
          <div className="modal-overlay">
            <div className="clean-modal-content landscape" style={{ maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div className="clean-modal-header" style={{ padding: '14px 20px', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  {isAdmin ? (isEditMode ? '✏️ Edit Event' : '📋 New Event Registration') : '📅 Request Date'}
                </h3>
                <button className="clean-close-btn" onClick={() => { setShowAddModal(false); setEditingEventId(null); setAdminSelectedDates([]); }}><X size={18} /></button>
              </div>

              <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                  {/* LEFT COLUMN — Mini Calendar (only in pick mode) */}
                  {isPickMode && (
                    <div style={{ width: '290px', flexShrink: 0, borderRight: '1px solid var(--glass-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button type="button" className="mini-cal-nav-btn" onClick={() => setAdminMiniCalMonth(new Date(adminMiniYear, adminMiniMonthIdx - 1, 1))}>‹</button>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {adminMiniCalMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button type="button" className="mini-cal-nav-btn" onClick={() => setAdminMiniCalMonth(new Date(adminMiniYear, adminMiniMonthIdx + 1, 1))}>›</button>
                      </div>
                      <div className="mini-cal-grid" style={{ gap: '2px' }}>
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                          <div key={d} className="mini-cal-dow" style={{ fontSize: '0.65rem', padding: '2px 0' }}>{d}</div>
                        ))}
                        {adminMiniCells.map((cell, idx) => {
                          const isPast = cell.dateStr && cell.dateStr < todayStr;
                          const isSelected = cell.dateStr && adminSelectedDates.includes(cell.dateStr);
                          const isToday = cell.dateStr === todayStr;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`mini-cal-day compact-day ${!cell.inMonth ? 'other-month' : ''} ${isPast ? 'past-day' : ''} ${isSelected ? 'selected-day' : ''} ${isToday ? 'today-day' : ''}`}
                              onClick={() => toggleAdminDate(cell.dateStr)}
                              disabled={!cell.inMonth || isPast}
                              title={cell.dateStr || ''}
                            >
                              {cell.d}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {adminSelectedDates.length > 0 ? `${adminSelectedDates.length} date${adminSelectedDates.length > 1 ? 's' : ''} selected` : 'Click a date to select'}
                        </span>
                        {adminSelectedDates.length > 0 && (
                          <div className="chips-scroll" style={{ marginTop: '6px', maxHeight: '64px' }}>
                            {[...adminSelectedDates].sort().map(d => (
                              <span key={d} className="date-chip">
                                {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                <button type="button" className="chip-remove" onClick={() => setAdminSelectedDates(prev => prev.filter(x => x !== d))}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RIGHT COLUMN — Form Fields */}
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Mode toggle */}
                    {!isEditMode && (
                      <div className="date-mode-toggle">
                        <button type="button" className={`date-mode-btn ${adminDateMode === 'single' ? 'active' : ''}`} onClick={() => { setAdminDateMode('single'); setAdminSelectedDates([]); }}>
                          📅 Single Date
                        </button>
                        <button type="button" className={`date-mode-btn ${adminDateMode === 'pick' ? 'active' : ''}`} onClick={() => { setAdminDateMode('pick'); setAdminMiniCalMonth(new Date()); setEventDate(''); }}>
                          🗓️ Pick Multiple
                        </button>
                      </div>
                    )}

                    {/* Employee + Category */}
                    <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '12px' }}>
                      {isAdmin && (
                        <div>
                          <label style={labelStyle}>Employee</label>
                          <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={selStyle}>
                            <option value={user.id}>Me ({user.full_name || 'Admin'})</option>
                            {employees.filter(emp => String(emp.id) !== String(user.id)).map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label style={labelStyle}>Category</label>
                        <select value={eventType} onChange={e => setEventType(e.target.value)} style={selStyle}>
                          <option value="WS">Work Schedule</option>
                          <option value="VL">Vacation Leave</option>
                        </select>
                      </div>
                    </div>

                    {/* Date + Schedule Option (single/edit mode) */}
                    {!isPickMode && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={labelStyle}>Date</label>
                          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={todayStr} max="9999-12-31" required style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Schedule Option</label>
                          <select value={scheduleOption} onChange={e => setScheduleOption(e.target.value)} style={selStyle}>
                            <option value="">None</option>
                            <option value="alternate">Alternate Sat/Sun</option>
                            <option value="warehouse">Available at Warehouse</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Schedule Option for pick mode */}
                    {isPickMode && (
                      <div>
                        <label style={labelStyle}>Schedule Option</label>
                        <select value={scheduleOption} onChange={e => setScheduleOption(e.target.value)} style={selStyle}>
                          <option value="">None</option>
                          <option value="alternate">Alternate Sat/Sun</option>
                          <option value="warehouse">Available at Warehouse</option>
                        </select>
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label style={labelStyle}>Description (Optional)</label>
                      <textarea placeholder="Add a note..." value={description} onChange={e => setDescription(e.target.value)} rows="3" style={{ ...inputStyle, resize: 'none', lineHeight: '1.4' }} />
                    </div>

                    {/* Warnings */}
                    {isPastDate && !isPickMode && (
                      <div style={{ color: '#ef4444', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(239,68,68,0.08)', padding: '7px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        ⚠️ Cannot schedule events in the past.
                      </div>
                    )}

                  </div>
                </div>

                {/* Footer */}
                <div className="clean-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', flexShrink: 0, justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '7px 20px' }} onClick={() => { setShowAddModal(false); setEditingEventId(null); setAdminSelectedDates([]); }}>Cancel</button>
                  <button
                    type="submit"
                    className="schedule-submit-btn"
                    style={{ padding: '7px 20px', margin: 0 }}
                    disabled={loading || (!isPickMode && isPastDate) || (isPickMode && adminSelectedDates.length === 0)}
                  >
                    {loading ? 'Saving…'
                      : isAdmin
                        ? (isEditMode ? 'Update Event' : isPickMode && adminSelectedDates.length > 0 ? `Save ${adminSelectedDates.length} Event${adminSelectedDates.length > 1 ? 's' : ''}` : 'Save Event')
                        : (isPickMode && adminSelectedDates.length > 0 ? `Submit ${adminSelectedDates.length} Request${adminSelectedDates.length > 1 ? 's' : ''}` : 'Submit Request')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}


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
      {showScheduleModal && (() => {
        const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

        // Mini calendar helpers
        const miniYear = miniCalMonth.getFullYear();
        const miniMonthIdx = miniCalMonth.getMonth();
        const miniFirstDay = new Date(miniYear, miniMonthIdx, 1).getDay();
        const miniDaysInMonth = new Date(miniYear, miniMonthIdx + 1, 0).getDate();
        const miniDaysInPrev = new Date(miniYear, miniMonthIdx, 0).getDate();
        const miniCells = [];
        for (let i = 0; i < miniFirstDay; i++) {
          miniCells.push({ d: miniDaysInPrev - miniFirstDay + i + 1, inMonth: false, dateStr: null });
        }
        for (let i = 1; i <= miniDaysInMonth; i++) {
          const mm = String(miniMonthIdx + 1).padStart(2, '0');
          const dd = String(i).padStart(2, '0');
          miniCells.push({ d: i, inMonth: true, dateStr: `${miniYear}-${mm}-${dd}` });
        }
        const remaining = 42 - miniCells.length;
        for (let i = 1; i <= remaining; i++) {
          miniCells.push({ d: i, inMonth: false, dateStr: null });
        }

        const toggleDate = (dateStr) => {
          if (!dateStr || dateStr < todayStr) return;
          setSelectedDates(prev =>
            prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
          );
        };

        const hasPastSelection = scheduleDateMode === 'range'
          ? (scheduleStartDate && scheduleStartDate < todayStr) || (scheduleEndDate && scheduleEndDate < todayStr)
          : false;

        return (
          <div className="modal-overlay">
            <div className="clean-modal-content landscape" style={{ maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="clean-modal-header" style={{ padding: '14px 20px', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📋 Request Schedule</h3>
                <button className="clean-close-btn" onClick={() => { setShowScheduleModal(false); setSelectedDates([]); }}><X size={18} /></button>
              </div>
              <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                  {/* LEFT COLUMN — Mini Calendar (only in pick mode) */}
                  {scheduleDateMode === 'pick' && (
                    <div style={{ width: '290px', flexShrink: 0, borderRight: '1px solid var(--glass-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button type="button" className="mini-cal-nav-btn" onClick={() => setMiniCalMonth(new Date(miniYear, miniMonthIdx - 1, 1))}>
                          ‹
                        </button>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {miniCalMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button type="button" className="mini-cal-nav-btn" onClick={() => setMiniCalMonth(new Date(miniYear, miniMonthIdx + 1, 1))}>
                          ›
                        </button>
                      </div>
                      <div className="mini-cal-grid" style={{ gap: '2px' }}>
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                          <div key={d} className="mini-cal-dow" style={{ fontSize: '0.65rem', padding: '2px 0' }}>{d}</div>
                        ))}
                        {miniCells.map((cell, idx) => {
                          const isPast = cell.dateStr && cell.dateStr < todayStr;
                          const isSelected = cell.dateStr && selectedDates.includes(cell.dateStr);
                          const isToday = cell.dateStr === todayStr;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`mini-cal-day compact-day ${!cell.inMonth ? 'other-month' : ''} ${isPast ? 'past-day' : ''} ${isSelected ? 'selected-day' : ''} ${isToday ? 'today-day' : ''}`}
                              onClick={() => toggleDate(cell.dateStr)}
                              disabled={!cell.inMonth || isPast}
                              title={cell.dateStr || ''}
                            >
                              {cell.d}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {selectedDates.length > 0 ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected` : 'Click a date to select'}
                        </span>
                        {selectedDates.length > 0 && (
                          <div className="chips-scroll" style={{ marginTop: '6px', maxHeight: '64px' }}>
                            {[...selectedDates].sort().map(d => (
                              <span key={d} className="date-chip">
                                {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                <button type="button" className="chip-remove" onClick={() => setSelectedDates(prev => prev.filter(x => x !== d))}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RIGHT COLUMN — Form Fields */}
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Date Mode Toggle */}
                    <div className="date-mode-toggle">
                      <button
                        type="button"
                        className={`date-mode-btn ${scheduleDateMode === 'range' ? 'active' : ''}`}
                        onClick={() => setScheduleDateMode('range')}
                      >
                        📅 Date Range
                      </button>
                      <button
                        type="button"
                        className={`date-mode-btn ${scheduleDateMode === 'pick' ? 'active' : ''}`}
                        onClick={() => { setScheduleDateMode('pick'); setMiniCalMonth(new Date()); }}
                      >
                        🗓️ Pick Dates
                      </button>
                    </div>

                    {/* Schedule Type */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Schedule Type</label>
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%' }}
                      >
                        <option value="WS">Work Shift</option>
                        <option value="VL">Vacation Leave</option>
                      </select>
                    </div>

                    {/* Date Range Mode */}
                    {scheduleDateMode === 'range' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Start Date</label>
                          <input
                            type="date"
                            value={scheduleStartDate}
                            onChange={(e) => setScheduleStartDate(e.target.value)}
                            min={todayStr}
                            max="9999-12-31"
                            required
                            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>End Date</label>
                          <input
                            type="date"
                            value={scheduleEndDate}
                            onChange={(e) => setScheduleEndDate(e.target.value)}
                            min={scheduleStartDate || todayStr}
                            max="9999-12-31"
                            required
                            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Schedule Option */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Schedule Option</label>
                      <select
                        value={scheduleOption}
                        onChange={(e) => setScheduleOption(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%' }}
                      >
                        <option value="">None</option>
                        <option value="alternate">Alternate Sat/Sun</option>
                        <option value="warehouse">Available at Warehouse</option>
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Description (Optional)</label>
                      <textarea
                        placeholder="Add a note..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', resize: 'none', lineHeight: '1.4' }}
                      />
                    </div>

                    {/* Warnings */}
                    {hasPastSelection && (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '8px' }}>
                        ⚠️ Past dates cannot be requested.
                      </div>
                    )}

                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="clean-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '10px', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.02)' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => { setShowScheduleModal(false); setSelectedDates([]); }}>Cancel</button>
                  <button
                    type="submit"
                    className="schedule-submit-btn"
                    style={{ margin: 0, padding: '8px 24px', fontSize: '0.9rem', minWidth: '120px' }}
                    disabled={loading || hasPastSelection || (scheduleDateMode === 'pick' && selectedDates.length === 0)}
                  >
                    {loading ? 'Submitting…' : `Submit${scheduleDateMode === 'pick' && selectedDates.length > 0 ? ` (${selectedDates.length})` : ''}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Own Schedule Details Modal */}
      {showOwnScheduleModal && ownScheduleData && (
        <div className="modal-overlay">
          <div className="schedule-modal-content">
            <div className="modal-header">
              <h3>Schedule Details</h3>
              <button className="close-btn" onClick={() => setShowOwnScheduleModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0', fontSize: '0.95rem' }}>
              <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(ownScheduleData.event_date.split(' ')[0] + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
              <p style={{ margin: 0 }}><strong>Type:</strong> {ownScheduleData.event_type === 'WS' ? 'Work Shift (WS)' : ownScheduleData.event_type}</p>
              <p style={{ margin: 0 }}><strong>Schedule Option:</strong> {ownScheduleData.schedule_option || 'None'}</p>
              <p style={{ margin: 0 }}><strong>Title:</strong> {ownScheduleData.title}</p>
              {ownScheduleData.description && <p style={{ margin: 0 }}><strong>Description:</strong> {ownScheduleData.description}</p>}
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>Status:</strong>
                <span className={`status-badge status-${ownScheduleData.status}`}>{ownScheduleData.status}</span>
              </p>
            </div>

            {ownScheduleData.event_date.split(' ')[0] >= new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button
                  className="schedule-submit-btn"
                  style={{ flex: 1, margin: 0, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  onClick={() => {
                    setShowOwnScheduleModal(false);
                    setRescheduleMode('cancel');
                    setRescheduleData(ownScheduleData);
                    setNewRescheduleDate(ownScheduleData.event_date.split(' ')[0]);
                    setRescheduleDesc('');
                    setShowRescheduleModal(true);
                  }}
                >
                  <X size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                  Cancel Schedule
                </button>
                <button
                  className="schedule-submit-btn"
                  style={{ flex: 1, margin: 0 }}
                  onClick={() => {
                    setShowOwnScheduleModal(false);
                    setRescheduleMode('reschedule');
                    setRescheduleData(ownScheduleData);
                    setNewRescheduleDate(ownScheduleData.event_date.split(' ')[0]);
                    setRescheduleTitle(ownScheduleData.title);
                    setRescheduleDesc(ownScheduleData.description || '');
                    setRescheduleType(ownScheduleData.event_type);
                    setRescheduleOption(ownScheduleData.schedule_option || '');
                    setShowRescheduleModal(true);
                  }}
                >
                  <CalendarIcon size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                  Reschedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="clean-modal-content" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="clean-modal-header" style={{ padding: '14px 20px', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{rescheduleMode === 'cancel' ? 'Cancel Schedule Request' : 'Reschedule Request'}</h3>
              <button className="clean-close-btn" onClick={() => setShowRescheduleModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: rescheduleMode === 'cancel' ? '1fr' : '1fr 1fr', gap: '20px', padding: '16px' }}>
                
                {/* Left Column (Only for Reschedule) */}
                {rescheduleMode === 'reschedule' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Title</label>
                      <input type="text" value={rescheduleTitle} onChange={e => setRescheduleTitle(e.target.value)} required style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Type</label>
                        <select value={rescheduleType} onChange={e => setRescheduleType(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}>
                          <option value="WS">Work Shift (WS)</option>
                          <option value="VL">Vacation Leave (VL)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Schedule Option</label>
                        <select value={rescheduleOption} onChange={e => setRescheduleOption(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}>
                          <option value="">None</option>
                          <option value="alternate">Alternate on Sat/Sun</option>
                          <option value="warehouse">Available at warehouse</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>New Date</label>
                      <input
                        type="date"
                        value={newRescheduleDate}
                        onChange={e => setNewRescheduleDate(e.target.value)}
                        min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                        max="9999-12-31"
                        required
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}

                {/* Right Column / Full Width (Cancel/Description) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
                  {rescheduleMode === 'cancel' && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <p style={{ margin: 0, color: 'var(--text-main)' }}>You are requesting to cancel the schedule on <strong>{new Date(newRescheduleDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>
                    </div>
                  )}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Reason / Description {rescheduleMode === 'cancel' && <span style={{ color: '#ef4444' }}>*</span>}</label>
                    <textarea value={rescheduleDesc} onChange={e => setRescheduleDesc(e.target.value)} required={rescheduleMode === 'cancel'} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', resize: 'none', flex: 1, minHeight: rescheduleMode === 'cancel' ? '120px' : '90px', lineHeight: '1.4' }} />
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '0 16px 16px' }}>
                {rescheduleMode === 'reschedule' && newRescheduleDate && newRescheduleDate < new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px' }}>
                    ⚠️ Cannot reschedule to a past date.
                  </div>
                )}
              </div>
              
              <div className="clean-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '10px', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.02)' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setShowRescheduleModal(false)}>Close</button>
                <button type="submit" className="schedule-submit-btn" style={{ margin: 0, padding: '8px 24px', fontSize: '0.9rem', minWidth: '120px' }} disabled={loading || (rescheduleMode === 'reschedule' && newRescheduleDate && newRescheduleDate < new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0])}>
                  {rescheduleMode === 'cancel' ? 'Submit Cancellation' : 'Submit Reschedule'}
                </button>
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
