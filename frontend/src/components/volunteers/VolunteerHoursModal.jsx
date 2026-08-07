import React, { useEffect, useState } from 'react';

export default function VolunteerHoursModal({ isOpen, onClose, volunteer }) {
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !volunteer?.id) return;
    setHours([]);
    setError(null);
    setLoading(true);

    const fetchHours = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/volunteers/${volunteer.id}/hours`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to load volunteer hours.');
        setHours(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHours();
  }, [isOpen, volunteer]);

  if (!isOpen) return null;
  if (!volunteer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{volunteer.name} - Logged Hours</h2>
            <p className="text-sm text-slate-500">Review volunteer hours and task contributions.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-4">
          {loading && <div className="text-slate-500">Loading hours...</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!loading && !error && hours.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No volunteer hours logged yet.
            </div>
          )}

          {!loading && !error && hours.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hours.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{entry.taskTitle || 'Unknown task'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{entry.hours}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {entry.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">{entry.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
