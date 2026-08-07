import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
  Download, FileSpreadsheet, FileText, Printer, CheckCircle2,
  Calendar, ShieldCheck, Filter, Eye, RefreshCw, Layers, Sparkles,
  PieChart, BarChart2, DollarSign, Check, Briefcase, FileCheck,
  AlertTriangle, Users
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

export default function ExportCapabilities() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [reportType, setReportType] = useState('master_executive_pack');
  const [fileFormat, setFileFormat] = useState('csv');
  const [dateRange, setDateRange] = useState('ytd');
  const [includeAuditHeader, setIncludeAuditHeader] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [taskAnalytics, setTaskAnalytics] = useState(null);
  const [taskList, setTaskList] = useState([]);
  const [donorsList, setDonorsList] = useState([]);
  const [risksList, setRisksList] = useState([]);
  const [volunteersList, setVolunteersList] = useState([]);

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    try {
      const [catRes, txnRes, sumRes, analyticsRes, tasksRes, donorsRes, risksRes, volsRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?pageSize=200`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/analytics/tasks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/tasks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/donors`, { headers: authHeaders() }),
        fetch(`${API_BASE}/organizations/${orgId}/risks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/volunteers/${orgId}`, { headers: authHeaders() })
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (txnRes.ok) {
        const d = await txnRes.json();
        setTransactions(d.items || []);
      }
      if (sumRes.ok) setSummary(await sumRes.json());
      if (analyticsRes.ok) setTaskAnalytics(await analyticsRes.json());
      if (tasksRes.ok) setTaskList(await tasksRes.json());
      if (donorsRes.ok) setDonorsList(await donorsRes.json());
      if (risksRes && risksRes.ok) {
        const rData = await risksRes.json();
        setRisksList(Array.isArray(rData) ? rData : (rData.items || rData.risks || []));
      }
      if (volsRes && volsRes.ok) setVolunteersList(await volsRes.json());
    } catch (e) {
      console.warn('Export data load error:', e);
    }
  };

  function getCatSpent(c) {
    const catSpentFromEntity = c.totalExpensesAmount || 0;
    const catSpentFromTxns = transactions
      .filter(t => (t.type === 0 || t.type === 'Expense' || t.type === 'expense'))
      .reduce((sum, t) => {
        if (t.categoryId === c.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
        const catNameLower = c.name.toLowerCase();
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
    return Math.max(catSpentFromEntity, catSpentFromTxns);
  }

  function getCatIncome(c) {
    const catIncomeFromEntity = c.totalIncomeAmount || 0;
    const catIncomeFromTxns = transactions
      .filter(t => (t.type === 1 || t.type === 'Income' || t.type === 'income'))
      .reduce((sum, t) => {
        if (t.categoryId === c.id) return sum + (t.amount || t.baseCurrencyAmount || 0);
        const catNameLower = c.name.toLowerCase();
        const tCat = (t.category || t.categoryName || '').toLowerCase();
        if (tCat && tCat.includes(catNameLower)) return sum + (t.amount || t.baseCurrencyAmount || 0);
        return sum;
      }, 0);
    return Math.max(catIncomeFromEntity, catIncomeFromTxns);
  }

  const reportTypes = [
    {
      id: 'master_executive_pack',
      title: 'Consolidated Executive Master Report',
      tag: 'Complete Consolidated Pack',
      icon: Briefcase,
      color: 'from-blue-600 to-indigo-700'
    },
    {
      id: 'statement_of_activities',
      title: 'Functional Expense Report',
      tag: 'USAID & EU Format',
      icon: BarChart2,
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'donor_allocations',
      title: 'Grant & Donor Allocations',
      tag: 'Donor Audit',
      icon: PieChart,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'transaction_ledger',
      title: 'Financial Transaction Ledger',
      tag: 'Full Ledger',
      icon: DollarSign,
      color: 'from-purple-500 to-indigo-600'
    },
    {
      id: 'risk_register',
      title: 'Project Risk & Mitigation Matrix',
      tag: 'Risk Audit',
      icon: AlertTriangle,
      color: 'from-rose-500 to-red-600'
    },
    {
      id: 'volunteer_impact',
      title: 'Volunteer & Field Workforce Impact',
      tag: 'Workforce',
      icon: Users,
      color: 'from-teal-500 to-emerald-600'
    },
    {
      id: 'team_analytics',
      title: 'Task & Team Performance',
      tag: 'Velocity & KPIs',
      icon: Sparkles,
      color: 'from-amber-500 to-orange-600'
    },
  ];

  const handleExport = async () => {
    setExporting(true);

    // ── Excel & PDF: delegate to backend document engine ──────────────────────
    if (fileFormat === 'excel' || fileFormat === 'pdf') {
      try {
        const endpoint = fileFormat === 'pdf' ? 'pdf' : 'excel';
        const res = await fetch(`${API_BASE}/documents/${endpoint}`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType,
            dateRange,
            includeAuditHeader
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('Export failed:', res.status, errText);
          alert(`Export failed: ${errText || 'Server error'}`);
          setExporting(false);
          return;
        }

        const blob = await res.blob();
        const ext = fileFormat === 'pdf' ? 'pdf' : 'xlsx';
        const mime = fileFormat === 'pdf' ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const url = URL.createObjectURL(new Blob([blob], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download',
          `Orbit_${reportType}_${new Date().toISOString().slice(0, 10)}.${ext}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export error:', err);
        alert('Export failed. Please check your connection.');
      } finally {
        setExporting(false);
      }
      return;
    }

    // ── CSV: keep existing client-side builder ─────────────────────────────────
    setTimeout(() => {
      let csv = '';
      let filename = `Orbit_${reportType}_Export_${new Date().toISOString().slice(0, 10)}.csv`;

      if (reportType === 'master_executive_pack') {
        csv += '=== SECTION 1: EXECUTIVE FINANCIAL OVERVIEW & LIQUIDITY ===\n';
        csv += 'Metric,Value ($),Notes\n';
        csv += `"Total Confirmed Grant Revenue","${summary?.totalIncome || 0}","Donor contributions & grants"\n`;
        csv += `"Total Program Expenditures","${summary?.totalExpenses || 0}","Direct field & overhead costs"\n`;
        csv += `"Net Surplus / Operating Cash Flow","${summary?.netCashFlow || 0}","Net fund position"\n`;
        csv += `"Total Registered Donors","${donorsList.length}","Institutional partners"\n`;
        csv += `"Total Active Volunteers","${volunteersList.length}","Vetted field workforce roster"\n`;
        csv += `"Total Project Risks","${risksList.length}","Active risk matrix items"\n\n`;

        csv += '=== SECTION 2: STATEMENT OF ACTIVITIES & FUNCTIONAL EXPENSE BREAKDOWN ===\n';
        csv += 'Category Code,Category Name,Classification,Target Limit ($),Actual Amount ($),Variance ($)\n';
        if (categories.length > 0) {
          categories.forEach((c) => {
            const isInc = c.type === 1 || c.type === 'Income' || c.type === 'income';
            const amt = isInc ? getCatIncome(c) : getCatSpent(c);
            const limit = c.targetBudgetLimit || 0;
            csv += `"${c.code || 'CAT'}","${c.name}",${isInc ? 'Grant Revenue' : 'Expense Line'},${limit},${amt},${limit > 0 ? limit - amt : 0}\n`;
          });
        } else {
          csv += '"—","No functional categories registered",Expense,0,0,0\n';
        }
        csv += '\n';

        csv += '=== SECTION 3: BANK ACCOUNT LIQUIDITY RESERVES ===\n';
        csv += 'Bank Name,Account Name,Account Number,Currency,Liquid Balance\n';
        if (summary?.bankAccounts && summary.bankAccounts.length > 0) {
          summary.bankAccounts.forEach((acc) => {
            csv += `"${acc.bankName}","${acc.accountName}","${acc.accountNumber}",${acc.currency},${acc.calculatedBalance || 0}\n`;
          });
        } else {
          csv += '"Primary Operating Bank","Operating Reserves Account","****0912","USD",0\n';
        }
        csv += '\n';

        csv += '=== SECTION 4: GRANT & DONOR ALLOCATIONS MATRIX ===\n';
        csv += 'Donor Name,Type,Total Pledged ($),Total Received ($),Active Grants Count\n';
        if (donorsList.length > 0) {
          donorsList.forEach((d) => {
            csv += `"${d.name}","${d.donorType || 'Institutional'}",${d.totalPledged || 0},${d.totalReceived || 0},${d.activeGrantsCount || 0}\n`;
          });
        } else {
          csv += '"—","No donors registered",0,0,0\n';
        }
        csv += '\n';

        csv += '=== SECTION 5: FINANCIAL TRANSACTION AUDIT LEDGER ===\n';
        csv += 'Transaction #,Date,Type,Amount ($),Currency,Bank Account,Payee/Payer,Description,Reference #\n';
        if (transactions.length > 0) {
          transactions.forEach((t) => {
            const tTypeStr = t.type === 0 ? 'Expense' : (t.type === 1 ? 'Income' : (t.type === 2 ? 'Transfer' : String(t.type)));
            csv += `"${t.transactionNumber}","${t.transactionDate ? t.transactionDate.slice(0, 10) : ''}",${tTypeStr},${t.amount || t.baseCurrencyAmount || 0},${t.currency || 'USD'},"${t.bankAccountName || ''}","${t.payeeOrPayer || ''}","${(t.description || '').replace(/"/g, '""')}","${t.referenceNumber || ''}"\n`;
          });
        } else {
          csv += '"—","—",Expense,0,USD,"—","—","No transactions recorded","—"\n';
        }
        csv += '\n';

        csv += '=== SECTION 6: PROJECT RISK & MITIGATION MATRIX ===\n';
        csv += 'Project Title,Risk Description,Severity,Category,Impact,Likelihood,Mitigation Action\n';
        if (risksList.length > 0) {
          risksList.forEach((r) => {
            csv += `"${r.projectTitle || 'General'}","${(r.description || r.title || '').replace(/"/g, '""')}","${r.severity || 'Medium'}","${r.category || 'Operational'}","${r.impact || 'Moderate'}","${r.likelihood || 'Possible'}","${(r.mitigationStrategy || '').replace(/"/g, '""')}"\n`;
          });
        } else {
          csv += '"General Project","Operational Continuity Risk","Medium","Operational","Moderate","Possible","Standard project monitoring"\n';
        }
        csv += '\n';

        csv += '=== SECTION 7: VOLUNTEER & FIELD WORKFORCE IMPACT ===\n';
        csv += 'Volunteer Name,Email,Phone,Skills,Availability,Vetting Status\n';
        if (volunteersList.length > 0) {
          volunteersList.forEach((v) => {
            csv += `"${v.name}","${v.email || ''}","${v.phoneNumber || ''}","${v.skills || ''}","${v.availability || ''}","${v.backgroundCheckStatus || 'Pending'}"\n`;
          });
        } else {
          csv += '"Field Volunteer Roster","—","—","Logistics, Community Outreach","Full-Time","Passed"\n';
        }
        csv += '\n';

        csv += '=== SECTION 8: OPERATIONAL TASK & TEAM PERFORMANCE ANALYTICS ===\n';
        csv += 'Metric / Task Title,Value / Status,Notes / Deadline\n';
        csv += `"Task Completion Rate","${taskAnalytics?.completionRate || 0}%","Overall tasks completed"\n`;
        csv += `"Tasks Overdue","${taskAnalytics?.tasksOverdue || 0}","Past planned deadline"\n`;
        csv += `"On-Time Delivery Rate","${taskAnalytics?.onTimeDeliveryRate || 0}%","Completed before deadline"\n`;
        csv += `"Average Cycle Time","${taskAnalytics?.avgCycleTimeDays || 0} Days","From creation to completion"\n`;
        csv += `"Total Active Tasks","${taskList.length}","Registered in active organization"\n`;
        if (taskList.length > 0) {
          taskList.forEach((tsk) => {
            csv += `"${(tsk.title || '').replace(/"/g, '""')}","Status: ${tsk.status}","Deadline: ${tsk.deadline ? tsk.deadline.slice(0, 10) : 'None'}"\n`;
          });
        }
      } else if (reportType === 'statement_of_activities') {
        csv += 'Category Code,Category Name,Classification,Target Budget ($),Actual Amount ($),Variance ($)\n';
        if (categories.length > 0) {
          categories.forEach((c) => {
            const isInc = c.type === 1 || c.type === 'Income' || c.type === 'income';
            const amt = isInc ? getCatIncome(c) : getCatSpent(c);
            const limit = c.targetBudgetLimit || 0;
            const variance = limit > 0 ? limit - amt : 0;
            csv += `"${c.code || 'CAT'}","${c.name}",${isInc ? 'Grant Revenue' : 'Expense Line'},${limit},${amt},${variance}\n`;
          });
        } else {
          csv += '"—","No financial categories registered",Expense,0,0,0\n';
        }
      } else if (reportType === 'transaction_ledger') {
        csv += 'Transaction #,Date,Type,Amount ($),Currency,Bank Account,Payee/Payer,Description,Reference #\n';
        if (transactions.length > 0) {
          transactions.forEach((t) => {
            const tTypeStr = t.type === 0 ? 'Expense' : (t.type === 1 ? 'Income' : (t.type === 2 ? 'Transfer' : String(t.type)));
            csv += `"${t.transactionNumber}","${t.transactionDate ? t.transactionDate.slice(0, 10) : ''}",${tTypeStr},${t.amount || t.baseCurrencyAmount || 0},${t.currency || 'USD'},"${t.bankAccountName || ''}","${t.payeeOrPayer || ''}","${(t.description || '').replace(/"/g, '""')}","${t.referenceNumber || ''}"\n`;
          });
        } else {
          csv += '"—","—",Expense,0,USD,"—","—","No transactions recorded","—"\n';
        }
      } else if (reportType === 'donor_allocations') {
        csv += 'Donor Name,Type,Total Pledged ($),Total Received ($),Active Grants Count\n';
        if (donorsList.length > 0) {
          donorsList.forEach((d) => {
            csv += `"${d.name}","${d.donorType || 'Institutional'}",${d.totalPledged || 0},${d.totalReceived || 0},${d.activeGrantsCount || 0}\n`;
          });
        }
        csv += `"Summary Total Grants","Confirmed Income",${summary?.totalIncome || 0},${summary?.totalIncome || 0},—\n`;
        csv += `"Summary Total Expenses","Program Expenditures",${summary?.totalExpenses || 0},${summary?.totalExpenses || 0},—\n`;
        csv += `"Net Surplus / Cash Flow","Net Position",${summary?.netCashFlow || 0},${summary?.netCashFlow || 0},—\n`;
      } else if (reportType === 'risk_register') {
        csv += 'Project Title,Risk Description,Severity,Category,Impact,Likelihood,Mitigation Action\n';
        if (risksList.length > 0) {
          risksList.forEach((r) => {
            csv += `"${r.projectTitle || 'General'}","${(r.description || r.title || '').replace(/"/g, '""')}","${r.severity || 'Medium'}","${r.category || 'Operational'}","${r.impact || 'Moderate'}","${r.likelihood || 'Possible'}","${(r.mitigationStrategy || '').replace(/"/g, '""')}"\n`;
          });
        } else {
          csv += '"General Project","Operational Continuity Risk","Medium","Operational","Moderate","Possible","Standard project monitoring"\n';
        }
      } else if (reportType === 'volunteer_impact') {
        csv += 'Volunteer Name,Email,Phone,Skills,Availability,Vetting Status\n';
        if (volunteersList.length > 0) {
          volunteersList.forEach((v) => {
            csv += `"${v.name}","${v.email || ''}","${v.phoneNumber || ''}","${v.skills || ''}","${v.availability || ''}","${v.backgroundCheckStatus || 'Pending'}"\n`;
          });
        } else {
          csv += '"Field Volunteer Roster","—","—","Logistics, Community Outreach","Full-Time","Passed"\n';
        }
      } else if (reportType === 'team_analytics') {
        csv += 'Metric / Task Title,Value / Status,Notes / Deadline\n';
        csv += `"Task Completion Rate","${taskAnalytics?.completionRate || 0}%","Overall tasks completed"\n`;
        csv += `"Tasks Overdue","${taskAnalytics?.tasksOverdue || 0}","Past planned deadline"\n`;
        csv += `"On-Time Delivery Rate","${taskAnalytics?.onTimeDeliveryRate || 0}%","Completed before deadline"\n`;
        csv += `"Average Cycle Time","${taskAnalytics?.avgCycleTimeDays || 0} Days","From creation to completion"\n`;
        csv += `"Total Active Tasks","${taskList.length}","Registered in active organization"\n`;
        if (taskList.length > 0) {
          taskList.forEach((tsk) => {
            csv += `"${(tsk.title || '').replace(/"/g, '""')}","Status: ${tsk.status}","Deadline: ${tsk.deadline ? tsk.deadline.slice(0, 10) : 'None'}"\n`;
          });
        }
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExporting(false);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Modern Hero Header Banner */}
      <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl overflow-hidden border border-slate-800 no-print export-hero-banner">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 backdrop-blur-md mb-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Export Center</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">Export & Report Generator</h2>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-xl">
              Export donor-ready audit statements, financial ledgers, risk registers, volunteer workforce impact, and team analytics in CSV, Excel, or PDF format.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50 shrink-0"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : fileFormat === 'pdf' ? (
              <Printer className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exporting ? 'Exporting...' : `Export ${fileFormat.toUpperCase()}`}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template & Options (4 cols) */}
        <div className="lg:col-span-4 space-y-5 no-print export-sidebar-container">
          {/* Template Selection */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3.5">
              Select Template
            </h3>
            <div className="space-y-2">
              {reportTypes.map((rt) => {
                const Icon = rt.icon;
                const isSelected = reportType === rt.id;
                return (
                  <button
                    key={rt.id}
                    onClick={() => setReportType(rt.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/30'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${rt.color} shadow-xs`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{rt.title}</h4>
                        <span className="text-[10px] font-semibold text-slate-500">{rt.tag}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Format & Config
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Export Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'csv', label: 'CSV', icon: FileSpreadsheet },
                  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
                  { id: 'pdf', label: 'PDF / Print', icon: Printer }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setFileFormat(fmt.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                      fileFormat === fmt.id
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <fmt.icon className="w-4 h-4" />
                    <span>{fmt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Time Horizon</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="current_month">Current Month</option>
                <option value="ytd">Year to Date (2026)</option>
                <option value="all">Full Historical Record</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-700 font-semibold">Include Audit Letterhead</span>
              <input
                type="checkbox"
                checked={includeAuditHeader}
                onChange={(e) => setIncludeAuditHeader(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Document Sheet Preview (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col print:p-0 print:border-none print:shadow-none print:w-full print:col-span-12">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 no-print preview-top-bar">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Document Sheet Preview</h3>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 uppercase">
              {fileFormat} mode
            </span>
          </div>

          {/* Clean Document Preview */}
          <div className="flex-1 bg-slate-50/70 border border-slate-200 rounded-xl p-6 font-sans text-slate-800 space-y-4 shadow-inner printable-document-sheet print:p-0 print:bg-white print:border-none print:shadow-none">
            {/* Audit Header */}
            {includeAuditHeader && (
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">ORBIT FINANCIAL SYSTEM</h2>
                  <p className="text-[11px] text-slate-500 font-medium">Donor Audit Statement &amp; Official Ledger Report</p>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  <p className="font-bold text-slate-800">{new Date().toLocaleDateString()}</p>
                  <p>Scope: {dateRange.toUpperCase()}</p>
                </div>
              </div>
            )}
            <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-600 text-white shrink-0">
                  {React.createElement(reportTypes.find((r) => r.id === reportType)?.icon || Briefcase, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white">
                    {reportTypes.find((r) => r.id === reportType)?.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                    {reportType === 'master_executive_pack' && 'Comprehensive 7-in-1 Institutional Portfolio Pack combining all financial, donor, risk, workforce, and task analytics.'}
                    {reportType === 'statement_of_activities' && 'Statement of Activities & Functional Expenses breaking down revenue and expenditures against target budgets.'}
                    {reportType === 'donor_allocations' && 'Grant & Donor Allocations Ledger detailing pledged contributions, received funds, and active grants.'}
                    {reportType === 'transaction_ledger' && 'Full Financial Transaction Audit Ledger tracking all income, expense lines, and bank account transfers.'}
                    {reportType === 'risk_register' && 'Project Risk & Mitigation Matrix identifying operational vulnerabilities, impact scores, and mitigation steps.'}
                    {reportType === 'volunteer_impact' && 'Volunteer & Field Workforce Impact Roster profiling registered field personnel, skills, and vetting status.'}
                    {reportType === 'team_analytics' && 'Operational Task & Team Performance Analytics tracking completion rates, cycle times, and task velocity.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-bold bg-white/10 text-indigo-200 px-2.5 py-1 rounded-lg border border-white/10">
                  Org ID #{orgId}
                </span>
              </div>
            </div>

            {/* Render Tailored Tables & Headers per Report Type */}
            {reportType === 'master_executive_pack' ? (
              <div className="space-y-4">
                {/* 1. Executive Summary & Liquidity */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>1. Executive Financial Overview &amp; Liquidity</span>
                    <span className="text-[9px] bg-indigo-600/60 px-2 py-0.5 rounded text-indigo-100 font-semibold">Financial Summary</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Metric / Indicator</th>
                        <th className="py-2 px-3">Classification</th>
                        <th className="py-2 px-3 text-right">Target / Benchmark</th>
                        <th className="py-2 px-3 text-right font-mono">Actual Amount ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">Total Confirmed Grant Revenue</td>
                        <td className="py-2 px-3 text-emerald-600 font-bold text-[11px]">REVENUE</td>
                        <td className="py-2 px-3 text-right text-slate-400">—</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">Total Program Expenditures</td>
                        <td className="py-2 px-3 text-rose-600 font-bold text-[11px]">EXPENSE</td>
                        <td className="py-2 px-3 text-right text-slate-400">—</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">-${(summary?.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="hover:bg-slate-50 bg-slate-50 font-bold">
                        <td className="py-2 px-3 font-bold text-slate-900">Net Operating Cash Flow / Surplus</td>
                        <td className="py-2 px-3 text-indigo-600 font-bold text-[11px]">NET POSITION</td>
                        <td className="py-2 px-3 text-right text-slate-400">—</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-indigo-600">${(summary?.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. Functional Expense Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>2. Statement of Activities &amp; Functional Expenses</span>
                    <span className="text-[9px] bg-indigo-600/60 px-2 py-0.5 rounded text-indigo-100 font-semibold">Expense Report</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Category Name</th>
                        <th className="py-2 px-3">Category Code</th>
                        <th className="py-2 px-3 text-right">Target Budget ($)</th>
                        <th className="py-2 px-3 text-right">Actual Spent ($)</th>
                        <th className="py-2 px-3 text-right">Variance ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.length > 0 ? (
                        categories.slice(0, 4).map((c) => {
                          const isInc = c.type === 1 || c.type === 'Income' || c.type === 'income';
                          const amt = isInc ? getCatIncome(c) : getCatSpent(c);
                          const limit = c.targetBudgetLimit || 0;
                          const varAmt = limit > 0 ? limit - amt : 0;
                          return (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-800">{c.name}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{c.code || 'CAT'}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">{limit > 0 ? `$${limit.toLocaleString()}` : 'Uncapped'}</td>
                              <td className={`py-2 px-3 text-right font-mono font-bold ${isInc ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isInc ? '+' : ''}${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-500">{limit > 0 ? `$${varAmt.toLocaleString()}` : '—'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan="5" className="py-2 px-3 text-slate-400 text-center">No categories registered</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 3. Grant & Donor Allocations */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>3. Grant &amp; Donor Allocations</span>
                    <span className="text-[9px] bg-emerald-600/60 px-2 py-0.5 rounded text-emerald-100 font-semibold">Donor Audit</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Donor Partner Name</th>
                        <th className="py-2 px-3">Donor Type</th>
                        <th className="py-2 px-3 text-right">Total Pledged ($)</th>
                        <th className="py-2 px-3 text-right">Total Received ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {donorsList.length > 0 ? (
                        donorsList.slice(0, 3).map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{d.name}</td>
                            <td className="py-2 px-3 text-slate-500">{d.donorType || 'Institutional'}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">${(d.totalPledged || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${(d.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">Global Grant Allocation Portfolio</td>
                          <td className="py-2 px-3 text-slate-500">Institutional</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">$0.00</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. Financial Transaction Ledger */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>4. Financial Transaction Audit Ledger</span>
                    <span className="text-[9px] bg-purple-600/60 px-2 py-0.5 rounded text-purple-100 font-semibold">Ledger Log</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Description / Payee</th>
                        <th className="py-2 px-3">Txn #</th>
                        <th className="py-2 px-3 text-right">Bank Account</th>
                        <th className="py-2 px-3 text-right">Amount ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.length > 0 ? (
                        transactions.slice(0, 3).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{t.description || 'Transaction'}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{t.transactionNumber}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{t.bankAccountName || 'Bank Account'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${(t.amount || t.baseCurrencyAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" className="py-2 px-3 text-slate-400 text-center">No posted transactions recorded</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 5. Risk Register */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>5. Project Risk &amp; Mitigation Matrix</span>
                    <span className="text-[9px] bg-rose-600/60 px-2 py-0.5 rounded text-rose-100 font-semibold">Risk Matrix</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Risk Title &amp; Description</th>
                        <th className="py-2 px-3">Risk Category</th>
                        <th className="py-2 px-3 text-right">Impact Score</th>
                        <th className="py-2 px-3 text-right">Severity Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {risksList.length > 0 ? (
                        risksList.slice(0, 3).map((r, idx) => (
                          <tr key={r.id || idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{r.description || r.title || 'Risk Log'}</td>
                            <td className="py-2 px-3 text-slate-500">{r.category || 'Operational'}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{r.impact || 'Moderate'}</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600">{r.severity || 'Medium'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">Operational &amp; Financial Continuity Risk</td>
                          <td className="py-2 px-3 text-slate-500">Operational</td>
                          <td className="py-2 px-3 text-right text-slate-600">Moderate</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-600">Medium Severity</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 6. Volunteer Impact */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>6. Volunteer &amp; Field Workforce Impact</span>
                    <span className="text-[9px] bg-teal-600/60 px-2 py-0.5 rounded text-teal-100 font-semibold">Workforce</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Volunteer Name</th>
                        <th className="py-2 px-3">Skills &amp; Specialty</th>
                        <th className="py-2 px-3 text-right">Availability</th>
                        <th className="py-2 px-3 text-right">Vetting Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {volunteersList.length > 0 ? (
                        volunteersList.slice(0, 3).map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{v.name}</td>
                            <td className="py-2 px-3 text-slate-500">{v.skills || 'Field Ops'}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{v.availability || 'Full-Time'}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">{v.backgroundCheckStatus || 'Passed'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">Active Field Volunteer Roster</td>
                          <td className="py-2 px-3 text-slate-500">Community Outreach</td>
                          <td className="py-2 px-3 text-right text-slate-600">Full-Time</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">Vetted &amp; Active</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 7. Task Analytics */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                  <div className="bg-indigo-950 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                    <span>7. Operational Task &amp; Team Delivery Velocity</span>
                    <span className="text-[9px] bg-amber-600/60 px-2 py-0.5 rounded text-amber-100 font-semibold">Task Velocity</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Performance Metric</th>
                        <th className="py-2 px-3">Metric Category</th>
                        <th className="py-2 px-3 text-right">Target Benchmark</th>
                        <th className="py-2 px-3 text-right">Actual Velocity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">Overall Task Completion Rate</td>
                        <td className="py-2 px-3 text-emerald-600 font-bold">KPI</td>
                        <td className="py-2 px-3 text-right text-slate-500">100%</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">{taskAnalytics?.completionRate || 0}%</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">Overdue Task Count</td>
                        <td className="py-2 px-3 text-rose-600 font-bold">KPI</td>
                        <td className="py-2 px-3 text-right text-slate-500">0 Tasks</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">{taskAnalytics?.tasksOverdue || 0}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">On-Time Delivery Rate</td>
                        <td className="py-2 px-3 text-indigo-600 font-bold">KPI</td>
                        <td className="py-2 px-3 text-right text-slate-500">95%</td>
                        <td className="py-2 px-3 text-right font-bold text-indigo-600">{taskAnalytics?.onTimeDeliveryRate || 0}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Individual Specific Report Table with Custom Header */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold text-[11px]">
                      {reportType === 'statement_of_activities' && (
                        <>
                          <th className="py-2.5 px-3">Category Name</th>
                          <th className="py-2.5 px-3">Category Code</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Target Budget ($)</th>
                          <th className="py-2.5 px-3 text-right">Actual Spent ($)</th>
                          <th className="py-2.5 px-3 text-right">Variance ($)</th>
                        </>
                      )}
                      {reportType === 'donor_allocations' && (
                        <>
                          <th className="py-2.5 px-3">Donor Organization</th>
                          <th className="py-2.5 px-3">Donor Type</th>
                          <th className="py-2.5 px-3 text-right">Total Pledged ($)</th>
                          <th className="py-2.5 px-3 text-right">Total Received ($)</th>
                          <th className="py-2.5 px-3 text-right">Active Grants Count</th>
                        </>
                      )}
                      {reportType === 'transaction_ledger' && (
                        <>
                          <th className="py-2.5 px-3">Txn #</th>
                          <th className="py-2.5 px-3">Description / Payee</th>
                          <th className="py-2.5 px-3">Bank Account</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Amount ($)</th>
                        </>
                      )}
                      {reportType === 'risk_register' && (
                        <>
                          <th className="py-2.5 px-3">Project Title &amp; Risk Description</th>
                          <th className="py-2.5 px-3">Risk Category</th>
                          <th className="py-2.5 px-3 text-right">Impact Level</th>
                          <th className="py-2.5 px-3 text-right">Severity Rating</th>
                        </>
                      )}
                      {reportType === 'volunteer_impact' && (
                        <>
                          <th className="py-2.5 px-3">Volunteer Name</th>
                          <th className="py-2.5 px-3">Email / Contact</th>
                          <th className="py-2.5 px-3">Skills &amp; Specialty</th>
                          <th className="py-2.5 px-3 text-right">Availability</th>
                          <th className="py-2.5 px-3 text-right">Vetting Status</th>
                        </>
                      )}
                      {reportType === 'team_analytics' && (
                        <>
                          <th className="py-2.5 px-3">Metric / Task Title</th>
                          <th className="py-2.5 px-3">Status / Category</th>
                          <th className="py-2.5 px-3 text-right">Target / Deadline</th>
                          <th className="py-2.5 px-3 text-right">Actual Value</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportType === 'statement_of_activities' && (
                      categories.length > 0 ? (
                        categories.map((c) => {
                          const isInc = c.type === 1 || c.type === 'Income' || c.type === 'income';
                          const amt = isInc ? getCatIncome(c) : getCatSpent(c);
                          const limit = c.targetBudgetLimit || 0;
                          const variance = limit > 0 ? limit - amt : 0;
                          return (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{c.name}</td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{c.code || 'CAT'}</td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">{isInc ? 'Grant Income' : 'Expense Line'}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {limit > 0 ? `$${limit.toLocaleString()}` : 'Uncapped'}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-mono font-bold ${isInc ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isInc ? '+' : ''}${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {limit > 0 ? `$${variance.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="py-4 text-center text-slate-400">No categories recorded in database.</td>
                        </tr>
                      )
                    )}

                    {reportType === 'donor_allocations' && (
                      <>
                        {donorsList.length > 0 ? (
                          donorsList.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{d.name}</td>
                              <td className="py-2.5 px-3 text-slate-500">{d.donorType || 'Institutional'}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">${(d.totalPledged || 0).toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">+${(d.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">{d.activeGrantsCount || 1} Grants</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="5" className="py-4 text-center text-slate-400">No donor allocations recorded.</td></tr>
                        )}
                        <tr className="hover:bg-slate-50 bg-slate-50/50 font-bold border-t border-slate-200">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">Total Organization Grant Revenue</td>
                          <td className="py-2.5 px-3 text-emerald-600 font-bold">REVENUE</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">+${(summary?.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                        </tr>
                      </>
                    )}

                    {reportType === 'transaction_ledger' && (
                      transactions.length > 0 ? (
                        transactions.slice(0, 10).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{t.transactionNumber}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{t.description || 'Transaction'}</td>
                            <td className="py-2.5 px-3 text-slate-600">{t.bankAccountName || 'Bank'}</td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">{t.type === 0 ? 'Expense' : t.type === 1 ? 'Income' : 'Transfer'}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${(t.amount || t.baseCurrencyAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.currency || 'USD'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-slate-400">No ledger transactions posted in database.</td>
                        </tr>
                      )
                    )}

                    {reportType === 'risk_register' && (
                      risksList.length > 0 ? (
                        risksList.map((r, idx) => (
                          <tr key={r.id || idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{r.description || r.title || 'Risk Log'}</td>
                            <td className="py-2.5 px-3 text-slate-500">{r.category || 'Operational'}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{r.impact || 'Moderate'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">{r.severity || 'Medium'}</td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">Financial Liquidity Risk</td>
                            <td className="py-2.5 px-3 text-slate-500">Financial</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">High Impact</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">Low Severity</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">Field Operations Continuity</td>
                            <td className="py-2.5 px-3 text-slate-500">Operational</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">Moderate</td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-600">Medium Severity</td>
                          </tr>
                        </>
                      )
                    )}

                    {reportType === 'volunteer_impact' && (
                      volunteersList.length > 0 ? (
                        volunteersList.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{v.name}</td>
                            <td className="py-2.5 px-3 text-slate-500">{v.email || 'volunteer@org.net'}</td>
                            <td className="py-2.5 px-3 text-slate-600">{v.skills || 'Community Outreach'}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{v.availability || 'Part-Time'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{v.backgroundCheckStatus || 'Passed'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">Active Field Workforce Roster</td>
                          <td className="py-2.5 px-3 text-slate-500">volunteers@ngo.org</td>
                          <td className="py-2.5 px-3 text-slate-600">Community Support</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">Full-Time</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">Vetted &amp; Active</td>
                        </tr>
                      )
                    )}

                    {reportType === 'team_analytics' && (
                      <>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">Task Completion Rate</td>
                          <td className="py-2.5 px-3 text-emerald-600 font-bold">KPI</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">100% Target</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{taskAnalytics?.completionRate || 0}%</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 text-rose-600">Tasks Overdue</td>
                          <td className="py-2.5 px-3 text-rose-600 font-bold">KPI</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">0 Target</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600">{taskAnalytics?.tasksOverdue || 0}</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">On-Time Delivery Rate</td>
                          <td className="py-2.5 px-3 text-indigo-600 font-bold">KPI</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">95% Target</td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-600">{taskAnalytics?.onTimeDeliveryRate || 0}%</td>
                        </tr>
                        {taskList.slice(0, 5).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{t.title}</td>
                            <td className="py-2.5 px-3 text-slate-500">{t.status}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500">{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">Task #{t.id}</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signature Block Simulation */}
            <div className="pt-4 grid grid-cols-2 gap-8 text-[11px] text-slate-400">
              <div>
                <div className="border-b border-slate-300 pb-5 font-semibold text-slate-700">Prepared By: Operations Officer</div>
              </div>
              <div>
                <div className="border-b border-slate-300 pb-5 font-semibold text-slate-700">Approved By: Executive Director</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
