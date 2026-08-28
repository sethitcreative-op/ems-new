import axios from 'axios';
import API_BASE from '../config/api';

/**
 * Logs a system action to the backend system_logs table.
 * @param {string} action - Short identifier for the action (e.g. 'DOWNLOAD_PDF')
 * @param {string} description - Detailed description of the action
 */
export const logSystemAction = async (action, description) => {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        
        const user = JSON.parse(userStr);
        
        await axios.post(`${API_BASE}/logs.php`, {
            user_id: user.id,
            action: action,
            description: description
        });
    } catch (error) {
        console.error('Failed to log system action:', error);
    }
};
