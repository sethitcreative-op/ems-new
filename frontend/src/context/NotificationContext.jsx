import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import API_BASE from '../config/api';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const lastNotificationRef = useRef({ message: null, time: 0 });
  const initialLoadDone = useRef(false);
  const seenNotificationIds = useRef(new Set());

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addNotification = useCallback(async (notification) => {
    const now = Date.now();
    // Prevent adding the exact same notification if it was added within the last 3 seconds
    if (
      lastNotificationRef.current.message === notification.message && 
      (now - lastNotificationRef.current.time) < 3000
    ) {
      return; 
    }
    
    lastNotificationRef.current = { message: notification.message, time: now };

    const id = Date.now() + Math.random();
    const newNotification = {
      timestamp: new Date(),
      read: false,
      ...notification,
      id, // ensure id is not overwritten
    };
    
    // Add to local state for immediate feedback
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    setToasts(prev => {
      // Prevent duplicate toasts on screen at the same time
      if (prev.some(t => t.message === notification.message)) {
        return prev;
      }
      return [...prev, newNotification];
    });
    
    setTimeout(() => {
      removeToast(id);
    }, 4000);

    // Persist to database
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      try {
        await fetch(`${API_BASE}/notifications.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            type: notification.type || 'info',
            message: notification.message
          })
        });
      } catch (error) {
        console.error("Failed to persist notification", error);
      }
    }
  }, [removeToast]);

  const markAllAsRead = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    try {
      await fetch(`${API_BASE}/notifications.php`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id })
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark notifications as read", error);
    }
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user) return;

      try {
        const res = await fetch(`${API_BASE}/notifications.php?user_id=${user.id}`);
        const data = await res.json();
        
        if (data.status === 'success') {
          const newNotifs = data.data;
          const newUnread = newNotifs.filter(n => parseInt(n.is_read) === 0);
          
          // Check for new unread notifications to show toasts only after initial load
          if (initialLoadDone.current) {
            newUnread.forEach(n => {
              if (!seenNotificationIds.current.has(n.id)) {
                // It's a brand new unread notification
                const toastId = `db-${n.id}`;
                setToasts(t => {
                  if (t.some(existingToast => existingToast.message === n.message)) {
                    return t;
                  }
                  return [...t, { ...n, timestamp: n.created_at, id: toastId }];
                });
                setTimeout(() => removeToast(toastId), 4000);
                seenNotificationIds.current.add(n.id);
              }
            });
          } else {
            // Initial load, just mark all as seen so we don't toast them later
            newNotifs.forEach(n => seenNotificationIds.current.add(n.id));
            initialLoadDone.current = true;
          }
          
          setNotifications(newNotifs);
          setUnreadCount(newUnread.length);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    
    // Custom event to stop interval on logout or trigger refresh
    const handleAuthChange = () => {
      if (!localStorage.getItem('user')) {
        setNotifications([]);
        setUnreadCount(0);
        initialLoadDone.current = false;
        seenNotificationIds.current.clear();
      } else {
        fetchNotifications();
      }
    };
    
    window.addEventListener('userUpdated', handleAuthChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('userUpdated', handleAuthChange);
    };
  }, [removeToast]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllAsRead }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={`toast-${toast.id}`} className={`toast-message glass border-${toast.type || 'success'}`}>
              <div className={`toast-icon bg-${toast.type || 'success'}`}>
                {toast.type === 'error' ? '✕' : toast.type === 'warning' ? '!' : '✓'}
              </div>
              <div className="toast-content">
                {toast.message}
              </div>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

