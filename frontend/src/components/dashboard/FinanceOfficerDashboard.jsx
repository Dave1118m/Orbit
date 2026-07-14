import { useUser } from '../../contexts/UserContext';

export default function FinanceOfficerDashboard() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      {/* Budget Tracking */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Budget Tracking</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">${user?.totalBudget || 0}</p>
            <p className="text-sm text-slate-500">Total Budget</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">${user?.spentBudget || 0}</p>
            <p className="text-sm text-slate-500">Spent</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">${user?.remainingBudget || 0}</p>
            <p className="text-sm text-slate-500">Remaining</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.budgetUtilization || 0}%</p>
            <p className="text-sm text-slate-500">Utilization</p>
          </div>
        </div>
      </div>

      {/* Expense Approval Queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Expense Approval Queue</h2>
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            {user?.pendingExpenses || 0} Pending
          </span>
        </div>
        <div className="w-full h-[250px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <p className="text-slate-400">Expense approval interface</p>
        </div>
      </div>

      {/* Financial Reports */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Financial Reports</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.monthlyExpenses || 0}</p>
            <p className="text-sm text-slate-500">Monthly Expenses</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{user?.donorCount || 0}</p>
            <p className="text-sm text-slate-500">Active Donors</p>
          </div>
        </div>
      </div>

      {/* Compliance Tracking */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Compliance Status</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
            <span className="text-slate-700">Tax Exemption</span>
            <span className="text-green-600 text-sm font-medium">Valid</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
            <span className="text-slate-700">Registration</span>
            <span className="text-green-600 text-sm font-medium">Current</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
            <span className="text-slate-700">Audit Status</span>
            <span className="text-amber-600 text-sm font-medium">Due in 30 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
