import React, { useState, useEffect } from 'react';
import SearchSelect from '../SearchSelect';
import DonorProgressReportModal from './DonorProgressReportModal';

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

const DonorTypeMapping = {
  0: 'Institutional',
  1: 'Foundation',
  2: 'Individual',
  3: 'Corporate'
};

const DONOR_TYPE_OPTIONS = [
  { value: 0, label: 'Institutional' },
  { value: 1, label: 'Foundation' },
  { value: 2, label: 'Individual' },
  { value: 3, label: 'Corporate' }
];

export default function DonorsContributions() {
  const [donors, setDonors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDonorId, setExpandedDonorId] = useState(null);
  const [reportDonorTarget, setReportDonorTarget] = useState(null);

  // Search & Filter state
  const [donorSearch, setDonorSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    donorType: 0,
    country: '',
    primaryContact: '',
    emailAddress: '',
    phoneNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDonors();
    fetchProjects();
    fetchBankAccounts();
  }, []);

  async function fetchProjects(retries = 2) {
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchProjects(retries - 1), 1000);
      } else {
        console.error('Failed to fetch projects:', err);
      }
    }
  }

  async function fetchBankAccounts(retries = 2) {
    try {
      const response = await fetch(`${API_BASE}/bankaccounts`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data);
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchBankAccounts(retries - 1), 1000);
      } else {
        console.error('Failed to fetch bank accounts:', err);
      }
    }
  }

  async function fetchDonors(retries = 2) {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/donors`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDonors(data);
      } else {
        throw new Error('Failed to fetch donors');
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchDonors(retries - 1), 1000);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // Summary metrics
  const totalDonors = donors.length;
  const totalFunding = donors.reduce((sum, d) => sum + (d.totalPledged || 0), 0);
  const totalReceived = donors.reduce((sum, d) => sum + (d.totalReceived || 0), 0);
  const outstanding = Math.max(0, totalFunding - totalReceived);
  const activeGrants = donors.reduce((sum, d) => sum + (d.activeGrantsCount || 0), 0);

  // Filtered donors
  const filteredDonors = React.useMemo(() => {
    return donors.filter(d => {
      const q = (donorSearch || '').trim().toLowerCase();
      const matchSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.country || '').toLowerCase().includes(q) || (d.primaryContact || '').toLowerCase().includes(q);
      const matchType = typeFilter === null || typeFilter === '' || d.donorType === parseInt(typeFilter);
      return matchSearch && matchType;
    });
  }, [donors, donorSearch, typeFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'donorType' ? parseInt(value, 10) : value
    }));
  };

  const handleAddDonor = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        donorType: parseInt(formData.donorType, 10),
        primaryContact: formData.primaryContact?.trim() || null,
        emailAddress: formData.emailAddress?.trim() || null,
        phoneNumber: formData.phoneNumber?.trim() || null,
        country: formData.country?.trim() || null
      };

      const response = await fetch(`${API_BASE}/donors`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMsg = 'Failed to create donor';
        try {
          const errData = await response.json();
          errorMsg = errData.message || errData.title || JSON.stringify(errData);
        } catch {
          const text = await response.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      const newDonor = await response.json();
      setDonors(prev => [...prev, newDonor]);
      setIsModalOpen(false);
      setFormData({ name: '', donorType: 0, country: '', primaryContact: '', emailAddress: '', phoneNumber: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDonor = async (donorId, donorName) => {
    if (!window.confirm(`Are you sure you want to delete donor "${donorName}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/donors/${donorId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        fetchDonors();
      } else {
        const errText = await res.text();
        alert(`Failed to delete donor: ${errText || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting donor.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Donors & Contributions</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track multi-donor pledges, project allocations, and tranche disbursements
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#5A45FF] hover:bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <span>+ Add New Donor</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Donors</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalDonors}</div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pledged</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalFunding)}</div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Received</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(totalReceived)}</div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding Tranches</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(outstanding)}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={donorSearch}
            onChange={e => setDonorSearch(e.target.value)}
            className="block w-full pl-4 pr-4 py-2 border border-slate-200 rounded-2xl text-sm leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 focus:border-[#5A45FF]"
            placeholder="Search donors by name, contact, country..."
          />
        </div>
        <div className="w-full sm:w-56">
          <SearchSelect
            options={DONOR_TYPE_OPTIONS}
            value={typeFilter !== null ? parseInt(typeFilter) : null}
            onChange={val => setTypeFilter(val)}
            placeholder="Filter by Type..."
            isClearable={true}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading donors...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 font-medium">{error}</div>
        ) : filteredDonors.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="h-16 w-16 bg-indigo-50 text-[#5A45FF] rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold">
              🤝
            </div>
            <h3 className="text-lg font-bold text-slate-900">No donors found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Register donor profiles to manage pledges, linked projects, and contribution records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left">Donor Name</th>
                  <th scope="col" className="px-6 py-4 text-left">Donor Type</th>
                  <th scope="col" className="px-6 py-4 text-left">Total Pledged</th>
                  <th scope="col" className="px-6 py-4 text-left">Total Received</th>
                  <th scope="col" className="px-6 py-4 text-left">Active Grants</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredDonors.map((donor) => (
                  <React.Fragment key={donor.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{donor.name}</div>
                        {donor.country && <div className="text-xs text-slate-500">📍 {donor.country}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {DonorTypeMapping[donor.donorType] || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(donor.totalPledged)}
                      </td>
                      <td className="px-6 py-4 text-sm font-extrabold text-emerald-600">
                        {formatCurrency(donor.totalReceived)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                        {donor.activeGrantsCount} Projects
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setReportDonorTarget(donor)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#5A45FF]/10 text-[#5A45FF] hover:bg-[#5A45FF]/20 border border-[#5A45FF]/20 transition shadow-2xs"
                            title="Generate Enterprise Donor Progress & Audit Report"
                          >
                            📄 Audit Report
                          </button>
                          <button
                            onClick={() => setExpandedDonorId(expandedDonorId === donor.id ? null : donor.id)}
                            className="text-slate-600 hover:text-slate-900 hover:underline"
                          >
                            {expandedDonorId === donor.id ? 'Hide Profile' : 'Manage Profile'}
                          </button>
                          <button
                            onClick={() => handleDeleteDonor(donor.id, donor.name)}
                            className="text-rose-600 hover:text-rose-800 hover:underline text-xs"
                            title="Delete Donor Profile"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedDonorId === donor.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50/80 p-6 border-y border-slate-200">
                          <DonorDetails
                            donor={donor}
                            projects={projects}
                            bankAccounts={bankAccounts}
                            onUpdate={fetchDonors}
                          />
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

      {/* DONOR PROGRESS & FINANCIAL REPORT MODAL */}
      {reportDonorTarget && (
        <DonorProgressReportModal
          donor={reportDonorTarget}
          onClose={() => setReportDonorTarget(null)}
        />
      )}

      {/* ADD DONOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add New Donor</h3>
            <form onSubmit={handleAddDonor} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Donor Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. World Health Organization"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Donor Type</label>
                <SearchSelect
                  options={DONOR_TYPE_OPTIONS}
                  value={parseInt(formData.donorType)}
                  onChange={val => handleInputChange({ target: { name: 'donorType', value: val } })}
                  placeholder="Select Type..."
                  isClearable={false}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Country / Region</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  placeholder="e.g. Switzerland / Global"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Primary Contact</label>
                <input
                  type="text"
                  name="primaryContact"
                  value={formData.primaryContact}
                  onChange={handleInputChange}
                  placeholder="Full contact name"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  placeholder="grants@donor.org"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#5A45FF] px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Donor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DonorDetails({ donor, projects, bankAccounts, onUpdate }) {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contributions');

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [contributionFormData, setContributionFormData] = useState({
    amount: '',
    currency: 'USD',
    date: new Date().toISOString().split('T')[0],
    type: 0,
    status: 0,
    allocatedProjectId: '',
    bankAccountId: '',
    notes: ''
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkFormData, setLinkFormData] = useState({
    projectId: '',
    allocatedAmount: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchContributions();
  }, [donor.id]);

  async function fetchContributions() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/donors/${donor.id}/contributions`, {
        headers: authHeaders()
      });
      if (res.ok) {
        setContributions(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleContributionSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        amount: parseFloat(contributionFormData.amount),
        currency: contributionFormData.currency,
        date: new Date(contributionFormData.date).toISOString(),
        type: parseInt(contributionFormData.type),
        status: parseInt(contributionFormData.status),
        allocatedProjectId: contributionFormData.allocatedProjectId ? parseInt(contributionFormData.allocatedProjectId) : null,
        bankAccountId: contributionFormData.bankAccountId ? parseInt(contributionFormData.bankAccountId) : null,
        notes: contributionFormData.notes
      };

      const res = await fetch(`${API_BASE}/donors/${donor.id}/contributions`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to record contribution: ${errText}`);
      }
      setIsContributionModalOpen(false);
      setContributionFormData({
        amount: '',
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        type: 0,
        status: 0,
        allocatedProjectId: '',
        bankAccountId: '',
        notes: ''
      });
      fetchContributions();
      onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        projectId: parseInt(linkFormData.projectId),
        allocatedAmount: parseFloat(linkFormData.allocatedAmount)
      };

      const res = await fetch(`${API_BASE}/donors/${donor.id}/link-project`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to link project');
      setIsLinkModalOpen(false);
      setLinkFormData({ projectId: '', allocatedAmount: '' });
      onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Donor Profile: {donor.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-xs text-slate-500">
            <div><span className="font-semibold text-slate-700">Contact:</span> {donor.primaryContact || '-'}</div>
            <div><span className="font-semibold text-slate-700">Email:</span> {donor.emailAddress || '-'}</div>
            <div><span className="font-semibold text-slate-700">Phone:</span> {donor.phoneNumber || '-'}</div>
            <div><span className="font-semibold text-slate-700">Country:</span> {donor.country || '-'}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsContributionModalOpen(true)}
            className="bg-[#5A45FF] hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow-sm transition"
          >
            + Record Contribution
          </button>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 font-semibold py-2 px-4 rounded-xl text-xs shadow-sm transition"
          >
            + Link Project
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('contributions')}
          className={`text-xs font-bold pb-2 transition border-b-2 ${
            activeTab === 'contributions' ? 'border-[#5A45FF] text-[#5A45FF]' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Contributions Ledger ({contributions.length})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`text-xs font-bold pb-2 transition border-b-2 ${
            activeTab === 'projects' ? 'border-[#5A45FF] text-[#5A45FF]' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Linked Projects & Allocations
        </button>
      </div>

      {activeTab === 'contributions' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          {loading ? (
            <p className="text-slate-500 text-xs py-8 text-center">Loading contributions...</p>
          ) : contributions.length === 0 ? (
            <p className="text-slate-500 text-xs py-10 text-center">No contributions recorded yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Project</th>
                  <th className="px-4 py-3 text-left">Bank Account</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contributions.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{new Date(c.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(c.amount, c.currency)}</td>
                    <td className="px-4 py-3">{['Cash', 'In-Kind', 'Equipment', 'Services'][c.type] || 'Cash'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold ${
                        c.status === 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {['Pledged', 'Received'][c.status] || 'Pledged'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.allocatedProjectName || 'Unallocated'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.bankAccountName || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={c.notes}>{c.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          {!donor.linkedProjects || donor.linkedProjects.length === 0 ? (
            <p className="text-slate-500 text-xs py-10 text-center">No projects linked to this donor yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Project Title</th>
                  <th className="px-4 py-3 text-left">Funding Status</th>
                  <th className="px-4 py-3 text-left">Allocated Grant Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donor.linkedProjects.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{p.projectName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Linked & Allocated
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">
                      {p.allocatedAmount && p.allocatedAmount > 0 ? formatCurrency(p.allocatedAmount) : 'Linked (Unallocated Amount)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* RECORD CONTRIBUTION MODAL */}
      {isContributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsContributionModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <h4 className="text-lg font-bold text-slate-900 mb-4">Record Contribution</h4>
            <form onSubmit={handleContributionSubmit} className="flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={contributionFormData.amount}
                    onChange={e => setContributionFormData({ ...contributionFormData, amount: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:border-[#5A45FF] focus:outline-none"
                    placeholder="10000.00"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Currency</label>
                  <select
                    value={contributionFormData.currency}
                    onChange={e => setContributionFormData({ ...contributionFormData, currency: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs bg-white focus:border-[#5A45FF] focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ETB">ETB (Br)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Contribution Date *</label>
                <input
                  type="date"
                  required
                  value={contributionFormData.date}
                  onChange={e => setContributionFormData({ ...contributionFormData, date: e.target.value })}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:border-[#5A45FF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Type</label>
                  <select
                    value={contributionFormData.type}
                    onChange={e => setContributionFormData({ ...contributionFormData, type: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value={0}>Cash</option>
                    <option value={1}>In-Kind</option>
                    <option value={2}>Equipment</option>
                    <option value={3}>Services</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">Status</label>
                  <select
                    value={contributionFormData.status}
                    onChange={e => setContributionFormData({ ...contributionFormData, status: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value={0}>Pledged</option>
                    <option value={1}>Received</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Allocate to Project</label>
                <SearchSelect
                  options={(() => {
                    const linkedIds = donor?.linkedProjects?.map(lp => lp.projectId || lp.id) || [];
                    const filtered = linkedIds.length > 0 ? projects.filter(p => linkedIds.includes(p.id)) : projects;
                    return filtered.map(p => ({ value: p.id, label: p.title }));
                  })()}
                  value={contributionFormData.allocatedProjectId ? parseInt(contributionFormData.allocatedProjectId) : null}
                  onChange={val => setContributionFormData({ ...contributionFormData, allocatedProjectId: val ? String(val) : '' })}
                  placeholder="Unallocated / General Grant"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Target Bank Account</label>
                <SearchSelect
                  options={bankAccounts.map(ba => ({ value: ba.id, label: `${ba.bankName} - ${ba.accountName} (${ba.currency})` }))}
                  value={contributionFormData.bankAccountId ? parseInt(contributionFormData.bankAccountId) : null}
                  onChange={val => setContributionFormData({ ...contributionFormData, bankAccountId: val ? String(val) : '' })}
                  placeholder="Select Account"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Notes / Deposit Proof</label>
                <textarea
                  rows={2}
                  value={contributionFormData.notes}
                  onChange={e => setContributionFormData({ ...contributionFormData, notes: e.target.value })}
                  placeholder="Deposit reference / notes"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContributionModalOpen(false)}
                  className="rounded-full px-4 py-1.5 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[#5A45FF] px-5 py-1.5 font-semibold text-white hover:bg-indigo-600 transition"
                >
                  Save Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK PROJECT MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <h4 className="text-lg font-bold text-slate-900 mb-4">Link Donor to Project</h4>
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Select Project</label>
                <SearchSelect
                  options={projects.map(p => {
                    const isAlreadyLinked = (donor.linkedProjects || []).some(lp => (lp.projectId || lp.id) === p.id);
                    return {
                      value: p.id,
                      label: isAlreadyLinked ? `${p.title} (Already Linked - Update Allocation)` : p.title
                    };
                  })}
                  value={linkFormData.projectId ? parseInt(linkFormData.projectId, 10) : null}
                  onChange={val => setLinkFormData({ ...linkFormData, projectId: val ? String(val) : '' })}
                  placeholder="Choose Project"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">Allocated Grant Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={linkFormData.allocatedAmount}
                  onChange={e => setLinkFormData({ ...linkFormData, allocatedAmount: e.target.value })}
                  placeholder="50000.00"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs focus:border-[#5A45FF] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="rounded-full px-4 py-1.5 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[#5A45FF] px-5 py-1.5 font-semibold text-white hover:bg-indigo-600 transition"
                >
                  Link Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
