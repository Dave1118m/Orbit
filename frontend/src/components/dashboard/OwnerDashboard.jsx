import { useUser } from '../../contexts/UserContext';

export default function OwnerDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* System Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">System Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.totalOrganizations || 0}</p>
            <p className="text-sm text-slate-500">Total Organizations</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.totalUsers || 0}</p>
            <p className="text-sm text-slate-500">Total Users</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.activeProjects || 0}</p>
            <p className="text-sm text-slate-500">Active Projects</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.systemHealth || 'Good'}</p>
            <p className="text-sm text-slate-500">System Health</p>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">User Management</h2>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            Invite User
          </button>
        </div>
        <div className="w-full h-[200px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">User management interface</p>
        </div>
      </div>

      {/* System Settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">System Settings</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Email Configuration</span>
            <span className="text-green-500 text-sm">Active</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">Database Status</span>
            <span className="text-green-500 text-sm">Connected</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-700">API Rate Limiting</span>
            <span className="text-green-500 text-sm">Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
