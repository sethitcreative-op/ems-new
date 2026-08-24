import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, CheckCircle, Clock, Filter, Settings, Calendar as CalendarIcon, ChevronDown, CalendarDays, Users, ListFilter, Edit, Trash2, Plus, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './DtrPage.css';
import API_BASE from '../../config/api';
import CustomWeekPicker from '../../components/common/CustomWeekPicker';

const ActiveTimer = ({ activeShift }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let interval;
    if (activeShift && activeShift.am_in) {
      const calculateElapsed = () => {
        const nowString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        const now = new Date(nowString);
        const amInStr = activeShift.am_in;
        const recordDate = activeShift.date;
        let amInDate;

        if (amInStr.includes(' ')) {
          amInDate = new Date(amInStr.replace(/-/g, '/'));
        } else {
          amInDate = new Date(`${recordDate} ${amInStr}`.replace(/-/g, '/'));
        }

        const diffInSeconds = Math.floor((now - amInDate) / 1000);
        return diffInSeconds > 0 ? diffInSeconds : 0;
      };

      setElapsedSeconds(calculateElapsed());
      interval = setInterval(() => {
        setElapsedSeconds(calculateElapsed());
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const formatElapsedTime = (totalSeconds) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.2rem', color: 'var(--primary)' }}>
      {formatElapsedTime(elapsedSeconds)}
    </span>
  );
};

const MultiSelectDropdown = ({ options, selected, onChange, className = "premium-input" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value) => {
    if (value === 'all') {
      onChange(['all']);
    } else {
      let newSelected = selected.includes('all') ? [] : [...selected];
      if (newSelected.includes(value)) {
        newSelected = newSelected.filter(id => id !== value);
      } else {
        newSelected.push(value);
      }
      if (newSelected.length === 0 || newSelected.length === options.length) {
        newSelected = ['all'];
      }
      onChange(newSelected);
    }
  };

  const getDisplayText = () => {
    if (selected.includes('all')) return 'All Employees';
    if (selected.length === 1) {
      const opt = options.find(o => String(o.id) === selected[0]);
      return opt ? opt.full_name : '1 Selected';
    }
    return `${selected.length} Selected`;
  };

  return (
    <div className="multi-select-dropdown" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className={className}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', background: 'var(--bg-surface)' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayText()}</span>
        <ChevronDown size={16} style={{ flexShrink: 0, marginLeft: '8px', opacity: 0.7 }} />
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface, #fff)', border: '1px solid var(--glass-border, #e2e8f0)', borderRadius: '8px', marginTop: '4px', zIndex: 999, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <div
            style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border, #e2e8f0)' }}
            onClick={() => toggleOption('all')}
          >
            <input type="checkbox" checked={selected.includes('all')} readOnly style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
            <span style={{ color: 'var(--text-main, #000)', fontSize: '0.9rem', fontWeight: 600 }}>All Employees</span>
          </div>
          {options.map(opt => (
            <div
              key={opt.id}
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
              onClick={() => toggleOption(String(opt.id))}
            >
              <input type="checkbox" checked={selected.includes('all') || selected.includes(String(opt.id))} readOnly style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
              <span style={{ color: 'var(--text-main, #000)', fontSize: '0.9rem' }}>{opt.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DtrPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [events, setEvents] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const { addNotification } = useNotification();

  // Helper: get US date as YYYY-MM-DD to match the server time
  const getLocalDateStr = (date = new Date()) => {
    const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
    const usDate = new Intl.DateTimeFormat('en-US', options).format(date);
    const [month, day, year] = usDate.split('/');
    return `${year}-${month}-${day}`;
  };

  // Helper: format DATETIME or HH:MM:SS string to 12-hour format
  const formatTime = (datetimeStr, recordDate) => {
    if (!datetimeStr) return '--:--';
    // Split by space to get time part if it's a datetime
    const [datePart, timePart] = datetimeStr.includes(' ') ? datetimeStr.split(' ') : [null, datetimeStr];
    const [hours, minutes] = timePart.split(':');
    const h = parseInt(hours, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    let result = `${String(h12).padStart(2, '0')}:${minutes} ${period}`;
    if (datePart && recordDate && datePart !== recordDate) {
      result += " (+1d)";
    }
    return result;
  };

  // Helper: format decimal hours (e.g. 8.5) to "8h 30m"
  const formatHoursDuration = (decimalHours) => {
    const val = parseFloat(decimalHours);
    if (!val || isNaN(val) || val === 0) return '';
    const totalMinutes = Math.round(val * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return '';
  };

  // Advanced Export State (Admin Only)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyExportUsers, setMonthlyExportUsers] = useState(['all']);
  const [weeklyExportUsers, setWeeklyExportUsers] = useState(['all']);
  const [customExportUsers, setCustomExportUsers] = useState(['all']);
  const [tableFilterUser, setTableFilterUser] = useState('all');
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [pdfColumns, setPdfColumns] = useState({
    name: true,
    amIn: true,
    pmOut: true,
    totalHrs: true,
    rate: true,
    earnings: true
  });

  const [showExportCenter, setShowExportCenter] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exportWeekStr, setExportWeekStr] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = (dayOfWeek + 7 - 4) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - diff);
    return getLocalDateStr(start);
  });

  // Dynamic Date Filter State
  const [dtrFilterType, setDtrFilterType] = useState('week'); // 'month', 'week', 'day'
  const [dtrFilterValue, setDtrFilterValue] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = (dayOfWeek + 7 - 4) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - diff);
    return getLocalDateStr(start);
  });

  // Admin Edit Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    mode: 'edit', // 'edit' or 'add'
    recordId: null,
    targetUserId: null,
    dateStr: '',
    amIn: '',
    pmOut: '',
    status: 'Present'
  });

  const handleFilterTypeChange = (e) => {
    const type = e.target.value;
    setDtrFilterType(type);
    const today = new Date();
    if (type === 'month') {
      setDtrFilterValue(today.toISOString().slice(0, 7));
    } else if (type === 'day') {
      setDtrFilterValue(getLocalDateStr(today));
    } else if (type === 'week') {
      const dayOfWeek = today.getDay();
      const diff = (dayOfWeek + 7 - 4) % 7;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      setDtrFilterValue(getLocalDateStr(start));
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    if (dtrFilterType === 'month') {
      setDtrFilterValue(today.toISOString().slice(0, 7));
    } else if (dtrFilterType === 'day') {
      setDtrFilterValue(getLocalDateStr(today));
    } else if (dtrFilterType === 'week') {
      const dayOfWeek = today.getDay();
      const diff = (dayOfWeek + 7 - 4) % 7;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      setDtrFilterValue(getLocalDateStr(start));
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchEvents();
    fetchLeaveRequests();
    if (isAdmin) fetchEmployees();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/calendar.php?role=${user.role}&user_id=${user.id}`);
      if (res.data.status === 'success') {
        setEvents(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      // Fetch approved leave requests — admin sees all, user sees their own
      const url = isAdmin
        ? `${API_BASE}/leaves.php?action=requests&role=admin`
        : `${API_BASE}/leaves.php?action=requests&role=user&user_id=${user.id}`;
      const res = await axios.get(url);
      if (res.data.status === 'success') {
        // Only keep approved leave requests
        const approved = res.data.data.filter(lr => lr.status === 'approved');
        setLeaveRequests(approved);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    }
  };

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

  const fetchRecords = async () => {
    try {
      const url = isAdmin
        ? `${API_BASE}/dtr.php?action=get_records`
        : `${API_BASE}/dtr.php?action=get_records&user_id=${user.id}`;
      const res = await axios.get(url);
      if (res.data.status === 'success') {
        setRecords(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper: get local time as HH:MM:SS string aligned with the system clock
  const getLocalTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const openEditModal = (record, dayObj, targetUserId) => {
    if (record) {
      setEditModal({
        isOpen: true,
        mode: 'edit',
        recordId: record.id,
        targetUserId: record.user_id,
        dateStr: record.date,
        amIn: record.am_in ? record.am_in.split(' ')[1] : '',
        pmOut: record.pm_out ? record.pm_out.split(' ')[1] : '',
        status: record.status || 'Present'
      });
    } else {
      setEditModal({
        isOpen: true,
        mode: 'add',
        recordId: null,
        targetUserId: targetUserId,
        dateStr: dayObj.dateStr,
        amIn: '',
        pmOut: '',
        status: 'Present'
      });
    }
  };

  const handleSaveModal = async () => {
    try {
      const amInDate = editModal.amIn ? `${editModal.dateStr} ${editModal.amIn}` : '';
      const pmOutDate = editModal.pmOut ? `${editModal.dateStr} ${editModal.pmOut}` : '';

      const payload = {
        action: editModal.mode === 'edit' ? 'edit_record' : 'add_record',
        record_id: editModal.recordId,
        user_id: editModal.targetUserId,
        date: editModal.dateStr,
        am_in: amInDate,
        pm_out: pmOutDate,
        status: editModal.status
      };

      const res = await axios.post(`${API_BASE}/dtr.php`, payload);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: res.data.message });
        setEditModal({ ...editModal, isOpen: false });
        // Re-fetch all data sources so the DTR stays in sync with latest state
        fetchRecords();
        fetchEvents();
        fetchLeaveRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to save record.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Network error while saving record.' });
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm("Are you sure you want to delete this DTR record?")) return;
    try {
      const res = await axios.get(`${API_BASE}/dtr.php?action=delete_record&record_id=${recordId}`);
      if (res.data.status === 'success') {
        addNotification({ type: 'success', message: res.data.message });
        // Re-fetch all data sources so the DTR stays in sync with latest state
        fetchRecords();
        fetchEvents();
        fetchLeaveRequests();
      } else {
        addNotification({ type: 'error', message: res.data.message || 'Failed to delete record.' });
      }
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', message: 'Network error while deleting record.' });
    }
  };


  const handleClockIn = async () => {
    setLoading(true);
    try {
      const timeStr = getLocalTimeStr();
      await axios.post(`${API_BASE}/dtr.php`, {
        action: 'clock_in',
        user_id: user.id,
        client_time: timeStr,
        client_date: getLocalDateStr()
      });
      addNotification({ type: 'success', message: `AM IN logged successfully at ${timeStr}` });
      // Re-fetch all data sources so the DTR stays in sync with latest state
      fetchRecords();
      fetchEvents();
      fetchLeaveRequests();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const timeStr = getLocalTimeStr();
      await axios.post(`${API_BASE}/dtr.php`, {
        action: 'clock_out',
        user_id: user.id,
        client_time: timeStr,
        client_date: getLocalDateStr()
      });
      addNotification({ type: 'success', message: `PM OUT logged successfully at ${timeStr}` });
      // Re-fetch all data sources so the DTR stays in sync with latest state
      fetchRecords();
      fetchEvents();
      fetchLeaveRequests();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // --- FILTERED DATE LOGIC ---
  const filteredDays = React.useMemo(() => {
    const days = [];
    if (!dtrFilterValue) return days;

    if (dtrFilterType === 'month') {
      const [year, month] = dtrFilterValue.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ dateStr, dayNum: day });
      }
    } else if (dtrFilterType === 'week') {
      const [year, month, day] = dtrFilterValue.split('-').map(Number);
      if (year && month && day) {
        const start = new Date(year, month - 1, day);
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dt = String(d.getDate()).padStart(2, '0');
          days.push({ dateStr: `${y}-${m}-${dt}`, dayNum: d.getDate() });
        }
      }
    } else if (dtrFilterType === 'day') {
      const parts = dtrFilterValue.split('-');
      if (parts.length === 3) {
        days.push({ dateStr: dtrFilterValue, dayNum: parseInt(parts[2], 10) });
      }
    }
    return days;
  }, [dtrFilterType, dtrFilterValue]);

  // Filter records for the main table view
  const tableRecords = tableFilterUser === 'all'
    ? records
    : records.filter(r => String(r.user_id) === String(tableFilterUser));

  let displayUser = user;
  if (isAdmin && tableFilterUser !== 'all') {
    displayUser = employees.find(e => String(e.id) === String(tableFilterUser)) || user;
  } else if (isAdmin && tableFilterUser === 'all') {
    displayUser = null;
  }

  // Calculate All Employees Summary (if displayUser is null)
  const allEmployeesSummary = React.useMemo(() => {
    if (displayUser || !isAdmin) return [];

    // Group records by user_id for the selectedMonth
    const summaryMap = {};
    employees.forEach(emp => {
      summaryMap[emp.id] = {
        ...emp,
        daysPresent: 0,
        totalHours: 0,
        totalEarnings: 0
      };
    });

    tableRecords.forEach(record => {
      // Only process records for the filtered dates
      if (record.date && filteredDays.some(d => d.dateStr === record.date)) {
        const uid = record.user_id;
        if (summaryMap[uid]) {
          if (record.am_in) {
            summaryMap[uid].daysPresent += 1;
          }
          const hrs = parseFloat(record.total_hours) || 0;
          summaryMap[uid].totalHours += hrs;
          const rate = parseFloat(record.hourly_rate) || parseFloat(summaryMap[uid].hourly_rate) || 0;
          summaryMap[uid].totalEarnings += (hrs * rate);
        }
      }
    });

    return Object.values(summaryMap);
  }, [displayUser, isAdmin, tableRecords, employees, filteredDays]);

  // Clock Restrictions (Check for Active Shift and Today's Record)
  const todayDateStr = getLocalDateStr();
  const myRecords = records.filter(r => String(r.user_id) === String(user.id));
  const myActiveShift = myRecords.find(r => r.am_in && !r.pm_out && r.date === todayDateStr);
  const myTodayRecord = myRecords.find(r => r.date === todayDateStr);

  const displayActiveShift = tableRecords.find(r => r.am_in && !r.pm_out && r.date === todayDateStr);
  const displayTodayRecord = tableRecords.find(r => r.date === todayDateStr);

  const isAmInDisabled = loading || !!myActiveShift || !!myTodayRecord;
  const isPmOutDisabled = loading || !myActiveShift;

  // --- ADMIN EXPORT LOGIC ---
  const handlePresetExport = (type) => {
    const today = new Date();
    let start = '';
    let end = getLocalDateStr(today);

    if (type === 'weekly') {
      const [year, month, day] = exportWeekStr.split('-').map(Number);
      if (year && month && day) {
        const startObj = new Date(year, month - 1, day);
        start = getLocalDateStr(startObj);
        const endObj = new Date(startObj);
        endObj.setDate(startObj.getDate() + 6);
        end = getLocalDateStr(endObj);
      }
    } else if (type === 'monthly') {
      const [year, month] = exportMonth.split('-').map(Number);
      start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (type === 'yearly') {
      const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      start = getLocalDateStr(lastYear);
    }

    setStartDate(start);
    setEndDate(end);

    let usersToExport = customExportUsers;
    if (type === 'weekly') usersToExport = weeklyExportUsers;
    else if (type === 'monthly') usersToExport = monthlyExportUsers;

    setTimeout(() => {
      exportPDF(start, end, type, usersToExport);
    }, 100);
  };

  const exportWeeklySchedulePDF = (startStr, endStr, usersToExport) => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Weekly Payroll Report", 148.5, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);

    const formatMMDDYYYY = (dateStr) => {
      if (!dateStr) return 'All Time';
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
    };
    const cycleStr = (startStr && endStr) ? `${formatMMDDYYYY(startStr)} to ${formatMMDDYYYY(endStr)}` : "All Records";
    doc.text(`Cycle: ${cycleStr}`, 148.5, 28, { align: "center" });

    // Filter records by date range and users
    let currentRecords = [...records];
    if (!usersToExport.includes('all')) {
      currentRecords = currentRecords.filter(r => usersToExport.includes(String(r.user_id)));
    }
    if (startStr) currentRecords = currentRecords.filter(r => r.date >= startStr);
    if (endStr) currentRecords = currentRecords.filter(r => r.date <= endStr);

    // Group by employee
    const grouped = {};
    let emps = employees;
    if (!usersToExport.includes('all')) {
      emps = employees.filter(e => usersToExport.includes(String(e.id)));
    }

    emps.forEach(emp => {
      grouped[emp.id] = {
        user_id: emp.id,
        full_name: emp.full_name,
        hourly_rate: emp.hourly_rate,
        total_hours: 0,
      };
    });

    currentRecords.forEach(r => {
      const uid = r.user_id;
      if (grouped[uid] && r.status !== 'Absent') {
        grouped[uid].total_hours += parseFloat(r.total_hours || 0);
      }
    });

    const tableColumn = ["NAME", "TOTAL HRS", "TOTAL RATE", "EARNINGS"];

    let grandTotalHrs = 0;
    let grandTotalEarnings = 0;

    const tableRows = Object.values(grouped).map(record => {
      const hrs = parseFloat(record.total_hours || 0);
      const rate = parseFloat(record.hourly_rate || 0);
      const earnings = hrs * rate;
      grandTotalHrs += hrs;
      grandTotalEarnings += earnings;
      return [
        record.full_name,
        hrs > 0 ? formatHoursDuration(hrs) : '0h',
        `$${rate.toFixed(2)}`,
        `$${earnings.toFixed(2)}`
      ];
    });

    // Grand total row
    tableRows.push([
      "GRAND TOTAL",
      formatHoursDuration(grandTotalHrs),
      "",
      `$${grandTotalEarnings.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [200, 240, 210], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0], halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, fontStyle: 'bold', lineWidth: 0.5, lineColor: [0, 0, 0] },
      didParseCell: function (data) {
        if (data.row.raw[0] === 'GRAND TOTAL') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [200, 240, 210];
        }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`, 280, 200, { align: 'right' });
    }

    doc.save(`Weekly Payroll Summary Report.pdf`);
  };

  const exportPDF = (customStart = startDate, customEnd = endDate, exportType = 'custom', usersToExport = customExportUsers) => {
    if (exportType === 'weekly') {
      exportWeeklySchedulePDF(customStart, customEnd, usersToExport);
      return;
    }

    let currentRecords = records;

    // 1. Filter by User
    if (!usersToExport.includes('all')) {
      currentRecords = currentRecords.filter(r => usersToExport.includes(String(r.user_id)));
    }

    // 2. Filter by Date Range
    if (customStart) currentRecords = currentRecords.filter(r => r.date >= customStart);
    if (customEnd) currentRecords = currentRecords.filter(r => r.date <= customEnd);

    // 3. Sort Records by Date (ascending)
    currentRecords.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    // Center for landscape A4 is 148.5 (width is 297)
    doc.text("Payroll Report", 148.5, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);

    const formatMMDDYYYY = (dateStr) => {
      if (!dateStr) return 'All Time';
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
    };
    const cycleStr = (customStart && customEnd) ? `${formatMMDDYYYY(customStart)} to ${formatMMDDYYYY(customEnd)}` : "All Records";
    doc.text(`Cycle: ${cycleStr}`, 148.5, 28, { align: "center" });



    const tableColumn = [];
    const dataKeys = [];

    if (pdfColumns.name) { tableColumn.push("NAME"); dataKeys.push("full_name"); }
    if (pdfColumns.totalHrs) { tableColumn.push("TOTAL HRS"); dataKeys.push("total_hours"); }
    if (pdfColumns.rate) { tableColumn.push("TOTAL RATE"); dataKeys.push("hourly_rate"); }
    if (pdfColumns.earnings) { tableColumn.push("EARNINGS"); dataKeys.push("earnings"); }

    const grouped = {};
    currentRecords.forEach(r => {
      const uid = r.user_id;
      if (!grouped[uid]) {
        grouped[uid] = {
          ...r,
          total_hours: 0,
          status: 'Present',
          full_name: r.full_name || employees.find(e => e.id == uid)?.full_name || user.full_name
        };
      }
      if (r.status !== 'Absent') {
        grouped[uid].total_hours += parseFloat(r.total_hours || 0);
      }
    });
    let recordsToProcess = Object.values(grouped);

    let grandTotalHrs = 0;
    let grandTotalEarnings = 0;

    const tableRows = [];
    recordsToProcess.forEach(record => {
      const rowData = [];
      const recordHrs = parseFloat(record.total_hours || 0);
      const recordRate = parseFloat(record.hourly_rate || parseFloat(employees.find(e => e.id == record.user_id)?.hourly_rate) || 0);
      const recordEarnings = recordHrs * recordRate;

      if (record.status !== 'Absent') {
        grandTotalHrs += recordHrs;
        grandTotalEarnings += recordEarnings;
      }

      dataKeys.forEach(key => {
        const isSpecialStatus = ['Absent', 'Leave', 'Holiday', 'Rescheduled'].includes(record.status);
        const displayStatus = record.status ? record.status.toUpperCase() : '';

        if (key === 'date') rowData.push(record.date);
        if (key === 'status') rowData.push(displayStatus);
        if (key === 'full_name') rowData.push(record.full_name);
        if (key === 'am_in') rowData.push(isSpecialStatus ? '---' : (record.am_in ? formatTime(record.am_in, record.date) : '--:--'));
        if (key === 'pm_out') rowData.push(isSpecialStatus ? '---' : (record.pm_out ? formatTime(record.pm_out, record.date) : '--:--'));
        if (key === 'total_hours') rowData.push(isSpecialStatus ? '---' : (record.total_hours ? formatHoursDuration(record.total_hours) : '0h'));
        if (key === 'hourly_rate') rowData.push(isSpecialStatus ? '' : `$${recordRate.toFixed(2)}`);
        if (key === 'earnings') {
          rowData.push(isSpecialStatus ? '' : `$${recordEarnings.toFixed(2)}`);
        }
      });
      tableRows.push(rowData);
    });

    const grandTotalRow = [];
    dataKeys.forEach((key, index) => {
      if (index === 0) grandTotalRow.push("GRAND TOTAL");
      else if (key === 'total_hours') grandTotalRow.push(formatHoursDuration(grandTotalHrs));
      else if (key === 'hourly_rate' || key === 'earnings') grandTotalRow.push(`$${grandTotalEarnings.toFixed(2)}`);
      else grandTotalRow.push("");
    });
    tableRows.push(grandTotalRow);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [200, 240, 210], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0], halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, fontStyle: 'bold', lineWidth: 0.5, lineColor: [0, 0, 0] },
      didParseCell: function (data) {
        if (data.row.raw[0] === 'GRAND TOTAL') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [200, 240, 210];
        }
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`, 280, 200, { align: 'right' });
    }

    let fileName = 'Payroll Summary Report.pdf';
    if (exportType === 'monthly') fileName = 'Monthly Payroll Summary Report.pdf';
    else if (exportType === 'yearly') fileName = 'Yearly Payroll Summary Report.pdf';

    doc.save(fileName);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Time Record</h1>
          <p className="page-subtitle">Track attendance and manage schedules</p>
        </div>

        <div className="action-buttons">
          <button className="btn btn-success dtr-action-btn" onClick={handleClockIn} disabled={isAmInDisabled}>
            <CheckCircle size={20} /> AM IN
          </button>
          <button className="btn btn-danger dtr-action-btn" onClick={handleClockOut} disabled={isPmOutDisabled}>
            {myTodayRecord?.pm_out ? <CheckCircle size={20} /> : <Clock size={20} />} PM OUT
          </button>
        </div>
      </div>

      {/* Admin Export Panel */}
      {isAdmin && (
        <div className="premium-admin-card" style={{ padding: showExportCenter ? '24px 30px' : '16px 30px' }}>
          <div
            className="admin-card-header"
            style={{
              borderBottom: showExportCenter ? '1px solid var(--glass-border)' : 'none',
              marginBottom: showExportCenter ? '24px' : '0',
              paddingBottom: showExportCenter ? '16px' : '0',
              cursor: 'pointer'
            }}
            onClick={() => setShowExportCenter(!showExportCenter)}
          >
            <div className="admin-card-title">
              <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                <Filter size={20} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.5px' }}>Attendance and Payroll Management</h3>
                {showExportCenter && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Generate specific reports and payroll records.</p>}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setShowExportCenter(!showExportCenter); }}>
              <ChevronDown size={20} style={{ transform: showExportCenter ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
            </button>
          </div>

          {showExportCenter && (
            <div className="animate-fade-in">
              <div className="admin-controls-surface" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>

                {/* Monthly Export Row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Select Month</label>
                    <input
                      type="month"
                      className="premium-input"
                      value={exportMonth}
                      onChange={e => setExportMonth(e.target.value)}
                    />
                  </div>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Employee</label>
                    <MultiSelectDropdown
                      options={employees}
                      selected={monthlyExportUsers}
                      onChange={setMonthlyExportUsers}
                    />
                  </div>
                  <button className="btn btn-primary" style={{ padding: '10px 24px', flexShrink: 0 }} onClick={() => handlePresetExport('monthly')}>
                    <Download size={16} /> Monthly PDF Export
                  </button>
                </div>

                {/* Weekly Export Row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Select Week</label>
                    <CustomWeekPicker
                      value={exportWeekStr}
                      onChange={val => setExportWeekStr(val)}
                    />
                  </div>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Employee</label>
                    <MultiSelectDropdown
                      options={employees}
                      selected={weeklyExportUsers}
                      onChange={setWeeklyExportUsers}
                    />
                  </div>
                  <button className="btn btn-primary" style={{ padding: '10px 24px', flexShrink: 0 }} onClick={() => handlePresetExport('weekly')}>
                    <Download size={16} /> Weekly PDF Export
                  </button>
                </div>

                {/* Yearly Export Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Annual Report</label>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>Generate a comprehensive report for the entire previous year automatically.</p>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '10px 24px', flexShrink: 0 }} onClick={() => handlePresetExport('yearly')}>
                    <Download size={16} /> Yearly PDF Export
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setShowExportSettings(!showExportSettings)}>
                  <Settings size={18} /> {showExportSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                </button>
              </div>

              {showExportSettings && (
                <div className="advanced-settings-drawer">
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                      <label>Employee Target</label>
                      <MultiSelectDropdown
                        options={employees}
                        selected={customExportUsers}
                        onChange={setCustomExportUsers}
                      />
                    </div>
                    <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                      <label>Custom Start Date</label>
                      <input type="date" className="premium-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="premium-select-group" style={{ flex: 1, minWidth: '150px' }}>
                      <label>Custom End Date</label>
                      <input type="date" className="premium-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, minWidth: '200px' }}>
                      <button className="btn btn-primary" style={{ width: '100%', padding: '10px 16px', fontSize: '0.95rem' }} onClick={() => exportPDF()}>
                        <Download size={18} /> Export Custom PDF
                      </button>
                    </div>
                  </div>

                  <div className="export-settings" style={{ marginTop: 0, background: 'transparent', padding: 0, border: 'none' }}>
                    <h4 style={{ color: 'var(--text-main)', marginBottom: '16px' }}>Include Columns:</h4>
                    <div className="checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.name} onChange={e => setPdfColumns({ ...pdfColumns, name: e.target.checked })} /> Name
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.totalHrs} onChange={e => setPdfColumns({ ...pdfColumns, totalHrs: e.target.checked })} /> Total Hrs
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.rate} onChange={e => setPdfColumns({ ...pdfColumns, rate: e.target.checked })} /> Total Rate
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.amIn} onChange={e => setPdfColumns({ ...pdfColumns, amIn: e.target.checked })} /> AM In
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.pmOut} onChange={e => setPdfColumns({ ...pdfColumns, pmOut: e.target.checked })} /> PM Out
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={pdfColumns.earnings} onChange={e => setPdfColumns({ ...pdfColumns, earnings: e.target.checked })} /> Earnings
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Design: Details and Record */}
      <div className="dtr-new-design-container">
        <div className="premium-dtr-toolbar">

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="toolbar-group">
              <div className="toolbar-label">
                <ListFilter size={16} /> Filter By
              </div>
              <select
                className="toolbar-input"
                value={dtrFilterType}
                onChange={handleFilterTypeChange}
              >
                <option value="month">Specific Month</option>
                <option value="week">Specific Week</option>
                <option value="day">Specific Day</option>
              </select>
            </div>

            <div className="toolbar-group">
              <div className="toolbar-label">
                <CalendarDays size={16} /> Date
              </div>
              {dtrFilterType === 'week' ? (
                <CustomWeekPicker
                  value={dtrFilterValue}
                  onChange={val => setDtrFilterValue(val)}
                  className="toolbar-input"
                />
              ) : (
                <input
                  type={dtrFilterType === 'day' ? 'date' : 'month'}
                  className="toolbar-input"
                  value={dtrFilterValue}
                  onChange={e => setDtrFilterValue(e.target.value)}
                />
              )}
              <button
                className="toolbar-today-btn"
                onClick={handleGoToToday}
                title="Go to Today"
              >
                Today
              </button>
            </div>

            {isAdmin && (
              <>
                <div className="toolbar-divider"></div>
                <div className="toolbar-group">
                  <div className="toolbar-label">
                    <Users size={16} /> Employee
                  </div>
                  <select
                    className="toolbar-input"
                    style={{ minWidth: '180px' }}
                    value={tableFilterUser}
                    onChange={e => setTableFilterUser(e.target.value)}
                  >
                    <option value="all">All Employees</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

        </div>

        {displayUser ? (
          <>
            <div className="dtr-content-layout">
              <div className="dtr-sidebar">
                <div className="daily-attendance-summary">
                  <div className="summary-row">
                    <span className="summary-label">Work:</span>
                    <span className="summary-text">
                      {displayActiveShift ? (
                        <ActiveTimer activeShift={displayActiveShift} />
                      ) : displayTodayRecord?.pm_out ? (
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                          Shift Ended ({displayTodayRecord.total_hours ? formatHoursDuration(displayTodayRecord.total_hours) : ''})
                        </span>
                      ) : (
                        '---'
                      )}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Start Time:</span>
                    <span className="summary-value">
                      {displayTodayRecord?.am_in ? formatTime(displayTodayRecord.am_in, displayTodayRecord.date) : '--:--'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">End Time:</span>
                    <span className="summary-value">
                      {displayTodayRecord?.pm_out ? formatTime(displayTodayRecord.pm_out, displayTodayRecord.date) : '--:--'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Date: </span>
                    <span className="summary-value">{new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Status:</span>
                    <span className={`summary-value ${(() => {
                      if (displayTodayRecord && displayTodayRecord.status !== 'Absent') return 'status-present';

                      const targetId = displayUser ? displayUser.id : user.id;
                      const todayEvents = events.filter(e => e.event_date === todayDateStr && (e.user_id == targetId || e.user_id == 0));
                      const approvedHoliday = todayEvents.find(e => e.status === 'approved' && (e.event_type === 'Holiday' || e.event_type === 'HL'));
                      const approvedLeave = todayEvents.find(e => e.status === 'approved' && e.event_type === 'VL');

                      if (approvedHoliday || approvedLeave) return 'status-present'; // Just to not show red
                      return 'status-absent';
                    })()}`}>
                      {(() => {
                        if (displayTodayRecord && displayTodayRecord.status !== 'Absent') return displayTodayRecord.status.toLowerCase();

                        const targetId = displayUser ? displayUser.id : user.id;
                        const todayEvents = events.filter(e => e.event_date === todayDateStr && (e.user_id == targetId || e.user_id == 0));
                        const approvedHoliday = todayEvents.find(e => e.status === 'approved' && (e.event_type === 'Holiday' || e.event_type === 'HL'));
                        const approvedLeave = todayEvents.find(e => e.status === 'approved' && e.event_type === 'VL');

                        if (approvedHoliday) return 'holiday';
                        if (approvedLeave) return 'approved leave';
                        return 'absent';
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="dtr-main-panel">
                <div className="premium-employee-card">
                  <div className="employee-card-header">
                    <div className="employee-card-profile">
                      <div className="employee-info-main">
                        <h2 className="employee-name">{displayUser.full_name || 'N/A'}</h2>
                        <span className="employee-role">{displayUser.email || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="employee-id-badge">
                      Employee ID: {(displayUser.employee_id || displayUser.id) ? String(displayUser.employee_id || displayUser.id).padStart(3, '0') : 'N/A'}
                    </div>
                  </div>

                  <div className="employee-card-divider"></div>

                  <div className="employee-card-body">
                    <div className="employee-stat-group">
                      <span className="stat-label">Month</span>
                      <span className="stat-value">{new Date().toLocaleString('en-US', { month: 'short' })}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Day</span>
                      <span className="stat-value">{new Date().toLocaleString('en-US', { day: 'numeric' })}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Year</span>
                      <span className="stat-value">{new Date().toLocaleString('en-US', { year: 'numeric' })}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Sex</span>
                      <span className="stat-value">{displayUser.sex || 'N/A'}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Department</span>
                      <span className="stat-value">{displayUser.department || 'N/A'}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Position</span>
                      <span className="stat-value" style={{ textTransform: 'capitalize' }}>{displayUser.position || displayUser.role || 'N/A'}</span>
                    </div>
                    <div className="employee-stat-group">
                      <span className="stat-label">Employment Status</span>
                      <span className="stat-value status-active">Active</span>
                    </div>
                    {isAdmin && (
                      <div className="employee-stat-group">
                        <span className="stat-label">Rate/Hr</span>
                        <span className="stat-value" style={{ color: 'var(--success)' }}>${displayUser.hourly_rate || '0.00'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="dtr-table-section" style={{ marginTop: '24px' }}>
              <div className="dtr-table-title">ATTENDANCE RECORD</div>
              <div className="table-responsive">
                <table className="dtr-monthly-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '60px' }}>DAY</th>
                      <th style={{ minWidth: '100px', width: '120px' }}>AM</th>
                      <th style={{ minWidth: '100px', width: '120px' }}>PM</th>
                      <th rowSpan={2} style={{ width: '100px' }}>TOTAL HRS</th>
                      {isAdmin && <th rowSpan={2} style={{ width: '100px' }}>RATE/HR</th>}
                      {isAdmin && <th rowSpan={2} style={{ width: '120px' }}>EARNINGS</th>}
                      <th rowSpan={2} style={{ width: '120px' }}>STATUS</th>
                      {isAdmin && <th rowSpan={2} style={{ width: '100px', textAlign: 'center' }}>ACTIONS</th>}
                    </tr>
                    <tr>
                      <th style={{ minWidth: '100px', width: '120px' }}>IN</th>
                      <th style={{ minWidth: '100px', width: '120px' }}>OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let grandTotalHrs = 0;
                      let grandTotalEarnings = 0;

                      return (
                        <>
                          {filteredDays.map(dayObj => {
                            const dailyRecords = tableRecords.filter(r => r.date === dayObj.dateStr);
                            const row = dailyRecords[0];
                            const targetUserId = displayUser.id;

                            // Check if this date is covered by an approved leave request.
                            // Only apply virtual leave status when there is NO actual DTR row for this day,
                            // so that admin edits (which create/update a row) always take precedence.
                            const approvedLeaveForDay = leaveRequests.find(lr =>
                              String(lr.user_id) === String(targetUserId) &&
                              dayObj.dateStr >= lr.start_date &&
                              dayObj.dateStr <= lr.end_date
                            );

                            let virtualStatus = '';
                            if (!row) {
                              // If covered by an approved leave request and no DTR row exists, show VACATION LEAVE
                              if (approvedLeaveForDay) {
                                virtualStatus = 'VACATION LEAVE';
                              } else {
                                const dailyEvents = events.filter(e => e.event_date === dayObj.dateStr && (e.user_id == targetUserId || e.user_id == 0));
                                const pendingReschedule = dailyEvents.find(e => e.status === 'pending' && e.reschedule_for_event_id);
                                const pendingNew = dailyEvents.find(e => e.status === 'pending' && !e.reschedule_for_event_id);

                                // Prioritize holiday over leave for display if both exist, or just use the first approved
                                const approved = dailyEvents.find(e => e.status === 'approved' && (e.event_type === 'Holiday' || e.event_type === 'HL'))
                                  || dailyEvents.find(e => e.status === 'approved');

                                if (approved) {
                                  if (approved.event_type === 'VL') virtualStatus = 'APPROVED LEAVE';
                                  else if (approved.event_type === 'HL' || approved.event_type === 'Holiday') virtualStatus = 'HOLIDAY';
                                  else virtualStatus = 'SCHEDULED';
                                } else if (pendingReschedule) {
                                  virtualStatus = 'PENDING RESCHEDULE';
                                } else if (pendingNew) {
                                  virtualStatus = 'PENDING SCHEDULE';
                                }
                              }
                            }
                            // If a real DTR row exists, it always wins — never overlay leave/event virtualStatus on top of it.

                            const hrs = row ? parseFloat(row.total_hours) || 0 : 0;
                            const rate = row ? (parseFloat(row.hourly_rate) || parseFloat(displayUser.hourly_rate) || 0) : 0;
                            const earnings = hrs * rate;

                            grandTotalHrs += hrs;
                            grandTotalEarnings += earnings;

                            const isSpecialStatus = (row && ['Absent', 'Leave', 'Holiday', 'Rescheduled'].includes(row.status)) || (!row && virtualStatus === 'VACATION LEAVE');
                            const displayStatus = row && row.status ? row.status.toUpperCase() : virtualStatus;

                            let statusColor = 'inherit';
                            if (row?.status === 'Absent') statusColor = 'var(--danger)';
                            else if (isSpecialStatus) statusColor = 'var(--primary)';
                            else if (virtualStatus === 'VACATION LEAVE') statusColor = 'var(--primary)';
                            else if (virtualStatus) statusColor = 'var(--text-muted)';

                            return (
                              <tr key={dayObj.dateStr}>
                                <td className="dtr-day-col">{dayObj.dayNum}</td>
                                <td style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                  {isSpecialStatus ? '---' : (row && row.am_in ? formatTime(row.am_in, row.date) : '')}
                                </td>
                                <td style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                  {isSpecialStatus ? '---' : (row && row.pm_out ? formatTime(row.pm_out, row.date) : '')}
                                </td>
                                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                  {isSpecialStatus ? '---' : (hrs ? formatHoursDuration(hrs) : '')}
                                </td>
                                {isAdmin && <td>{rate ? `$${rate.toFixed(2)}` : ''}</td>}
                                {isAdmin && <td style={{ fontWeight: 600, color: 'var(--success)' }}>{earnings && !isSpecialStatus ? `$${earnings.toFixed(2)}` : ''}</td>}
                                <td style={{ fontWeight: 600, color: statusColor }}>
                                  {displayStatus}
                                </td>
                                {isAdmin && (
                                  <td style={{ textAlign: 'center' }}>
                                    <div className="dtr-action-icons" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      {row ? (
                                        <>
                                          <button className="btn-icon text-primary" onClick={() => openEditModal(row, dayObj, targetUserId)} title="Edit Record" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                                            <Edit size={16} />
                                          </button>
                                          <button className="btn-icon text-danger" onClick={() => handleDeleteRecord(row.id)} title="Delete Record" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                                            <Trash2 size={16} />
                                          </button>
                                        </>
                                      ) : (
                                        <button onClick={() => openEditModal(null, dayObj, targetUserId)} title="Add Record" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', cursor: 'pointer', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                          <Plus size={14} /> Add
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                          <tr className="grand-total-row">
                            <td colSpan={3} style={{ textAlign: 'right', paddingRight: '24px', fontWeight: 800 }}>GRAND TOTAL</td>
                            <td style={{ color: 'var(--primary)', fontWeight: 800 }}>{grandTotalHrs > 0 ? formatHoursDuration(grandTotalHrs) : ''}</td>
                            {isAdmin && <td></td>}
                            {isAdmin && <td style={{ color: 'var(--success)', fontWeight: 800 }}>{grandTotalEarnings > 0 ? `$${grandTotalEarnings.toFixed(2)}` : ''}</td>}
                            <td></td>
                            {isAdmin && <td></td>}
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="dtr-table-section">
            <div className="dtr-table-title">ALL EMPLOYEES SUMMARY</div>
            <div className="table-responsive">
              <table className="dtr-monthly-table summary-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>EMPLOYEE NAME</th>
                    <th>POSITION</th>
                    <th>DAYS PRESENT</th>
                    <th>TOTAL HOURS</th>
                    <th>EARNINGS</th>
                  </tr>
                </thead>
                <tbody>
                  {allEmployeesSummary.length > 0 ? (
                    allEmployeesSummary.map(emp => (
                      <tr
                        key={emp.id}
                        className="clickable-row"
                        onClick={() => setTableFilterUser(String(emp.id))}
                      >
                        <td style={{ fontWeight: 600 }}>{emp.employee_id || emp.id}</td>
                        <td style={{ textAlign: 'left', paddingLeft: '16px', fontWeight: 600, color: 'var(--primary)' }}>{emp.full_name}</td>
                        <td>{emp.position || emp.role || '--'}</td>
                        <td>{emp.daysPresent} days</td>
                        <td>{emp.totalHours.toFixed(2)} hrs</td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>${emp.totalEarnings.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', color: 'var(--text-muted)' }}>
                        No records found for this timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Admin Edit/Add Modal */}
      {editModal.isOpen && (
        <div className="dtr-modal-overlay">
          <div className="dtr-modal-content">
            <div className="dtr-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                {editModal.mode === 'edit' ? 'Edit Record' : 'Add Record'} - {editModal.dateStr}
              </h3>
              <button className="btn-icon" onClick={() => setEditModal({ ...editModal, isOpen: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveModal(); }}>
              <div className="dtr-modal-body" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="premium-select-group">
                  <label>Status</label>
                  <select className="premium-input" value={editModal.status} onChange={(e) => setEditModal({ ...editModal, status: e.target.value })}>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">Leave</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Rescheduled">Rescheduled</option>
                  </select>
                </div>
                <div className="premium-select-group">
                  <label>AM IN Time</label>
                  <input type="time" step="1" className="premium-input" value={editModal.amIn} onChange={(e) => setEditModal({ ...editModal, amIn: e.target.value })} disabled={['Absent', 'Leave', 'Holiday'].includes(editModal.status)} />
                </div>
                <div className="premium-select-group">
                  <label>PM OUT Time</label>
                  <input type="time" step="1" className="premium-input" value={editModal.pmOut} onChange={(e) => setEditModal({ ...editModal, pmOut: e.target.value })} disabled={['Absent', 'Leave', 'Holiday'].includes(editModal.status)} />
                </div>
              </div>
              <div className="dtr-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditModal({ ...editModal, isOpen: false })}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DtrPage;
