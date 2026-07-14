import { useUser } from '../../contexts/UserContext';

export default function MemberDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* My Tasks */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">My Tasks</h2>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            New Task
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.myTasks || 0}</p>
            <p className="text-sm text-slate-500">Total Tasks</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.inProgressTasks || 0}</p>
            <p className="text-sm text-slate-500">In Progress</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.completedTasks || 0}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.overdueTasks || 0}</p>
            <p className="text-sm text-slate-500">Overdue</p>
          </div>
        </div>
      </div>

      {/* Team Projects */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Team Projects</h2>
        <div className="w-full h-[250px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Team projects interface</p>
        </div>
      </div>

      {/* Progress Tracking */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">My Progress</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Weekly Goal</span>
            <span className="text-slate-600 text-sm">{user?.weeklyProgress || 0}%</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Tasks Completed Today</span>
            <span className="text-slate-600 text-sm">{user?.todayTasks || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Team Contribution</span>
            <span className="text-slate-600 text-sm">{user?.teamContribution || 0}%</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">Completed task: Design review</span>
            <span className="text-slate-400 text-xs ml-auto">2h ago</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">Commented on: Project Alpha</span>
            <span className="text-slate-400 text-xs ml-auto">5h ago</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">Started task: API integration</span>
            <span className="text-slate-400 text-xs ml-auto">1d ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
