import { useUser } from '../../contexts/UserContext';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';
import { Eye, FolderKanban, CheckCircle2, Clock, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ViewerDashboard({ tasks = [], projects = [] }) {
  const { user } = useUser();

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 1 || p.status === 'Active' || p.status === 0).length;
  const completedProjects = projects.filter(p => p.status === 3 || p.status === 'Completed').length;
  const onHoldProjects = projects.filter(p => p.status === 2 || p.status === 'OnHold').length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-8">
      {/* ── Read-Only Viewer Banner ── */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
              Institutional Read-Only Audit Portal
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Observer & Auditor Dashboard</h1>
          <p className="text-xs text-slate-300 mt-1">
            Read-only visibility into organization metrics, project statuses, logframes, and compliance reports.
          </p>
        </div>

        <Link
          to="/reports"
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-extrabold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-90 text-white rounded-2xl shadow-lg transition"
        >
          <FileText className="w-4 h-4" />
          <span>View Public Reports</span>
        </Link>
      </div>

      {/* ── Live Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/projects" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-cyan-600 transition">{totalProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Total Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <FolderKanban className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/projects" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">{activeProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Active Projects</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/projects" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition">{completedProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Completed</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-110 transition">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </Link>

        <Link to="/projects" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition flex items-center justify-between group">
          <div>
            <p className="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition">{onHoldProjects}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">On Hold</p>
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

      {/* ── Active Tasks & Projects List + Activity Feed ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projects} tasks={tasks} />
        <ActivityFeed />
      </div>
    </div>
  );
}
