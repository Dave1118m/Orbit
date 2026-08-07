import React, { useState, useEffect } from 'react';
import SearchSelect from './SearchSelect';

export default function TaskVolunteersTab({ taskId }) {
  const [assignedVolunteers, setAssignedVolunteers] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('organizationId');

  useEffect(() => {
    if (taskId) {
      loadData();
    }
  }, [taskId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const promises = [
        fetch(`${API_BASE}/volunteers/tasks/${taskId}`, { headers: authHeaders })
      ];
      if (orgId) {
        promises.push(fetch(`${API_BASE}/volunteers/${orgId}`, { headers: authHeaders }));
      }

      const [taskVolRes, allVolRes] = await Promise.all(promises);

      if (taskVolRes && taskVolRes.ok) {
        const data = await taskVolRes.json();
        setAssignedVolunteers(Array.isArray(data) ? data : []);
      }

      if (allVolRes && allVolRes.ok) {
        const data = await allVolRes.json();
        setAllVolunteers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load volunteer data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e?.preventDefault();
    if (!selectedVolunteerId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ volunteerId: parseInt(selectedVolunteerId, 10) })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to assign volunteer');
      }

      setSelectedVolunteerId(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (volunteerId, volunteerName) => {
    if (!confirm(`Are you sure you want to unassign ${volunteerName || 'this volunteer'} from this task?`)) return;

    try {
      const res = await fetch(`${API_BASE}/volunteers/tasks/${taskId}/assign/${volunteerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to unassign volunteer');
      }

      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const assignedIds = new Set(assignedVolunteers.map(av => av.volunteerId || av.volunteer?.id));
  const unassignedVolunteers = allVolunteers.filter(v => !assignedIds.has(v.id));

  const selectOptions = unassignedVolunteers.map(v => ({
    value: v.id,
    label: `${v.name} (${v.skills || 'No skills specified'})`
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-slate-500">
        Loading volunteer assignments...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Assign Section */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h4 className="text-xs font-semibold text-slate-700 mb-2">Assign Volunteer to Task</h4>
        <form onSubmit={handleAssign} className="flex gap-2 items-center">
          <div className="flex-1 min-w-[200px]">
            <SearchSelect
              options={selectOptions}
              value={selectedVolunteerId}
              onChange={(val) => setSelectedVolunteerId(val)}
              placeholder="Search & select volunteer to assign..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !selectedVolunteerId}
            className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 transition shrink-0"
          >
            {submitting ? 'Assigning...' : '+ Assign'}
          </button>
        </form>
      </div>

      {error && <div className="text-xs text-rose-600 p-2 bg-rose-50 rounded-lg">{error}</div>}

      {/* Assigned Volunteers List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">
            Assigned Volunteers ({assignedVolunteers.length})
          </span>
        </div>

        {assignedVolunteers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            No volunteers assigned to this task yet. Use the dropdown above to assign a volunteer.
          </div>
        ) : (
          <div className="space-y-2">
            {assignedVolunteers.map((av) => {
              const vol = av.volunteer || {};
              const volName = vol.name || `Volunteer #${av.volunteerId}`;
              const bgStatus = vol.backgroundCheckStatus || 'Pending';

              return (
                <div
                  key={av.id || av.volunteerId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-bold text-xs border border-brand-100">
                      {volName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{volName}</span>
                        {bgStatus === 'Passed' && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Passed
                          </span>
                        )}
                        {bgStatus === 'Failed' && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                            Failed
                          </span>
                        )}
                        {bgStatus === 'Pending' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        {vol.email && <span>{vol.email}</span>}
                        {vol.skills && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {vol.skills}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnassign(av.volunteerId || vol.id, volName)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                  >
                    Unassign
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
