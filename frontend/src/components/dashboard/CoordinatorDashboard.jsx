import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';
import Modal from '../Modal';
import { 
  Building2, 
  FolderKanban, 
  Users, 
  CheckCircle2, 
  Clock, 
  Plus, 
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Briefcase
} from 'lucide-react';

export default function CoordinatorDashboard({ 
  tasks = [], 
  projects = [], 
  teams = [], 
  workspaces = [], 
  expenses = [] 
}) {
  const { user } = useUser();
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspaceList, setWorkspaceList] = useState(workspaces);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budgetCeiling: '',
    visibility: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL;
  const storedOrgId = localStorage.getItem('selectedOrganizationId');

  // Real Metric Calculations
  const activeWorkspacesCount = workspaceList.length || workspaces.length;
  const totalProjectsCount = projects.length;
  const totalTeamsCount = teams.length;
  const assignedTasksCount = tasks.filter(t => t.status !== 2).length; // Non-completed tasks
  const pendingApprovalsCount = expenses.filter(e => e.approvalStatus === 0 || e.approvalStatus === 'Pending').length;

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMsg('Workspace name must be at least 2 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const orgId = storedOrgId || user?.organizationId || 1;

      const res = await fetch(`${API_BASE}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Organization-Id': orgId.toString()
        },
        body: JSON.stringify({
          organizationId: parseInt(orgId, 10),
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          budgetCeiling: formData.budgetCeiling ? parseFloat(formData.budgetCeiling) : null,
          visibility: parseInt(formData.visibility, 10)
        })
      });

      if (res.ok) {
        const created = await res.json();
        setWorkspaceList(prev => [...prev, created]);
        setSuccessMsg(`Workspace "${created.name}" created successfully!`);
        setFormData({ name: '', description: '', budgetCeiling: '', visibility: 0 });
        setTimeout(() => {
          setIsWorkspaceModalOpen(false);
          setSuccessMsg('');
        }, 1200);
      } else {
        const errText = await res.text();
        setErrorMsg(errText || 'Failed to create workspace.');
      }
    } catch (err) {
      setErrorMsg('Network error while creating workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-8">
      {/* ── Role Specific Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-cyan-500/20 p-2 text-cyan-400 border border-cyan-500/30">
              <Briefcase className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">Program Coordinator Command Center</h1>
          </div>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            Oversee program workspaces, track live project health, coordinate team assignments, and manage resource allocations.
          </p>
        </div>

        <button
          onClick={() => setIsWorkspaceModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-3 text-xs font-extrabold text-white transition hover:opacity-90 active:scale-95 shadow-lg shadow-cyan-500/25 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Workspace</span>
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/projects" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-cyan-600 transition">{activeWorkspacesCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Active Workspaces</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <Building2 className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/projects" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition">{totalProjectsCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Program Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <FolderKanban className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/tasks" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">{assignedTasksCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Active Tasks</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/finance" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition">{pendingApprovalsCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Pending Approvals</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <Clock className="h-5 w-5" />
          </div>
        </Link>
      </div>

      {/* ── Task & Project Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectStatusChart projects={projects} />
        <TaskStatusChart tasks={tasks} />
      </div>

      {/* ── Interactive Project Coordination Board ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🎯 Project Coordination Matrix</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Live tracking of active program projects, health status, and assigned teams.</p>
          </div>
          <a href="/projects" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <span>Manage All Projects</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {projects.length === 0 ? (
          <div className="w-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <FolderKanban className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No active projects found</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Create a workspace and add your first project to start coordinating teams and tracking logframes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map(proj => {
              const taskCount = tasks.filter(t => t.projectId === proj.id).length;
              const completedCount = tasks.filter(t => t.projectId === proj.id && t.status === 2).length;
              const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : (proj.status === 3 ? 100 : 25);

              return (
                <div key={proj.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 hover:bg-white hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 truncate max-w-[170px]">{proj.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{taskCount} Total Tasks</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      proj.status === 1 ? 'bg-emerald-100 text-emerald-700' :
                      proj.status === 2 ? 'bg-amber-100 text-amber-700' :
                      proj.status === 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {proj.status === 1 ? 'Active' : proj.status === 2 ? 'On Hold' : proj.status === 3 ? 'Completed' : 'Planning'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{proj.teams?.length || 1} Teams</span>
                    </div>
                    {proj.budget && (
                      <span className="font-bold text-slate-700">${proj.budget.toLocaleString()} USD</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Active Projects & Activity Feed ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projects} tasks={tasks} />
        <ActivityFeed />
      </div>

      {/* ── CREATE WORKSPACE MODAL ── */}
      <Modal isOpen={isWorkspaceModalOpen} onClose={() => setIsWorkspaceModalOpen(false)} title="Create Program Workspace">
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Workspace Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Health & Infrastructure Program"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Program goals and team coordination scope..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Budget Ceiling ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.budgetCeiling}
                onChange={e => setFormData({ ...formData, budgetCeiling: e.target.value })}
                placeholder="500000.00"
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Visibility Level</label>
              <select
                value={formData.visibility}
                onChange={e => setFormData({ ...formData, visibility: e.target.value })}
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white"
              >
                <option value={0}>Public</option>
                <option value={1}>Internal</option>
                <option value={2}>Private</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsWorkspaceModalOpen(false)}
              className="rounded-full px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
