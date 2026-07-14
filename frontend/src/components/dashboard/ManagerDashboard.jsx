import { useUser } from '../../contexts/UserContext';

export default function ManagerDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* Project Portfolio */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Project Portfolio</h2>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            New Project
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.activeProjects || 0}</p>
            <p className="text-sm text-slate-500">Active Projects</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.completedProjects || 0}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.onHoldProjects || 0}</p>
            <p className="text-sm text-slate-500">On Hold</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.overdueTasks || 0}</p>
            <p className="text-sm text-slate-500">Overdue Tasks</p>
          </div>
        </div>
      </div>

      {/* Team Performance */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Team Performance</h2>
        <div className="w-full h-[250px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Team performance metrics</p>
        </div>
      </div>

      {/* Deadline Tracking */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Upcoming Deadlines</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
            <span className="text-slate-700">Project Alpha Launch</span>
            <span className="text-red-600 text-sm font-medium">Tomorrow</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
            <span className="text-slate-700">Budget Review</span>
            <span className="text-amber-600 text-sm font-medium">3 days</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Team Meeting</span>
            <span className="text-slate-600 text-sm">Next week</span>
          </div>
        </div>
      </div>
    </div>
  );
}
