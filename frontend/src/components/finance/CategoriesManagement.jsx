import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { 
  Tag, Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
  Search, AlertCircle, Folder, Layers, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2
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

const PRESET_COLORS = [
  '#4F46E5', '#059669', '#D97706', '#DC2626', 
  '#9333EA', '#16A34A', '#2563EB', '#0891B2', 
  '#EA580C', '#475569'
];

export default function CategoriesManagement() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [categories, setCategories] = useState([]);
  const [flatCategories, setFlatCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [expandedParents, setExpandedParents] = useState({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    type: 0, // 0 = Expense, 1 = Income, 2 = Both
    parentCategoryId: '',
    color: '#4F46E5',
    icon: 'Folder',
    targetBudgetLimit: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [orgId]);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}/flat`, { headers: authHeaders() })
      ]);

      if (!treeRes.ok) throw new Error('Failed to fetch categories');
      const treeData = await treeRes.json();
      const flatData = flatRes.ok ? await flatRes.json() : [];

      setCategories(treeData || []);
      setFlatCategories(flatData || []);

      // Auto-expand all parent categories by default
      const initialExpanded = {};
      (treeData || []).forEach(cat => {
        initialExpanded[cat.id] = true;
      });
      setExpandedParents(initialExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading financial categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedParents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        code: category.code || '',
        description: category.description || '',
        type: category.type ?? 0,
        parentCategoryId: category.parentCategoryId ? String(category.parentCategoryId) : '',
        color: category.color || '#4F46E5',
        icon: category.icon || 'Folder',
        targetBudgetLimit: category.targetBudgetLimit ? String(category.targetBudgetLimit) : ''
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        type: 0,
        parentCategoryId: '',
        color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        icon: 'Folder',
        targetBudgetLimit: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      organizationId: orgId,
      name: formData.name.trim(),
      code: formData.code.trim() || null,
      description: formData.description.trim() || null,
      type: parseInt(formData.type, 10),
      parentCategoryId: formData.parentCategoryId ? parseInt(formData.parentCategoryId, 10) : null,
      color: formData.color,
      icon: formData.icon,
      targetBudgetLimit: formData.targetBudgetLimit ? parseFloat(formData.targetBudgetLimit) : null
    };

    try {
      let res;
      if (editingCategory) {
        res = await fetch(`${API_BASE}/FinancialCategories/${editingCategory.id}`, {
          method: 'PUT',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...payload, isActive: editingCategory.isActive })
        });
      } else {
        res = await fetch(`${API_BASE}/FinancialCategories`, {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let msg = errData.message || errData.title;
        if (!msg && errData.errors) {
          msg = Object.values(errData.errors).flat().join(', ');
        }
        throw new Error(msg || 'Failed to save category');
      }

      setSuccessMsg(editingCategory ? 'Category updated successfully!' : 'Category created successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      handleCloseModal();
      fetchCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete or deactivate this category?')) return;
    try {
      const res = await fetch(`${API_BASE}/FinancialCategories/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete category');
      const data = await res.json();
      setSuccessMsg(data.message || 'Category deleted');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(cat => {
    const matchesSearch = 
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cat.code && cat.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (cat.subCategories && cat.subCategories.some(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesSearch) return false;

    if (filterType === 'EXPENSE') return cat.type === 0 || cat.type === 2;
    if (filterType === 'INCOME') return cat.type === 1 || cat.type === 2;
    return true;
  });

  const getTypeBadge = (type, isAllowable = true) => {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {type === 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"><ArrowDownRight className="w-3 h-3" /> Expense</span>}
        {type === 1 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"><ArrowUpRight className="w-3 h-3" /> Grant Revenue</span>}
        {type === 2 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"><Layers className="w-3 h-3" /> Expense & Revenue</span>}
        {isAllowable ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✓ Allowable Cost
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
            ⚠️ Restricted / Unallowable
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-brand-600" />
            Financial Categories & Hierarchy
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage category structures, major categories, sub-categories, and cost allowability tags.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Notifications */}
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search financial categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'EXPENSE', 'INCOME'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterType === type 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Types' : type === 'EXPENSE' ? 'Expenses' : 'Grant Revenues'}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tree View Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Category Hierarchy
          </span>
          <span className="text-xs text-slate-400">
            {filteredCategories.length} Parent Categories
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-600" />
            Loading category hierarchy...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No financial categories found matching your search.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCategories.map(cat => {
              const hasSubs = cat.subCategories && cat.subCategories.length > 0;
              const isExpanded = expandedParents[cat.id];

              return (
                <div key={cat.id} className="bg-white">
                  {/* Parent Row */}
                  <div className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleExpand(cat.id)}
                        className={`p-1 rounded hover:bg-slate-200 transition text-slate-400 ${!hasSubs && 'opacity-0 cursor-default'}`}
                        disabled={!hasSubs}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: cat.color || '#4F46E5' }}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{cat.name}</span>
                          {getTypeBadge(cat.type)}
                        </div>
                        {cat.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Financial Totals */}
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Expenses / Revenue</span>
                        <span className="text-xs font-bold text-slate-800">
                          ${(cat.totalExpensesAmount || 0).toLocaleString()} / ${(cat.totalIncomeAmount || 0).toLocaleString()}
                        </span>
                        {cat.targetBudgetLimit && (
                          <span className="text-[10px] text-slate-500 block">
                            Target Limit: ${cat.targetBudgetLimit.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenModal(cat)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition"
                          title="Edit Category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!cat.isSystemDefault && (
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subcategories (Expanded) */}
                  {hasSubs && isExpanded && (
                    <div className="bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100 pl-10 pr-4 py-1">
                      {cat.subCategories.map(sub => (
                        <div key={sub.id} className="py-2.5 flex items-center justify-between hover:bg-slate-100/50 px-3 rounded-lg transition">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color || cat.color || '#4F46E5' }}
                            />
                            <div>
                              <span className="font-semibold text-xs text-slate-800">{sub.name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-xs font-semibold text-slate-700">
                              ${(sub.totalExpensesAmount || 0).toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenModal(sub)}
                                className="p-1 text-slate-400 hover:text-brand-600 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!sub.isSystemDefault && (
                                <button
                                  onClick={() => handleDelete(sub.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Modal (Create / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCategory ? 'Edit Financial Category' : 'Create Financial Category'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software & IT Subscriptions"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Category Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                >
                  <option value={0}>Expense Only</option>
                  <option value={1}>Grant Revenue Only</option>
                  <option value={2}>Both Revenue & Expense</option>
                </select>
              </div>



              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Target Budget Limit ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={formData.targetBudgetLimit}
                  onChange={(e) => setFormData({ ...formData, targetBudgetLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Color Badge</label>
                <div className="flex items-center gap-2 mt-1">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-6 h-6 rounded-full transition ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Category description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
