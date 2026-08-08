import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  PieChart, BarChart3, RefreshCw, ShieldCheck
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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

export default function FinancialDashboard() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFinancialData();
  }, [orgId]);

  const fetchFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, catRes, txnRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?pageSize=200`, { headers: authHeaders() })
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (txnRes.ok) {
        const data = await txnRes.json();
        setTransactions(data.items || []);
      }
    } catch (err) {
      console.error('Financial dashboard fetch error:', err);
      setError('Unable to fetch live financial analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-600 animate-pulse">Loading NGO Financial Analytics...</p>
        </div>
      </div>
    );
  }

  const totalIncome = summary?.totalIncome || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const netCashFlow = summary?.netCashFlow ?? (totalIncome - totalExpenses);
  const bankAccounts = summary?.bankAccounts || [];

  // Dynamic Category Doughnut Data (100% Live from Database)
  const expenseCategories = categories.filter(c => c.type === 0 || c.type === 2 || c.type === 'Expense' || c.type === 'Both' || c.type === 'expense');
  const catLabels = expenseCategories.length > 0 ? expenseCategories.map(c => c.name) : ['No Expense Categories'];
  
  // Calculate total expense values per category dynamically from transactions + category entity
  const catDataValues = expenseCategories.map(cat => {
    const catSpentFromEntity = cat.totalExpensesAmount || 0;
    const catSpentFromTxns = transactions
      .filter(t => t.type === 0 || t.type === 'Expense' || t.type === 'expense')
      .reduce((sum, t) => {
        if (t.categoryId === cat.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
        const catNameLower = cat.name.toLowerCase();
        const tDesc = (t.description || '').toLowerCase();
        const tCat = (t.category || t.categoryName || '').toLowerCase();
        if (tCat && tCat.includes(catNameLower)) return sum + (t.amount || t.baseCurrencyAmount || 0);
        return sum;
      }, 0);
    return Math.max(catSpentFromEntity, catSpentFromTxns);
  });

  const catColors = expenseCategories.length > 0 ? expenseCategories.map(c => c.color || '#6366f1') : ['#e2e8f0'];

  const categoryDoughnutData = {
    labels: catLabels,
    datasets: [
      {
        data: catDataValues,
        backgroundColor: catColors,
        borderWidth: 0,
      },
    ],
  };

  // Dynamic Monthly Income vs Expense Trend Bar Chart (100% Live from Transactions DB)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthIdx = new Date().getMonth();
  const last6MonthLabels = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (currentMonthIdx - i + 12) % 12;
    last6MonthLabels.push(monthNames[idx]);
  }

  const monthlyIncome = new Array(6).fill(0);
  const monthlyExpenses = new Array(6).fill(0);

  transactions.forEach((t) => {
    const dateStr = t.transactionDate || t.date || t.createdAt;
    if (!dateStr) return;
    const d = new Date(dateStr);
    const mName = monthNames[d.getMonth()];
    const pos = last6MonthLabels.indexOf(mName);
    if (pos !== -1) {
      const amt = t.amount || t.baseCurrencyAmount || 0;
      if (t.type === 1 || t.type === 'Income' || t.type === 'income') {
        monthlyIncome[pos] += amt;
      } else if (t.type === 0 || t.type === 'Expense' || t.type === 'expense') {
        monthlyExpenses[pos] += amt;
      }
    }
  });

  const trendData = {
    labels: last6MonthLabels,
    datasets: [
      {
        label: 'Grant Revenue / Income ($)',
        data: monthlyIncome,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 6,
      },
      {
        label: 'Program Expenditures ($)',
        data: monthlyExpenses,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {error && (
        <div className="p-4 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Overview Cards (100% Live Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center justify-between text-indigo-200 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Grant Revenue / Income</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black tracking-tight text-white">
            ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-xs text-indigo-300 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            Includes restricted & unrestricted funds
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Program & Admin Expenses</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900">
            ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
            Functional expense allocation
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Net Operating Surplus</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {netCashFlow >= 0 ? '+Surplus' : '-Deficit'}
            </span>
          </div>
          <div className={`text-2xl font-black tracking-tight ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ${netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Fund balance available for projects
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-900 via-slate-900 to-slate-950 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-200 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Burn-Rate Velocity</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black tracking-tight text-white">
            ${(totalExpenses > 0 ? (totalExpenses / 6) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
          </div>
          <p className="mt-2 text-xs text-amber-200/80 flex items-center justify-between">
            <span>Est. Run-Out Date:</span>
            <span className="font-bold text-amber-300 font-mono">
              {totalExpenses > 0 && totalIncome > totalExpenses
                ? new Date(new Date().setMonth(new Date().getMonth() + Math.round((totalIncome - totalExpenses) / (totalExpenses / 6)))).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : 'Balanced'}
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2 text-xs font-semibold uppercase tracking-wider">
            <span>Active Bank Reserve</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900">
            {bankAccounts.length} Account{bankAccounts.length !== 1 ? 's' : ''}
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">
            {bankAccounts.length > 0 ? `${bankAccounts[0].bankName} (${bankAccounts[0].currency})` : 'No active bank accounts'}
          </p>
        </div>
      </div>

      {/* Interactive Charts Section (100% Live Data) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expenses Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Monthly Revenue vs Project Disbursement Trend
              </h3>
              <p className="text-xs text-slate-500">Comparison of incoming donor grants and outgoing activity expenditures</p>
            </div>
            <button 
              onClick={fetchFinancialData}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
              title="Refresh Analytics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="h-72">
            <Bar data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
          </div>
        </div>

        {/* Expense Category Distribution Doughnut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Expenditure by Category
            </h3>
            <p className="text-xs text-slate-500">Functional breakdown across NGO project budget lines</p>
          </div>
          <div className="h-56 relative flex items-center justify-center my-auto">
            <Doughnut data={categoryDoughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </div>
      </div>

      {/* NGO Functional Expense Table (100% Live Data from Database) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">NGO Functional Expense & Budget Line Breakdown</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Budget utilization tracking against donor-approved ceilings</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              {categories.length} Categories Registered
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-y border-slate-200">
                <th className="py-3 px-4">Category / Code</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Target Limit</th>
                <th className="py-3 px-4 text-right">Actual Spent</th>
                <th className="py-3 px-4 text-right">Budget Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.length > 0 ? (
                categories.map((cat) => {
                  const isIncomeCat = cat.type === 1 || cat.type === 'Income' || cat.type === 'income';
                  
                  const txnSpent = transactions
                    .filter(t => (t.type === 0 || t.type === 'Expense' || t.type === 'expense'))
                    .reduce((sum, t) => {
                      if (t.categoryId === cat.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
                      const catNameLower = cat.name.toLowerCase();
                      const tDesc = (t.description || '').toLowerCase();
                      const tCat = (t.category || t.categoryName || '').toLowerCase();
                      if (tCat && tCat.includes(catNameLower)) return sum + (t.amount || t.baseCurrencyAmount || 0);
                      if (catNameLower.includes('equipment') && (tDesc.includes('equipment') || tDesc.includes('solar') || tDesc.includes('water') || tDesc.includes('pump') || tCat.includes('equipment'))) {
                        return sum + (t.amount || t.baseCurrencyAmount || 0);
                      }
                      if (catNameLower.includes('travel') && (tDesc.includes('travel') || tDesc.includes('flight') || tCat.includes('travel'))) {
                        return sum + (t.amount || t.baseCurrencyAmount || 0);
                      }
                      if (catNameLower.includes('personnel') && (tDesc.includes('payroll') || tDesc.includes('salary') || tDesc.includes('personnel') || tCat.includes('personnel'))) {
                        return sum + (t.amount || t.baseCurrencyAmount || 0);
                      }
                      if (catNameLower.includes('operations') && (tDesc.includes('office') || tDesc.includes('admin') || tDesc.includes('ops') || tCat.includes('operations'))) {
                        return sum + (t.amount || t.baseCurrencyAmount || 0);
                      }
                      return sum;
                    }, 0);

                  const txnIncome = transactions
                    .filter(t => (t.type === 1 || t.type === 'Income' || t.type === 'income'))
                    .reduce((sum, t) => {
                      if (t.categoryId === cat.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
                      const catNameLower = cat.name.toLowerCase();
                      const tCat = (t.category || t.categoryName || '').toLowerCase();
                      if (tCat && tCat.includes(catNameLower)) return sum + (t.amount || t.baseCurrencyAmount || 0);
                      return sum;
                    }, 0);

                  const spent = isIncomeCat 
                    ? Math.max(cat.totalIncomeAmount || 0, txnIncome)
                    : Math.max(cat.totalExpensesAmount || 0, txnSpent);

                  const limit = cat.targetBudgetLimit || 0;
                  const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }}></span>
                        {cat.name}
                        {cat.code && <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">[{cat.code}]</span>}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className={`px-2.5 py-1 rounded-full ${isIncomeCat ? 'bg-emerald-50 text-emerald-700' : (cat.type === 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700')}`}>
                          {isIncomeCat ? 'Grant Revenue' : (cat.type === 0 ? 'Expense Line' : 'General')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 font-mono">
                        {limit > 0 ? `$${limit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Uncapped'}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold font-mono ${isIncomeCat ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isIncomeCat ? '+' : ''}${spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {limit > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-xs text-slate-400">
                    No financial categories logged yet. Register categories under Finance &rarr; Categories.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
