import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';
import { FolderKanban, CheckCircle2, Clock, AlertTriangle, ArrowRight, Plus } from 'lucide-react';

export default function ManagerDashboard({ stats = {}, tasks = [], projects = [] }) {
  const { user } = useUser();
  const navigate = useNavigate();

  const activeProjects = projects.filter(p => p.status === 1 || p.status === 'Active' || p.status === 0).length;
  const completedProjects = projects.filter(p => p.status === 3 || p.status === 'Completed').length;
  const onHoldProjects = projects.filter(p => p.status === 2 || p.status === 'OnHold').length;

  const now = new Date();
  const overdueTasksCount = tasks.filter(t => (t.status !== 2 && t.status !== 'Done') && t.deadline && new Date(t.deadline) < now).length;

  const upcomingDeadlineTasks = tasks
    .filter(t => t.deadline && (t.status !== 2 && t.status !== 'Done'))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-8">
      {/* ── Role Specific Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-500/20">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
            Project Manager Console
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">Manager Executive Dashboard</h1>
          <p className="text-xs text-slate-300 mt-1">
            Track project deliverables, monitor team task velocity, and resolve overdue project bottlenecks.
          </p>
        </div>

        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-3 text-xs font-extrabold text-white transition hover:opacity-90 active:scale-95 shadow-lg shadow-cyan-500/25 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* ── Portfolio Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div onClick={() => navigate('/projects')} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-cyan-600 transition">{activeProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Active Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <FolderKanban className="h-5 w-5" />
          </div>
        </div>

        <div onClick={() => navigate('/projects')} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">{completedProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Completed Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div onClick={() => navigate('/projects')} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition">{onHoldProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">On Hold Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div onClick={() => navigate('/tasks')} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-2xl font-black text-rose-600 group-hover:text-rose-700 transition">{overdueTasksCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Overdue Tasks</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── Task & Project Charts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectStatusChart projects={projects} />
        <TaskStatusChart tasks={tasks} />
      </div>

      {/* ── Upcoming Task Deadlines ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>⏰ Upcoming Task Deadlines</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Monitor critical path task deadlines and schedule risk.</p>
          </div>
          <button onClick={() => navigate('/tasks')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <span>View All Tasks</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {upcomingDeadlineTasks.length > 0 ? (
            upcomingDeadlineTasks.map(t => {
              const isOverdue = new Date(t.deadline) < now;
              return (
                <div key={t.id} className={`flex justify-between items-center p-3.5 rounded-2xl border ${isOverdue ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50/70 border-slate-200'}`}>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.projectName ? `Project: ${t.projectName}` : 'Project Task'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                    {isOverdue ? 'Overdue' : `Due ${new Date(t.deadline).toLocaleDateString()}`}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              No upcoming task deadlines recorded.
            </div>
          )}
        </div>
      </div>

      {/* ── Active Tasks & Projects List + Activity Feed ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projects} tasks={tasks} />
        <ActivityFeed />
      </div>
    </div>
  );
}
