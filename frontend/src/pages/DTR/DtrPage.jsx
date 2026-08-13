import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, CheckCircle, Clock, Filter, Settings, Calendar as CalendarIcon } from 'lucide-react';
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

  // Weekly Tab State
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const todayStr = getLocalDateStr(today);

    const daysInMonth = new Date(year, month, 0).getDate();
    let currentWeek = [];
    let computedWeeks = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push({ dateStr });
      }
      if (dayOfWeek === 5 || day === daysInMonth) {
        if (currentWeek.length > 0) computedWeeks.push(currentWeek);
        currentWeek = [];
      }
    }
    const idx = computedWeeks.findIndex(w => w.some(d => d.dateStr === todayStr));
    return idx !== -1 ? idx : 0;
  });

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

  // --- WEEKLY GROUPING LOGIC ---
  const weeks = [];
  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let currentWeek = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();

      // Exclude Sunday (0) and Saturday (6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push({ dateStr, dayNum: day });
      }

      // Push week on Friday (5) or last day of month
      if (dayOfWeek === 5 || day === daysInMonth) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
        }
        currentWeek = [];
      }
    }
  }

  // Ensure selectedWeek is within bounds if month changes
  useEffect(() => {
    if (selectedWeek >= weeks.length && weeks.length > 0) {
      setSelectedWeek(weeks.length - 1);
    }
  }, [selectedMonth, weeks.length]);

  const activeWeekDates = weeks[selectedWeek] || [];
  const activeDateStrings = activeWeekDates.map(d => d.dateStr);

  // Filter records for the active week and selected export user
  const tableRecords = selectedExportUser === 'all'
    ? records
    : records.filter(r => String(r.user_id) === String(selectedExportUser));

  const weeklyRecords = tableRecords.filter(r => activeDateStrings.includes(r.date));

  // Calculate Grand Totals
  const grandTotalHrs = weeklyRecords.reduce((sum, r) => sum + parseFloat(r.total_hours || 0), 0);
  const grandTotalEarnings = weeklyRecords.reduce((sum, r) => sum + (parseFloat(r.total_hours || 0) * parseFloat(r.hourly_rate || 0)), 0);

  // Clock Restrictions (Check for Active Shift and Today's Record)
  const todayDateStr = getLocalDateStr();
  const myRecords = records.filter(r => String(r.user_id) === String(user.id));
  const myActiveShift = myRecords.find(r => r.am_in && !r.pm_out);
  const myTodayRecord = myRecords.find(r => r.date === todayDateStr);

  const isAmInDisabled = loading || !!myActiveShift || !!myTodayRecord;
  const isPmOutDisabled = loading || !myActiveShift;

  // --- ADMIN EXPORT LOGIC ---
  const handlePresetExport = (type) => {
    const today = new Date();
    let start = '';
    let end = getLocalDateStr(today);

    if (type === 'weekly') {
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = getLocalDateStr(lastWeek);
    } else if (type === 'monthly') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      start = getLocalDateStr(lastMonth);
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
        if (key === 'total_hours') rowData.push(record.total_hours || '0.00');
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
          <button className="btn btn-success" onClick={handleClockIn} disabled={isAmInDisabled}>
            <CheckCircle size={18} /> AM IN
          </button>
          <button className="btn btn-danger" onClick={handleClockOut} disabled={isPmOutDisabled}>
            <Clock size={18} /> PM OUT
          </button>
        </div>
      </div>

      {/* Admin Export Panel */}
      {isAdmin && (
        <div className="glass filters-panel">
          <div className="filters-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>Admin Tools</h3>
            </div>
            <button className="btn btn-ghost" onClick={() => setShowExportSettings(!showExportSettings)}>
              <Settings size={18} /> {showExportSettings ? 'Hide Settings' : 'Export Settings'}
            </button>
          </div>

          <div className="filters-body">
            <div className="date-filters">
              <div className="input-group">
                <label>Employee</label>
                <select className="input-field" value={selectedExportUser} onChange={e => setSelectedExportUser(e.target.value)}>
                  <option value="all">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Start Date</label>
                <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label>End Date</label>
                <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="preset-exports">
              <button className="btn btn-outline" onClick={() => handlePresetExport('weekly')}>Weekly PDF</button>
              <button className="btn btn-outline" onClick={() => handlePresetExport('monthly')}>Monthly PDF</button>
              <button className="btn btn-outline" onClick={() => handlePresetExport('yearly')}>Yearly PDF</button>
              <button className="btn btn-primary" onClick={() => exportPDF()}>
                <Download size={18} /> Export Custom PDF
              </button>
            </div>
          </div>

          {showExportSettings && (
            <div className="export-settings animate-fade-in">
              <h4>Select Columns for PDF:</h4>
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
          )}
        </div>
      )}

      {/* Weekly DTR Table */}
      <div className="glass table-container">
        <div className="table-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>Attendance Record</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.85rem', marginBottom: '6px' }}>Select Month:</label>
              <input
                type="month"
                className="input-field"
                style={{ width: '180px' }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="weekly-tabs">
          {weeks.map((_, index) => (
            <button
              key={index}
              className={`week-tab ${selectedWeek === index ? 'active' : ''}`}
              onClick={() => setSelectedWeek(index)}
            >
              Week {index + 1}
            </button>
          ))}
        </div>

        <div className="table-responsive">
          <table className="premium-table weekly-table">
            <thead>
              <tr>
                <th>DAY</th>
                {isAdmin && <th>NAME</th>}
                <th>AM IN</th>
                <th>PM OUT</th>
                <th>TOTAL HRS</th>
                <th>RATE / HR</th>
                <th>EARNINGS ($)</th>
              </tr>
            </thead>
            <tbody>
              {activeWeekDates.length > 0 ? (
                activeWeekDates.map((dateObj) => {
                  const dateDate = new Date(dateObj.dateStr);
                  // Ensure local timezone doesn't shift the day backwards
                  const localDate = new Date(dateDate.getTime() + dateDate.getTimezoneOffset() * 60000);
                  const formattedDate = localDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                  const dailyRecords = tableRecords.filter(r => r.date === dateObj.dateStr);

                  if (dailyRecords.length === 0) {
                    return (
                      <tr key={dateObj.dateStr}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{formattedDate}</td>
                        {isAdmin && <td style={{ color: 'var(--text-muted)' }}>--</td>}
                        <td style={{ color: 'var(--text-muted)' }}>--:--</td>
                        <td style={{ color: 'var(--text-muted)' }}>--:--</td>
                        <td style={{ color: 'var(--text-muted)' }}>--</td>
                        <td style={{ color: 'var(--text-muted)' }}>--</td>
                        <td className="earnings" style={{ color: 'var(--text-muted)' }}>--</td>
                      </tr>
                    );
                  }

                  return dailyRecords.map((row, idx) => (
                    <tr key={`${dateObj.dateStr}-${idx}`}>
                      <td style={{ fontWeight: 600 }}>{idx === 0 ? formattedDate : ''}</td>
                      {isAdmin && <td>{row.full_name || '--'}</td>}
                      <td>{formatTime(row.am_in, row.date)}</td>
                      <td>{formatTime(row.pm_out, row.date)}</td>
                      <td>{row.total_hours || '--'}</td>
                      <td>{row.hourly_rate ? `$${row.hourly_rate}` : '--'}</td>
                      <td className="earnings">
                        {row.total_hours && row.hourly_rate 
                          ? `$${(parseFloat(row.total_hours) * parseFloat(row.hourly_rate)).toFixed(2)}` 
                          : '--'}
                      </td>
                    </tr>
                  ));
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No attendance records found for this month.
                  </td>
                </tr>
              )}
            </tbody>
            {weeklyRecords.length > 0 && (
              <tfoot>
                <tr className="grand-total-row">
                  <td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'right' }}>GRAND TOTAL</td>
                  <td>{grandTotalHrs.toFixed(2)}</td>
                  <td>-</td>
                  <td className="earnings">${grandTotalEarnings.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default DtrPage;
