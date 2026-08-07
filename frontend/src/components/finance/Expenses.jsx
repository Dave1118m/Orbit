import React, { useState, useEffect, useRef } from 'react';
import SearchSelect from '../SearchSelect';

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
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  } catch { return `${value} ${currency}`; }
}

const categoryLabels = {
  0: 'Personnel',
  1: 'Equipment',
  2: 'Operations',
  3: 'Training',
  4: 'Supplies',
  5: 'Travel'
};

const statusConfig = {
  0: { label: 'Pending Finance Review', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  1: { label: 'Pending Manager Sign-off', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  2: { label: 'Approved', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  3: { label: 'Rejected', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  4: { label: 'Paid / Disbursed', color: 'bg-[#5A45FF]/10 text-[#5A45FF] border-[#5A45FF]/30' }
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectDonors, setProjectDonors] = useState([]);
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Drawer modal
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    projectId: '', taskId: '', donorId: '', bankAccountId: '',
    category: 2, amount: '', currency: 'USD',
    date: new Date().toISOString().split('T')[0], description: ''
  });

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Receipt preview modal
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    loading: false,
    expense: null,
    blobUrl: null,
    error: null
  });
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileRef = useRef(null);

  async function openReceiptPreview(expenseItem) {
    setPreviewModal({
      isOpen: true,
      loading: true,
      expense: expenseItem,
      blobUrl: null,
      error: null
    });

    try {
      const res = await fetch(`${API_BASE}/expenses/${expenseItem.id}/receipt/download`, {
        headers: authHeaders()
      });

      if (!res.ok) {
        throw new Error('Failed to load receipt file preview.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setPreviewModal(prev => ({
        ...prev,
        loading: false,
        blobUrl: url
      }));
    } catch (err) {
      setPreviewModal(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }));
    }
  }

  function closeReceiptPreview() {
    if (previewModal.blobUrl) {
      URL.revokeObjectURL(previewModal.blobUrl);
    }
    setPreviewModal({
      isOpen: false,
      loading: false,
      expense: null,
      blobUrl: null,
      error: null
    });
  }

  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [parentCategories, setParentCategories] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [subCategories, setSubCategories] = useState([]);

  useEffect(() => {
    fetchExpenses();
    fetchBankAccounts();
    fetchProjects();
    fetchDynamicCategories();
  }, []);

  function getOrgId() {
    let orgId = localStorage.getItem('selectedOrganizationId');
    if (!orgId) {
      const storedOrg = localStorage.getItem('selectedOrganization');
      if (storedOrg) {
        try { orgId = JSON.parse(storedOrg).id; } catch {}
      }
    }
    if (!orgId) orgId = localStorage.getItem('selectedOrgId');
    return orgId || '1';
  }

  async function fetchDynamicCategories() {
    try {
      const currentOrgId = getOrgId();
      const [treeRes, flatRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${currentOrgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialCategories/organization/${currentOrgId}/flat`, { headers: authHeaders() })
      ]);
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        setParentCategories(treeData || []);
      }
      if (flatRes.ok) {
        setDynamicCategories(await flatRes.json());
      }
    } catch {}
  }

  const handleParentCategoryChange = (parentId) => {
    setSelectedParentId(parentId);
    if (!parentId) {
      setSubCategories([]);
      setForm(f => ({ ...f, category: '' }));
      return;
    }
    const parentCat = parentCategories.find(c => String(c.id) === String(parentId));
    const subs = parentCat?.subCategories || [];
    setSubCategories(subs);
    if (subs.length > 0) {
      setForm(f => ({ ...f, category: String(subs[0].id) }));
    } else {
      setForm(f => ({ ...f, category: String(parentId) }));
    }
  };

  async function fetchExpenses() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/expenses`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch expenses');
      setExpenses(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function fetchBankAccounts() {
    try {
      const res = await fetch(`${API_BASE}/bankaccounts`, { headers: authHeaders() });
      if (res.ok) setBankAccounts(await res.json());
    } catch {}
  }

  async function fetchProjects() {
    try {
      const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
      if (res.ok) setProjects(await res.json());
    } catch {}
  }

  async function fetchTasks(projectId) {
    if (!projectId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/tasks?projectId=${projectId}`, { headers: authHeaders() });
      if (res.ok) {
        setTasks(await res.json());
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    }
  }

  async function handleProjectChange(projId) {
    if (!projId) {
      setForm(f => ({ ...f, projectId: '', taskId: '', donorId: '' }));
      setTasks([]);
      setProjectDonors([]);
      setSelectedProjectInfo(null);
      return;
    }

    const matchedProj = projects.find(p => String(p.id) === String(projId));
    setSelectedProjectInfo(matchedProj || null);
    fetchTasks(projId);

    try {
      const res = await fetch(`${API_BASE}/projects/${projId}/donors`, { headers: authHeaders() });
      if (res.ok) {
        const donorsList = await res.json();
        setProjectDonors(donorsList);

        // Auto-select donor if single donor project or 1 linked donor
        if (matchedProj?.fundingType === 'SingleDonor' && donorsList.length > 0) {
          setForm(f => ({ ...f, projectId: projId, taskId: '', donorId: String(donorsList[0].donorId) }));
        } else if (donorsList.length === 1) {
          setForm(f => ({ ...f, projectId: projId, taskId: '', donorId: String(donorsList[0].donorId) }));
        } else {
          setForm(f => ({ ...f, projectId: projId, taskId: '', donorId: '' }));
        }
      } else {
        setProjectDonors([]);
        setForm(f => ({ ...f, projectId: projId, taskId: '', donorId: '' }));
      }
    } catch {
      setProjectDonors([]);
      setForm(f => ({ ...f, projectId: projId, taskId: '', donorId: '' }));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        projectId: form.projectId ? parseInt(form.projectId) : null,
        taskId: form.taskId ? parseInt(form.taskId) : null,
        bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : null,
        category: parseInt(form.category),
        amount: parseFloat(form.amount),
        currency: form.currency,
        date: form.date,
        description: form.description
      };
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, 'Failed to record expense');
        throw new Error(msg);
      }
      setIsDrawerOpen(false);
      setForm({ projectId: '', taskId: '', bankAccountId: '', category: 2, amount: '', currency: 'USD', date: new Date().toISOString().split('T')[0], description: '' });
      fetchExpenses();
    } catch (e) { alert(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function parseErrorMessage(res, defaultMsg) {
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return json.message || json.error || text;
      } catch {
        return text || defaultMsg;
      }
    } catch {
      return defaultMsg;
    }
  }

  async function handleFinanceReview(id) {
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}/review-finance`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, 'Failed to mark Finance Reviewed');
        throw new Error(msg);
      }
      fetchExpenses();
    } catch (e) { alert(e.message); }
  }

  async function handleManagerSignoff(id) {
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}/signoff-manager`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, 'Failed to sign off');
        throw new Error(msg);
      }
      fetchExpenses();
    } catch (e) { alert(e.message); }
  }

  async function handlePay(id) {
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}/pay`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, 'Failed to mark as paid');
        throw new Error(msg);
      }
      fetchExpenses();
    } catch (e) { alert(e.message); }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/expenses/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      setRejectTarget(null);
      setRejectReason('');
      fetchExpenses();
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteExpense(expenseId) {
    if (!window.confirm("Are you sure you want to remove this expense record?")) return;
    try {
      const res = await fetch(`${API_BASE}/expenses/${expenseId}/reject`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Removed during testing reset' })
      });
      fetchExpenses();
    } catch (e) { console.error(e); }
  }

  async function handleClearFinancialData() {
    if (!window.confirm("Are you sure you want to clear all test financial data (Expenses, Contributions, Budgets) so you can start testing fresh?")) return;
    try {
      const res = await fetch(`${API_BASE}/expenses/clear-financial-data`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        alert("All test financial data cleared successfully!");
        fetchExpenses();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !receiptTarget) return;
    try {
      setUploadingReceipt(true);
      const fd = new FormData();
      fd.append('file', file);
      
      const response = await fetch(`${API_BASE}/expenses/${receiptTarget.id}/receipt`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to upload receipt file');
      }

      setReceiptTarget(null);
      fetchExpenses();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function handleClearFinancialData() {
    if (!window.confirm('Are you sure you want to clear all financial test data (Expenses, Transactions, Budgets) for a clean fresh test run?')) return;
    try {
      const response = await fetch(`${API_BASE}/expenses/clear-financial-data`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (response.ok) {
        fetchExpenses();
        alert('All financial test data has been cleared to 0! You can now start testing the workflow from scratch.');
      } else {
        alert('Failed to clear financial data.');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingCount = expenses.filter(e => e.approvalStatus === 0 || e.approvalStatus === 1).length;
  const paidAmount = expenses.filter(e => e.approvalStatus === 4).reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Expense Ledger & Approval Workflow</h2>
          <p className="text-sm text-slate-500 mt-1">Multi-step approval hierarchy, receipt attachments, and budget safety verification.</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleClearFinancialData}
            className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold py-2.5 px-4 text-xs transition shadow-xs flex items-center gap-1.5"
          >
            <span>🗑️ Reset / Clear Test Data</span>
          </button>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="bg-gradient-to-r from-[#5A45FF] to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md shadow-[#5A45FF]/20 transition flex items-center gap-2 text-sm"
          >
            + Record New Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Expense Claims</p>
          <p className="text-3xl font-extrabold text-slate-900">{totalExpenses}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Amount Claimed</p>
          <p className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Pending Approvals</p>
          <p className="text-3xl font-extrabold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Disbursed (Paid)</p>
          <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(paidAmount)}</p>
        </div>
      </div>

      {/* Expenses List & Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading expenses...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 bg-indigo-50 text-[#5A45FF] rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold">
              💸
            </div>
            <h3 className="text-lg font-bold text-slate-900">No expenses recorded</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mb-6">
              Submit expense claims for project activities, personnel, or operational costs.
            </p>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="bg-[#5A45FF] text-white font-semibold py-2.5 px-6 rounded-full hover:bg-indigo-600 transition"
            >
              Record First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">Date & Category</th>
                  <th scope="col" className="px-6 py-4 text-left">Description</th>
                  <th scope="col" className="px-6 py-4 text-left">Project / Task</th>
                  <th scope="col" className="px-6 py-4 text-left">Amount</th>
                  <th scope="col" className="px-6 py-4 text-left">Receipt & Risk</th>
                  <th scope="col" className="px-6 py-4 text-left">Approval Status</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {expenses.map((eItem) => (
                  <React.Fragment key={eItem.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {new Date(eItem.date).toLocaleDateString()}
                        </div>
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mt-0.5">
                          {categoryLabels[eItem.category] || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate" title={eItem.description}>
                        {eItem.description || '-'}
                        <div className="text-[11px] text-slate-400">By: {eItem.submittedByUserName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {eItem.projectName ? (
                          <div>
                            <div className="font-semibold text-slate-900">{eItem.projectName}</div>
                            {eItem.taskName && <div className="text-[11px] text-slate-400">Task: {eItem.taskName}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">General Operational</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-extrabold text-slate-900">
                        {formatCurrency(eItem.amount, eItem.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {eItem.attachmentFileName ? (
                            <button
                              onClick={() => openReceiptPreview(eItem)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#5A45FF] hover:underline"
                            >
                              📎 {eItem.attachmentFileName}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setReceiptTarget(eItem);
                                setTimeout(() => fileRef.current?.click(), 100);
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-[#5A45FF]"
                            >
                              + Attach Receipt
                            </button>
                          )}

                          {eItem.budgetWarning && (
                            <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                              ⚠️ Budget Warning
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig[eItem.approvalStatus]?.color}`}>
                          {statusConfig[eItem.approvalStatus]?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold space-x-2">
                        {eItem.approvalStatus === 0 && (
                          <button
                            onClick={() => handleFinanceReview(eItem.id)}
                            className="text-[#5A45FF] hover:underline"
                          >
                            Finance Review
                          </button>
                        )}
                        {eItem.approvalStatus === 1 && (
                          <button
                            onClick={() => handleManagerSignoff(eItem.id)}
                            className="text-[#5A45FF] hover:underline"
                          >
                            Manager Sign-off
                          </button>
                        )}
                        {eItem.approvalStatus === 2 && (
                          <button
                            onClick={() => handlePay(eItem.id)}
                            className="text-emerald-600 hover:underline font-bold"
                          >
                            Disburse / Pay
                          </button>
                        )}
                        {eItem.approvalStatus < 2 && (
                          <button
                            onClick={() => setRejectTarget(eItem)}
                            className="text-rose-600 hover:underline"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteExpense(eItem.id)}
                          className="text-rose-600 hover:underline"
                          title="Delete / Reject Expense"
                        >
                          🗑️ Delete
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === eItem.id ? null : eItem.id)}
                          className="text-slate-500 hover:underline"
                        >
                          {expandedId === eItem.id ? 'Hide Details' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === eItem.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/80 p-6 border-y border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                              <p className="font-bold text-slate-900 mb-1">Step 1: Finance Officer Review</p>
                              <p className="text-slate-600">Reviewed By: {eItem.financeOfficerName || 'Pending'}</p>
                              <p className="text-slate-400 mt-0.5">{eItem.financeReviewedAt ? new Date(eItem.financeReviewedAt).toLocaleString() : 'Not reviewed yet'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                              <p className="font-bold text-slate-900 mb-1">Step 2: Manager Sign-off</p>
                              <p className="text-slate-600">Signed Off By: {eItem.managerName || 'Pending'}</p>
                              <p className="text-slate-400 mt-0.5">{eItem.managerSignedOffAt ? new Date(eItem.managerSignedOffAt).toLocaleString() : 'Not signed off yet'}</p>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-slate-200">
                              <p className="font-bold text-slate-900 mb-1">Step 3: Disbursement / Payment</p>
                              <p className="text-slate-600">Paid By: {eItem.paidUserName || 'Pending'}</p>
                              <p className="text-slate-400 mt-0.5">{eItem.paidAt ? new Date(eItem.paidAt).toLocaleString() : 'Not disbursed yet'}</p>
                            </div>
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

      {/* Hidden file input for receipt upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleReceiptUpload}
      />

      {/* RECORD EXPENSE MODAL */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-100 overflow-hidden text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-900">Record Expense Claim</h3>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Project</label>
                  {selectedProjectInfo && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedProjectInfo.fundingType === 'SingleDonor' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                        : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                    }`}>
                      {selectedProjectInfo.fundingType === 'SingleDonor' ? 'Sole Funder' : 'Co-Funded'}
                    </span>
                  )}
                </div>
                <select
                  value={form.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="">General Operational Expense</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.fundingType === 'SingleDonor' ? 'Sole Funder' : 'Co-Funded'})</option>
                  ))}
                </select>
              </div>

              {form.projectId && projectDonors.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Funding Donor
                  </label>
                  {selectedProjectInfo?.fundingType === 'SingleDonor' ? (
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs font-semibold text-amber-900">
                      <span>{projectDonors[0]?.donorName || 'Sole Funder Donor'}</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">100% Locked</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                      {projectDonors.map((pd) => {
                        const isSelected = String(form.donorId) === String(pd.donorId);
                        return (
                          <button
                            key={pd.donorId}
                            type="button"
                            onClick={() => setForm({ ...form, donorId: String(pd.donorId) })}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition ${
                              isSelected
                                ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pd.donorName} ({pd.coFundingPercentage}%)
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {form.projectId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Task</label>
                  <select
                    value={form.taskId}
                    onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">General Project Expense</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Account</label>
                <select
                  value={form.bankAccountId}
                  onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="">Select Account</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountName} ({b.currency})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent Category</label>
                  <select
                    value={selectedParentId}
                    onChange={(e) => handleParentCategoryChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Select Parent</option>
                    {parentCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subcategory</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    disabled={!selectedParentId || subCategories.length === 0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{subCategories.length > 0 ? 'Select Subcategory' : 'No Subcategories'}</option>
                    {subCategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ETB">ETB (Br)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Justification *</label>
                <textarea
                  rows={2}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed description of incurred cost..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT EXPENSE MODAL */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Reject Expense Claim</h3>
            <form onSubmit={handleRejectSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please state the exact reason for rejecting this claim..."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP RECEIPT PREVIEW MODAL */}
      {previewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeReceiptPreview} />
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>📎</span> Receipt Document Preview
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewModal.expense?.attachmentFileName || 'Attached Receipt'} &bull; {formatCurrency(previewModal.expense?.amount, previewModal.expense?.currency)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {previewModal.blobUrl && (
                  <a
                    href={previewModal.blobUrl}
                    download={previewModal.expense?.attachmentFileName || 'receipt_document'}
                    className="bg-[#5A45FF] hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5"
                  >
                    ⬇️ Download Receipt
                  </a>
                )}
                <button
                  onClick={closeReceiptPreview}
                  className="h-8 w-8 rounded-full bg-slate-200/60 hover:bg-slate-300/80 text-slate-600 flex items-center justify-center text-sm font-bold transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-slate-900/5 min-h-[350px]">
              {previewModal.loading ? (
                <div className="flex flex-col items-center gap-3 text-slate-500 py-12">
                  <div className="w-10 h-10 border-4 border-[#5A45FF] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Fetching receipt document securely...</span>
                </div>
              ) : previewModal.error ? (
                <div className="text-center p-8 text-rose-500 font-semibold text-sm bg-white rounded-2xl border border-rose-200 max-w-md shadow-sm">
                  <p className="text-2xl mb-2">⚠️</p>
                  <p>{previewModal.error}</p>
                </div>
              ) : previewModal.blobUrl ? (
                previewModal.expense?.attachmentFileName?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewModal.blobUrl}
                    title="Receipt PDF Preview"
                    className="w-full h-[600px] rounded-2xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <img
                      src={previewModal.blobUrl}
                      alt="Receipt Preview"
                      className="max-w-full max-h-[580px] rounded-2xl object-contain shadow-lg border border-slate-200 bg-white p-2"
                    />
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
