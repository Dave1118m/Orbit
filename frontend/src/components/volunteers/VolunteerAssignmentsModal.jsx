import React, { useEffect, useState } from 'react';

export default function VolunteerAssignmentsModal({ isOpen, onClose, volunteer }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !volunteer?.id) return;
    setAssignments([]);
    setError(null);
    setLoading(true);

    const fetchAssignments = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/volunteers/${volunteer.id}/assignments`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to load volunteer assignments.');
        setAssignments(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [isOpen, volunteer]);

  if (!isOpen) return null;
  if (!volunteer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{volunteer.name} - Task Assignments</h2>
            <p className="text-sm text-slate-500">View tasks assigned to this volunteer.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"></button>
        </div>

        <div className="p-4">
          {loading && <div className="text-slate-500">Loading assignments...</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!loading && !error && assignments.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No task assignments found.
            </div>
          )}

          {!loading && !error && assignments.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{assignment.taskTitle || 'Unknown task'}</td>
                      <td className="px-4 py-3">{assignment.projectName || 'Unknown project'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {assignment.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{new Date(assignment.assignedAt).toLocaleDateString()}</td>
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
