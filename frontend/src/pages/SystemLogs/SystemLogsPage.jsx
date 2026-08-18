import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter } from 'lucide-react';
import './SystemLogsPage.css';
import API_BASE from '../../config/api';

const SystemLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}/logs.php`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN')) return 'bg-blue';
    if (action.includes('CREATE')) return 'bg-green';
    if (action.includes('UPDATE')) return 'bg-orange';
    if (action.includes('DELETE')) return 'bg-red';
    if (action.includes('SUBMIT')) return 'bg-purple';
    return 'bg-gray';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = ['ALL', ...new Set(logs.map(log => log.action))];

  return (
    <div className="system-logs-container page-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={28} style={{marginRight: '12px'}}/> System Logs</h1>
          <p className="page-subtitle">Audit trail of all system activities</p>
        </div>
      </div>

      <div className="logs-content glass-panel">
        <div className="logs-controls">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search user, action or description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-box">
            <Filter size={18} className="filter-icon" />
            <select 
              value={actionFilter} 
              onChange={(e) => setActionFilter(e.target.value)}
              className="filter-select"
            >
              {uniqueActions.map(action => (
                <option key={action} value={action}>
                  {action === 'ALL' ? 'All Actions' : action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="logs-table-container custom-scrollbar">
          {loading ? (
            <div className="loading-state">Loading logs...</div>
          ) : filteredLogs.length > 0 ? (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="log-row fade-in">
                    <td className="time-cell">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="user-cell">
                      {log.user_name || 'System / Unknown'}
                    </td>
                    <td className="action-cell">
                      <span className={`action-badge ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="desc-cell">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <FileText size={48} className="empty-icon" />
              <p>No logs found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemLogsPage;
