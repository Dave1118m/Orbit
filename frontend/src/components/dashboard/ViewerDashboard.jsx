import { useUser } from '../../contexts/UserContext';

export default function ViewerDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* Project Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Project Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.totalProjects || 0}</p>
            <p className="text-sm text-slate-500">Total Projects</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.activeProjects || 0}</p>
            <p className="text-sm text-slate-500">Active</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.completedProjects || 0}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.onHoldProjects || 0}</p>
            <p className="text-sm text-slate-500">On Hold</p>
          </div>
        </div>
      </div>

      {/* Team Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Team Information</h2>
        <div className="w-full h-[250px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Team information (read-only)</p>
        </div>
      </div>

      {/* Reports View */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Reports</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.availableReports || 0}</p>
            <p className="text-sm text-slate-500">Available Reports</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.lastReportUpdate || 'Today'}</p>
            <p className="text-sm text-slate-500">Last Update</p>
          </div>
        </div>
      </div>

      {/* Organization Updates */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Organization Updates</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">New project: Community Health Initiative</span>
            <span className="text-slate-400 text-xs ml-auto">1d ago</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">Budget approved for Q3</span>
            <span className="text-slate-400 text-xs ml-auto">3d ago</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-slate-700 text-sm">Team restructuring completed</span>
            <span className="text-slate-400 text-xs ml-auto">1w ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
