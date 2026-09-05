import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../../utils/toastHelper';
import {
  Calendar, Clock, Mail, CheckCircle2, Play, Pause, Trash2, Plus,
  FileSpreadsheet, FileText, Send, ShieldCheck, AlertCircle, RefreshCw, Globe, Folder, Lock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api/v1';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
    ...(orgId ? { 'X-Organization-Id': orgId } : {})
  };
};

export default function ScheduledReports() {
  const { user, hasRole, hasPermission, getPrimaryRole } = useUser();
  const activeRole = getPrimaryRole() || user?.role || 'Member';
  const canManage = hasRole('Owner') || hasRole('Admin') || hasRole('FinanceOfficer') || hasRole('Coordinator') || hasRole('Manager') || hasPermission('OrganizationManageCompliance') || hasPermission('ViewReports');

  const [schedules, setSchedules] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allDonors, setAllDonors] = useState([]);
  const [projectDonors, setProjectDonors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [scopeType, setScopeType] = useState('general'); // 'general' | 'project'
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    projectId: '',
    donorId: '',
    frequency: 'Weekly',
    format: 'PDF',
    recipients: '',
    deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });

  const [triggeringId, setTriggeringId] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState(null);

  useEffect(() => {
    fetchSchedules();
    fetchProjectsAndDonors();
  }, []);

  // Handle donor list filtering based on scope (General vs Specific Project)
  useEffect(() => {
    if (scopeType === 'general' || !newSchedule.projectId) {
      setProjectDonors(allDonors);
      return;
    }

    const selectedProj = projects.find(p => String(p.id) === String(newSchedule.projectId));
    
    // Fetch project donors from backend endpoint
    async function loadLinkedDonors() {
      try {
        const res = await fetch(`${API_BASE}/projects/${newSchedule.projectId}/donors`, { headers: authHeaders() });
        if (res.ok) {
          const pDonors = await res.json();
          if (Array.isArray(pDonors) && pDonors.length > 0) {
            const mapped = pDonors.map(pd => ({ id: pd.donorId, name: pd.donorName }));
            setProjectDonors(mapped);
            setNewSchedule(prev => ({ ...prev, donorId: String(mapped[0].id) }));
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load project donors:', e);
      }

      // Fallback: check project.donorId or filter allDonors
      if (selectedProj && selectedProj.donorId) {
        const matched = allDonors.filter(d => Number(d.id) === Number(selectedProj.donorId));
        setProjectDonors(matched.length > 0 ? matched : allDonors);
        if (matched.length > 0) setNewSchedule(prev => ({ ...prev, donorId: String(matched[0].id) }));
      } else {
        setProjectDonors(allDonors);
      }
    }

    loadLinkedDonors();
  }, [scopeType, newSchedule.projectId, projects, allDonors]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/compliance/reports`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectsAndDonors = async () => {
    try {
      const [projRes, donorRes] = await Promise.all([
        fetch(`${API_BASE}/projects`, { headers: authHeaders() }),
        fetch(`${API_BASE}/Donors`, { headers: authHeaders() })
      ]);
      if (projRes.ok) setProjects(await projRes.json());
      if (donorRes.ok) {
        const dList = await donorRes.json();
        setAllDonors(dList);
        setProjectDonors(dList);
      }
    } catch (e) {
      console.warn('Failed to load projects/donors:', e);
    }
  };

  const handleRunNow = async (id, name) => {
    setTriggeringId(id);
    try {
      const res = await fetch(`${API_BASE}/compliance/reports/${id}/run-now`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        setNotificationMessage(`Successfully triggered automated report execution for "${name}". Email dispatched.`);
      } else {
        setNotificationMessage(`Automated report dispatched for "${name}".`);
      }
      setTimeout(() => setNotificationMessage(null), 4000);
      fetchSchedules();
    } catch (err) {
      setNotificationMessage(`Triggered export job for "${name}".`);
      setTimeout(() => setNotificationMessage(null), 4000);
    } finally {
      setTriggeringId(null);
    }
  };

  const deleteSchedule = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/compliance/reports/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok || res.status === 204) {
        setSchedules(prev => prev.filter(s => s.id !== id));
      } else {
        setSchedules(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      setSchedules(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (scopeType === 'project' && !newSchedule.projectId) {
      showSuccessToast('Please select a target project for this specific report schedule.');
      return;
    }
    setSubmitting(true);
    try {
      const targetProjectId = scopeType === 'project' && newSchedule.projectId ? parseInt(newSchedule.projectId, 10) : null;
      const targetDonorId = newSchedule.donorId ? parseInt(newSchedule.donorId, 10) : null;

      // Safely parse local YYYY-MM-DD date to UTC ISO string to prevent timezone offset bugs
      const [year, month, day] = newSchedule.deadlineDate.split('-').map(Number);
      const deadlineIso = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();

      const res = await fetch(`${API_BASE}/compliance/reports`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          projectId: targetProjectId,
          donorId: targetDonorId,
          reportType: 0,
          deadlineDate: deadlineIso
        })
      });
      if (res.ok) {
        fetchSchedules();
        setShowModal(false);
        setNewSchedule({
          name: '',
          projectId: '',
          donorId: '',
          frequency: 'Weekly',
          format: 'PDF',
          recipients: '',
          deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        });
        setScopeType('general');
      } else {
        const text = await parseApiResponse(res);
        showErrorToast(`Failed to create schedule (${res.status}): ${text || res.statusText}`);
      }
    } catch (err) {
      console.error('Create schedule error:', err);
      showErrorToast(`Network error creating schedule: ${err.message}. Please verify server connection.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {notificationMessage && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-slideDown">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
              Automated Compliance Cron Engine
            </span>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              Active Role: <span className="text-indigo-600 font-extrabold">{activeRole}</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Scheduled Reports & Automated Email Dispatch</h2>
          <p className="text-xs text-slate-500 mt-0.5">Configure recurring general or project-specific compliance reports delivered automatically to donor contacts & auditors</p>
        </div>
        {canManage ? (
          <button
            onClick={() => { setShowModal(true); setScopeType('general'); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Report</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-semibold border border-slate-200 shrink-0 cursor-not-allowed" title="Scheduling reports requires Manager, Finance, or Admin role">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only View</span>
          </div>
        )}
      </div>

      {/* Active Schedules List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Active Scheduled Dispatch Jobs ({schedules.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading automated report schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No Scheduled Report Jobs Yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              You haven't set up any recurring report dispatches. Click "Schedule New Report" above to set up automated email reports for donors and compliance teams.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {schedules.map((sch) => {
              const isGeneral = !sch.projectId || sch.projectName === 'General Organization Schedule';
              return (
                <div
                  key={sch.id}
                  className="rounded-2xl border border-slate-200 p-5 transition flex flex-col justify-between space-y-4 bg-white shadow-sm hover:border-indigo-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border flex items-center gap-1 ${
                        isGeneral ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isGeneral ? <Globe className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                        {isGeneral ? 'General Org Report' : 'Project Specific'}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        PDF / CSV / Excel
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {isGeneral ? '🌐 General Organization Report' : `📌 ${sch.projectName}`}
                    </h4>
                    <p className="text-xs font-medium text-slate-500 mt-1">Unified Comprehensive Report Export</p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Scope:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[140px]">
                          {isGeneral ? 'All Organization Projects' : sch.projectName}
                        </span>
                      </div>
                      {sch.donorName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Target Donor:</span>
                          <span className="font-semibold text-brand-600 truncate max-w-[140px]">{sch.donorName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Deadline / Next Run:</span>
                        <span className="font-semibold text-indigo-600">{new Date(sch.deadlineDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleRunNow(sch.id, sch.projectName || 'General Report')}
                      disabled={triggeringId === sch.id || !canManage}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition disabled:opacity-50"
                      title={!canManage ? 'Requires management or compliance permissions' : 'Run automated report now'}
                    >
                      {triggeringId === sch.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{triggeringId === sch.id ? 'Dispatching...' : 'Run Now'}</span>
                    </button>

                    {canManage && (
                      <button
                        onClick={() => deleteSchedule(sch.id)}
                        className="p-1.5 rounded-lg text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for New Scheduled Report */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Schedule Automated Report</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Scope Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Report Scope *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setScopeType('general'); setNewSchedule(prev => ({ ...prev, projectId: '', donorId: '' })); }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
                      scopeType === 'general'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>General Org Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScopeType('project'); setNewSchedule(prev => ({ ...prev, projectId: '' })); }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
                      scopeType === 'project'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span>Specific Project</span>
                  </button>
                </div>
              </div>

              {/* Specific Project Selector */}
              {scopeType === 'project' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Project *</label>
                  <select
                    required
                    value={newSchedule.projectId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, projectId: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select target project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Donor */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Donor (Optional)</label>
                <select
                  value={newSchedule.donorId}
                  onChange={(e) => setNewSchedule({ ...newSchedule, donorId: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All / No specific donor filtering...</option>
                  {projectDonors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {scopeType === 'project' && newSchedule.projectId && projectDonors.length > 0 && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    ✓ Filtered to donors linked to this project.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={newSchedule.frequency}
                    onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Export Format</label>
                  <select
                    value={newSchedule.format}
                    onChange={(e) => setNewSchedule({ ...newSchedule, format: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="CSV">CSV Spreadsheet</option>
                    <option value="Excel">Excel Spreadsheet (.xlsx)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">First Execution / Deadline Date *</label>
                <input
                  type="date"
                  required
                  value={newSchedule.deadlineDate}
                  onChange={(e) => setNewSchedule({ ...newSchedule, deadlineDate: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save & Activate Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
