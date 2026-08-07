import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import CommonAnalyticsHub from './CommonAnalyticsHub';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';

export default function MemberDashboard({ tasks = [], projects = [] }) {
  const { user } = useUser();
  const navigate = useNavigate();

  // Priority tasks (not done, sorted by high priority or deadline)
  const priorityTasks = tasks
    .filter(t => t.status !== 4 && t.status !== 'Done')
    .slice(0, 5);

  const completedCount = tasks.filter(t => t.status === 4 || t.status === 'Done').length;
  const totalCount = tasks.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 3:
      case 'Urgent':
      case 2:
      case 'High':
        return <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">High</span>;
      case 1:
      case 'Medium':
        return <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Medium</span>;
      default:
        return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Low</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* ── Role Specific Header ── */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Member Workspace</h1>
        <p className="text-slate-500">Your assigned tasks, active projects, and personal velocity.</p>
      </div>

      {/* ── Task & Project Charts - Side by Side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProjectStatusChart projects={projects} />
        <TaskStatusChart tasks={tasks} />
      </div>

      {/* ── Active Tasks & Projects List + Activity Feed ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projects} tasks={tasks} />
        <ActivityFeed />
      </div>

      {/* ── Member Specific Widgets ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Priority Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">My Priority Tasks</h2>
            <button 
              onClick={() => navigate('/tasks')}
              className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-sm font-semibold hover:bg-brand-100 transition"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {priorityTasks.length > 0 ? (
              priorityTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-4 p-3 bg-slate-50 hover:bg-slate-100 transition rounded-xl border border-slate-100">
                  <div className="h-4 w-4 rounded border-2 border-slate-300 flex-shrink-0 cursor-pointer hover:border-brand-500 transition"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {t.projectName ? `Project: ${t.projectName}` : 'Active Task'} • {t.deadline ? `Due ${new Date(t.deadline).toLocaleDateString()}` : 'No deadline'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {getPriorityBadge(t.priority)}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                No active priority tasks found.
              </div>
            )}
          </div>
        </div>

        {/* Personal Progress Tracking */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">My Progress</h2>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">Overall Task Completion</span>
                <span className="font-bold text-slate-900">{completedCount} / {totalCount} ({completionPercent}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }}></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div onClick={() => navigate('/tasks')} className="p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-slate-100 transition">
                <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
                <p className="text-sm text-slate-500 mt-1">Completed Tasks</p>
              </div>
              <div onClick={() => navigate('/tasks')} className="p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-slate-100 transition">
                <p className="text-2xl font-bold text-slate-900">{priorityTasks.length}</p>
                <p className="text-sm text-slate-500 mt-1">Pending Priority Tasks</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
