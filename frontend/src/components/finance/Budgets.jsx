import React, { useState, useEffect } from 'react';
import SearchSelect from '../SearchSelect';
import { useUser } from '../../contexts/UserContext';
import { parseApiResponse, showSuccessToast } from '../../utils/toastHelper';

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
  if (value === undefined || value === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  } catch { return `${value} ${currency}`; }
}

const levelLabels = { 0: 'Organization', 1: 'Workspace', 2: 'Project', 3: 'Task' };
const statusConfig = {
  0: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  'Draft': { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  1: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800' },
  'PendingApproval': { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800' },
  2: { label: 'Approved', color: 'bg-lime-100 text-lime-800' },
  'Approved': { label: 'Approved', color: 'bg-lime-100 text-lime-800' },
  3: { label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  'Active': { label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  4: { label: 'Closed', color: 'bg-[#5A45FF]/10 text-[#5A45FF]' },
  'Closed': { label: 'Closed', color: 'bg-[#5A45FF]/10 text-[#5A45FF]' }
};

const categoryLabels = {
  0: 'Personnel',
  1: 'Equipment',
  2: 'Operations',
  3: 'Training',
  4: 'Supplies',
  5: 'Travel',
  6: 'Consultancy',
  7: 'Other'
};

function getCategoryDisplayName(catVal, dynamicCats = []) {
  if (catVal === undefined || catVal === null) return 'General';
  if (typeof catVal === 'number' || (!isNaN(catVal) && categoryLabels[catVal])) {
    return categoryLabels[catVal] || `Category ${catVal}`;
  }
  const match = dynamicCats.find(c => String(c.id) === String(catVal) || c.name === String(catVal));
  if (match) return match.fullName || match.name;
  return String(catVal);
}

export default function Budgets() {
  const { user, getPrimaryRole } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Determine active role for 2-step sign-off restriction
  const primaryRole = (getPrimaryRole && getPrimaryRole()) || localStorage.getItem('selectedRole') || '';
  const userRolesList = (user?.roles || []).map(r => r.name);

  const canApproveBudget = 
    ['FinanceOfficer', 'Finance Officer', 'Admin', 'Owner'].includes(primaryRole) ||
    userRolesList.some(r => ['FinanceOfficer', 'Finance Officer', 'Admin', 'Owner'].includes(r));

  const canReviseOrDraftBudget = 
    ['Manager', 'Coordinator', 'Admin', 'Owner'].includes(primaryRole) ||
    userRolesList.some(r => ['Manager', 'Coordinator', 'Admin', 'Owner'].includes(r));

  // Entity lists for dropdowns
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({ level: 'Project', entityId: '', totalAmount: '', currency: 'USD', fiscalYear: new Date().getFullYear(), logframeLevel: '', logframeEntityId: '' });

  // Revise modal
  const [reviseTarget, setReviseTarget] = useState(null);
  const [reviseForm, setReviseForm] = useState({ totalAmount: '', currency: 'USD', notes: '' });

  // Return Remaining Budget modal
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Line item modal
  const [lineItemTarget, setLineItemTarget] = useState(null);
  const [lineItemForm, setLineItemForm] = useState({ category: 2, description: '', amount: '' });

  // Phase 2: Project Balancing info
  const [projectBalancing, setProjectBalancing] = useState(null);

  async function fetchProjectBalancing(projId) {
    if (!projId) {
      setProjectBalancing(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/budgets/project/${projId}/balancing`, { headers: authHeaders() });
      if (res.ok) setProjectBalancing(await res.json());
      else setProjectBalancing(null);
    } catch {
      setProjectBalancing(null);
    }
  }

  // Revision History modal
  const [revisionsTarget, setRevisionsTarget] = useState(null);
  const [revisionsLog, setRevisionsLog] = useState([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // Dynamic Categories list
  const [dynamicCategories, setDynamicCategories] = useState([]);

  useEffect(() => {
    fetchBudgets();
    fetchProjects();
    fetchWorkspaces();
    fetchDynamicCategories();
  }, []);

  async function fetchDynamicCategories() {
    try {
      const res = await fetch(`${API_BASE}/FinancialCategories/flat`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDynamicCategories(data);
      }
    } catch {}
  }

  async function fetchProjects() {
    try {
      const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
      if (res.ok) setProjects(await res.json());
    } catch {}
  }

  async function fetchWorkspaces() {
    try {
      const res = await fetch(`${API_BASE}/workspaces`, { headers: authHeaders() });
      if (res.ok) setWorkspaces(await res.json());
    } catch {}
  }

  async function fetchBudgets() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/budgets`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch budgets');
      setBudgets(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        level: createForm.level,
        totalAmount: parseFloat(createForm.totalAmount),
        currency: createForm.currency || 'USD',
        fiscalYear: parseInt(createForm.fiscalYear) || new Date().getFullYear(),
        logframeLevel: createForm.logframeLevel || null,
        logframeEntityId: createForm.logframeEntityId ? parseInt(createForm.logframeEntityId, 10) : null
      };
      const storedOrgId = parseInt(localStorage.getItem('selectedOrganizationId') || '0');
      
      if (payload.level === 'Organization' || payload.level === 0) {
        payload.organizationId = storedOrgId;
      } else if (payload.level === 'Workspace' || payload.level === 1) {
        payload.workspaceId = parseInt(createForm.workspaceId || createForm.entityId);
      } else if (payload.level === 'Project' || payload.level === 2) {
        payload.projectId = parseInt(createForm.projectId || createForm.entityId);
      } else if (payload.level === 'Task' || payload.level === 3) {
        payload.taskId = parseInt(createForm.taskId || createForm.entityId);
      }

      const res = await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to create budget');
      }
      setIsCreateOpen(false);
      setCreateForm({ level: 'Project', entityId: '', projectId: '', workspaceId: '', taskId: '', totalAmount: '', currency: 'USD', fiscalYear: new Date().getFullYear(), logframeLevel: '', logframeEntityId: '' });
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function handleApprove(id) {
    try {
      const res = await fetch(`${API_BASE}/budgets/${id}/approve`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to approve');
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
  }

  async function handleReturnRemainingSubmit(e) {
    e.preventDefault();
    if (!returnTarget) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/budgets/${returnTarget.id}/return-remaining`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: returnNotes })
      });
      if (!res.ok) {
        const errText = await parseApiResponse(res);
        throw new Error(errText || 'Failed to return remaining budget');
      }
      setReturnTarget(null);
      setReturnNotes('');
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this budget? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/budgets/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        let errMsg = 'Failed to delete';
        try {
          const errText = await parseApiResponse(res);
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.message || errText;
          } catch {
            errMsg = errText || errMsg;
          }
        } catch {}
        throw new Error(errMsg);
      }
      setBudgets(prev => prev.filter(b => b.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e) { showSuccessToast(e.message); }
  }

  function openRevise(budget) {
    setReviseTarget(budget);
    setReviseForm({ totalAmount: budget.totalAmount, currency: budget.currency, notes: '' });
  }

  async function handleRevise(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/budgets/${reviseTarget.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAmount: parseFloat(reviseForm.totalAmount), currency: reviseForm.currency, notes: reviseForm.notes })
      });
      if (!res.ok) throw new Error('Failed to revise budget');
      setReviseTarget(null);
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function openRevisionsHistory(budget) {
    setRevisionsTarget(budget);
    setLoadingRevisions(true);
    try {
      const res = await fetch(`${API_BASE}/budgets/${budget.id}/revisions`, { headers: authHeaders() });
      if (res.ok) {
        setRevisionsLog(await res.json());
      } else {
        setRevisionsLog([]);
      }
    } catch {
      setRevisionsLog([]);
    } finally {
      setLoadingRevisions(false);
    }
  }

  function openAddLineItem(budget) {
    setLineItemTarget(budget);
    const initialCategory = dynamicCategories.length > 0 ? dynamicCategories[0].id : 0;
    setLineItemForm({ category: initialCategory, description: '', amount: '' });
  }

  async function handleAddLineItem(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/budgets/${lineItemTarget.id}/line-items`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: parseInt(lineItemForm.category), description: lineItemForm.description, amount: parseFloat(lineItemForm.amount) })
      });
      if (!res.ok) throw new Error('Failed to add line item');
      setLineItemTarget(null);
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function handleDeleteLineItem(budgetId, lineItemId) {
    if (!confirm('Remove this line item?')) return;
    try {
      const res = await fetch(`${API_BASE}/budgets/${budgetId}/line-items/${lineItemId}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to delete line item');
      fetchBudgets();
    } catch (e) { showSuccessToast(e.message); }
  }

  // KPIs
  const totalBudgetsCount = budgets.length;
  const totalBudgeted = budgets.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spentAmount || 0), 0);
  const remainingOverall = Math.max(0, totalBudgeted - totalSpent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Master Budgets & Expenditure Ceilings</h2>
          <p className="text-sm text-slate-500 mt-1">Configure ceilings, track real-time utilization, and return remaining unspent funds.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-[#5A45FF] to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md shadow-[#5A45FF]/20 transition flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          + Create Master Budget
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Budgets</p>
          <p className="text-3xl font-extrabold text-slate-900">{totalBudgetsCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Allocated (USD eq.)</p>
          <p className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalBudgeted, 'USD')}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Expended (USD eq.)</p>
          <p className="text-3xl font-extrabold text-rose-600">{formatCurrency(totalSpent, 'USD')}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Unspent Pool (USD eq.)</p>
          <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(remainingOverall, 'USD')}</p>
        </div>
      </div>

      {/* Budgets Grid / List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading budgets...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 bg-indigo-50 text-[#5A45FF] rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold">
              📊
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active budgets found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mb-6">
              Establish organization, workspace, or project-level budget ceilings to control financial expenditure.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#5A45FF] text-white font-semibold py-2.5 px-6 rounded-full hover:bg-indigo-600 transition"
            >
              Create First Budget
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">Level & Target</th>
                  <th scope="col" className="px-6 py-4 text-left">Budget Ceiling</th>
                  <th scope="col" className="px-6 py-4 text-left">Spent Amount</th>
                  <th scope="col" className="px-6 py-4 text-left">Utilization</th>
                  <th scope="col" className="px-6 py-4 text-left">Status & Risk</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {budgets.map((b) => {
                  const spentPct = b.totalAmount > 0 ? Math.min(100, Math.round((b.spentAmount / b.totalAmount) * 100)) : 0;
                  const isOverSpend = b.spentAmount > b.totalAmount;
                  const isHighUtilization = spentPct >= 80;
                  const unspentRemaining = Math.max(0, b.totalAmount - b.spentAmount);

                  return (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{b.entityName}</div>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mt-0.5">
                            {levelLabels[b.level]} Level • FY {b.fiscalYear || new Date().getFullYear()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                          {formatCurrency(b.totalAmount, b.currency)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-rose-600">
                          {formatCurrency(b.spentAmount, b.currency)}
                        </td>
                        <td className="px-6 py-4 w-44">
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className={isOverSpend ? 'text-rose-600' : 'text-slate-700'}>{spentPct}%</span>
                            <span className="text-slate-400 text-[10px]">Unspent: {formatCurrency(unspentRemaining, b.currency)}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOverSpend ? 'bg-rose-600' : isHighUtilization ? 'bg-amber-500' : 'bg-[#5A45FF]'
                              }`}
                              style={{ width: `${Math.min(100, spentPct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${statusConfig[b.status]?.color}`}>
                              {statusConfig[b.status]?.label}
                            </span>
                            {isOverSpend && (
                              <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                ⚠️ Budget Exceeded
                              </span>
                            )}
                            {isHighUtilization && !isOverSpend && (
                              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                ⚡ High Utilization (&gt;80%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-xs">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {unspentRemaining > 0 && b.status !== 4 && b.status !== 'Closed' && (
                              <button
                                onClick={() => {
                                  setReturnTarget(b);
                                  setReturnNotes('');
                                }}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition shadow-2xs"
                                title="Return remaining unspent budget to parent pool"
                              >
                                ↩ Return Remaining
                              </button>
                            )}
                            {canReviseOrDraftBudget && (
                              <button
                                onClick={() => openRevise(b)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-[#5A45FF] hover:bg-indigo-100 border border-indigo-200/80 transition shadow-2xs"
                              >
                                ✎ Revise
                              </button>
                            )}
                            <button
                              onClick={() => openRevisionsHistory(b)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition shadow-2xs"
                              title="View Budget Revision History Log"
                            >
                              📋 History
                            </button>
                            {(b.status === 0 || b.status === 'Draft' || b.status === 1 || b.status === 'PendingApproval') && canApproveBudget && (
                              <button
                                onClick={() => handleApprove(b.id)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                                title="Manager Sign-off / Approve Budget"
                              >
                                ✓ Approve
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setExpandedId(b.id);
                                openAddLineItem(b);
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200/80 transition shadow-2xs"
                              title="Add budget line item"
                            >
                              + Line Item
                            </button>
                            <button
                              onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition shadow-2xs"
                            >
                              {expandedId === b.id ? '▲ Hide Lines' : '▼ Line Items'}
                            </button>
                            {canReviseOrDraftBudget && (
                              <button
                                onClick={() => handleDelete(b.id)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/80 transition shadow-2xs"
                              >
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === b.id && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/80 p-6 border-y border-slate-200">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 text-sm">Budget Line Items for {b.entityName}</h4>
                                {canReviseOrDraftBudget && (
                                  <button
                                    onClick={() => openAddLineItem(b)}
                                    className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-100 shadow-sm"
                                  >
                                    + Add Line Item
                                  </button>
                                )}
                              </div>

                              {b.lineItems.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4 text-center">No line items configured.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                      <tr>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3">Line Amount</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {b.lineItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                          <td className="px-4 py-2.5 font-bold text-slate-700">
                                            {item.categoryName || 'General'}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600">{item.description}</td>
                                          <td className="px-4 py-2.5 font-bold text-slate-900">{formatCurrency(item.amount, b.currency)}</td>
                                          <td className="px-4 py-2.5 text-right">
                                            {canReviseOrDraftBudget && (
                                              <button
                                                onClick={() => handleDeleteLineItem(b.id, item.id)}
                                                className="text-rose-600 hover:underline font-semibold"
                                              >
                                                Remove
                                              </button>
                                            )}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MASTER BUDGET MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsCreateOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 overflow-hidden text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-900">Create Master Budget</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Budget Level</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, level: 'Organization' })}
                    className={`py-1 text-[11px] font-semibold rounded-md border transition ${
                      createForm.level === 'Organization'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, level: 'Workspace' })}
                    className={`py-1 text-[11px] font-semibold rounded-md border transition ${
                      createForm.level === 'Workspace'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, level: 'Project' })}
                    className={`py-1 text-[11px] font-semibold rounded-md border transition ${
                      createForm.level === 'Project'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Project
                  </button>
                </div>
              </div>

              {createForm.level === 'Workspace' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Workspace *</label>
                  <select
                    required
                    value={createForm.workspaceId}
                    onChange={(e) => setCreateForm({ ...createForm, workspaceId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Choose Workspace</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {createForm.level === 'Project' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Project *</label>
                  <select
                    required
                    value={createForm.projectId}
                    onChange={(e) => setCreateForm({ ...createForm, projectId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Choose Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fiscal Year *</label>
                <input
                  type="number"
                  required
                  value={createForm.fiscalYear}
                  onChange={(e) => setCreateForm({ ...createForm, fiscalYear: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>




              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={createForm.totalAmount}
                    onChange={(e) => setCreateForm({ ...createForm, totalAmount: e.target.value })}
                    placeholder="50000.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ETB">ETB (Br)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN REMAINING UNSPENT BUDGET MODAL */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Return Remaining Unspent Budget</h3>
                <p className="text-xs text-slate-500">Return unallocated funds from <strong>{returnTarget.entityName}</strong> back to parent pool.</p>
              </div>
              <button
                onClick={() => setReturnTarget(null)}
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-2xl bg-indigo-50/80 border border-indigo-200/80 p-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Current Total Budget:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(returnTarget.totalAmount, returnTarget.currency)}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Actual Expended:</span>
                  <span className="font-bold text-rose-600">{formatCurrency(returnTarget.spentAmount, returnTarget.currency)}</span>
                </div>
                <div className="flex justify-between text-xs font-extrabold pt-2 border-t border-indigo-200">
                  <span className="text-[#5A45FF]">Amount to Return:</span>
                  <span className="text-emerald-600">{formatCurrency(returnTarget.totalAmount - returnTarget.spentAmount, returnTarget.currency)}</span>
                </div>
              </div>

              <form onSubmit={handleReturnRemainingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Return Notes / Reason</label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Project completed under budget; returning remaining funds to main pool."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReturnTarget(null)}
                    className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-xs"
                  >
                    {isSubmitting ? 'Returning...' : 'Return Funds & Close'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REVISE BUDGET MODAL */}
      {reviseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Revise Budget Ceiling</h3>
                <p className="text-xs text-slate-500">Update total allocated ceiling for {reviseTarget.entityName}.</p>
              </div>
              <button
                onClick={() => setReviseTarget(null)}
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRevise} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">New Total Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={reviseForm.totalAmount}
                  onChange={(e) => setReviseForm({ ...reviseForm, totalAmount: e.target.value })}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Revision Notes</label>
                <textarea
                  rows={2}
                  value={reviseForm.notes}
                  onChange={(e) => setReviseForm({ ...reviseForm, notes: e.target.value })}
                  placeholder="Reason for revision"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviseTarget(null)}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#5A45FF] px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition shadow-xs"
                >
                  Save Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LINE ITEM MODAL */}
      {lineItemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Budget Line Item</h3>
                <p className="text-xs text-slate-500">Break down budget allocation for {lineItemTarget.entityName}.</p>
              </div>
              <button
                onClick={() => setLineItemTarget(null)}
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddLineItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Category</label>
                <select
                  value={lineItemForm.category}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, category: e.target.value })}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 bg-white"
                >
                  {dynamicCategories.length > 0 ? (
                    dynamicCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.fullName || cat.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={0}>Personnel</option>
                      <option value={1}>Equipment</option>
                      <option value={2}>Operations</option>
                      <option value={3}>Training</option>
                      <option value={4}>Supplies</option>
                      <option value={5}>Travel</option>
                      <option value={6}>Consultancy</option>
                      <option value={7}>Other</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={lineItemForm.description}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                  placeholder="e.g. Field Staff Salaries Q3"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={lineItemForm.amount}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, amount: e.target.value })}
                  placeholder="15000.00"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLineItemTarget(null)}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#5A45FF] px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition shadow-xs"
                >
                  Add Line Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* REVISION HISTORY MODAL */}
      {revisionsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Budget Revision History</h3>
                <p className="text-xs text-slate-500">{revisionsTarget.entityName} — {revisionsTarget.currency}</p>
              </div>
              <button
                onClick={() => setRevisionsTarget(null)}
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {loadingRevisions ? (
                <div className="py-8 text-center text-sm text-slate-500 font-medium">Loading revision history...</div>
              ) : revisionsLog.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No revisions logged yet for this budget.</div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {revisionsLog.map((rev) => (
                    <div key={rev.id || rev.versionNo} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>Version #{rev.versionNo}</span>
                        <span className="text-slate-500 font-normal">
                          {rev.dateApproved ? new Date(rev.dateApproved).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700 font-semibold py-1">
                        <span className="text-rose-600 font-mono">{formatCurrency(rev.previousAmount, revisionsTarget.currency)}</span>
                        <span>➜</span>
                        <span className="text-emerald-600 font-mono">{formatCurrency(rev.newAmount, revisionsTarget.currency)}</span>
                      </div>
                      <p className="text-slate-600 font-medium">{rev.notes || 'No notes provided'}</p>
                      <div className="text-[11px] text-slate-400">Approved by: {rev.approvedByUserName || 'System'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setRevisionsTarget(null)}
                className="rounded-full bg-slate-100 hover:bg-slate-200 px-6 py-2 text-sm font-semibold text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
