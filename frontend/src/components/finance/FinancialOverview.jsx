import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import PaymentVoucherModal from './PaymentVoucherModal';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, ArrowRightLeft,
  Search, RefreshCw, AlertCircle, CheckCircle2, FileText, AlertTriangle, Calculator, Printer
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  let orgId = localStorage.getItem('selectedOrganizationId');
  if (!orgId) {
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedOrg) {
      try { orgId = JSON.parse(storedOrg).id; } catch { }
    }
  }
  if (!orgId) orgId = localStorage.getItem('selectedOrgId');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = String(orgId);
  return headers;
}

export default function FinancialOverview() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Bank Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    fromBankAccountId: '',
    toBankAccountId: '',
    amount: '',
    description: 'Inter-account bank transfer',
    referenceNumber: ''
  });
  const [transferring, setTransferring] = useState(false);

  // Selected Voucher Modal
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Manual Transaction Modal state
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnModalError, setTxnModalError] = useState(null);
  const [txnSubmitting, setTxnSubmitting] = useState(false);
  const [txnData, setTxnData] = useState({
    type: '0', // 0 = Expense, 1 = Income, 3 = Adjustment
    amount: '',
    currency: 'USD',
    exchangeRate: '1.0',
    transactionDate: new Date().toISOString().slice(0, 10),
    categoryId: '',
    bankAccountId: '',
    payeeOrPayer: '',
    description: '',
    referenceNumber: ''
  });

  // Quick Live Currency Converter state (USD <-> ETB)
  const [converterData, setConverterData] = useState({
    amount: '100',
    from: 'USD',
    to: 'ETB',
    result: null,
    rate: 160.60,
    loading: false
  });

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [orgId, typeFilter, searchQuery, page]);

  useEffect(() => {
    handleConvertCurrency();
  }, [converterData.amount, converterData.from, converterData.to]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, {
        headers: authHeaders()
      });
      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }

      let url = `${API_BASE}/FinancialTransactions/organization/${orgId}?page=${page}&pageSize=20`;
      if (typeFilter) url += `&type=${typeFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const txnRes = await fetch(url, { headers: authHeaders() });
      if (!txnRes.ok) {
        const errTxt = await txnRes.text().catch(() => '');
        throw new Error(`Failed to fetch transaction ledger (${txnRes.status})`);
      }
      const txnData = await txnRes.json();

      setTransactions(txnData.items || []);
      setTotalCount(txnData.totalCount || 0);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading financial overview');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, {
        headers: authHeaders()
      });
      if (res.ok) setCategories(await res.json());
    } catch { }
  };

  const handleConvertCurrency = async () => {
    if (!converterData.amount || isNaN(converterData.amount)) return;
    setConverterData(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/Currency/convert?amount=${converterData.amount}&from=${converterData.from}&to=${converterData.to}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setConverterData(prev => ({
          ...prev,
          result: data.toAmount,
          rate: data.exchangeRate,
          loading: false
        }));
      }
    } catch {
      setConverterData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    setTransferring(true);
    setError(null);

    const fromId = parseInt(transferData.fromBankAccountId, 10);
    const toId = parseInt(transferData.toBankAccountId, 10);
    const amountVal = parseFloat(transferData.amount);

    if (fromId && toId && fromId === toId) {
      setTransferring(false);
      setError("Source and target bank accounts cannot be identical.");
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      setTransferring(false);
      setError("Transfer amount must be strictly greater than zero ($0.01 or more).");
      return;
    }

    const payload = {
      organizationId: orgId,
      fromBankAccountId: fromId,
      toBankAccountId: toId,
      amount: amountVal,
      description: transferData.description.trim(),
      referenceNumber: transferData.referenceNumber.trim() || null
    };

    try {
      const res = await fetch(`${API_BASE}/FinancialTransactions/transfer`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to execute bank transfer');
      }

      setSuccessMsg('Inter-account Bank Transfer executed successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsTransferModalOpen(false);
      setTransferData({
        fromBankAccountId: '',
        toBankAccountId: '',
        amount: '',
        description: 'Inter-account bank transfer',
        referenceNumber: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferring(false);
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    setTxnSubmitting(true);
    setTxnModalError(null);

    const parsedAmount = parseFloat(txnData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxnSubmitting(false);
      setTxnModalError("Transaction amount must be strictly greater than zero ($0.01 or more).");
      return;
    }

    const selectedDate = new Date(txnData.transactionDate);
    if (selectedDate.getFullYear() < 2000) {
      setTxnSubmitting(false);
      setTxnModalError("Transaction date cannot be prior to year 2000.");
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      setTxnSubmitting(false);
      setTxnModalError("Transaction date cannot be in the future (max allowed date is today).");
      return;
    }

    const payload = {
      organizationId: orgId,
      type: parseInt(txnData.type, 10),
      amount: parseFloat(txnData.amount) || 0,
      currency: (txnData.currency || 'USD').trim().toUpperCase(),
      exchangeRate: parseFloat(txnData.exchangeRate) || 1.0,
      transactionDate: txnData.transactionDate ? new Date(txnData.transactionDate).toISOString() : new Date().toISOString(),
      categoryId: txnData.categoryId ? parseInt(txnData.categoryId, 10) : null,
      bankAccountId: txnData.bankAccountId ? parseInt(txnData.bankAccountId, 10) : null,
      payeeOrPayer: txnData.payeeOrPayer ? txnData.payeeOrPayer.trim() : null,
      description: txnData.description.trim(),
      referenceNumber: txnData.referenceNumber ? txnData.referenceNumber.trim() : null
    };

    try {
      const res = await fetch(`${API_BASE}/FinancialTransactions`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let msg = errData.message || 'Failed to record transaction';
        if (errData.errors) {
          const firstErrKey = Object.keys(errData.errors)[0];
          if (firstErrKey && errData.errors[firstErrKey].length > 0) {
            msg = errData.errors[firstErrKey][0];
          }
        }
        throw new Error(msg);
      }

      setSuccessMsg('Financial transaction recorded successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsTxnModalOpen(false);
      setTxnData({
        type: '0',
        amount: '',
        currency: 'USD',
        exchangeRate: '1.0',
        transactionDate: new Date().toISOString().slice(0, 10),
        categoryId: '',
        bankAccountId: '',
        payeeOrPayer: '',
        description: '',
        referenceNumber: ''
      });
      fetchData();
    } catch (err) {
      setTxnModalError(err.message);
    } finally {
      setTxnSubmitting(false);
    }
  };

  function getCategorySpent(cat) {
    const fromEntity = cat.totalExpensesAmount || 0;
    const fromTxns = transactions
      .filter(t => (t.type === 0 || t.type === 'Expense' || t.type === 'expense'))
      .reduce((sum, t) => {
        if (t.categoryId === cat.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
        return sum;
      }, 0);
    return Math.max(fromEntity, fromTxns, fromEntity + fromTxns);
  }

  // Over-budget categories check
  const overBudgetCategories = categories
    .map(c => ({ ...c, currentExpenses: getCategorySpent(c) }))
    .filter(c => c.targetBudgetLimit && c.currentExpenses > c.targetBudgetLimit);

  const getTxnBadge = (type) => {
    if (type === 0 || type === 'Expense') {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"><TrendingDown className="w-3 h-3" /> Expense</span>;
    }
    if (type === 1 || type === 'Income') {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><TrendingUp className="w-3 h-3" /> Grant Revenue</span>;
    }
    if (type === 2 || type === 'Transfer') {
      return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"><ArrowRightLeft className="w-3 h-3" /> Transfer</span>;
    }
    return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Adjustment</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-brand-600" />
            Executive Financial Overview & Transaction Ledger
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time cash flow metrics, double-entry audit ledger, and inter-bank account fund transfers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTxnModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <DollarSign className="w-4 h-4" />
            Record Transaction
          </button>
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Inter-Account Transfer
          </button>
        </div>
      </div>

      {/* Messages & Over-Budget Warning Banner */}
      {overBudgetCategories.length > 0 && (
        <div className="flex items-center gap-3 p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Over-Budget Early Warning: </span>
            <span>
              {overBudgetCategories.map(c => `${c.name} ($${c.currentExpenses.toLocaleString()} / limit $${c.targetBudgetLimit.toLocaleString()})`).join('; ')}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Grant Revenue</span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              ${(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Expenditures</span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              ${(summary?.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Surplus / Cash Flow</span>
            <h3 className={`text-xl font-bold mt-0.5 ${(summary?.netCashFlow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ${(summary?.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Bank Accounts</span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              {summary?.bankAccounts?.length || 0} Accounts
            </h3>
          </div>
        </div>
      </div>

      {/* Live USD <-> ETB Currency Converter Widget & Bank Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Bank Account Balances */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Live Bank Account Balances
          </h4>
          {summary?.bankAccounts && summary.bankAccounts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.bankAccounts.map(acc => (
                <div key={acc.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{acc.bankName}</span>
                    <span className="text-xs text-slate-500">{acc.accountName} ({acc.accountNumber})</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    ${acc.calculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {acc.currency}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No active bank accounts found.</p>
          )}
        </div>

        {/* Live Exchange Rate Converter Widget */}
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Live USD ↔ ETB Converter
            </h4>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Live Exchange API
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount</label>
              <input
                type="number"
                value={converterData.amount}
                onChange={(e) => setConverterData({ ...converterData, amount: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Direction</label>
              <select
                value={`${converterData.from}_${converterData.to}`}
                onChange={(e) => {
                  const [from, to] = e.target.value.split('_');
                  setConverterData({ ...converterData, from, to });
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="USD_ETB">USD → ETB</option>
                <option value="ETB_USD">ETB → USD</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Converted Value:</span>
            <span className="text-base font-black text-emerald-400">
              {converterData.loading ? (
                'Calculating...'
              ) : (
                `${converterData.result !== null ? converterData.result.toLocaleString() : '0'} ${converterData.to}`
              )}
            </span>
          </div>

          <span className="text-[10px] text-slate-400 block text-right">
            Rate: 1 USD = {converterData.rate ? converterData.rate.toFixed(2) : '160.60'} ETB
          </span>
        </div>
      </div>

      {/* Transaction Ledger Table Header & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Central Audit Ledger & Payment Vouchers
          </h3>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
            >
              <option value="">All Types</option>
              <option value="1">Grant Revenue Only</option>
              <option value="0">Expenses Only</option>
              <option value="2">Transfers Only</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Txn #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Bank Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading transaction ledger...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-400">
                    No transactions recorded in the ledger.
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {t.transactionNumber}
                    </td>
                    <td className="px-4 py-3">{getTxnBadge(t.type)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {t.description}
                      {t.payeeOrPayer && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          Party: {t.payeeOrPayer}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.categoryName ? (
                        <span
                          className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-white inline-block shadow-2xs"
                          style={{ backgroundColor: t.categoryColor || '#4F46E5' }}
                        >
                          {t.categoryName}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.bankAccountName || t.toBankAccountName || '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${t.type === 1 || t.type === 'Income' ? 'text-emerald-600' : (t.type === 0 || t.type === 'Expense' ? 'text-rose-600' : 'text-blue-600')
                      }`}>
                      {t.type === 1 || t.type === 'Income' ? '+' : (t.type === 0 || t.type === 'Expense' ? '-' : '')}
                      ${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.currency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedVoucher(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        title="View Printable Payment Voucher"
                      >
                        <Printer className="w-3 h-3 text-slate-600" /> Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inter-Account Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-600" />
                Inter-Account Bank Transfer
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Source Bank Account (From) *
                </label>
                <select
                  required
                  value={transferData.fromBankAccountId}
                  onChange={(e) => setTransferData({ ...transferData, fromBankAccountId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select Source Account</option>
                  {summary?.bankAccounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountName} (${acc.calculatedBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Destination Bank Account (To) *
                </label>
                <select
                  required
                  value={transferData.toBankAccountId}
                  onChange={(e) => setTransferData({ ...transferData, toBankAccountId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select Destination Account</option>
                  {summary?.bankAccounts?.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountName} (${acc.calculatedBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Transfer Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Transfer Description / Notes
                </label>
                <input
                  type="text"
                  value={transferData.description}
                  onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {transferring ? 'Executing Transfer...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Financial Transaction Modal */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsTxnModalOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-brand-600" />
                Record Transaction
              </h3>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {txnModalError && (
              <div className="flex items-center gap-2 p-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{txnModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTransaction} className="space-y-3 text-xs font-sans">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Type *</label>
                  <select
                    value={txnData.type}
                    onChange={(e) => setTxnData({ ...txnData, type: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="0">Expense Entry</option>
                    <option value="1">Income / Grant Revenue</option>
                    <option value="3">Adjustment Entry</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    min="2000-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={txnData.transactionDate}
                    onChange={(e) => setTxnData({ ...txnData, transactionDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={txnData.amount}
                    onChange={(e) => setTxnData({ ...txnData, amount: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency *</label>
                  <select
                    value={txnData.currency}
                    onChange={(e) => setTxnData({ ...txnData, currency: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ETB">ETB (Br)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="KES">KES (KSh)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="Office procurement, Consultant fee..."
                  value={txnData.description}
                  onChange={(e) => setTxnData({ ...txnData, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={txnData.categoryId}
                    onChange={(e) => setTxnData({ ...txnData, categoryId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Account</label>
                  <select
                    value={txnData.bankAccountId}
                    onChange={(e) => setTxnData({ ...txnData, bankAccountId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Select Bank Account</option>
                    {summary?.bankAccounts?.map((b) => (
                      <option key={b.id} value={b.id}>{b.bankName} ({b.accountNumber})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payee / Payer</label>
                  <input
                    type="text"
                    placeholder="Vendor, Grantor..."
                    value={txnData.payeeOrPayer}
                    onChange={(e) => setTxnData({ ...txnData, payeeOrPayer: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    placeholder="INV-1002, PO-883..."
                    value={txnData.referenceNumber}
                    onChange={(e) => setTxnData({ ...txnData, referenceNumber: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsTxnModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txnSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50"
                >
                  {txnSubmitting ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payment Voucher Modal */}
      {selectedVoucher && (
        <PaymentVoucherModal
          transaction={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}
    </div>
  );
}

