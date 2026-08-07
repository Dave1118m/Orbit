import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL;

function authHeaders() {
  const token = localStorage.getItem('token');
  const storedOrgId = localStorage.getItem('selectedOrganizationId');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null') {
    headers['X-Organization-Id'] = storedOrgId;
  }
  return headers;
}

/**
 * Extracts initials from a full name string.
 * e.g. "Jamie Kim" => "JK", "Alice" => "A"
 */
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Returns a deterministic color class for a given user name,
 * so the same user always gets the same avatar color.
 */
const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-teal-500',
];

function getAvatarColor(name) {
  if (!name) return 'bg-slate-400';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Converts a UTC timestamp to a human-readable relative time string.
 */
function timeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`${API}/activity?limit=15`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setActivities(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load activity feed', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-900">Activity</h2>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ maxHeight: '380px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => {
            const userName = activity.performedByUserName;
            const initials = getInitials(userName);
            const avatarColor = getAvatarColor(userName);

            return (
              <div key={activity.id} className="flex items-start gap-3 group">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-semibold text-white">{initials}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">
                    {userName ? (
                      <span className="font-semibold text-slate-900">{userName}</span>
                    ) : (
                      <span className="font-semibold text-slate-500">System</span>
                    )}
                    {' '}
                    <span className="text-slate-500">{activity.action}</span>
                    {' '}
                    <span className="font-medium text-slate-700">{activity.entity}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(activity.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
