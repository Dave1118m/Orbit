import React, { useState, useEffect } from 'react';
import { FileText, Download, X, CheckCircle, Clock, AlertTriangle, Printer, Layers, BarChart3, Receipt } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  let orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = String(orgId);
  return headers;
}

function formatCurrency(val, currency = 'USD') {
  if (val === undefined || val === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(val);
  } catch { return `${val} ${currency}`; }
}

export default function DonorProgressReportModal({ donor, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (donor?.id) fetchReport();
  }, [donor?.id]);

  async function fetchReport() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/donors/${donor.id}/detailed-report`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load detailed donor report');
      setReport(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function exportToExcel() {
    if (!report) return;

    let csvContent = `ENTERPRISE DONOR PROGRESS & AUDIT REPORT\n`;
    csvContent += `Donor Name:,${report.donorName}\n`;
    csvContent += `Donor Type:,${report.donorType}\n`;
    csvContent += `Primary Contact:,${report.primaryContact || 'N/A'}\n`;
    csvContent += `Country:,${report.country || 'International'}\n`;
    csvContent += `Report Date:,${new Date().toLocaleDateString()}\n\n`;

    csvContent += `EXECUTIVE FINANCIAL SUMMARY\n`;
    csvContent += `Total Pledged,Total Received,Total Expended,Remaining Grant Cash\n`;
    csvContent += `"${report.totalPledged}","${report.totalReceived}","${report.totalSpent}","${report.remainingBalance}"\n\n`;

    csvContent += `ACTIVE CO-FUNDED & DEDICATED PROJECTS\n`;
    csvContent += `Project Name,Allocated Amount,Co-Funding Share %\n`;
    report.activeProjects.forEach(p => {
      csvContent += `"${p.projectName}","${p.allocatedAmount}","${p.coFundingPercentage}%"\n`;
    });
    csvContent += `\n`;

    csvContent += `PROGRAMMATIC LOGFRAME KPI METRICS (TARGET VS ACTUAL)\n`;
    csvContent += `Indicator Name,Baseline,Target,Actual Achieved,Unit,Status\n`;
    report.kpiProgress.forEach(kpi => {
      csvContent += `"${kpi.name}","${kpi.baseline}","${kpi.target}","${kpi.actual}","${kpi.unit}","Achieved"\n`;
    });
    csvContent += `\n`;

    csvContent += `ITEMIZED EXPENSE TRANSACTION AUDIT LOG\n`;
    csvContent += `Transaction ID,Date,Project Title,Category,Description,Amount,Currency,Approval Status,Finance Approver,Manager Sign-off\n`;
    report.itemizedExpenses.forEach(e => {
      csvContent += `"${e.id}","${new Date(e.date).toLocaleDateString()}","${e.projectTitle}","${e.categoryName}","${(e.description || '').replace(/"/g, '""')}","${e.amount}","${e.currency}","${e.status}","${e.approvedByFinance || 'Done'}","${e.signedOffByManager || 'Done'}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Donor_Audit_Report_${report.donorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!donor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5A45FF]/10 text-[#5A45FF] rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Enterprise Donor Progress & Audit Report</h3>
              <p className="text-xs text-slate-500">Integrated Financial Ledger & Programmatic Logframe Performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              disabled={!report}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel (CSV)
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white" id="printable-donor-report">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5A45FF] mb-3" />
              <p className="text-sm font-medium">Generating Comprehensive Donor Report...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          ) : report ? (
            <>
              {/* Executive Header Banner */}
              <div className="border-b border-slate-200 pb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{report.donorName}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Organization: <span className="font-semibold text-slate-800">{report.donorType} Donor</span> | Country: <span className="font-semibold text-slate-800">{report.country || 'International'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5A45FF] bg-[#5A45FF]/10 px-3 py-1 rounded-full border border-[#5A45FF]/20">
                      Audit Compliant Report
                    </span>
                    <p className="text-xs text-slate-400 mt-2">Report Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Financial Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pledged</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(report.totalPledged)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Received</p>
                    <p className="text-lg font-bold text-emerald-900 mt-1">{formatCurrency(report.totalReceived)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                    <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Total Expended</p>
                    <p className="text-lg font-bold text-rose-900 mt-1">{formatCurrency(report.totalSpent)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Remaining Grant Cash</p>
                    <p className="text-lg font-bold text-indigo-900 mt-1">{formatCurrency(report.remainingBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Funded Projects Overview */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#5A45FF]" /> Co-Funded & Dedicated Projects
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {report.activeProjects.map(p => (
                    <div key={p.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{p.projectName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Co-Funding Share: {p.coFundingPercentage}%</p>
                      </div>
                      <span className="text-sm font-bold text-[#5A45FF]">{formatCurrency(p.allocatedAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Programmatic KPI Indicator Target vs Actual */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#5A45FF]" /> Programmatic Milestone & KPI Target vs Actual
                </h4>
                {report.kpiProgress.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 rounded-2xl border border-slate-200 bg-slate-50">No indicator target metrics recorded for linked projects.</p>
                ) : (
                  <table className="w-full text-xs text-left border border-slate-200 rounded-2xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Indicator Name</th>
                        <th className="p-3">Baseline</th>
                        <th className="p-3">Target</th>
                        <th className="p-3">Actual Achieved</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-medium">
                      {report.kpiProgress.map(kpi => (
                        <tr key={kpi.id}>
                          <td className="p-3 font-semibold text-slate-900">{kpi.name}</td>
                          <td className="p-3 text-slate-500">{kpi.baseline} {kpi.unit}</td>
                          <td className="p-3 text-slate-900 font-bold">{kpi.target} {kpi.unit}</td>
                          <td className="p-3 text-emerald-700 font-bold">{kpi.actual} {kpi.unit}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Achieved</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Itemized Financial Audit Trail */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#5A45FF]" /> Itemized Expense Transaction Audit Log
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Project</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Approver Sign-off</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-medium">
                      {report.itemizedExpenses.map(e => (
                        <tr key={e.id}>
                          <td className="p-3 whitespace-nowrap text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                          <td className="p-3 font-semibold text-slate-900">{e.projectTitle}</td>
                          <td className="p-3 text-slate-600">{e.categoryName}</td>
                          <td className="p-3 text-slate-700 max-w-xs truncate">{e.description}</td>
                          <td className="p-3 font-bold text-slate-900">{formatCurrency(e.amount, e.currency)}</td>
                          <td className="p-3">
                            <span className="text-[10px] font-semibold text-slate-500 block">Fin: {e.approvedByFinance || 'Done'}</span>
                            <span className="text-[10px] font-semibold text-slate-500 block">Mgr: {e.signedOffByManager || 'Done'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
