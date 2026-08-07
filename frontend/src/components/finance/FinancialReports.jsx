import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { 
  BarChart3, Download, TrendingUp, TrendingDown, DollarSign, 
  Layers, RefreshCw, Calendar, CheckCircle2, AlertCircle, FileSpreadsheet, PieChart, CreditCard, HeartHandshake, ShieldCheck
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  let orgId = localStorage.getItem('selectedOrganizationId');
  if (!orgId) {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedOrg) {
      try { orgId = JSON.parse(storedOrg).id; } catch {}
    }
  }
  if (!orgId) orgId = localStorage.getItem('selectedOrgId');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = String(orgId);
  return headers;
}

export default function FinancialReports() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [activeReportTab, setActiveReportTab] = useState('activities'); // activities, variance, cashflow, donors
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [orgId]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, sumRes, txnRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?pageSize=100`, { headers: authHeaders() })
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.items || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading NGO financial reports');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    let csv = 'Category Name,Type,Target Budget Limit ($),Actual Expenditures ($),Variance / Surplus ($)\n';
    categories.forEach(cat => {
      const spent = cat.totalExpensesAmount || 0;
      const limit = cat.targetBudgetLimit || 0;
      const variance = limit > 0 ? limit - spent : 0;
      csv += `"${cat.name}",${cat.type === 0 ? 'Expense' : 'Grant Revenue'},${limit},${spent},${variance}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NGO_Statement_of_Activities_Org_${orgId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const incomeCategories = categories.filter(c => c.type === 1 || c.type === 2);
  const expenseCategories = categories.filter(c => c.type === 0 || c.type === 2);

  return (
    <div className="space-y-6">
      {/* NGO Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              NGO & Non-Profit Financial Standard
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            Statement of Activities & Grant Financial Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Statement of Revenue & Expenditures, Grant Budget Variance, Liquidity Statements, and Donor Fund Audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export NGO Statement (CSV)
          </button>
        </div>
      </div>

      {/* Subtab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 p-1 gap-1">
          {[
            { id: 'activities', label: 'Statement of Activities (Revenue & Expenses)', icon: DollarSign },
            { id: 'variance', label: 'Grant Budget vs Actual Variance', icon: PieChart },
            { id: 'cashflow', label: 'Liquidity & Cash Flow Statement', icon: CreditCard },
            { id: 'donors', label: 'Donor Fund Utilization Audit', icon: HeartHandshake }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeReportTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition ${
                  isActive
                    ? 'bg-white text-brand-600 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl m-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Generating NGO Financial Statements...</p>
          </div>
        ) : (
          <div className="p-6">
            {/* TAB 1: Statement of Activities (Revenue & Expenditures) */}
            {activeReportTab === 'activities' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Breakdown */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800 flex items-center justify-between">
                      <span>Grant Revenues & Donor Contributions</span>
                      <span>+${(summary?.totalIncome || 0).toLocaleString()}</span>
                    </h4>
                    <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
                      {incomeCategories.length > 0 ? (
                        incomeCategories.map(c => (
                          <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <span className="font-bold text-emerald-600">+${(c.totalIncomeAmount || 0).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-xs text-slate-400 text-center">No grant revenue categories logged.</div>
                      )}
                    </div>
                  </div>

                  {/* Programmatic & Operational Expenditures Breakdown */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-rose-800 flex items-center justify-between">
                      <span>Programmatic & Operating Expenditures</span>
                      <span>-${(summary?.totalExpenses || 0).toLocaleString()}</span>
                    </h4>
                    <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
                      {expenseCategories.length > 0 ? (
                        expenseCategories.map(c => (
                          <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <span className="font-bold text-rose-600">-${(c.totalExpensesAmount || 0).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-xs text-slate-400 text-center">No expenditure categories logged.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Net Surplus / Deficit Summary Box */}
                <div className="p-6 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Net Change in Unrestricted & Restricted Assets (Surplus / Deficit)
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Calculated as Total Grant Revenue minus Total Programmatic Expenditures
                    </p>
                  </div>
                  <span className={`text-2xl font-black ${(summary?.netCashFlow || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(summary?.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Budget vs Actual Variance */}
            {activeReportTab === 'variance' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Category Name</th>
                        <th className="px-4 py-3">Classification</th>
                        <th className="px-4 py-3 text-right">Target Grant Limit</th>
                        <th className="px-4 py-3 text-right">Actual Expended</th>
                        <th className="px-4 py-3 text-right">Remaining Fund ($)</th>
                        <th className="px-4 py-3 text-center">Burn %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map(cat => {
                        const limit = cat.targetBudgetLimit || 0;
                        const spent = cat.totalExpensesAmount || 0;
                        const variance = limit > 0 ? limit - spent : 0;
                        const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                        const isOver = limit > 0 && spent > limit;

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || '#4F46E5' }} />
                              {cat.name}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {cat.type === 0 ? 'Program Expense' : (cat.type === 1 ? 'Grant Revenue' : 'General')}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              {limit > 0 ? `$${limit.toLocaleString()}` : 'Uncapped'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">${spent.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {limit > 0 ? `$${variance.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {limit > 0 ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isOver ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Cash Flow & Liquidity */}
            {activeReportTab === 'cashflow' && (
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-slate-900">NGO Bank Account Liquidity & Reserve Funds</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {summary?.bankAccounts?.map(acc => (
                    <div key={acc.id} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-900 block">{acc.bankName}</span>
                      <span className="text-xs text-slate-500 block">{acc.accountName} ({acc.accountNumber})</span>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Liquid Balance:</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          ${acc.calculatedBalance.toLocaleString()} {acc.currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Donor Fund Utilization */}
            {activeReportTab === 'donors' && (
              <div className="space-y-4 text-xs text-slate-600">
                <p className="text-slate-500">
                  Comprehensive audit of institutional and individual donor contributions allocated to program projects.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                    <span>Total Allocated Donor Grants & Contributions</span>
                    <span className="text-emerald-600">+${(summary?.totalIncome || 0).toLocaleString()} USD</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    All donor contributions are tracked to donor agreements and linked bank accounts.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
