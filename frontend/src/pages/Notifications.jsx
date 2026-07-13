import { useEffect, useState } from 'react';
import { createOrGetConnection, onEvent, offEvent } from '../lib/signalrClient';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [connection, setConnection] = useState(null);

  const token = localStorage.getItem('token');
  const API_BASE = 'https://localhost:7065/api/v1';

  useEffect(() => {
    async function init() {
      if (!token) return;

      // Initialize SignalR
      const conn = await createOrGetConnection(token);
      setConnection(conn);

      // Listen for new notifications
      const handleNotificationReceived = (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      };

      onEvent(conn, 'NotificationReceived', handleNotificationReceived);

      // Load notifications
      await loadNotifications();
      await loadUnreadCount();

      return () => {
        offEvent(conn, 'NotificationReceived', handleNotificationReceived);
      };
    }

    init();
  }, [token]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const resp = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load unread count', err);
    }
  };

  const handleToggleSelect = (notificationId) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleMarkAsRead = async () => {
    try {
      const notificationIds = Array.from(selectedNotifications);
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notificationIds })
      });

      // Update UI
      setNotifications(prev =>
        prev.map(n => selectedNotifications.has(n.Id) ? { ...n, IsRead: true } : n)
      );
      setSelectedNotifications(new Set());
      await loadUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ markAllAsRead: true })
      });

      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev => prev.filter(n => n.Id !== notificationId));
      if (!notifications.find(n => n.Id === notificationId)?.IsRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
          </p>
        </div>

        <div className="flex gap-2">
          {selectedNotifications.size > 0 && (
            <button
              onClick={handleMarkAsRead}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Mark Selected as Read
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-slate-500">No notifications yet</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.Id}
              className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                notif.IsRead
                  ? 'border-slate-200 bg-white'
                  : 'border-blue-300 bg-blue-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedNotifications.has(notif.Id)}
                onChange={() => handleToggleSelect(notif.Id)}
                className="h-5 w-5 cursor-pointer"
              />

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notif.IsRead ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                  {notif.Message}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(notif.CreatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {notif.Link && (
                  <a
                    href={notif.Link}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View
                  </a>
                )}
                <button
                  onClick={() => handleDelete(notif.Id)}
                  className="text-slate-400 hover:text-slate-600"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
