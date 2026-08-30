import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, 
  PieChart, 
  Sparkles, 
  Download, 
  Check, 
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  FileCode
} from 'lucide-react';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function InteractiveReportsDemo() {
  const [activeTab, setActiveTab] = useState('budget'); // 'budget' | 'velocity' | 'category'
  const [chartKey, setChartKey] = useState(0);
  const [exportToast, setExportToast] = useState(null);
  const [reportsData, setReportsData] = useState({
    projects: ['Clean Water', 'Solar Resilience', 'Youth Literacy', 'Health Access', 'Food Security'],
    allocatedBudget: [120000, 81000, 45000, 90000, 68000],
    actualExpended: [95000, 68000, 35000, 80000, 40000],
    categories: ['Clean Water', 'Solar Resilience', 'Youth Literacy', 'Health Access', 'Food Security', 'Admin & Overhead'],
    categorySpending: [27000, 18000, 10000, 20000, 15000, 10000],
    indicators: [
      { title: 'Education MEL', current: 78, target: 85, color: 'from-indigo-500 to-cyan-400' },
      { title: 'WASH Indicators', current: 89, target: 92, color: 'from-cyan-500 to-emerald-400' },
      { title: 'Health Targets', current: 71, target: 76, color: 'from-emerald-500 to-amber-400' },
      { title: 'Livelihood KPIs', current: 65, target: 88, color: 'from-pink-500 to-purple-400' },
      { title: 'Gender Equity', current: 82, target: 95, color: 'from-blue-500 to-indigo-400' }
    ],
    overallExecutionRate: 89.4,
    receiptComplianceRate: 100,
    unflaggedOverspend: 0
  });

  const API_BASE = import.meta.env.VITE_API_URL;

  useEffect(() => {
    async function fetchLiveReports() {
      try {
        const res = await fetch(`${API_BASE}/analytics/public-reports`);
        if (res.ok) {
          const data = await res.json();
          setReportsData(prev => ({
            ...prev,
            ...data,
            indicators: (data.indicators && data.indicators.length > 0) ? data.indicators.map((ind, i) => {
              const colors = [
                'from-indigo-500 to-cyan-400',
                'from-cyan-500 to-emerald-400',
                'from-emerald-500 to-amber-400',
                'from-pink-500 to-purple-400',
                'from-blue-500 to-indigo-400'
              ];
              return { ...ind, color: colors[i % colors.length] };
            }) : prev.indicators
          }));
        }
      } catch (err) {
        console.log('Public reports fetch notice:', err);
      }
    }
    fetchLiveReports();
  }, [API_BASE]);

  // Trigger chart re-animation on tab change
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [activeTab, reportsData]);

  const handleExport = (type) => {
    setExportToast(`✨ Exported donor summary in ${type.toUpperCase()} format!`);
    setTimeout(() => setExportToast(null), 3000);
  };

  // 1. Budget vs. Actual Bar Chart Data
  const budgetChartData = {
    labels: reportsData.projects.length ? reportsData.projects : ['Project Alpha', 'Project Beta', 'Project Gamma'],
    datasets: [
      {
        label: 'Allocated Budget ($)',
        data: reportsData.allocatedBudget,
        backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo
        borderColor: '#818cf8',
        borderWidth: 1.5,
        borderRadius: { topLeft: 6, topRight: 6 },
        barPercentage: 0.65,
        categoryPercentage: 0.65
      },
      {
        label: 'Actual Expended ($)',
        data: reportsData.actualExpended,
        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald
        borderColor: '#34d399',
        borderWidth: 1.5,
        borderRadius: { topLeft: 6, topRight: 6 },
        barPercentage: 0.65,
        categoryPercentage: 0.65
      }
    ]
  };

  const maxBudgetVal = Math.max(...(reportsData.allocatedBudget.length ? reportsData.allocatedBudget : [100000]), 10000);

  const budgetChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#090d16',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: $${Number(context.raw || 0).toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Inter, sans-serif', size: 11, weight: '500' }
        },
        border: { color: 'rgba(255, 255, 255, 0.08)' }
      },
      y: {
        min: 0,
        suggestedMax: Math.ceil(maxBudgetVal * 1.15),
        ticks: {
          callback: (value) => {
            if (value === 0) return '0';
            return value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`;
          },
          color: '#64748b',
          font: { family: 'Inter, monospace', size: 10 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
          drawBorder: false
        },
        border: { display: false }
      }
    }
  };

  const donutColors = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#38bdf8', '#94a3b8'];

  // 2. Category Distribution Donut Chart Data
  const categoryDonutData = {
    labels: reportsData.categories.length ? reportsData.categories : ['General Operations'],
    datasets: [
      {
        data: reportsData.categorySpending.length ? reportsData.categorySpending : [100],
        backgroundColor: donutColors.slice(0, reportsData.categories.length || 1),
        borderColor: '#0b101b',
        borderWidth: 4,
        hoverOffset: 6
      }
    ]
  };

  const totalCatSpending = reportsData.categorySpending.reduce((a, b) => a + Number(b || 0), 0) || 1;

  return (
    <div className="relative w-full max-w-7xl mx-auto">
      {/* Toast Notification */}
      {exportToast && (
        <div className="absolute -top-12 right-0 z-50 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xl animate-fade-up border border-indigo-400/30">
          <Sparkles className="h-4 w-4 text-amber-300 animate-spin" />
          <span>{exportToast}</span>
        </div>
      )}

      {/* Main Grid: Left Main Showcase (68%) vs Right Sidebar (32%) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* ── LEFT MAIN SHOWCASE CONTAINER ── */}
        <div className="lg:col-span-8 rounded-3xl border border-white/[0.08] bg-[#090d16]/90 p-5 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col justify-between">
          <div>
            {/* ── TOP TABS BAR ── */}
            <div className="flex items-center gap-2 sm:gap-4 border-b border-white/[0.08] pb-4 mb-6 overflow-x-auto">
              {/* Tab 1: Budget vs. Actual */}
              <button
                onClick={() => setActiveTab('budget')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'budget'
                    ? 'bg-white/[0.08] text-white border border-indigo-500/40 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-3.5 rounded-full bg-indigo-400 inline-block" />
                <span>Budget vs. Actual</span>
              </button>

              {/* Tab 2: Logframe Indicator Velocity */}
              <button
                onClick={() => setActiveTab('velocity')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'velocity'
                    ? 'bg-white/[0.08] text-white border border-cyan-500/40 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-cyan-400" />
                <span>Logframe Indicator Velocity</span>
              </button>

              {/* Tab 3: Category Distribution */}
              <button
                onClick={() => setActiveTab('category')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'category'
                    ? 'bg-white/[0.08] text-white border border-pink-500/40 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="h-3 w-3 rounded-full border-2 border-pink-400 inline-block" />
                <span>Category Distribution</span>
              </button>
            </div>

            {/* ── TAB 1 VIEW: BUDGET VS. ACTUAL ── */}
            {activeTab === 'budget' && (
              <div className="space-y-6 animate-fade-up">
                {/* Legend Pills */}
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-7 rounded-full bg-indigo-500 inline-block shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    <span className="text-slate-300">Allocated Budget ($)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-7 rounded-full bg-emerald-500 inline-block shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-slate-300">Actual Expended ($)</span>
                  </div>
                </div>

                {/* Dual-Bar Chart Canvas */}
                <div className="h-64 sm:h-72 w-full pt-2">
                  <Bar key={chartKey} data={budgetChartData} options={budgetChartOptions} />
                </div>

                {/* Bottom Program Metrics Summary Row */}
                <div className="pt-4 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  {reportsData.projects.map((projTitle, idx) => {
                    const budget = reportsData.allocatedBudget[idx] || 1;
                    const spent = reportsData.actualExpended[idx] || 0;
                    const pct = Math.min(100, Math.round((spent / budget) * 100));
                    const colors = ['text-indigo-400', 'text-emerald-400', 'text-pink-400', 'text-amber-400', 'text-cyan-400'];
                    return (
                      <div key={idx} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-[11px] font-medium text-slate-400 truncate" title={projTitle}>{projTitle}</p>
                        <p className={`text-base font-black ${colors[idx % colors.length]} font-mono mt-0.5`}>{pct}%</p>
                        <p className="text-[10px] font-bold text-slate-500">${Math.round(spent / 1000)}k</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 2 VIEW: LOGFRAME INDICATOR VELOCITY ── */}
            {activeTab === 'velocity' && (
              <div className="space-y-6 pt-2 animate-fade-up">
                <div className="space-y-5">
                  {reportsData.indicators.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-200">{item.title}</span>
                        <span className="font-mono text-slate-400">
                          <span className="text-white font-black">{item.current}%</span> / {item.target}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.color || 'from-indigo-500 to-cyan-400'} shadow-sm transition-all duration-700`}
                          style={{ width: `${item.current}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 3 VIEW: CATEGORY DISTRIBUTION ── */}
            {activeTab === 'category' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-2 animate-fade-up">
                {/* Donut Chart Canvas */}
                <div className="sm:col-span-5 h-56 relative flex items-center justify-center">
                  <Doughnut
                    key={chartKey}
                    data={categoryDonutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '72%',
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>

                {/* 2-Column Program Legend Breakdown */}
                <div className="sm:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {reportsData.categories.map((catName, idx) => {
                    const spend = reportsData.categorySpending[idx] || 0;
                    const pct = Math.round((spend / totalCatSpending) * 100) || 0;
                    const color = donutColors[idx % donutColors.length];
                    return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate" title={catName}>{catName}</p>
                          <p className="font-mono font-black text-slate-300 text-sm">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR WIDGETS (32%) ── */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          {/* Card 1: TOTAL PROGRAM EXECUTION */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#090d16]/90 p-5 shadow-2xl backdrop-blur-2xl">
            <h4 className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-slate-400 mb-4">
              TOTAL PROGRAM EXECUTION
            </h4>

            <div className="flex items-center gap-5">
              {/* Circular Gauge */}
              <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Ring */}
                  <path
                    className="text-cyan-400"
                    strokeDasharray={`${reportsData.overallExecutionRate}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-black text-white font-mono leading-none">{reportsData.overallExecutionRate}%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">executed</span>
                </div>
              </div>

              {/* Program Mini-Bars List */}
              <div className="flex-1 space-y-2 text-[11px] font-bold">
                {reportsData.projects.slice(0, 5).map((projTitle, idx) => {
                  const budget = reportsData.allocatedBudget[idx] || 1;
                  const spent = reportsData.actualExpended[idx] || 0;
                  const pct = Math.min(100, Math.round((spent / budget) * 100));
                  const colors = ['bg-indigo-500 text-indigo-400', 'bg-emerald-500 text-emerald-400', 'bg-pink-500 text-pink-400', 'bg-amber-500 text-amber-400', 'bg-cyan-500 text-cyan-400'];
                  const [bgCol, textCol] = colors[idx % colors.length].split(' ');
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-slate-300">
                        <span className="truncate max-w-[90px]">{projTitle}</span>
                        <span className={`${textCol} font-mono`}>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                        <div className={`h-full rounded-full ${bgCol}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: FINANCIAL AUDIT STATUS */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#090d16]/90 p-5 shadow-2xl backdrop-blur-2xl space-y-3">
            <h4 className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-slate-400">
              FINANCIAL AUDIT STATUS
            </h4>

            {/* Receipt Compliance Box */}
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-[#091b16]/70 p-3.5">
              <span className="text-xs font-bold text-slate-200">Receipt Compliance</span>
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-mono font-black text-emerald-400 border border-emerald-500/30">
                {reportsData.receiptComplianceRate}% Passed
              </span>
            </div>

            {/* Threshold Overspend Box */}
            <div className="flex items-center justify-between rounded-2xl border border-indigo-500/30 bg-[#0c1830]/70 p-3.5">
              <span className="text-xs font-bold text-slate-200">Threshold Overspend</span>
              <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-mono font-black text-indigo-300 border border-indigo-500/30">
                ${reportsData.unflaggedOverspend} Unflagged
              </span>
            </div>
          </div>

          {/* Card 3: 1-Click Donor Export Ready */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#090d16]/90 p-5 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">1-Click Donor Export Ready</h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Instantly export PDF/Excel reports formatted for institutional donors.
                </p>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="mt-4 flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExport('PDF')}
                className="flex-1 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-xs font-mono font-black text-slate-200 hover:text-white hover:bg-white/[0.08] hover:border-indigo-400/50 transition-all active:scale-95 text-center"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('Excel')}
                className="flex-1 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-xs font-mono font-black text-slate-200 hover:text-white hover:bg-white/[0.08] hover:border-emerald-400/50 transition-all active:scale-95 text-center"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={() => handleExport('CSV')}
                className="flex-1 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-xs font-mono font-black text-slate-200 hover:text-white hover:bg-white/[0.08] hover:border-cyan-400/50 transition-all active:scale-95 text-center"
              >
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
