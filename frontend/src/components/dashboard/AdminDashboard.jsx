import { useUser } from '../../contexts/UserContext';
import { Link } from 'react-router-dom';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';
import { FolderKanban, CheckCircle2, Users } from 'lucide-react';

export default function AdminDashboard({ stats = {}, tasks = [], projects = [] }) {
  const { user } = useUser();

  const StatCard = ({ title, value, icon, color, to }) => (
    <Link to={to} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between h-40 transition hover:shadow-md hover:border-indigo-300 group cursor-pointer">
      <div className="flex justify-between items-start">
        <div className={`h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center ${color} group-hover:scale-110 transition`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition">
          {value !== null && value !== undefined ? value : 0}
        </p>
        <p className="text-sm font-semibold text-slate-500 mt-1">{title}</p>
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
        <p className="text-slate-500">Manage settings, tasks, and monitor workspace health.</p>
      </div>

      {/* ── Stat Summary Cards (3 Columns) ── */}
      <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-3">
        <StatCard 
          title="Total Projects" 
          value={projects.length || stats.projectsCount} 
          color="text-brand-500"
          icon={<FolderKanban className="w-5 h-5" />}
          to="/projects"
        />
        <StatCard 
          title="Total Tasks" 
          value={tasks.length || stats.tasksCount} 
          color="text-emerald-500"
          icon={<CheckCircle2 className="w-5 h-5" />}
          to="/tasks"
        />
        <StatCard 
          title="Teams" 
          value={stats.teamsCount} 
          color="text-indigo-500"
          icon={<Users className="w-5 h-5" />}
          to="/teams"
        />
      </div>

      {/* ── Charts Section - Side by Side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
