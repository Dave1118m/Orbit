import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { Link } from 'react-router-dom';
import ProjectStatusChart from './ProjectStatusChart';
import TaskStatusChart from './TaskStatusChart';
import ActiveProjectsList from './ActiveProjectsList';
import ActivityFeed from './ActivityFeed';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, Receipt, 
  ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, FileText,
  Clock
} from 'lucide-react';

export default function FinanceOfficerDashboard({ tasks = [], projects = [] }) {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId');
  const orgId = storedOrgId || currentOrganization?.id || 1;

  const [summary, setSummary] = useState(null);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchFinancialData();
  }, [orgId]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'X-Organization-Id': orgId.toString()
      };

      const [sumRes, expRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers }),
        fetch(`${API_BASE}/expenses`, { headers })
      ]);

      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
      if (expRes.ok) {
        const expData = await expRes.json();
        setPendingExpenses(expData.filter(e => e.approvalStatus === 0 || e.approvalStatus === 'Pending'));
      }
    } catch (err) {
      console.error('Error loading finance officer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-8">
      {/* Executive Financial Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
            Finance & Executive Overview
          </span>
          <h2 className="text-2xl font-black mt-1 text-white">Finance Officer Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time cash flow monitoring, expense approval queue, and audit control.
          </p>
        </div>
        <Link
          to="/finance"
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white rounded-2xl shadow-lg transition"
        >
          <span>Open Full Finance Suite</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/finance" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold group-hover:scale-110 transition">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Revenue / Income</span>
            <p className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition mt-0.5">
              ${(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
            </p>
          </div>
        </Link>

        <Link to="/finance" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold group-hover:scale-110 transition">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Expenses</span>
            <p className="text-xl font-black text-slate-900 group-hover:text-rose-600 transition mt-0.5">
              ${(summary?.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
            </p>
          </div>
        </Link>

        <Link to="/finance" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold group-hover:scale-110 transition">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Net Cash Flow</span>
            <p className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition mt-0.5">
              ${(summary?.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
            </p>
          </div>
        </Link>

        <Link to="/finance" className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 font-bold group-hover:scale-110 transition">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Pending Approvals</span>
            <p className="text-xl font-black text-slate-900 group-hover:text-amber-600 transition mt-0.5">
              {pendingExpenses.length} Claims
            </p>
          </div>
        </Link>
      </div>

      {/* Pending Expenses Approval Queue */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <span>💳 Expense Claim Approval Queue</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Review and sign off on submitted project expenses and receipt attachments.</p>
          </div>
          <Link to="/finance" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <span>Manage All Expenses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingExpenses.length === 0 ? (
          <div className="w-full py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
            <p className="text-sm font-bold text-slate-700">Approval Queue Clear</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              All submitted expense claims have been reviewed and processed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingExpenses.slice(0, 5).map(exp => (
              <div key={exp.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                    ${exp.amount}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{exp.description || 'Expense Claim'}</p>
                    <p className="text-xs text-slate-500">
                      Submitted by {exp.submittedByUserName || 'Staff'} • {exp.date ? new Date(exp.date).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    ${exp.amount?.toLocaleString()} {exp.currency || 'USD'}
                  </span>
                  <Link
                    to="/finance"
                    className="rounded-full bg-indigo-50 text-indigo-600 px-4 py-1.5 text-xs font-bold hover:bg-indigo-100 transition"
                  >
                    Review Claim
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task & Project Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectStatusChart projects={projects} />
        <TaskStatusChart tasks={tasks} />
      </div>

      {/* Active Tasks & Projects List + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projects} tasks={tasks} />
        <ActivityFeed />
      </div>
    </div>
  );
}
