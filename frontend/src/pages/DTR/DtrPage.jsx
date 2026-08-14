import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, CheckCircle, Clock, Filter, Settings, Calendar as CalendarIcon, ChevronDown, CalendarDays, Users, ListFilter } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './DtrPage.css';
import API_BASE from '../../config/api';

const DtrPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const { addNotification } = useNotification();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Helper: get local date as YYYY-MM-DD (avoids UTC date shift from toISOString)
  const getLocalDateStr = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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
  const [selectedExportUser, setSelectedExportUser] = useState('all');
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
  const [exportWeek, setExportWeek] = useState(0);

  // Dynamic Date Filter State
  const [dtrFilterType, setDtrFilterType] = useState('week'); // 'month', 'week', 'day'
  const [dtrFilterValue, setDtrFilterValue] = useState(() => {
    const today = new Date();
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
      const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      setDtrFilterValue(`${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    if (dtrFilterType === 'month') {
      setDtrFilterValue(today.toISOString().slice(0, 7));
    } else if (dtrFilterType === 'day') {
      setDtrFilterValue(getLocalDateStr(today));
    } else if (dtrFilterType === 'week') {
      const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      setDtrFilterValue(`${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`);
    }
  };

  useEffect(() => {
    fetchRecords();
    if (isAdmin) fetchEmployees();
  }, []);

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
      fetchRecords();
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
      fetchRecords();
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
      const [yearStr, weekNumStr] = dtrFilterValue.split('-W');
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
        for (let i = 0; i < 7; i++) {
          const d = new Date(ISOweekStart);
          d.setDate(ISOweekStart.getDate() + i);
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

  // Filter records for the selected export user
  const tableRecords = selectedExportUser === 'all'
    ? records
    : records.filter(r => String(r.user_id) === String(selectedExportUser));

  let displayUser = user;
  if (isAdmin && selectedExportUser !== 'all') {
    displayUser = employees.find(e => String(e.id) === String(selectedExportUser)) || user;
  } else if (isAdmin && selectedExportUser === 'all') {
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
  const myActiveShift = myRecords.find(r => r.am_in && !r.pm_out);
  const myTodayRecord = myRecords.find(r => r.date === todayDateStr);

  const displayActiveShift = tableRecords.find(r => r.am_in && !r.pm_out);
  const displayTodayRecord = tableRecords.find(r => r.date === todayDateStr);

  const isAmInDisabled = loading || !!myActiveShift || !!myTodayRecord;
  const isPmOutDisabled = loading || !myActiveShift;

  useEffect(() => {
    let interval;
    if (displayActiveShift && displayActiveShift.am_in) {
      const calculateElapsed = () => {
        const now = new Date();
        const amInStr = displayActiveShift.am_in;
        const recordDate = displayActiveShift.date;
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
  }, [displayActiveShift]);

  const formatElapsedTime = (totalSeconds) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // --- ADMIN EXPORT LOGIC ---
  const exportWeeksArray = [];
  if (exportMonth) {
    const [year, month] = exportMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let currentWeek = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        currentWeek.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
      if (dayOfWeek === 5 || day === daysInMonth) {
        if (currentWeek.length > 0) exportWeeksArray.push(currentWeek);
        currentWeek = [];
      }
    }
  }

  const handlePresetExport = (type) => {
    const today = new Date();
    let start = '';
    let end = getLocalDateStr(today);

    if (type === 'weekly') {
      const targetWeek = exportWeeksArray[exportWeek] || [];
      if (targetWeek.length > 0) {
        start = targetWeek[0];
        end = targetWeek[targetWeek.length - 1];
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

    setTimeout(() => {
      exportPDF(start, end);
    }, 100);
  };

  const exportPDF = (customStart = startDate, customEnd = endDate) => {
    let currentRecords = records;

    // 1. Filter by User
    if (selectedExportUser !== 'all') {
      currentRecords = currentRecords.filter(r => String(r.user_id) === String(selectedExportUser));
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
    doc.text("DAILY TIME RECORD", 148.5, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const dateRangeStr = (customStart && customEnd) ? `${customStart} to ${customEnd}` : "All Records";
    doc.text(`Date Range: ${dateRangeStr}`, 148.5, 28, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    if (selectedExportUser !== 'all') {
      const emp = employees.find(e => String(e.id) === String(selectedExportUser));
      doc.text(`Generated for: ${emp?.full_name || 'Unknown'}`, 14, 40);
      doc.text(`Role: ${emp?.role === 'admin' ? 'Administrator' : 'Employee'}`, 14, 46);
      doc.text(`Hourly Rate: $${emp?.hourly_rate || '0.00'}`, 14, 52);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 58);
    } else {
      doc.text(`Generated for: All Employees`, 14, 40);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 46);
    }

    const tableColumn = ["DATE"];
    const dataKeys = ["date"];

    if (pdfColumns.name) { tableColumn.push("NAME"); dataKeys.push("full_name"); }
    if (pdfColumns.amIn) { tableColumn.push("AM IN"); dataKeys.push("am_in"); }
    if (pdfColumns.pmOut) { tableColumn.push("PM OUT"); dataKeys.push("pm_out"); }
    if (pdfColumns.totalHrs) { tableColumn.push("TOTAL HRS"); dataKeys.push("total_hours"); }
    if (pdfColumns.rate) { tableColumn.push("RATE"); dataKeys.push("hourly_rate"); }
    if (pdfColumns.earnings) { tableColumn.push("EARNINGS"); dataKeys.push("earnings"); }

    const tableRows = [];
    currentRecords.forEach(record => {
      const rowData = [];
      dataKeys.forEach(key => {
        if (key === 'date') rowData.push(record.date);
        if (key === 'full_name') rowData.push(record.full_name || user.full_name);
        if (key === 'am_in') rowData.push(record.am_in ? formatTime(record.am_in, record.date) : '--:--');
        if (key === 'pm_out') rowData.push(record.pm_out ? formatTime(record.pm_out, record.date) : '--:--');
        if (key === 'total_hours') rowData.push(record.total_hours ? formatHoursDuration(record.total_hours) : '0h');
        if (key === 'hourly_rate') rowData.push(`$${record.hourly_rate || '0.00'}`);
        if (key === 'earnings') {
          const calculatedEarnings = parseFloat(record.total_hours || 0) * parseFloat(record.hourly_rate || 0);
          rowData.push(`$${calculatedEarnings.toFixed(2)}`);
        }
      });
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: selectedExportUser !== 'all' ? 65 : 55,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: [51, 65, 85], halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 }
    });

    doc.save(`DTR_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Time Record</h1>
          <p className="page-subtitle">Track attendance and earnings.</p>
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
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Select Month</label>
                    <input
                      type="month"
                      className="premium-input"
                      value={exportMonth}
                      onChange={e => { setExportMonth(e.target.value); setExportWeek(0); }}
                    />
                  </div>
                  <button className="btn btn-primary" style={{ padding: '10px 24px', flexShrink: 0 }} onClick={() => handlePresetExport('monthly')}>
                    <Download size={16} /> Monthly PDF Export
                  </button>
                </div>

                {/* Weekly Export Row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Target Month</label>
                    <input
                      type="month"
                      className="premium-input"
                      value={exportMonth}
                      onChange={e => { setExportMonth(e.target.value); setExportWeek(0); }}
                    />
                  </div>
                  <div className="premium-select-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Select Week</label>
                    <select
                      className="premium-input"
                      value={exportWeek}
                      onChange={e => setExportWeek(Number(e.target.value))}
                    >
                      {exportWeeksArray.map((_, idx) => (
                        <option key={idx} value={idx}>Week {idx + 1}</option>
                      ))}
                    </select>
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
                  <div className="advanced-grid">
                    <div className="premium-select-group">
                      <label>Employee Target</label>
                      <select className="premium-input" value={selectedExportUser} onChange={e => setSelectedExportUser(e.target.value)}>
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="premium-select-group">
                      <label>Custom Start Date</label>
                      <input type="date" className="premium-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="premium-select-group">
                      <label>Custom End Date</label>
                      <input type="date" className="premium-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
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
                        <input type="checkbox" checked={pdfColumns.rate} onChange={e => setPdfColumns({ ...pdfColumns, rate: e.target.checked })} /> Rate/Hr
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
              <input
                type={dtrFilterType === 'day' ? 'date' : dtrFilterType === 'week' ? 'week' : 'month'}
                className="toolbar-input"
                value={dtrFilterValue}
                onChange={e => setDtrFilterValue(e.target.value)}
              />
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
                    value={selectedExportUser}
                    onChange={e => setSelectedExportUser(e.target.value)}
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
          <div className="dtr-content-layout">
            <div className="dtr-sidebar">
              <div className="daily-attendance-summary">
                <div className="summary-row">
                  <span className="summary-label">Work:</span>
                  <span className="summary-text">
                    {displayActiveShift ? (
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.2rem', color: 'var(--primary)' }}>
                        {formatElapsedTime(elapsedSeconds)}
                      </span>
                    ) : displayTodayRecord?.pm_out ? (
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                        Shift Ended ({displayTodayRecord.total_hours ? formatHoursDuration(displayTodayRecord.total_hours) : ''})
                      </span>
                    ) : (
                      'once AM IN, count will start, PM OUT will end the time'
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
                  <span className={`summary-value ${displayTodayRecord ? 'status-present' : 'status-absent'}`}>
                    {displayTodayRecord ? 'present' : 'absent'}
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
                      <span className="employee-role">{displayUser.position || displayUser.role || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="employee-id-badge">
                    Employee ID: {(displayUser.employee_id || displayUser.id) ? String(displayUser.employee_id || displayUser.id).padStart(3, '0') : 'N/A'}
                  </div>
                </div>

                <div className="employee-card-divider"></div>

                <div className="employee-card-body">
                  <div className="employee-stat-group">
                    <span className="stat-label">Department</span>
                    <span className="stat-value">{displayUser.department || 'N/A'}</span>
                  </div>
                  <div className="employee-stat-group">
                    <span className="stat-label">Position</span>
                    <span className="stat-value">{displayUser.position || displayUser.role || 'N/A'}</span>
                  </div>
                  <div className="employee-stat-group">
                    <span className="stat-label">Employment Status</span>
                    <span className="stat-value status-active">Active</span>
                  </div>
                  <div className="employee-stat-group">
                    <span className="stat-label">Rate/Hr</span>
                    <span className="stat-value" style={{ color: 'var(--success)' }}>${displayUser.hourly_rate || '0.00'}</span>
                  </div>
                </div>
              </div>

              <div className="dtr-table-section">
                <div className="dtr-table-title">ATTENDANCE RECORD</div>
                <div className="table-responsive">
                  <table className="dtr-monthly-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '60px' }}>DAY</th>
                        <th>AM</th>
                        <th>PM</th>
                        <th rowSpan={2} style={{ width: '100px' }}>TOTAL HRS</th>
                        {isAdmin && <th rowSpan={2} style={{ width: '100px' }}>RATE/HR</th>}
                        {isAdmin && <th rowSpan={2} style={{ width: '120px' }}>EARNINGS</th>}
                      </tr>
                      <tr>
                        <th>IN</th>
                        <th>OUT</th>
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
                              const hrs = row ? parseFloat(row.total_hours) || 0 : 0;
                              const rate = row ? (parseFloat(row.hourly_rate) || parseFloat(displayUser.hourly_rate) || 0) : 0;
                              const earnings = hrs * rate;

                              grandTotalHrs += hrs;
                              grandTotalEarnings += earnings;

                              return (
                                <tr key={dayObj.dateStr}>
                                  <td className="dtr-day-col">{dayObj.dayNum}</td>
                                  <td>{row && row.am_in ? formatTime(row.am_in, row.date) : ''}</td>
                                  <td>{row && row.pm_out ? formatTime(row.pm_out, row.date) : ''}</td>
                                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{hrs ? formatHoursDuration(hrs) : ''}</td>
                                  {isAdmin && <td>{rate ? `$${rate.toFixed(2)}` : ''}</td>}
                                  {isAdmin && <td style={{ fontWeight: 600, color: 'var(--success)' }}>{earnings ? `$${earnings.toFixed(2)}` : ''}</td>}
                                </tr>
                              );
                            })}
                            <tr className="grand-total-row">
                              <td colSpan={3} style={{ textAlign: 'right', paddingRight: '24px', fontWeight: 800 }}>GRAND TOTAL</td>
                              <td style={{ color: 'var(--primary)', fontWeight: 800 }}>{grandTotalHrs > 0 ? formatHoursDuration(grandTotalHrs) : ''}</td>
                              {isAdmin && <td></td>}
                              {isAdmin && <td style={{ color: 'var(--success)', fontWeight: 800 }}>{grandTotalEarnings > 0 ? `$${grandTotalEarnings.toFixed(2)}` : ''}</td>}
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
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
                        onClick={() => setSelectedExportUser(emp.id)}
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
    </div>
  );
};

export default DtrPage;
