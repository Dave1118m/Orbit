import { useUser } from '../../contexts/UserContext';

export default function AdminDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* Organization Health */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Organization Health</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.activeMembers || 0}</p>
            <p className="text-sm text-slate-500">Active Members</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.pendingInvites || 0}</p>
            <p className="text-sm text-slate-500">Pending Invitations</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.complianceStatus || 'Good'}</p>
            <p className="text-sm text-slate-500">Compliance Status</p>
          </div>
        </div>
      </div>

      {/* Team Management */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Team Management</h2>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            Create Team
          </button>
        </div>
        <div className="w-full h-[200px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Team management interface</p>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Budget Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">${user?.totalBudget || 0}</p>
            <p className="text-sm text-slate-500">Total Budget</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">${user?.spentBudget || 0}</p>
            <p className="text-sm text-slate-500">Spent</p>
          </div>
        </div>
      </div>
    </div>
  );
}
