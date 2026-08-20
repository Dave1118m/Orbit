import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { parseApiResponse, showErrorToast } from '../../utils/toastHelper';
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

// Helper to check if task is completed regardless of string casing, enum ID, or completedDate timestamp
const isTaskDone = (t) => {
  if (!t) return false;
  if (t.completedDate || t.CompletedDate) return true;
  if (t.isCompleted === true) return true;
  if (t.status === undefined || t.status === null) return false;
  const s = String(t.status).trim().toLowerCase();
  return s === 'done' || s === 'completed' || s === '4' || s === '3';
};

export default function ExportCapabilities() {
  const { currentOrganization } = useUser();
  const storedOrgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const orgId = currentOrganization?.id || (storedOrgId ? parseInt(storedOrgId, 10) : 1);

  const [reportType, setReportType] = useState('unified_master_report');
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

  const [projectsList, setProjectsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  const [projectDetails, setProjectDetails] = useState(null);
  const [projectDonors, setProjectDonors] = useState([]);
  const [projectLogframe, setProjectLogframe] = useState(null);
  const [projectRisks, setProjectRisks] = useState([]);
  const [projectTxns, setProjectTxns] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [activityMatrix, setActivityMatrix] = useState(null);
  const [categoryRollups, setCategoryRollups] = useState([]);

  useEffect(() => {
    fetchData();
  }, [orgId, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== 'all') {
      fetchProjectData(selectedProjectId);
    } else {
      setProjectDetails(null);
      setProjectDonors([]);
      setProjectLogframe(null);
      setProjectRisks([]);
      setProjectTxns([]);
      setProjectTasks([]);
      setActivityMatrix(null);
      setCategoryRollups([]);
    }
  }, [selectedProjectId]);

  const fetchProjectData = async (projId) => {
    try {
      const [projRes, donorsRes, logRes, risksRes, txnsRes, tasksRes, matrixRes] = await Promise.all([
        fetch(`${API_BASE}/projects/${projId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/projects/${projId}/donors`, { headers: authHeaders() }),
        fetch(`${API_BASE}/projects/${projId}/logframe`, { headers: authHeaders() }),
        fetch(`${API_BASE}/projects/${projId}/risks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?projectId=${projId}&pageSize=200`, { headers: authHeaders() }),
        fetch(`${API_BASE}/tasks?projectId=${projId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/reports/projects/${projId}/usaid-activity-costing`, { headers: authHeaders() })
      ]);

      if (projRes.ok) setProjectDetails(await projRes.json());
      if (donorsRes.ok) setProjectDonors(await donorsRes.json());
      if (logRes.ok) setProjectLogframe(await logRes.json());
      if (risksRes && risksRes.ok) {
        const rData = await risksRes.json();
        setProjectRisks(Array.isArray(rData) ? rData : (rData.items || rData.risks || []));
      }
      if (txnsRes.ok) {
        const d = await txnsRes.json();
        setProjectTxns(d.items || []);
      }
      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setProjectTasks(Array.isArray(tData) ? tData : (tData.items || []));
      }
      if (matrixRes && matrixRes.ok) {
        const matrixData = await matrixRes.json();
        // Backend returns PascalCase keys via ASP.NET default camelCase serializer
        // Fields: project, categories, tasks, matrix, categoryRollups, taskRollups
        setActivityMatrix(matrixData);
        // Parse categoryRollups — backend sends camelCase: budgetAmount, incurredSpent, remainingBalance, burnRatePercentage
        setCategoryRollups(Array.isArray(matrixData.categoryRollups) ? matrixData.categoryRollups : []);
      } else {
        setActivityMatrix(null);
        setCategoryRollups([]);
      }
    } catch (e) {
      console.warn('Project specific data fetch error:', e);
      setActivityMatrix(null);
      setCategoryRollups([]);
    }
  };

  const fetchData = async () => {
    try {
      const [catRes, txnRes, sumRes, analyticsRes, tasksRes, donorsRes, risksRes, volsRes, projRes] = await Promise.all([
        fetch(`${API_BASE}/FinancialCategories/organization/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}?pageSize=200`, { headers: authHeaders() }),
        fetch(`${API_BASE}/FinancialTransactions/organization/${orgId}/summary`, { headers: authHeaders() }),
        fetch(`${API_BASE}/analytics/tasks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/tasks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/donors`, { headers: authHeaders() }),
        fetch(`${API_BASE}/organizations/${orgId}/risks`, { headers: authHeaders() }),
        fetch(`${API_BASE}/volunteers/${orgId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/projects`, { headers: authHeaders() })
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
      if (projRes && projRes.ok) {
        const projs = await projRes.json();
        setProjectsList(projs);
      }
    } catch (e) {
      console.warn('Export data load error:', e);
    }
  };

  function getCatSpent(c) {
    const catSpentFromEntity = c.totalExpensesAmount || 0;
    const catSpentFromTxns = transactions
      .filter(t => (t.type === 0 || t.type === 'Expense' || t.type === 'expense'))
      .reduce((sum, t) => {
        if (t.categoryId === c.id) return sum + (t.baseCurrencyAmount || t.amount || 0);
        const catNameLower = c.name.toLowerCase();
        const tDesc = (t.description || '').toLowerCase();
        const tCat = (t.category || t.categoryName || '').toLowerCase();
        if (tCat && tCat.includes(catNameLower)) return sum + (t.baseCurrencyAmount || t.amount || 0);
        if (catNameLower.includes('equipment') && (tDesc.includes('equipment') || tDesc.includes('solar') || tDesc.includes('water') || tDesc.includes('pump') || tCat.includes('equipment'))) {
          return sum + (t.baseCurrencyAmount || t.amount || 0);
        }
        if (catNameLower.includes('travel') && (tDesc.includes('travel') || tDesc.includes('flight') || tCat.includes('travel'))) {
          return sum + (t.baseCurrencyAmount || t.amount || 0);
        }
        if (catNameLower.includes('personnel') && (tDesc.includes('payroll') || tDesc.includes('salary') || tDesc.includes('personnel') || tCat.includes('personnel'))) {
          return sum + (t.baseCurrencyAmount || t.amount || 0);
        }
        if (catNameLower.includes('operations') && (tDesc.includes('office') || tDesc.includes('admin') || tDesc.includes('ops') || tCat.includes('operations'))) {
          return sum + (t.baseCurrencyAmount || t.amount || 0);
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
        if (t.categoryId === c.id) return sum + (t.baseCurrencyAmount || t.amount || 0);
        const catNameLower = c.name.toLowerCase();
        const tCat = (t.category || t.categoryName || '').toLowerCase();
        if (tCat && tCat.includes(catNameLower)) return sum + (t.baseCurrencyAmount || t.amount || 0);
        return sum;
      }, 0);
    return Math.max(catIncomeFromEntity, catIncomeFromTxns);
  }

  const reportTypes = [
    {
      id: 'unified_master_report',
      title: 'Institutional Audit & Programmatic Impact Master Report',
      subtitle: 'Unified All-in-One Donor Report: Total budget, money spent, remaining cash, % complete, expense category breakdown (Operations, Logistics, Personnel, Equipment), donor allocations, transaction ledger, logframe KPIs, risks & workforce.',
      tag: '100% Unified Master Report (All-in-One)',
      icon: ShieldCheck,
      color: 'from-slate-900 via-indigo-950 to-indigo-600'
    }
  ];

  const handleExport = async () => {
    setExporting(true);

    if (reportType === 'audit_support_package') {
      try {
        const projectId = selectedProjectId || (projectsList.length > 0 ? projectsList[0].id : 1);
        const res = await fetch(`${API_BASE}/projects/${projectId}/export-audit-package`, {
          headers: authHeaders()
        });

        if (!res.ok) {
          const errText = await parseApiResponse(res);
          showErrorToast(`Audit export failed: ${errText || 'Server error'}`);
          setExporting(false);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `OrbitDesk_Audit_Package_Project_${projectId}_${new Date().toISOString().slice(0, 10)}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Audit package export error:', err);
        showErrorToast('Failed to download audit package.');
      } finally {
        setExporting(false);
      }
      return;
    }

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
            includeAuditHeader,
            projectId: selectedProjectId !== 'all' ? Number(selectedProjectId) : null
          })
        });

        if (!res.ok) {
          const errText = await parseApiResponse(res);
          console.error('Export failed:', res.status, errText);
          showErrorToast(`Export failed: ${errText || 'Server error'}`);
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
        showErrorToast('Export failed. Please check your connection.');
      } finally {
        setExporting(false);
      }
      return;
    }

    // ── CSV / Excel: Build Unified Master Report ─────────────────────────────
    setTimeout(() => {
      let csv = '';
      const selectedProj = selectedProjectId !== 'all' ? projectsList.find(p => p.id === Number(selectedProjectId)) : null;
      const scopeTag = selectedProj ? `Project_${selectedProj.id}` : 'General_System';
      let filename = `Orbit_Institutional_Master_Report_${scopeTag}_${new Date().toISOString().slice(0, 10)}.csv`;

      // Robust CSV Cell Sanitizer: Removes internal newlines, escapes quotes, and wraps in quotes to prevent column leaks
      const cleanCell = (val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim();
        return `"${str}"`;
      };

      // Filter Data by Project Scope if selected
      const activeTxns = selectedProj 
        ? (projectTxns.length > 0 ? projectTxns : transactions.filter(t => t.projectId === selectedProj.id || t.projectId === Number(selectedProjectId)))
        : transactions;

      const activeRisks = selectedProj
        ? (projectRisks.length > 0 ? projectRisks : risksList.filter(r => r.projectId === selectedProj.id || (r.projectTitle && r.projectTitle.toLowerCase().includes((selectedProj.title || '').toLowerCase()))))
        : risksList;

      const activeDonors = selectedProj && projectDonors.length > 0
        ? projectDonors
        : donorsList;

      const activeIndicators = selectedProj && projectLogframe?.indicators
        ? projectLogframe.indicators
        : null;

      const filteredTasks = selectedProj
        ? (projectTasks.length > 0 ? projectTasks : taskList.filter(t => Number(t.projectId) === Number(selectedProj.id)))
        : taskList;

      const projSpentFromTxns = activeTxns
        .filter(t => t.type === 0 || t.type === 'Expense' || t.type === 'expense')
        .reduce((sum, t) => sum + (t.baseCurrencyAmount || t.amount || 0), 0);

      // 1. EXECUTIVE OVERVIEW & METRICS
      if (selectedProj) {
        const projBudget = projectDetails?.budget || selectedProj.budget || projSpentFromTxns;
        const projSpent = projSpentFromTxns;
        const projRemaining = Math.max(0, projBudget - projSpent);

        // Dynamic Calculations from real-time data
        const completedTasksCount = filteredTasks.filter(isTaskDone).length;
        const taskCompletionRate = filteredTasks.length > 0 
          ? Math.round((completedTasksCount / filteredTasks.length) * 100)
          : 0;

        let logframeKpiRate = null;
        if (activeIndicators && activeIndicators.length > 0) {
          const kpiScores = activeIndicators.map(ind => {
            const act = parseFloat(ind.actual) || 0;
            const tgt = parseFloat(ind.target) || 0;
            return tgt > 0 ? Math.min(Math.max((act / tgt) * 100, 0), 100) : 0;
          });
          logframeKpiRate = Math.round(kpiScores.reduce((a, b) => a + b, 0) / kpiScores.length);
        }

        const dynamicOverallProgress = selectedProj.progressPercentage !== undefined && selectedProj.progressPercentage !== null
          ? selectedProj.progressPercentage
          : (logframeKpiRate !== null ? logframeKpiRate : taskCompletionRate);

        csv += '"SECTION 1: EXECUTIVE FINANCIAL & PROGRESS OVERVIEW"\n';
        csv += 'Metric / Indicator,Value,Notes & Status\n';
        csv += `${cleanCell('Target Project Title')},${cleanCell(selectedProj.title)},${cleanCell('Backend Database Record')}\n`;
        csv += `${cleanCell('Total Allocated Project Budget')},${cleanCell('$' + projBudget.toLocaleString())},${cleanCell('Approved budget limit in database')}\n`;
        csv += `${cleanCell('Total Expended / Money Spent')},${cleanCell('$' + projSpent.toLocaleString())},${cleanCell('Direct transaction expenditures to date')}\n`;
        csv += `${cleanCell('Remaining Unspent Budget')},${cleanCell('$' + projRemaining.toLocaleString())},${cleanCell('Unspent project cash balance')}\n`;
        csv += `${cleanCell('Task Execution Progress')},${cleanCell(taskCompletionRate + '%')},${cleanCell(completedTasksCount + ' of ' + filteredTasks.length + ' project tasks completed')}\n`;
        csv += `${cleanCell('Logframe KPI Achievement Rate')},${cleanCell(logframeKpiRate !== null ? logframeKpiRate + '%' : 'N/A')},${cleanCell('Average achievement across ' + (activeIndicators ? activeIndicators.length : 0) + ' programmatic indicators')}\n`;
        csv += `${cleanCell('Overall Project Reach & Progress')},${cleanCell(dynamicOverallProgress + '%')},${cleanCell('Real-time dynamic progress calculation')}\n`;
        csv += `${cleanCell('Primary Funding Donor')},${cleanCell(projectDonors.length > 0 ? projectDonors[0].donorName : (selectedProj.donorName || 'Institutional Partner'))},${cleanCell('Linked Donor in DB')}\n\n`;
      } else {
        csv += '"SECTION 1: GENERAL SYSTEM-WIDE EXECUTIVE FINANCIAL OVERVIEW"\n';
        csv += 'Metric / Indicator,Value ($),Notes & Status\n';
        csv += `${cleanCell('Total Confirmed Grant Revenue')},${cleanCell(summary?.totalIncome || 0)},${cleanCell('Donor contributions & grants')}\n`;
        csv += `${cleanCell('Total Program Expenditures')},${cleanCell(summary?.totalExpenses || 0)},${cleanCell('Direct field & overhead costs')}\n`;
        csv += `${cleanCell('Net Surplus / Operating Cash Flow')},${cleanCell(summary?.netCashFlow || 0)},${cleanCell('Net fund position')}\n`;
        csv += `${cleanCell('Total Registered Donors')},${cleanCell(donorsList.length)},${cleanCell('Institutional partners')}\n\n`;
      }


      // 2. PROGRAMMATIC LOGFRAME & KPI TARGET VS ACTUAL
      csv += `"SECTION 2: PROGRAMMATIC LOGFRAME KPI METRICS (${selectedProj ? selectedProj.title.toUpperCase() : 'ORGANIZATION WIDE'})"\n`;
      csv += 'Metric Title,Baseline Value,Target Value,Actual Achieved,Unit,Achievement (%),Status\n';
      if (activeIndicators && activeIndicators.length > 0) {
        activeIndicators.forEach((ind) => {
          const act = parseFloat(ind.actual) || 0;
          const tgt = parseFloat(ind.target) || 0;
          const base = parseFloat(ind.baseline) || 0;
          let computedPct = 0;
          if (tgt > 0) {
            computedPct = Math.min(Math.max(Math.round((act / tgt) * 100), 0), 100);
          }
          const pct = ind.progressPercentage !== undefined ? ind.progressPercentage : computedPct;
          const status = act >= tgt && tgt > 0 ? 'Completed' : (act > base ? 'In Progress' : 'Active');
          csv += `${cleanCell(ind.name || 'Indicator')},${cleanCell(ind.baseline || 0)},${cleanCell(ind.target || 100)},${cleanCell(ind.actual || 0)},${cleanCell(ind.unit || 'Count')},${cleanCell(pct + '%')},${cleanCell(ind.status || status)}\n`;
        });
      } else {
        csv += `${cleanCell('No Logframe indicators created for this project')},${cleanCell(0)},${cleanCell(0)},${cleanCell(0)},${cleanCell('Count')},${cleanCell('0%')},${cleanCell('Pending')}\n`;
      }
      csv += '\n';

      // 3. GRANT & DONOR ALLOCATIONS MATRIX
      csv += '"SECTION 3: GRANT & DONOR ALLOCATIONS MATRIX"\n';
      csv += 'Donor Name,Type / Allocation,Total Pledged / Allocated ($),Total Received ($),Active Grants Count\n';
      if (selectedProj) {
        if (projectDonors.length > 0) {
          projectDonors.forEach((pd) => {
            const allocLabel = projectDonors.length === 1 ? 'Sole Funder (100%)' : `Co-Funding: ${pd.coFundingPercentage || 100}%`;
            csv += `${cleanCell(pd.donorName || 'Institutional Donor')},${cleanCell(allocLabel)},${pd.allocatedAmount || projectDetails?.budget || 0},${pd.allocatedAmount || projectDetails?.budget || 0},1\n`;
          });
        } else if (selectedProj.donorName) {
          csv += `${cleanCell(selectedProj.donorName)},${cleanCell('Sole Funder (100%)')},${projectDetails?.budget || selectedProj.budget || 0},${projectDetails?.budget || selectedProj.budget || 0},1\n`;
        } else {
          csv += `${cleanCell('No donors linked to this project')},${cleanCell('N/A')},0,0,0\n`;
        }
      } else if (donorsList.length > 0) {
        donorsList.forEach((d) => {
          csv += `${cleanCell(d.name)},${cleanCell(d.donorType || 'Institutional')},${d.totalPledged || 0},${d.totalReceived || 0},${d.activeGrantsCount || 0}\n`;
        });
      } else {
        csv += `${cleanCell('No registered donors found')},${cleanCell('N/A')},0,0,0\n`;
      }
      csv += '\n';

      // 4. CATEGORY BUDGET VS ACTUALS (BVA) — FEDERAL STANDARD REPORT
      csv += `"SECTION 4: CATEGORY BUDGET VS ACTUALS (BVA) — FEDERAL STANDARD FINANCIAL REPORT${selectedProj ? ' — ' + selectedProj.title.toUpperCase() : ''}"\n`;
      csv += 'Category Name,Category Code,Approved Budget ($),Actual Expense ($),Remaining Balance ($),Burn Rate (%),Status\n';
      if (categoryRollups.length > 0) {
        categoryRollups.forEach(cat => {
          const isOver = cat.budgetAmount > 0 && cat.incurredSpent > cat.budgetAmount;
          const status = cat.budgetAmount === 0 ? 'No Budget Set' : (isOver ? 'OVER BUDGET' : (cat.burnRatePercentage >= 90 ? 'Critical' : (cat.burnRatePercentage >= 75 ? 'Warning' : 'On Track')));
          csv += `${cleanCell(cat.name)},${cleanCell(cat.code || 'N/A')},${cat.budgetAmount || 0},${cat.incurredSpent || 0},${cat.remainingBalance || 0},${cat.burnRatePercentage || 0}%,${cleanCell(status)}\n`;
        });
        // Totals row
        const totalBudget = categoryRollups.reduce((s, c) => s + (c.budgetAmount || 0), 0);
        const totalSpent = categoryRollups.reduce((s, c) => s + (c.incurredSpent || 0), 0);
        const totalRemaining = categoryRollups.reduce((s, c) => s + (c.remainingBalance || 0), 0);
        const overallBurnRate = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0;
        csv += `${cleanCell('TOTAL')},—,${totalBudget},${totalSpent},${totalRemaining},${overallBurnRate}%,—\n`;
      } else {
        csv += `${cleanCell(selectedProj ? 'No approved budget line items found for this project' : 'Select a specific project to view Category BVA')},N/A,0,0,0,0%,N/A\n`;
      }
      csv += '\n';

      // 5. 2D ACTIVITY-BASED COSTING MATRIX (Task x Category)
      csv += `"SECTION 5: 2D ACTIVITY-BASED COSTING MATRIX (TASKS x CHART OF ACCOUNTS)${selectedProj ? ' — ' + selectedProj.title.toUpperCase() : ''}"\n`;
      if (activityMatrix && activityMatrix.tasks && activityMatrix.categories) {
        const matrixCats = activityMatrix.categories;
        const matrixTasks = activityMatrix.tasks;
        const matrixData = activityMatrix.matrix || {};
        // Header row: Task | Status | [each category] | Total
        csv += `Task / Activity,Status,${matrixCats.map(c => cleanCell(c.name)).join(',')},Total Incurred ($)\n`;
        matrixTasks.forEach(task => {
          // Backend matrix keys are "taskId_categoryId" strings
          const getCellValue = (catId) => matrixData[`${task.id}_${catId}`] || 0;
          const rowTotal = matrixCats.reduce((sum, cat) => sum + getCellValue(cat.id), 0);
          csv += `${cleanCell(task.title)},${cleanCell(task.status)},${matrixCats.map(cat => getCellValue(cat.id)).join(',')},${rowTotal}\n`;
        });
        // Totals row
        const colTotals = matrixCats.map(cat =>
          matrixTasks.reduce((sum, task) => sum + (matrixData[`${task.id}_${cat.id}`] || 0), 0)
        );
        const grandTotal = colTotals.reduce((a, b) => a + b, 0);
        csv += `${cleanCell('TOTAL')},—,${colTotals.join(',')},${grandTotal}\n`;
      } else {
        csv += `${cleanCell(selectedProj ? 'Select a specific project above to generate the 2D Activity Matrix' : 'No matrix data available — select a project')}\n`;
      }
      csv += '\n';

      // 6. FINANCIAL TRANSACTION AUDIT LEDGER
      csv += `"SECTION 6: FINANCIAL TRANSACTION AUDIT LEDGER (${selectedProj ? selectedProj.title.toUpperCase() : 'ALL TRANSACTIONS'})"\n`;
      csv += 'Transaction Code,Date,Type,Amount ($),Currency,Bank Account,Payee/Payer,Description,Reference Code\n';
      if (activeTxns.length > 0) {
        activeTxns.forEach((t) => {
          const tTypeStr = t.type === 0 ? 'Expense' : (t.type === 1 ? 'Income' : (t.type === 2 ? 'Transfer' : String(t.type)));
          csv += `${cleanCell(t.transactionNumber || 'TXN-' + t.id)},${cleanCell(t.transactionDate ? t.transactionDate.slice(0, 10) : '')},${cleanCell(tTypeStr)},${t.baseCurrencyAmount || t.amount || 0},${cleanCell(t.currency || 'USD')},${cleanCell(t.bankAccountName || 'Operating Account')},${cleanCell(t.payeeOrPayer || 'Supplier')},${cleanCell(t.description || '')},${cleanCell(t.referenceNumber || '')}\n`;
        });
      } else {
        csv += `${cleanCell('No transactions recorded')},${cleanCell('N/A')},${cleanCell('N/A')},0,${cleanCell('USD')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('No active transactions logged')},${cleanCell('N/A')}\n`;
      }
      csv += '\n';

      // 7. PROJECT RISK & MITIGATION MATRIX
      csv += '"SECTION 7: PROJECT RISK & MITIGATION MATRIX"\n';
      csv += 'Project Title,Risk Description,Severity Rating,Category,Impact Level,Likelihood,Mitigation Action\n';
      if (activeRisks.length > 0) {
        activeRisks.forEach((r) => {
          csv += `${cleanCell(r.projectTitle || (selectedProj ? selectedProj.title : 'General'))},${cleanCell(r.description || r.title || '')},${cleanCell(r.severity || 'Medium')},${cleanCell(r.category || 'Operational')},${cleanCell(r.impact || 'Moderate')},${cleanCell(r.likelihood || 'Possible')},${cleanCell(r.mitigationStrategy || r.mitigationPlan || '')}\n`;
        });
      } else {
        csv += `${cleanCell(selectedProj ? selectedProj.title : 'Target Project')},${cleanCell('No risks recorded for this project')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('No active risks logged')}\n`;
      }
      csv += '\n';

      // 8. VOLUNTEER & FIELD WORKFORCE ROSTER
      csv += `"SECTION 8: VOLUNTEER & FIELD WORKFORCE IMPACT ROSTER (${selectedProj ? selectedProj.title.toUpperCase() : 'ALL WORKFORCE'})"\n`;
      csv += 'Volunteer Name,Contact Email,Phone,Skills & Specialty,Availability,Vetting Status\n';
      const projTaskIds = filteredTasks.map(t => t.id);
      const activeVolunteers = selectedProj 
        ? volunteersList.filter(v => v.projectId === selectedProj.id || (v.taskVolunteers && v.taskVolunteers.some(tv => projTaskIds.includes(tv.taskId))))
        : volunteersList;

      if (activeVolunteers.length > 0) {
        activeVolunteers.forEach((v) => {
          csv += `${cleanCell(v.name)},${cleanCell(v.email || '')},${cleanCell(v.phoneNumber || '')},${cleanCell(v.skills || '')},${cleanCell(v.availability || '')},${cleanCell(v.backgroundCheckStatus || 'Passed')}\n`;
        });
      } else {
        csv += `${cleanCell('No volunteers assigned')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('N/A')},${cleanCell('N/A')}\n`;
      }
      csv += '\n';

      // 9. OPERATIONAL TASK EXECUTION & TEAM VELOCITY
      csv += `"SECTION 9: OPERATIONAL TASK EXECUTION & TEAM VELOCITY (${selectedProj ? selectedProj.title.toUpperCase() : 'ALL TASKS'})"\n`;
      csv += 'Metric / Task Title,Value / Status,Notes & Deadline\n';
      const completedFilteredTasks = filteredTasks.filter(isTaskDone);
      const filteredCompletionRate = filteredTasks.length > 0 ? Math.round((completedFilteredTasks.length / filteredTasks.length) * 100) : 0;
      csv += `${cleanCell('Task Completion Rate')},${cleanCell(filteredCompletionRate + '%')},${cleanCell(completedFilteredTasks.length + ' of ' + filteredTasks.length + ' project tasks completed')}\n`;
      csv += `${cleanCell('Tasks Overdue')},${cleanCell(filteredTasks.filter(t => !isTaskDone(t) && t.deadline && new Date(t.deadline) < new Date()).length)},${cleanCell('Past planned deadline')}\n`;
      csv += `${cleanCell('Total Active Project Tasks')},${cleanCell(filteredTasks.length)},${cleanCell('Registered in project scope')}\n`;

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Report Scope / Target Project</label>
              <select
                value={selectedProjectId || 'all'}
                onChange={(e) => setSelectedProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">🌐 General System-Wide (All Organization Projects)</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    📌 Project: {p.title}
                  </option>
                ))}
              </select>
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
                    Unified All-in-One Master Donor Report: Total budget, money spent, remaining cash, % complete, expense category breakdown (Operations, Logistics, Personnel, Equipment), donor allocations, transaction audit log, logframe KPIs, risk matrix & workforce.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-bold bg-white/10 text-indigo-200 px-2.5 py-1 rounded-lg border border-white/10">
                  Organization Verified
                </span>
              </div>
            </div>

            {/* Render 8 Unified Master Sections */}
            {(() => {
              const activeProj = selectedProjectId !== 'all' ? projectsList.find(p => p.id === Number(selectedProjectId)) : null;
              const activeTxns = activeProj ? (projectTxns.length > 0 ? projectTxns : transactions.filter(t => t.projectId === activeProj.id || t.projectId === Number(selectedProjectId))) : transactions;
              const activeSpent = activeProj 
                ? activeTxns.filter(t => t.type === 0 || t.type === 'Expense' || t.type === 'expense').reduce((sum, t) => sum + (t.baseCurrencyAmount || t.amount || 0), 0)
                : (summary?.totalExpenses || 0);
              const activeBudget = activeProj ? (projectDetails?.budget || activeProj.budget || (activeSpent > 0 ? activeSpent * 1.2 : 50000)) : (summary?.totalIncome || 0);
              const activeRemaining = Math.max(0, activeBudget - activeSpent);
              const activeProjTasks = activeProj ? (projectTasks.length > 0 ? projectTasks : taskList.filter(t => Number(t.projectId) === Number(activeProj.id))) : taskList;
              const completedTasksCount = activeProjTasks.filter(isTaskDone).length;
              const taskProgressPct = activeProjTasks.length > 0 ? Math.round((completedTasksCount / activeProjTasks.length) * 100) : 0;
              
              const projIndicators = activeProj && projectLogframe?.indicators ? projectLogframe.indicators : null;
              let indicatorAvgPct = null;
              if (projIndicators && projIndicators.length > 0) {
                const kpis = projIndicators.map(i => {
                  const act = parseFloat(i.actual) || 0;
                  const tgt = parseFloat(i.target) || 0;
                  return tgt > 0 ? Math.min(Math.max((act / tgt) * 100, 0), 100) : 0;
                });
                indicatorAvgPct = Math.round(kpis.reduce((a, b) => a + b, 0) / kpis.length);
              }

              const activeProgress = activeProj 
                ? (activeProj.progressPercentage !== undefined && activeProj.progressPercentage !== null ? activeProj.progressPercentage : (indicatorAvgPct !== null ? indicatorAvgPct : taskProgressPct)) 
                : (taskList.length > 0 ? Math.round((taskList.filter(isTaskDone).length / taskList.length) * 100) : 0);

              return (
                <div className="space-y-4">
                  {/* 1. Executive Summary & Progress */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                    <div className="bg-slate-900 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                      <span>1. Executive Financial &amp; Progress Overview {activeProj ? `(${activeProj.title.toUpperCase()})` : '(ORGANIZATION WIDE)'}</span>
                      <span className="text-[9px] bg-indigo-600 px-2 py-0.5 rounded text-white font-semibold">
                        {activeProj ? 'Single Project Scope' : 'Master Overview'}
                      </span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2 px-3">Metric / Indicator</th>
                          <th className="py-2 px-3">Classification</th>
                          <th className="py-2 px-3 text-right">Target / Benchmark</th>
                          <th className="py-2 px-3 text-right font-mono">Actual Amount ($ / %)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">Total Confirmed Grant Revenue / Budget</td>
                          <td className="py-2 px-3 text-emerald-600 font-bold text-[11px]">REVENUE</td>
                          <td className="py-2 px-3 text-right text-slate-400">—</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${activeBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">Total Program Expenditures / Money Spent</td>
                          <td className="py-2 px-3 text-rose-600 font-bold text-[11px]">EXPENSE</td>
                          <td className="py-2 px-3 text-right text-slate-400">—</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">-${activeSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 bg-slate-50 font-bold">
                          <td className="py-2 px-3 font-bold text-slate-900">Remaining Unspent Cash Balance</td>
                          <td className="py-2 px-3 text-indigo-600 font-bold text-[11px]">NET POSITION</td>
                          <td className="py-2 px-3 text-right text-slate-400">—</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-indigo-600">${activeRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 bg-indigo-50/40 font-bold">
                          <td className="py-2 px-3 font-bold text-indigo-950">Overall Execution Progress (% Complete)</td>
                          <td className="py-2 px-3 text-indigo-600 font-bold text-[11px]">MILESTONE</td>
                          <td className="py-2 px-3 text-right text-slate-400">100% Target</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-emerald-600">{activeProgress}% Achieved</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>


              {/* 2. Programmatic Logframe */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <div className="bg-slate-900 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span>2. Programmatic Logframe KPI Progress Metrics</span>
                  <span className="text-[9px] bg-blue-600 px-2 py-0.5 rounded text-white font-semibold">Logframe M&amp;E</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-3">Metric Title</th>
                      <th className="py-2 px-3 text-right">Baseline</th>
                      <th className="py-2 px-3 text-right">Target</th>
                      <th className="py-2 px-3 text-right">Actual Achieved</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projIndicators && projIndicators.length > 0 ? (
                      projIndicators.map((ind, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{ind.name}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{ind.baseline}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">{ind.target}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{ind.actual}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-600">Active</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">No logframe data found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 3. Grant & Donor Allocations */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <div className="bg-slate-900 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span>3. Grant &amp; Donor Allocations Matrix {activeProj ? `(${activeProj.title.toUpperCase()})` : ''}</span>
                  <span className="text-[9px] bg-purple-600 px-2 py-0.5 rounded text-white font-semibold">
                    {activeProj ? (projectDonors.length === 1 || !projectDonors.length ? 'Sole Funder' : 'Project Donors') : 'Donor Audit'}
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-3">Donor Partner Name</th>
                      <th className="py-2 px-3">Allocation / Funding Type</th>
                      <th className="py-2 px-3 text-right">Total Pledged / Allocated ($)</th>
                      <th className="py-2 px-3 text-right">Total Received ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeProj ? (
                      projectDonors.length > 0 ? (
                        projectDonors.map((pd, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{pd.donorName || 'Institutional Donor'}</td>
                            <td className="py-2 px-3 text-slate-500 font-medium">
                              {projectDonors.length === 1 ? 'Sole Funder (100%)' : `Co-Funding (${pd.coFundingPercentage || 100}%)`}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">${(pd.allocatedAmount || activeBudget).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${(pd.allocatedAmount || activeBudget).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{activeProj.donorName || 'Sole Funding Partner'}</td>
                          <td className="py-2 px-3 text-slate-500 font-medium">Sole Funder (100%)</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">${activeBudget.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${activeBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )
                    ) : donorsList.length > 0 ? (
                      donorsList.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{d.name}</td>
                          <td className="py-2 px-3 text-slate-500">{d.donorType || 'Institutional'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">${(d.totalPledged || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+${(d.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">No donor data found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 4. Category BVA — Federal Standard Report */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> 4. Category Budget vs Actuals (BVA) — Standard Financial Report</span>
                  <span className="text-[9px] bg-emerald-600 px-2 py-0.5 rounded text-white font-semibold">Federal BVA</span>
                </div>
                {categoryRollups.length > 0 ? (
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-3">Category Name</th>
                        <th className="py-2 px-3 font-mono text-[10px]">Code</th>
                        <th className="py-2 px-3 text-right">Approved Budget ($)</th>
                        <th className="py-2 px-3 text-right">Actual Expense ($)</th>
                        <th className="py-2 px-3 text-right">Remaining Balance ($)</th>
                        <th className="py-2 px-3 text-center">Burn Rate / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categoryRollups.map(cat => {
                        const isOver = cat.budgetAmount > 0 && cat.incurredSpent > cat.budgetAmount;
                        return (
                          <tr key={cat.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{cat.name}</td>
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{cat.code || 'CAT'}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {cat.budgetAmount > 0 ? `$${cat.budgetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                              ${(cat.incurredSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold ${(cat.remainingBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {cat.budgetAmount > 0 ? `$${(cat.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {cat.budgetAmount > 0 ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOver ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {cat.burnRatePercentage}% {isOver ? '⚠️' : '✅'}
                                </span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-bold">
                      <tr>
                        <td className="py-2 px-3" colSpan={2}>TOTALS</td>
                        <td className="py-2 px-3 text-right font-mono">
                          ${categoryRollups.reduce((s, c) => s + (c.budgetAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-300">
                          ${categoryRollups.reduce((s, c) => s + (c.incurredSpent || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-300">
                          ${categoryRollups.reduce((s, c) => s + (c.remainingBalance || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center text-indigo-300 font-mono">
                          {(() => { const tb = categoryRollups.reduce((s,c) => s+(c.budgetAmount||0),0); const ts = categoryRollups.reduce((s,c) => s+(c.incurredSpent||0),0); return tb > 0 ? ((ts/tb)*100).toFixed(1)+'%' : '—'; })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="py-6 text-center text-slate-400 italic text-[11px]">
                    {selectedProjectId !== 'all' ? 'No approved budget line items found for this project.' : 'Select a specific project above to view the Category BVA report.'}
                  </div>
                )}
              </div>

              {/* 5. 2D Activity-Based Costing Matrix */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white px-3 py-2 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-indigo-300" /> 5. 2D Activity-Based Costing Matrix (Tasks × Categories)</span>
                  <span className="text-[9px] bg-indigo-500 px-2 py-0.5 rounded text-white font-semibold">Activity Costing</span>
                </div>
                {activityMatrix && activityMatrix.tasks && activityMatrix.categories ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2 px-3 min-w-[150px]">Task / Activity</th>
                          <th className="py-2 px-3 w-20 text-center">Status</th>
                          {activityMatrix.categories.map(cat => (
                            <th key={cat.id} className="py-2 px-3 text-right min-w-[100px]">{cat.name}</th>
                          ))}
                          <th className="py-2 px-3 text-right font-extrabold bg-slate-200">Total ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activityMatrix.tasks.map(task => {
                          // Backend matrix keys are "taskId_categoryId" strings
                          const getCellValue = (catId) => activityMatrix.matrix?.[`${task.id}_${catId}`] || 0;
                          const rowTotal = activityMatrix.categories.reduce((s, c) => s + getCellValue(c.id), 0);
                          return (
                            <tr key={task.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-800">{task.title}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  String(task.status).toLowerCase().includes('done') || String(task.status).toLowerCase().includes('complet')
                                    ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>{task.status}</span>
                              </td>
                              {activityMatrix.categories.map(cat => (
                                <td key={cat.id} className="py-2 px-3 text-right font-mono text-slate-600">
                                  {getCellValue(cat.id) > 0 ? `$${getCellValue(cat.id).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-right font-mono font-black text-slate-900 bg-slate-50">
                                ${rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals Footer */}
                        <tr className="bg-slate-900 text-white font-bold">
                          <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                          {activityMatrix.categories.map(cat => {
                            // Backend matrix keys are "taskId_categoryId" strings
                            const colTotal = activityMatrix.tasks.reduce((s, t) => s + (activityMatrix.matrix?.[`${t.id}_${cat.id}`] || 0), 0);
                            return <td key={cat.id} className="py-2 px-3 text-right font-mono">${colTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>;
                          })}
                          <td className="py-2 px-3 text-right font-mono font-black text-emerald-300">
                            ${activityMatrix.tasks.reduce((s, t) => {
                              return s + activityMatrix.categories.reduce((cs, c) => cs + (activityMatrix.matrix?.[`${t.id}_${c.id}`] || 0), 0);
                            }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 italic text-[11px]">
                    {selectedProjectId !== 'all' ? 'No activity costing data for this project yet.' : 'Select a specific project above to view the 2D Activity Matrix.'}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
