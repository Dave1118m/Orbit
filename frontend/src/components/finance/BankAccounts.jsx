import React, { useState, useEffect } from 'react';
import SearchSelect from '../SearchSelect';
import { AutoText } from '../../contexts/TranslationContext';
import { ETHIOPIAN_BANKS, getShortBankName } from '../../lib/ethiopianBanks';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../../utils/toastHelper';

const API_BASE = import.meta.env.VITE_API_URL;

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

function formatCurrency(value, currency = 'USD') {
  if (value === undefined || value === null) return '-';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    currency: 'USD',
    isActive: true
  });

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    fromBankAccountId: '',
    toBankAccountId: '',
    transferAmount: '',
    exchangeRate: '1.0',
    description: ''
  });

  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ETB: 130 });

  useEffect(() => {
    fetchAccounts();
    async function loadRates() {
      try {
        const res = await fetch(`${API_BASE}/currency/rates?baseCurrency=USD`, { headers: authHeaders() });
        if (res.ok) setExchangeRates(await res.json());
      } catch {}
    }
    loadRates();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/bankaccounts`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch bank accounts');
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTransactions(accountId) {
    try {
      setLoadingTx(true);
      const res = await fetch(`${API_BASE}/bankaccounts/${accountId}/transactions`, {
        headers: authHeaders()
      });
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTx(false);
    }
  }

  const toggleExpand = (accountId) => {
    if (expandedAccountId === accountId) {
      setExpandedAccountId(null);
    } else {
      setExpandedAccountId(accountId);
      fetchTransactions(accountId);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingAccountId(null);
    setFormData({ bankName: '', accountName: '', accountNumber: '', currency: 'USD', isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (account) => {
    setIsEditMode(true);
    setEditingAccountId(account.id);
    setFormData({
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      isActive: account.isActive
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const [fetchingRate, setFetchingRate] = useState(false);
  const [isLiveRate, setIsLiveRate] = useState(false);

  const fetchLiveRate = async (fromAccId, toAccId) => {
    const fromAcc = accounts.find(a => String(a.id) === String(fromAccId));
    const toAcc = accounts.find(a => String(a.id) === String(toAccId));
    if (!fromAcc || !toAcc) return;
    if (fromAcc.currency === toAcc.currency) {
      setTransferData(prev => ({ ...prev, exchangeRate: '1.0' }));
      setIsLiveRate(true);
      return;
    }
    try {
      setFetchingRate(true);
      const res = await fetch(`${API_BASE}/currency/convert?amount=1&from=${fromAcc.currency}&to=${toAcc.currency}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTransferData(prev => ({ ...prev, exchangeRate: String(data.exchangeRate) }));
        setIsLiveRate(data.isLive !== false);
      }
    } catch (err) {
      console.error('Failed to fetch live exchange rate', err);
    } finally {
      setFetchingRate(false);
    }
  };

  const openTransferModal = () => {
    if (accounts.length < 2) {
      showErrorToast('You need at least 2 bank accounts to perform an inter-account transfer.');
      return;
    }
    const fromId = accounts[0]?.id ? String(accounts[0].id) : '';
    const toId = accounts[1]?.id ? String(accounts[1].id) : '';
    setTransferData({
      fromBankAccountId: fromId,
      toBankAccountId: toId,
      transferAmount: '',
      exchangeRate: '1.0',
      description: ''
    });
    setIsTransferModalOpen(true);
    fetchLiveRate(fromId, toId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsSubmitting(true);
      const url = isEditMode
        ? `${API_BASE}/bankaccounts/${editingAccountId}`
        : `${API_BASE}/bankaccounts`;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errText = await parseApiResponse(response);
        throw new Error(errText || `Failed to ${isEditMode ? 'update' : 'add'} bank account`);
      }

      setIsModalOpen(false);
      fetchAccounts();
      showSuccessToast(`Bank account ${isEditMode ? 'updated' : 'added'} successfully.`);
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (transferData.fromBankAccountId === transferData.toBankAccountId) {
      showErrorToast('Source and target bank accounts must be different.');
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE}/bankaccounts/transfer`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBankAccountId: parseInt(transferData.fromBankAccountId),
          toBankAccountId: parseInt(transferData.toBankAccountId),
          transferAmount: parseFloat(transferData.transferAmount),
          exchangeRate: parseFloat(transferData.exchangeRate || '1.0'),
          description: transferData.description
        })
      });

      if (!response.ok) {
        const errText = await parseApiResponse(response);
        throw new Error(`Transfer failed: ${errText}`);
      }

      setIsTransferModalOpen(false);
      fetchAccounts();
      if (expandedAccountId) fetchTransactions(expandedAccountId);
      showSuccessToast('Transfer completed successfully.');
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this bank account? This cannot be undone.')) return;
    try {
      const response = await fetch(`${API_BASE}/bankaccounts/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!response.ok) {
        const errText = await parseApiResponse(response);
        throw new Error(errText || 'Failed to delete bank account');
      }
      setAccounts(prev => prev.filter(a => a.id !== id));
      if (expandedAccountId === id) setExpandedAccountId(null);
      showSuccessToast('Bank account deleted.');
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  // KPIs
  const activeAccountsCount = accounts.filter(a => a.isActive).length;

  function toUSD(amount, currency) {
    if (!currency || currency === 'USD') return amount;
    const rate = exchangeRates[currency];
    return rate ? amount / rate : amount;
  }

  const totalBalance = accounts.reduce((sum, a) => sum + toUSD(a.currentBalance || 0, a.currency), 0);
  const totalReceived = accounts.reduce((sum, a) => sum + toUSD(a.totalReceived || 0, a.currency), 0);
  const totalExpended = accounts.reduce((sum, a) => sum + toUSD(a.totalExpended || 0, a.currency), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight"><AutoText text="Bank Accounts" /></h2>
          <p className="text-sm text-slate-500 mt-1"><AutoText text="Manage real account balances, inter-account transfers, and dual transaction ledgers." /></p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openTransferModal}
            className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-2 text-sm"
          >
            🔄 <AutoText text="Inter-Account Transfer" />
          </button>
          <button
            onClick={openAddModal}
            className="bg-gradient-to-r from-[#5A45FF] to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md shadow-[#5A45FF]/20 transition flex items-center gap-2 text-sm"
          >
            + <AutoText text="Add Bank Account" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1"><AutoText text="Active Accounts" /></p>
          <p className="text-3xl font-extrabold text-slate-900">{activeAccountsCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1"><AutoText text="Current Balance (USD eq.)" /></p>
          <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(totalBalance, 'USD')}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1"><AutoText text="Total Received (USD eq.)" /></p>
          <p className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalReceived, 'USD')}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1"><AutoText text="Total Expended (USD eq.)" /></p>
          <p className="text-3xl font-extrabold text-rose-600">{formatCurrency(totalExpended, 'USD')}</p>
        </div>
      </div>

      {/* Accounts List & Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading bank accounts...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 bg-indigo-50 text-[#5A45FF] rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold">
              🏦
            </div>
            <h3 className="text-lg font-bold text-slate-900">No bank accounts registered</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mb-6">
              Add your organization's bank accounts to track deposit allocations, balance updates, and currency holdings.
            </p>
            <button
              onClick={openAddModal}
              className="bg-[#5A45FF] text-white font-semibold py-2.5 px-6 rounded-full hover:bg-indigo-600 transition"
            >
              Add First Bank Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">Bank & Account Name</th>
                  <th scope="col" className="px-6 py-4 text-left">Account / SWIFT</th>
                  <th scope="col" className="px-6 py-4 text-left">Currency</th>
                  <th scope="col" className="px-6 py-4 text-left">Total Deposits</th>
                  <th scope="col" className="px-6 py-4 text-left">Total Disbursed</th>
                  <th scope="col" className="px-6 py-4 text-left">Current Balance</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <React.Fragment key={acc.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-[#5A45FF] flex items-center justify-center font-bold text-lg">
                            🏦
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{getShortBankName(acc.bankName)}</div>
                            <div className="text-xs text-slate-500">{acc.accountName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">
                        <div>{acc.accountNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {acc.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(acc.totalReceived, acc.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-rose-600">
                        {formatCurrency(acc.totalExpended, acc.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold space-x-2">
                        <button
                          onClick={() => toggleExpand(acc.id)}
                          className="text-[#5A45FF] hover:underline"
                        >
                          {expandedAccountId === acc.id ? 'Hide Ledger' : 'View Ledger'}
                        </button>
                        <button
                          onClick={() => openEditModal(acc)}
                          className="text-slate-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id)}
                          className="text-rose-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedAccountId === acc.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/80 p-6 border-y border-slate-200">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-900 text-sm">
                                Transaction Ledger for {getShortBankName(acc.bankName)} ({acc.accountName})
                              </h4>
                              <span className="text-xs text-slate-500 font-medium">
                                Account Currency: <strong className="text-slate-800">{acc.currency}</strong>
                              </span>
                            </div>

                            {loadingTx ? (
                              <p className="text-xs text-slate-500 py-4">Loading transaction ledger...</p>
                            ) : transactions.length === 0 ? (
                              <p className="text-xs text-slate-500 py-6 text-center">No transactions recorded for this account yet.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                    <tr>
                                      <th className="px-4 py-3">Date</th>
                                      <th className="px-4 py-3">Type</th>
                                      <th className="px-4 py-3">Amount</th>
                                      <th className="px-4 py-3">Source / Project</th>
                                      <th className="px-4 py-3">Description</th>
                                      <th className="px-4 py-3">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {transactions.map((tx, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 font-medium text-slate-600">
                                          {new Date(tx.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            tx.type === 'Deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {tx.type}
                                          </span>
                                        </td>
                                        <td className={`px-4 py-2.5 font-bold ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {tx.type === 'Deposit' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-700">
                                          {tx.donorName || tx.projectName || '-'}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={tx.description}>
                                          {tx.description}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                            {tx.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD/EDIT BANK ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 overflow-hidden text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-900">{isEditMode ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Name *</label>
                <SearchSelect
                  options={ETHIOPIAN_BANKS}
                  value={formData.bankName}
                  onChange={val => handleInputChange({ target: { name: 'bankName', value: val } })}
                  placeholder="Select Bank..."
                  isClearable={true}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  name="accountName"
                  required
                  value={formData.accountName}
                  onChange={handleInputChange}
                  placeholder="e.g. Operating Main Account"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  name="accountNumber"
                  required
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="100029384"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="ETB">ETB (Br)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-ACCOUNT TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsTransferModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 overflow-hidden text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-900">Inter-Account Fund Transfer</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <form onSubmit={handleTransferSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Account (From) *</label>
                <select
                  value={transferData.fromBankAccountId}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    setTransferData(prev => ({ ...prev, fromBankAccountId: newFrom }));
                    fetchLiveRate(newFrom, transferData.toBankAccountId);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getShortBankName(a.bankName)} - {a.accountName} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Account (To) *</label>
                <select
                  value={transferData.toBankAccountId}
                  onChange={(e) => {
                    const newTo = e.target.value;
                    setTransferData(prev => ({ ...prev, toBankAccountId: newTo }));
                    fetchLiveRate(transferData.fromBankAccountId, newTo);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getShortBankName(a.bankName)} - {a.accountName} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={transferData.amount}
                    onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Exchange Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={transferData.exchangeRate}
                    onChange={(e) => setTransferData(prev => ({ ...prev, exchangeRate: e.target.value }))}
                    placeholder="1.0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Reason</label>
                <input
                  type="text"
                  value={transferData.notes}
                  onChange={(e) => setTransferData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Fund reallocation..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50"
                >
                  {transferring ? 'Executing...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
