import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { 
  BarChart3, Download, TrendingUp, TrendingDown, DollarSign, 
  Layers, RefreshCw, Calendar, CheckCircle2, AlertCircle, FileSpreadsheet, PieChart, CreditCard, HeartHandshake, ShieldCheck
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token');
  let orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  if (!orgId) {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedOrg) {
      try { orgId = JSON.parse(storedOrg).id; } catch {}
    }
  }
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = String(orgId);
  return headers;
}

export default function FinancialReports({ selectedCurrency = 'USD' }) {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [activeReportTab, setActiveReportTab] = useState('activities'); // activities, variance, cashflow, donors
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ETB: 161.44 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [orgId]);

  useEffect(() => {
    fetch(`${API_BASE}/Currency/rates?baseCurrency=USD`, { headers: authHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(rates => {
        if (rates && rates.ETB) setExchangeRates(rates);
      })
      .catch(() => {});
  }, []);

  const rate = selectedCurrency === 'ETB' ? (exchangeRates.ETB || 161.44) : 1;
  const currSymbol = selectedCurrency === 'ETB' ? 'Br ' : '$';
  const currLabel = selectedCurrency;

  const formatMoney = (usdVal) => {
    const converted = (usdVal || 0) * rate;
    return `${currSymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, sumRes, txnRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?pageSize=200`, { headers: authHeaders() })
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

  function getCategorySpent(cat) {
    const catSpentFromEntity = cat.totalExpensesAmount || 0;
    const catSpentFromTxns = transactions
      .filter(t => (t.type === 0 || t.type === 'Expense' || t.type === 'expense'))
      .reduce((sum, t) => {
        if (t.categoryId === cat.id) return sum + (t.baseCurrencyAmount || t.amount || 0);
        return sum;
      }, 0);
    return Math.max(catSpentFromEntity, catSpentFromTxns);
  }

  function getCategoryIncome(cat) {
    const catIncomeFromEntity = cat.totalIncomeAmount || 0;
    const catIncomeFromTxns = transactions
      .filter(t => (t.type === 1 || t.type === 'Income' || t.type === 'income'))
      .reduce((sum, t) => {
        if (t.categoryId === cat.id) return sum + (t.baseCurrencyAmount || t.amount || 0);
        return sum;
      }, 0);
    return Math.max(catIncomeFromEntity, catIncomeFromTxns);
  }

  const handleExportCSV = () => {
    let csv = `Category Name,Classification,Target Budget Limit (${currLabel}),Actual Spent / Income (${currLabel}),Variance / Surplus (${currLabel})\n`;
    categories.forEach(cat => {
      const isExpense = cat.type === 0 || cat.type === 2;
      const rawSpent = isExpense ? getCategorySpent(cat) : getCategoryIncome(cat);
      const spent = rawSpent * rate;
      const limit = (cat.targetBudgetLimit || 0) * rate;
      const variance = limit > 0 ? limit - spent : 0;
      csv += `"${cat.name}",${cat.type === 0 ? 'Program Expense' : (cat.type === 1 ? 'Grant Revenue' : 'General')},${limit.toFixed(2)},${spent.toFixed(2)},${variance.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NGO_Statement_of_Activities_Org_${orgId}_${currLabel}.csv`);
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
            Statement of Activities & Grant Financial Reports ({currLabel})
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
                      <span>Grant Revenues & Donor Contributions ({currLabel})</span>
                      <span>+{formatMoney(summary?.totalIncome)}</span>
                    </h4>
                    <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
                      {incomeCategories.length > 0 ? (
                        incomeCategories.map(c => {
                          const inc = getCategoryIncome(c);
                          return (
                            <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{c.name}</span>
                              <span className="font-bold text-emerald-600">+{formatMoney(inc)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-xs text-slate-400 text-center">No grant revenue categories logged.</div>
                      )}
                    </div>
                  </div>

                  {/* Programmatic & Operational Expenditures Breakdown */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-rose-800 flex items-center justify-between">
                      <span>Programmatic & Operating Expenditures ({currLabel})</span>
                      <span>-{formatMoney(summary?.totalExpenses)}</span>
                    </h4>
                    <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
                      {expenseCategories.length > 0 ? (
                        expenseCategories.map(c => {
                          const spent = getCategorySpent(c);
                          return (
                            <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{c.name}</span>
                              <span className="font-bold text-rose-600">-{formatMoney(spent)}</span>
                            </div>
                          );
                        })
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
                      Net Change in Unrestricted & Restricted Assets (Surplus / Deficit) ({currLabel})
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Calculated as Total Grant Revenue minus Total Programmatic Expenditures
                    </p>
                  </div>
                  <span className={`text-2xl font-black ${(summary?.netCashFlow || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(summary?.netCashFlow || 0) >= 0 ? '+' : ''}{formatMoney(summary?.netCashFlow)}
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
                        <th className="px-4 py-3 text-right">Target Grant Limit ({currLabel})</th>
                        <th className="px-4 py-3 text-right">Actual Expended ({currLabel})</th>
                        <th className="px-4 py-3 text-right">Remaining Fund ({currLabel})</th>
                        <th className="px-4 py-3 text-center">Burn %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map(cat => {
                        const limit = cat.targetBudgetLimit || 0;
                        const spent = getCategorySpent(cat);
                        const variance = limit > 0 ? limit - spent : 0;
                        const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                        const isOver = limit > 0 && spent > limit;

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#4F46E5' }} />
                              {cat.name}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {cat.type === 0 ? 'Program Expense' : (cat.type === 1 ? 'Grant Revenue' : 'General')}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800 font-mono">
                              {limit > 0 ? formatMoney(limit) : 'Uncapped'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono">{formatMoney(spent)}</td>
                            <td className={`px-4 py-3 text-right font-bold font-mono ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {limit > 0 ? formatMoney(variance) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {limit > 0 ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isOver ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">—</span>
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

            {/* TAB 3: Cash Flow & Liquidity Statement */}
            {activeReportTab === 'cashflow' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Statement of Cash Flows &amp; Liquid Reserves</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit of cash inflows, program disbursements, and bank liquidity balances.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Net Cash Position</span>
                    <span className={`text-xl font-black ${(summary?.netCashFlow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(summary?.netCashFlow || 0) >= 0 ? '+' : ''}{formatMoney(summary?.netCashFlow)}
                    </span>
                  </div>
                </div>

                {/* Section 1: Formal Cash Flow Statement Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="bg-slate-900 px-5 py-3 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>Cash Flow Activity Section</span>
                    <span>Amount ({currLabel})</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {/* Operating Inflows */}
                    <div className="p-4 bg-emerald-50/40">
                      <div className="flex justify-between items-center font-bold text-emerald-900">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          1. Cash Inflows from Operating Activities (Grant Revenues &amp; Contributions)
                        </span>
                        <span className="text-sm font-mono font-extrabold text-emerald-600">
                          +{formatMoney(summary?.totalIncome)}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-1 pl-6">
                        Includes institutional donor disbursements, unrestricted donations, and grant receipts.
                      </p>
                    </div>

                    {/* Operating Outflows */}
                    <div className="p-4 bg-rose-50/40">
                      <div className="flex justify-between items-center font-bold text-rose-900">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                          2. Cash Outflows for Program &amp; Operational Activities
                        </span>
                        <span className="text-sm font-mono font-extrabold text-rose-600">
                          -{formatMoney(summary?.totalExpenses)}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 mt-1 pl-6">
                        Includes direct field project expenses, personnel payroll, equipment procurement, and administrative overhead.
                      </p>
                    </div>

                    {/* Net Operating Cash Flow */}
                    <div className="p-4 bg-slate-900 text-white font-extrabold flex justify-between items-center">
                      <span>Net Cash Provided by / (Used in) Operating Activities</span>
                      <span className={`text-base font-mono ${(summary?.netCashFlow || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(summary?.netCashFlow || 0) >= 0 ? '+' : ''}{formatMoney(summary?.netCashFlow)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Liquidity Reserves & Bank Accounts */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Institutional Bank Accounts &amp; Liquid Fund Reserves
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summary?.bankAccounts?.length > 0 ? (
                      summary.bankAccounts.map(acc => (
                        <div key={acc.id} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-900">{acc.bankName}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">{acc.currency}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            <div>{acc.accountName}</div>
                            <div className="font-mono text-[11px] text-slate-400">{acc.accountNumber}</div>
                          </div>
                          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                            <span className="text-[11px] text-slate-500 font-semibold">Available Liquidity:</span>
                            <span className="text-base font-black text-slate-900 font-mono">
                              {acc.currency === 'USD' ? '$' : 'Br '}{(acc.calculatedBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {acc.currency}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                        No bank accounts configured for liquidity tracking.
                      </div>
                    )}
                  </div>
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
                    <span className="text-emerald-600">+{formatMoney(summary?.totalIncome)} ({currLabel})</span>
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

