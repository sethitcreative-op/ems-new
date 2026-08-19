import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import './CustomWeekPicker.css';

const CustomWeekPicker = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to format date for display (e.g., Aug 6 - Aug 12, 2026)
  const getDisplayValue = () => {
    if (!value) return "Select Week";
    const [y, m, d] = value.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 6);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // If same year, we can just use the year at the end
    if (start.getFullYear() === end.getFullYear()) {
      return `${startStr} - ${endStr}`;
    }
    return `${startStr}, ${start.getFullYear()} - ${endStr}`;
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Build the calendar grid starting on Thursday
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstDayOfMonth.getDay(); 
  
  // Thursday is 4. Offset calculation:
  const diff = (dayOfWeek + 7 - 4) % 7;
  
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - diff);

  const weeks = [];
  let currentDay = new Date(startDate);
  
  // Always 6 rows for standard calendar views
  for (let i = 0; i < 6; i++) {
    const week = [];
    const weekStartDate = new Date(currentDay);
    
    for (let j = 0; j < 7; j++) {
      week.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    // The value of the row is its Thursday (index 0)
    const yStr = weekStartDate.getFullYear();
    const mStr = String(weekStartDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(weekStartDate.getDate()).padStart(2, '0');
    const rowValue = `${yStr}-${mStr}-${dStr}`;
    
    weeks.push({
      days: week,
      value: rowValue
    });
  }

  const handleRowClick = (rowValue) => {
    onChange(rowValue);
    setIsOpen(false);
  };

  return (
    <div className={`custom-week-picker ${className}`} ref={containerRef}>
      <div 
        className="custom-week-picker-input" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{getDisplayValue()}</span>
        <CalendarIcon size={16} className="calendar-icon" />
      </div>

      {isOpen && (
        <div className="custom-week-picker-popup fade-in-up">
          <div className="custom-week-picker-header">
            <button className="nav-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <div className="current-month">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button className="nav-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>
          
          <div className="custom-week-picker-grid">
            <div className="grid-header">
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
            </div>
            
            <div className="grid-body">
              {weeks.map((week, idx) => {
                const isSelected = value === week.value;
                return (
                  <div 
                    key={idx} 
                    className={`grid-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRowClick(week.value)}
                  >
                    {week.days.map((day, dIdx) => {
                      const isOtherMonth = day.getMonth() !== month;
                      const isToday = new Date().toDateString() === day.toDateString();
                      return (
                        <div 
                          key={dIdx} 
                          className={`grid-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                        >
                          {day.getDate()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomWeekPicker;
