import { useUser } from '../../contexts/UserContext';

export default function CoordinatorDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* Workspace Management */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Workspace Management</h2>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            Create Workspace
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.activeWorkspaces || 0}</p>
            <p className="text-sm text-slate-500">Active Workspaces</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.totalProjects || 0}</p>
            <p className="text-sm text-slate-500">Total Projects</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.teamCount || 0}</p>
            <p className="text-sm text-slate-500">Teams</p>
          </div>
        </div>
      </div>

      {/* Project Coordination */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Project Coordination</h2>
        <div className="w-full h-[250px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Project coordination interface</p>
        </div>
      </div>

      {/* Resource Allocation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Resource Allocation</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.assignedTasks || 0}</p>
            <p className="text-sm text-slate-500">Assigned Tasks</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.pendingApprovals || 0}</p>
            <p className="text-sm text-slate-500">Pending Approvals</p>
          </div>
        </div>
      </div>
    </div>
  );
}
