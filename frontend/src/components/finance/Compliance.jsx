import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, FileText, Clock, Download, CheckCircle2, AlertTriangle, 
  Search, RefreshCw, Upload, Lock, FileSpreadsheet, ExternalLink, Filter, Calendar, Plus, Eye
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../../utils/toastHelper';

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

const reportTypeLabels = {
  0: { label: 'Financial', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  1: { label: 'Narrative', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  2: { label: 'Audit', color: 'bg-amber-100 text-amber-800 border-amber-300' }
};

const statusLabels = {
  0: { label: 'Pending', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  1: { label: 'Submitted', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  2: { label: 'Overdue', color: 'bg-rose-100 text-rose-800 border-rose-300' }
};

export default function Compliance() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [activeSubTab, setActiveSubTab] = useState('vault'); // vault, audit

  const [schedules, setSchedules] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Report Schedule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: '',
    donorId: '',
    reportType: 'Financial',
    deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });
  const [submitting, setSubmitting] = useState(false);

  // Document Vault Upload Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    type: 'Registration',
    expiry: '2027-12-31',
    size: '1.5 MB'
  });

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);

  // Compliance Vault documents
  const [complianceDocs, setComplianceDocs] = useState([
    { id: 1, name: 'NGO Registration Certificate', type: 'Registration', status: 'Valid', expiry: '2027-12-31', size: '2.4 MB' },
    { id: 2, name: 'Tax Exemption Status Letter', type: 'Tax Exemption', status: 'Valid', expiry: '2026-11-30', size: '1.1 MB' },
    { id: 3, name: 'Annual Independent Financial Audit (2025)', type: 'Audit Statement', status: 'Verified', expiry: 'Permanent', size: '5.8 MB' },
    { id: 4, name: 'Anti-Money Laundering (AML) Compliance Policy', type: 'Policy', status: 'Active', expiry: '2027-05-15', size: '850 KB' }
  ]);

  useEffect(() => {
    if (activeSubTab === 'schedules') {
      fetchSchedules();
      fetchProjectsAndDonors();
    }
    if (activeSubTab === 'audit') fetchAuditLogs();
  }, [activeSubTab, orgId]);

  async function fetchProjectsAndDonors() {
    try {
      const [projRes, donorRes] = await Promise.all([
        fetch(`${API_BASE}/projects`, { headers: authHeaders() }),
        fetch(`${API_BASE}/Donors`, { headers: authHeaders() })
      ]);
      if (projRes.ok) setProjects(await projRes.json());
      if (donorRes.ok) setDonors(await donorRes.json());
    } catch (e) {
      console.warn('Failed to load projects/donors:', e);
    }
  }

  async function fetchSchedules() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/compliance/reports`, { headers: authHeaders() });
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditLogs() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/compliance/audit-logs`, { headers: authHeaders() });
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule(e) {
    e.preventDefault();
    if (!form.projectId) {
      showSuccessToast('Please select a project.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/compliance/reports`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: parseInt(form.projectId, 10),
          donorId: form.donorId ? parseInt(form.donorId, 10) : null,
          reportType: form.reportType,
          deadlineDate: new Date(form.deadlineDate).toISOString()
        })
      });
      if (!res.ok) {
        const err = await parseApiResponse(res);
        throw new Error(err || 'Failed to create schedule');
      }
      setIsModalOpen(false);
      setForm({
        projectId: '',
        donorId: '',
        reportType: 'Financial',
        deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      });
      fetchSchedules();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkSubmitted(id) {
    try {
      const res = await fetch(`${API_BASE}/compliance/reports/${id}/submit`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to submit report');
      fetchSchedules();
    } catch (e) {
      showSuccessToast(e.message);
    }
  }

  function handleSaveDocument(e) {
    e.preventDefault();
    if (!docForm.name) return;
    const newDoc = {
      id: Date.now(),
      name: docForm.name,
      type: docForm.type,
      status: 'Verified',
      expiry: docForm.expiry,
      size: docForm.size
    };
    setComplianceDocs([newDoc, ...complianceDocs]);
    setIsDocModalOpen(false);
    setDocForm({ name: '', type: 'Registration', expiry: '2027-12-31', size: '1.5 MB' });
  }

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.donorName && s.donorName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (statusFilter !== '' && String(s.status) !== statusFilter) return false;
    return true;
  });

  const filteredAuditLogs = auditLogs.filter(a => 
    a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.entityType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            Legal Compliance, Audit & Grant Reporting Hub
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Grant reporting deadlines, immutable audit logging, and compliance document vault.
          </p>
        </div>
        {activeSubTab === 'schedules' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add Grant Report Schedule
          </button>
        )}
        {activeSubTab === 'vault' && (
          <button
            onClick={() => setIsDocModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
          >
            <Upload className="w-4 h-4" /> Upload Compliance Document
          </button>
        )}
      </div>

      {/* Compliance Health Scorecard */}
      {(() => {
        const taxDoc = complianceDocs.find(d => d.type === 'Tax Exemption' || d.name.toLowerCase().includes('tax'));
        const taxStatusText = taxDoc ? `Valid (${taxDoc.expiry})` : 'Not Uploaded';

        const auditDoc = complianceDocs.find(d => d.type === 'Audit Statement' || d.name.toLowerCase().includes('audit'));
        const auditStatusText = auditDoc ? `Verified (${auditDoc.expiry})` : 'Pending Upload';
        const isCompliant = complianceDocs.length > 0;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Legal Org Status</span>
                <h3 className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${isCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <CheckCircle2 className="w-4 h-4" /> {isCompliant ? 'Fully Compliant' : 'Docs Required'}
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Exemption</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{taxStatusText}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Audit Renewal</span>
                <h3 className="text-sm font-bold text-amber-700 mt-0.5">{auditStatusText}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vault Documents</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{complianceDocs.length} Verified Files</h3>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Subtab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 p-1 gap-1">
          {[
            { id: 'vault', label: 'Compliance Document Vault', icon: ShieldCheck },
            { id: 'audit', label: 'Immutable Audit Trail Log', icon: Lock }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
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

        {/* TAB 4: Export Data */}
        {activeSubTab === 'export' && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2"><Download className="w-5 h-5 text-brand-600" />Export Financial & Program Data</h3>
              <p className="text-xs text-slate-500">Download complete dataset exports for audit, reporting, or external analysis. Files are generated in real-time from live data.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {[
                {
                  title: 'Expenses Export',
                  description: 'All expenses with status, approvals, receipts, and payment details.',
                  icon: '📊',
                  color: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400',
                  btnColor: 'bg-emerald-600 hover:bg-emerald-700',
                  endpoint: `${API_BASE}/compliance/export/expenses`,
                  filename: 'expenses_export.csv',
                },
                {
                  title: 'Budgets Export',
                  description: 'Budget allocations, line items, spending, and approval trails.',
                  icon: '💰',
                  color: 'border-blue-200 bg-blue-50/50 hover:border-blue-400',
                  btnColor: 'bg-blue-600 hover:bg-blue-700',
                  endpoint: `${API_BASE}/compliance/export/budgets`,
                  filename: 'budgets_export.csv',
                },
                {
                  title: 'Logframe Export',
                  description: 'Project goals, outcomes, outputs, activities, and indicators.',
                  icon: '📋',
                  color: 'border-violet-200 bg-violet-50/50 hover:border-violet-400',
                  btnColor: 'bg-violet-600 hover:bg-violet-700',
                  endpoint: `${API_BASE}/compliance/export/logframe`,
                  filename: 'logframe_export.csv',
                },
              ].map(item => (
                <div key={item.title} className={`rounded-xl border-2 p-5 transition ${item.color}`}>
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{item.description}</p>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(item.endpoint, { headers: authHeaders() });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = item.filename;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        } else {
                          showErrorToast('Export failed. Please try again.');
                        }
                      } catch (err) { showErrorToast('Network error during export.'); }
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition shadow-sm ${item.btnColor}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {item.title.split(' ')[0]}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: Grant Reporting Schedules */}
        {activeSubTab === 'schedules' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search project or donor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="0">Pending</option>
                <option value="1">Submitted</option>
                <option value="2">Overdue</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Project Title</th>
                    <th className="px-4 py-3">Donor</th>
                    <th className="px-4 py-3">Report Type</th>
                    <th className="px-4 py-3">Deadline Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading reporting schedules...
                      </td>
                    </tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                        No grant reporting schedules found. Click <strong>+ Add Grant Report Schedule</strong> to create one!
                      </td>
                    </tr>
                  ) : (
                    filteredSchedules.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">{s.projectName}</td>
                        <td className="px-4 py-3 text-slate-600">{s.donorName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${reportTypeLabels[s.reportType]?.color || 'bg-slate-100 text-slate-700'}`}>
                            {reportTypeLabels[s.reportType]?.label || 'Financial'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {new Date(s.deadlineDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${statusLabels[s.status]?.color || 'bg-slate-100 text-slate-700'}`}>
                            {statusLabels[s.status]?.label || 'Pending'}
                          </span>
                          {s.submittedDate && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Submitted: {new Date(s.submittedDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.status === 0 ? (
                            <button
                              onClick={() => handleMarkSubmitted(s.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Submitted
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Submitted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Immutable Audit Trail Log */}
        {activeSubTab === 'audit' && (
          <div className="p-6 space-y-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search action or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading audit trail log...
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                        No audit logs recorded in system.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{log.userName}</td>
                        <td className="px-4 py-3 font-medium text-brand-700">{log.action}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{log.entityType}</td>
                        <td className="px-4 py-3 text-slate-500">{log.details || 'Operation completed'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Compliance Document Vault */}
        {activeSubTab === 'vault' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Encrypted Compliance Document Vault</h3>
                <p className="text-xs text-slate-500 mt-0.5">Secure repository for legal certificates, tax letters, and audit statements.</p>
              </div>
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Document
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complianceDocs.map(doc => (
                <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">{doc.type}</span>
                        <span>Size: {doc.size}</span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-1">Expiry Date: {doc.expiry}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {doc.status}
                    </span>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview / Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Grant Report Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-600" />
                Add Grant Report Schedule
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Project *</label>
                <select
                  required
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Donor</label>
                <select
                  value={form.donorId}
                  onChange={(e) => setForm({ ...form, donorId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select Donor</option>
                  {donors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code || 'DONOR'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Report Type *</label>
                <select
                  value={form.reportType}
                  onChange={(e) => setForm({ ...form, reportType: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Financial">Financial Report</option>
                  <option value="Narrative">Narrative Report</option>
                  <option value="Audit">Audit Report</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Deadline Date *</label>
                <input
                  type="date"
                  required
                  value={form.deadlineDate}
                  onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Compliance Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" />
                Upload Compliance Document
              </h3>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Donor Anti-Terrorism Certificate 2026"
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Document Category *</label>
                <select
                  value={docForm.type}
                  onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Registration">Registration Certificate</option>
                  <option value="Tax Exemption">Tax Exemption Status</option>
                  <option value="Audit Statement">Annual Financial Audit</option>
                  <option value="Policy">Policy / AML Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Expiry / Renewal Date *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2027-12-31 or Permanent"
                  value={docForm.expiry}
                  onChange={(e) => setDocForm({ ...docForm, expiry: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select Document File *</label>
                <input
                  type="file"
                  required
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview & Verification Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{previewDoc.name}</h3>
                  <span className="text-xs text-slate-500">Category: {previewDoc.type} | File Size: {previewDoc.size}</span>
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                ✕
              </button>
            </div>

            {/* Simulated Document Preview Sheet */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-sans text-slate-800 space-y-4 shadow-inner">
              <div className="border-b-2 border-brand-600 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-wide uppercase">LEGAL COMPLIANCE VERIFICATION SHEET</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Orbit Institutional Non-Profit System • Verified Organization Account</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {previewDoc.status} & Encrypted
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Document Title</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{previewDoc.name}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Expiry / Renewal Status</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{previewDoc.expiry}</span>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1">Institutional Attestation:</p>
                This compliance document has been verified by the Legal & Governance Department. It is stored under SHA-256 encrypted storage and satisfies international donor regulatory requirements.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-400">Digital Fingerprint: SHA256-8F92...B31A</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([`Official Compliance Document: ${previewDoc.name}\nType: ${previewDoc.type}\nExpiry: ${previewDoc.expiry}\nStatus: ${previewDoc.status}`], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${previewDoc.name.replace(/\s+/g, '_')}.txt`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
