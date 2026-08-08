import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import { AutoText } from '../contexts/TranslationContext';
import SearchSelect from '../components/SearchSelect';
import CommentSection from '../components/CommentSection';
import AttachmentList from '../components/AttachmentList';
import RiskRegister from '../components/RiskRegister';
import GanttTimelineView from '../components/GanttTimelineView';

const API_URL = `${import.meta.env.VITE_API_URL}/projects`;
const TEAMS_URL = `${import.meta.env.VITE_API_URL}/teams`;
const WORKSPACES_URL = `${import.meta.env.VITE_API_URL}/workspaces`;
const DONORS_URL = `${import.meta.env.VITE_API_URL}/donors`;

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  0: { label: 'Planning',  color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'  },
  1: { label: 'Active',    color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  2: { label: 'On Hold',   color: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500'   },
  3: { label: 'Completed', color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500'    },
  4: { label: 'Cancelled', color: 'bg-red-50 text-red-700',         dot: 'bg-red-500'     },
};

function getStatusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG[0];
}

// Derive a "health" badge based on dates & status
function getHealthBadge(project) {
  if (project.status === 3) return { label: 'Completed', color: 'bg-blue-50 text-blue-700' };
  if (project.status === 4) return { label: 'Cancelled', color: 'bg-red-50 text-red-600' };
  if (project.status === 2) return { label: 'On Hold', color: 'bg-amber-50 text-amber-700' };

  const now = new Date();
  if (project.endDate) {
    const end = new Date(project.endDate);
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Overdue', color: 'bg-red-50 text-red-600' };
    if (daysLeft < 14) return { label: 'At Risk', color: 'bg-orange-50 text-orange-700' };
  }
  return { label: 'On Track', color: 'bg-emerald-50 text-emerald-700' };
}

// Derive task progress percentage (dummy formula if no completedTaskCount — backend returns taskCount only)
function getProgress(project) {
  if (!project.taskCount || project.taskCount === 0) return 0;
  // If backend provides completedTaskCount use it; otherwise use status heuristic
  if (project.completedTaskCount !== undefined) {
    return Math.round((project.completedTaskCount / project.taskCount) * 100);
  }
  const heuristic = { 0: 10, 1: 45, 2: 30, 3: 100, 4: 0 };
  return heuristic[project.status] ?? 0;
}

// Generate avatar initials / color from name
const AVATAR_COLORS = [
  'bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-cyan-500','bg-pink-500','bg-indigo-500',
];
function avatarColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name = '') {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent} text-white text-xl flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, donors, onClick }) {
  const status = getStatusConfig(project.status);
  const health = getHealthBadge(project);
  const progress = getProgress(project);
  const donor = donors.find(d => d.id === project.donorId);
  const endDate = project.endDate ? new Date(project.endDate) : null;
  const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
                 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-200"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 font-bold text-sm flex-shrink-0">
            {project.title.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate max-w-[160px]">
              <AutoText text={project.title} />
            </h3>
            {donor && (
              <p className="text-xs text-slate-400 truncate max-w-[160px] mt-0.5">
                <AutoText text={donor.name} />
              </p>
            )}
          </div>
        </div>
        {/* Health badge */}
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0 ${health.color}`}>
          <AutoText text={health.label} />
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
          <AutoText text={project.description} />
        </p>
      )}

      {/* Status + Budget row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${project.fundingType === 'MultiDonor' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          {project.fundingType === 'MultiDonor' ? 'Co-Funded' : 'Sole Funder'}
        </span>
        {project.budget && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            ${project.budget.toLocaleString()}
          </span>
        )}
      </div>

      {/* Task Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">
            {project.taskCount > 0 ? `${project.taskCount} tasks` : 'No tasks yet'}
          </span>
          <span className="text-xs font-semibold text-slate-700">{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
        {/* Teams avatar stack */}
        <div className="flex items-center gap-1.5">
          {project.teams && project.teams.length > 0 ? (
            <div className="flex -space-x-1.5">
              {project.teams.slice(0, 3).map((team, i) => (
                <div
                  key={team.id ?? i}
                  title={team.name}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ${avatarColor(team.name)}`}
                >
                  {initials(team.name)}
                </div>
              ))}
              {project.teams.length > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-600">
                  +{project.teams.length - 3}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">No teams</span>
          )}
        </div>

        {/* Due date */}
        {endDate && (
          <div className={`flex items-center gap-1 text-xs font-medium ${daysLeft !== null && daysLeft < 0 ? 'text-red-500' : daysLeft !== null && daysLeft < 14 ? 'text-orange-500' : 'text-slate-500'}`}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {daysLeft !== null && daysLeft < 0
              ? `${Math.abs(daysLeft)}d overdue`
              : endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/0 to-violet-500/0 group-hover:from-brand-500/3 group-hover:to-violet-500/3 pointer-events-none transition-all duration-300" />
    </div>
  );
}

// ─── Project Detail Slide-over ─────────────────────────────────────────────────
function ProjectDetailPanel({ project, donors, users, onClose, onDelete, onAssignTeam, onEdit }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [leadHistory, setLeadHistory] = useState([]);
  const [postponements, setPostponements] = useState([]);
  const [isAssigningLead, setIsAssigningLead] = useState(false);
  const [selectedLeadUserId, setSelectedLeadUserId] = useState('');
  const [isPostponing, setIsPostponing] = useState(false);
  const [postponeData, setPostponeData] = useState({ newEndDate: '', reason: '' });

  const API_BASE = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (project?.id) {
      fetchLeadHistory();
      fetchPostponements();
    }
  }, [project?.id]);

  const fetchLeadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/${project.id}/lead-history`, { headers });
      if (res.ok) setLeadHistory(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchPostponements = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/${project.id}/postponements`, { headers });
      if (res.ok) setPostponements(await res.json());
      else setPostponements([]);
    } catch (err) { setPostponements([]); }
  };

  const handleAssignLead = async () => {
    if (!selectedLeadUserId) return;
    try {
      const res = await fetch(`${API_BASE}/projects/${project.id}/assign-lead`, {
        method: 'POST', headers, body: JSON.stringify({ userId: parseInt(selectedLeadUserId) })
      });
      if (res.ok) {
        setIsAssigningLead(false);
        setSelectedLeadUserId('');
        fetchLeadHistory();
      }
    } catch (err) { console.error(err); }
  };

  const handlePostpone = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/projects/${project.id}/postpone`, {
        method: 'POST', headers,
        body: JSON.stringify({ newEndDate: postponeData.newEndDate, reason: postponeData.reason })
      });
      if (res.ok) {
        setIsPostponing(false);
        setPostponeData({ newEndDate: '', reason: '' });
        fetchPostponements();
      }
    } catch (err) { console.error(err); }
  };

  if (!project) return null;

  const status = getStatusConfig(project.status);
  const health = getHealthBadge(project);
  const donor = donors.find(d => d.id === project.donorId);
  const progress = getProgress(project);
  const currentLead = leadHistory.find(h => !h.endDate);
  const currentLeadUser = currentLead ? (users || []).find(u => u.id === currentLead.userId) : null;

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg bg-white shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-sm flex-shrink-0">
              {project.title.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">{project.title}</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <Link to={`/projects/${project.id}/logframe`} className="text-xs font-semibold px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200 shadow-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              View Logframe
            </Link>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
          {['overview', 'gantt', 'comments', 'attachments', 'risks'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                activeTab === tab
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab === 'gantt' ? 'Gantt / Timeline' : tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'gantt' && (
            <div className="p-6 space-y-6">
              <GanttTimelineView projectId={project.id} />

              {/* Project Lead History Audit Log */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leadership Tenure History</p>
                  <button onClick={() => setIsAssigningLead(true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    + Assign New Lead
                  </button>
                </div>
                {leadHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No lead tenure records logged.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {leadHistory.map(entry => (
                      <div key={entry.id} className={`rounded-xl border p-3 flex items-center justify-between ${!entry.endDate ? 'border-brand-200 bg-brand-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-bold ${avatarColor(entry.userName)}`}>
                            {initials(entry.userName)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{entry.userName}</p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(entry.startDate).toLocaleDateString()} — {entry.endDate ? new Date(entry.endDate).toLocaleDateString() : 'Present'}
                            </p>
                          </div>
                        </div>
                        {!entry.endDate && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">Current Lead</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="p-6 space-y-5">
              {/* Health + progress */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${health.color}`}>{health.label}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{project.taskCount} total tasks</span>
                  <span className="font-semibold text-slate-700">{progress}%</span>
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                {project.startDate && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400 mb-1">Start Date</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {project.endDate && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400 mb-1">End Date</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {project.budget && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400 mb-1">Budget</p>
                    <p className="text-sm font-semibold text-slate-800">${project.budget.toLocaleString()}</p>
                  </div>
                )}
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="text-xs text-slate-400 mb-1">Funding Structure</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {project.fundingType === 'MultiDonor' ? 'Co-Funded' : 'Sole Funder'}
                  </p>
                </div>
                {donor && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <p className="text-xs text-slate-400 mb-1">Donor</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{donor.name}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {project.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{project.description}</p>
                </div>
              )}

              {/* Teams */}
              {project.teams && project.teams.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assigned Teams</p>
                  <div className="space-y-2">
                    {project.teams.map((team, i) => (
                      <div key={team.id ?? i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${avatarColor(team.name)}`}>
                          {initials(team.name)}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{team.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => onEdit(project)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => onAssignTeam(project)}
                  className="flex-1 rounded-xl border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition"
                >
                  + Assign Team
                </button>
                <button
                  onClick={() => setIsPostponing(true)}
                  className="flex-1 rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 transition"
                >
                  Postpone
                </button>
                <button
                  onClick={() => { if (window.confirm('Delete this project?')) onDelete(project.id); }}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="p-6 h-full">
              <CommentSection entityType="projects" entityId={project.id} />
            </div>
          )}
          {activeTab === 'attachments' && (
            <div className="p-6 h-full">
              <AttachmentList entityType="projects" entityId={project.id} />
            </div>
          )}
          {activeTab === 'risks' && (
            <div className="p-6 h-full">
              <RiskRegister projectId={project.id} />
            </div>
          )}
        </div>
      </div>

      {/* Assign Lead Modal */}
      {isAssigningLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Assign Project Lead</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Select User</label>
                <SearchSelect
                  options={(users || []).map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                  value={selectedLeadUserId}
                  onChange={val => setSelectedLeadUserId(val || '')}
                  placeholder="Choose a user..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsAssigningLead(false); setSelectedLeadUserId(''); }} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                <button type="button" onClick={handleAssignLead} disabled={!selectedLeadUserId} className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Assign Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {isPostponing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Postpone Project Timeline</h3>
            <form onSubmit={handlePostpone} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New End Date</label>
                <input required type="date" value={postponeData.newEndDate} onChange={e => setPostponeData({...postponeData, newEndDate: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <textarea required rows={3} value={postponeData.reason} onChange={e => setPostponeData({...postponeData, reason: e.target.value})} className={inputClass} placeholder="Explain the reason for postponement..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsPostponing(false)} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition">Postpone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [donors, setDonors] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projectTeams, setProjectTeams] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    const stored = localStorage.getItem('selectedOrganizationId');
    return stored ? parseInt(stored, 10) : null;
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTeamAssignmentOpen, setIsTeamAssignmentOpen] = useState(false);
  const [isTeamReplacementOpen, setIsTeamReplacementOpen] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [selectedReplacementTeamId, setSelectedReplacementTeamId] = useState(null);

  const [formData, setFormData] = useState({
    title: '', description: '', status: 0, budget: '', donorId: '', fundingType: 'SingleDonor', startDate: '', endDate: ''
  });

  const [editFormData, setEditFormData] = useState({
    title: '', description: '', status: 0, budget: '', donorId: '', fundingType: 'SingleDonor', startDate: '', endDate: ''
  });

  // ── Data fetching ──
  const authHeaders = () => {
    const token = localStorage.getItem('token');
    let orgId = selectedOrganizationId || localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
    if (!orgId) {
      const storedOrg = localStorage.getItem('selectedOrganization');
      if (storedOrg) { try { orgId = JSON.parse(storedOrg).id; } catch {} }
    }
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['X-Organization-Id'] = String(orgId);
    return headers;
  };

  const fetchProjects = useCallback(async (workspaceId = null) => {
    try {
      const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const res = await fetch(`${API_URL}${query}`, { headers: authHeaders() });
      if (res.ok) setProjects(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchTeams = useCallback(async (workspaceId = null) => {
    try {
      const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const res = await fetch(`${TEAMS_URL}${query}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setTeams(d.filter(t => !t.isArchived)); }
    } catch (err) { console.error(err); }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const url = WORKSPACES_URL + (selectedOrganizationId ? `?orgId=${selectedOrganizationId}` : '');
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d.items || []);
        setWorkspaces(list);
        if (list.length > 0 && !selectedWorkspaceId) {
          setSelectedWorkspaceId(list[0].id);
        }
      }
    } catch (err) { console.error(err); }
  }, [selectedOrganizationId, selectedWorkspaceId]);

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch(DONORS_URL, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDonors(Array.isArray(data) ? data : (data.items || []));
      } else {
        console.error('Failed to fetch donors:', res.status);
      }
    } catch (err) { console.error('Error fetching donors:', err); }
  }, [selectedOrganizationId]);

  const fetchProjectTeams = useCallback(async (projectId) => {
    try {
      const res = await fetch(`${API_URL}/${projectId}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setProjectTeams(d.teams || []); }
    } catch (err) { console.error(err); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: authHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'selectedOrganizationId') {
        setSelectedOrganizationId(e.newValue ? parseInt(e.newValue, 10) : null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    fetchDonors();
    fetchUsers();
  }, [selectedOrganizationId, fetchWorkspaces, fetchDonors, fetchUsers]);

  useEffect(() => {
    if (isCreateModalOpen || isEditModalOpen) {
      fetchDonors();
    }
  }, [isCreateModalOpen, isEditModalOpen, fetchDonors]);

  useEffect(() => {
    fetchProjects(selectedWorkspaceId);
    fetchTeams(selectedWorkspaceId);
  }, [selectedWorkspaceId, selectedOrganizationId, fetchProjects, fetchTeams]);

  // ── Handlers ──
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWorkspaceId) { alert('Select a workspace first.'); return; }
    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      alert('Project Deadline (End Date) cannot be earlier than Start Date.');
      return;
    }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          title: formData.title,
          description: formData.description,
          status: parseInt(formData.status, 10),
          budget: formData.budget ? parseFloat(formData.budget) : null,
          donorId: formData.donorId ? parseInt(formData.donorId, 10) : null,
          donorIds: (formData.donorIds && formData.donorIds.length > 0)
            ? formData.donorIds.map(id => parseInt(id, 10))
            : (formData.donorId ? [parseInt(formData.donorId, 10)] : []),
          fundingType: formData.fundingType || 'SingleDonor',
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
        })
      });
      if (res.ok) {
        setIsCreateModalOpen(false);
        setFormData({ title: '', description: '', status: 0, budget: '', donorId: '', donorIds: [], fundingType: 'SingleDonor', startDate: '', endDate: '' });
        fetchProjects(selectedWorkspaceId);
      } else {
        alert('Failed to create project. Check your permissions.');
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) { setSelectedProject(null); fetchProjects(selectedWorkspaceId); }
    } catch (err) { console.error(err); }
  };

  const handleOpenEdit = (project) => {
    const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
    setEditFormData({
      title: project.title || '',
      description: project.description || '',
      status: project.status ?? 0,
      budget: project.budget != null ? String(project.budget) : '',
      donorId: project.donorId != null ? String(project.donorId) : '',
      fundingType: project.fundingType || 'SingleDonor',
      startDate: toDateStr(project.startDate),
      endDate: toDateStr(project.endDate),
    });
    setIsEditModalOpen(true);
  };

  const handleEditChange = (e) => setEditFormData({ ...editFormData, [e.target.name]: e.target.value });

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (editFormData.startDate && editFormData.endDate && new Date(editFormData.endDate) < new Date(editFormData.startDate)) {
      alert('End Date cannot be earlier than Start Date.');
      return;
    }
    try {
      const body = {
        title: editFormData.title,
        description: editFormData.description || null,
        status: parseInt(editFormData.status, 10),
        budget: editFormData.budget ? parseFloat(editFormData.budget) : null,
        donorId: editFormData.donorId ? parseInt(editFormData.donorId, 10) : null,
        fundingType: editFormData.fundingType || 'SingleDonor',
        startDate: editFormData.startDate || null,
        endDate: editFormData.endDate || null,
      };
      const res = await fetch(`${API_URL}/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedProject(prev => ({ ...prev, ...updated }));
        setIsEditModalOpen(false);
        fetchProjects(selectedWorkspaceId);
      } else {
        const err = await res.text();
        alert(`Failed to update project: ${err}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleAssignTeam = async (e) => {
    e.preventDefault();
    if (selectedTeamIds.length === 0) { alert('Select at least one team'); return; }
    try {
      const results = await Promise.all(selectedTeamIds.map(teamId =>
        fetch(`${TEAMS_URL}/${teamId}/assign-project`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ projectId: selectedProject.id })
        })
      ));
      if (results.every(r => r.ok || r.status === 409)) {
        setIsTeamAssignmentOpen(false);
        setSelectedTeamIds([]);
        await fetchProjectTeams(selectedProject.id);
        const assignedTeams = teams.filter(t => selectedTeamIds.includes(t.id));
        setSelectedProject(prev => ({ ...prev, teams: [...(prev.teams || []), ...assignedTeams] }));
      } else {
        alert('Some teams failed to assign.');
      }
    } catch (err) { console.error(err); }
  };

  const handleReplaceTeam = async (e) => {
    e.preventDefault();
    if (!selectedReplacementTeamId) { alert('Select a replacement team'); return; }
    try {
      const oldTeamId = projectTeams[0]?.id;
      const res = await fetch(`${TEAMS_URL}/${oldTeamId}/replace-on-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ projectId: selectedProject.id, newTeamId: selectedReplacementTeamId })
      });
      if (res.ok) {
        setIsTeamReplacementOpen(false);
        setSelectedReplacementTeamId(null);
        await fetchProjectTeams(selectedProject.id);
      }
    } catch (err) { console.error(err); }
  };

  // ── Derived stats ──
  const totalProjects  = projects.length;
  const activeProjects = projects.filter(p => p.status === 1).length;
  const atRisk = projects.filter(p => {
    if (p.status === 1 && p.endDate) {
      const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft < 14 && daysLeft >= 0;
    }
    return false;
  }).length;
  const completed = projects.filter(p => p.status === 3).length;

  // ── Filtering ──
  const FILTERS = ['All', 'Active', 'On Hold', 'Completed', 'Planning'];
  const filteredProjects = projects
    .filter(p => {
      if (activeFilter === 'All') return true;
      const status = getStatusConfig(p.status);
      return status.label === activeFilter;
    })
    .filter(p => {
      if (!searchQuery.trim()) return true;
      return p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    });

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalProjects} project{totalProjects !== 1 ? 's' : ''} · {activeProjects} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Workspace selector */}
          <select
            value={selectedWorkspaceId ?? ''}
            onChange={e => setSelectedWorkspaceId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Workspaces</option>
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={<AutoText text="Total Projects" />}  value={totalProjects}  icon="📁" accent="bg-brand-500" />
        <StatCard label={<AutoText text="Active" />}          value={activeProjects} icon="▶️" accent="bg-emerald-500" />
        <StatCard label={<AutoText text="At Risk" />}         value={atRisk}         icon="⚠️" accent="bg-orange-500" />
        <StatCard label={<AutoText text="Completed" />}       value={completed}      icon="✅" accent="bg-blue-500" />
      </div>

      {/* ── Filter + Search + View toggle ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                activeFilter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <AutoText text={f} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-48"
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Project Cards / List ── */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-4">📂</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No projects found</h3>
          <p className="text-sm text-slate-400 mb-6">
            {searchQuery ? `No results for "${searchQuery}"` : 'Create your first project to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition"
            >
              + New Project
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              donors={donors}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Progress</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Budget</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Teams</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map(project => {
                const st = getStatusConfig(project.status);
                const prog = getProgress(project);
                const health = getHealthBadge(project);
                return (
                  <tr
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 font-bold text-xs flex-shrink-0">
                          {project.title.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{project.title}</p>
                          {project.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{project.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${prog}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-8">{prog}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {project.budget ? `$${project.budget.toLocaleString()}` : '–'}
                    </td>
                    <td className="px-6 py-4">
                      {project.teams?.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {project.teams.slice(0, 3).map((team, i) => (
                            <div key={team.id ?? i} title={team.name}
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ${avatarColor(team.name)}`}>
                              {initials(team.name)}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">–</span>}
                    </td>
                    <td className="px-6 py-4">
                      {project.endDate ? (
                        <span className={`text-xs font-medium ${health.label === 'Overdue' ? 'text-red-500' : health.label === 'At Risk' ? 'text-orange-500' : 'text-slate-500'}`}>
                          {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Project Detail Panel ── */}
      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          donors={donors}
          users={users}
          onClose={() => setSelectedProject(null)}
          onDelete={handleDelete}
          onEdit={handleOpenEdit}
          onAssignTeam={(proj) => {
            fetchProjectTeams(proj.id);
            setIsTeamAssignmentOpen(true);
          }}
        />
      )}

      {/* ── Create Project Modal ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Project">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Project Title *</label>
            <input required name="title" value={formData.title} onChange={handleChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Project title..." />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Brief description..." />
          </div>

          {/* Funding Structure Quick Selection Buttons */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-700">Funding Structure</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const firstId = (formData.donorIds && formData.donorIds.length > 0) ? formData.donorIds[0] : (formData.donorId || '');
                  setFormData({ ...formData, fundingType: 'SingleDonor', donorId: firstId, donorIds: firstId ? [firstId] : [] });
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                  formData.fundingType === 'SingleDonor'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Sole Funder
              </button>
              <button
                type="button"
                onClick={() => {
                  const initialIds = (formData.donorIds && formData.donorIds.length > 0)
                    ? formData.donorIds
                    : (formData.donorId ? [formData.donorId] : []);
                  setFormData({ ...formData, fundingType: 'MultiDonor', donorIds: initialIds });
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                  formData.fundingType === 'MultiDonor'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Co-Funded
              </button>
            </div>
          </div>

          {/* Donor Selection Pill Buttons */}
          {donors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  {formData.fundingType === 'MultiDonor' ? 'Select Co-Funding Donors (Multi-select)' : 'Select Sole Donor'}
                </label>
                {formData.fundingType === 'MultiDonor' && (
                  <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                    Multi-Donor Mode
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, donorId: '', donorIds: [] })}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition ${
                    (!formData.donorId && (!formData.donorIds || formData.donorIds.length === 0))
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  None
                </button>
                {donors.map(d => {
                  const idStr = String(d.id);
                  const isMulti = formData.fundingType === 'MultiDonor';
                  const isSelected = isMulti
                    ? (formData.donorIds || []).includes(idStr) || String(formData.donorId) === idStr
                    : String(formData.donorId) === idStr;

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        if (isMulti) {
                          const currentIds = formData.donorIds || (formData.donorId ? [String(formData.donorId)] : []);
                          const exists = currentIds.includes(idStr);
                          const nextIds = exists ? currentIds.filter(x => x !== idStr) : [...currentIds, idStr];
                          setFormData({ ...formData, donorIds: nextIds, donorId: nextIds[0] || '' });
                        } else {
                          setFormData({ ...formData, donorId: idStr, donorIds: [idStr] });
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && isMulti && <span>✓</span>}
                      {d.name || d.code || `Donor #${d.id}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Workspace *</label>
              <select
                value={selectedWorkspaceId || ''}
                onChange={e => setSelectedWorkspaceId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value={0}>Planning</option>
                <option value={1}>Active</option>
                <option value={2}>On Hold</option>
                <option value={3}>Completed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">End Date</label>
              <input type="date" name="endDate" min={formData.startDate || undefined} value={formData.endDate} onChange={handleChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs">Create</button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Project Modal ── */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Project">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Project Title *</label>
            <input required name="title" value={editFormData.title} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Project name" />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Description</label>
            <textarea name="description" value={editFormData.description} onChange={handleEditChange} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Brief description..." />
          </div>

          {/* Funding Structure Quick Selection Buttons */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-700">Funding Structure</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const firstId = (editFormData.donorIds && editFormData.donorIds.length > 0) ? editFormData.donorIds[0] : (editFormData.donorId || '');
                  setEditFormData({ ...editFormData, fundingType: 'SingleDonor', donorId: firstId, donorIds: firstId ? [firstId] : [] });
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                  editFormData.fundingType === 'SingleDonor'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Sole Funder
              </button>
              <button
                type="button"
                onClick={() => {
                  const initialIds = (editFormData.donorIds && editFormData.donorIds.length > 0)
                    ? editFormData.donorIds
                    : (editFormData.donorId ? [editFormData.donorId] : []);
                  setEditFormData({ ...editFormData, fundingType: 'MultiDonor', donorIds: initialIds });
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                  editFormData.fundingType === 'MultiDonor'
                    ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Co-Funded
              </button>
            </div>
          </div>

          {/* Donor Selection Pill Buttons */}
          {donors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  {editFormData.fundingType === 'MultiDonor' ? 'Select Co-Funding Donors (Multi-select)' : 'Select Sole Donor'}
                </label>
                {editFormData.fundingType === 'MultiDonor' && (
                  <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                    Multi-Donor Mode
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, donorId: '', donorIds: [] })}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition ${
                    (!editFormData.donorId && (!editFormData.donorIds || editFormData.donorIds.length === 0))
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  None
                </button>
                {donors.map(d => {
                  const idStr = String(d.id);
                  const isMulti = editFormData.fundingType === 'MultiDonor';
                  const isSelected = isMulti
                    ? (editFormData.donorIds || []).includes(idStr) || String(editFormData.donorId) === idStr
                    : String(editFormData.donorId) === idStr;

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        if (isMulti) {
                          const currentIds = editFormData.donorIds || (editFormData.donorId ? [String(editFormData.donorId)] : []);
                          const exists = currentIds.includes(idStr);
                          const nextIds = exists ? currentIds.filter(x => x !== idStr) : [...currentIds, idStr];
                          setEditFormData({ ...editFormData, donorIds: nextIds, donorId: nextIds[0] || '' });
                        } else {
                          setEditFormData({ ...editFormData, donorId: idStr, donorIds: [idStr] });
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && isMulti && <span>✓</span>}
                      {d.name || d.code || `Donor #${d.id}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Status</label>
              <select name="status" value={editFormData.status} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value={0}>Planning</option>
                <option value={1}>Active</option>
                <option value={2}>On Hold</option>
                <option value={3}>Completed</option>
                <option value={4}>Cancelled</option>
              </select>
            </div>
            <div />
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={editFormData.startDate} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">End Date</label>
              <input type="date" name="endDate" min={editFormData.startDate || undefined} value={editFormData.endDate} onChange={handleEditChange} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* ── Assign Team Modal ── */}
      <Modal isOpen={isTeamAssignmentOpen} onClose={() => { setIsTeamAssignmentOpen(false); setSelectedTeamIds([]); }} title="Assign Teams to Project">
        <form onSubmit={handleAssignTeam} className="space-y-4">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {teams.length === 0 ? (
              <p className="text-sm text-slate-500">No teams available in this workspace</p>
            ) : teams.filter(t => !projectTeams.some(pt => pt.teamId === t.id)).map(team => (
              <label key={team.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" value={team.id} checked={selectedTeamIds.includes(team.id)}
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    setSelectedTeamIds(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                  }} className="w-4 h-4" />
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${avatarColor(team.name)}`}>
                  {initials(team.name)}
                </div>
                <p className="text-sm font-medium text-slate-900">{team.name}</p>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setIsTeamAssignmentOpen(false); setSelectedTeamIds([]); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit" disabled={selectedTeamIds.length === 0} className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50">
              Assign ({selectedTeamIds.length})
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Replace Team Modal ── */}
      <Modal isOpen={isTeamReplacementOpen} onClose={() => { setIsTeamReplacementOpen(false); setSelectedReplacementTeamId(null); }} title="Replace Team">
        <form onSubmit={handleReplaceTeam} className="space-y-4 text-xs">
          {projectTeams.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              Current team: <span className="font-semibold">{projectTeams[0]?.name}</span>
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {teams.filter(t => !projectTeams.some(pt => pt.id === t.id)).map(team => (
              <label key={team.id} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="radio" name="team" value={team.id} checked={selectedReplacementTeamId === team.id}
                  onChange={e => setSelectedReplacementTeamId(parseInt(e.target.value))} className="w-4 h-4" />
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${avatarColor(team.name)}`}>
                  {initials(team.name)}
                </div>
                <p className="text-xs font-semibold text-slate-800">{team.name}</p>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setIsTeamReplacementOpen(false); setSelectedReplacementTeamId(null); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit" disabled={!selectedReplacementTeamId} className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50">Replace</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
