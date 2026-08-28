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

  // Trigger chart re-animation on tab change
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [activeTab]);

  const handleExport = (type) => {
    setExportToast(`✨ Exported donor summary in ${type.toUpperCase()} format!`);
    setTimeout(() => setExportToast(null), 3000);
  };

  // 1. Budget vs. Actual Bar Chart Data (Figma Exact)
  const budgetChartData = {
    labels: ['Clean Water', 'Solar Resilience', 'Youth Literacy', 'Health Access', 'Food Security'],
    datasets: [
      {
        label: 'Allocated Budget ($)',
        data: [120000, 81000, 45000, 90000, 68000],
        backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo
        borderColor: '#818cf8',
        borderWidth: 1.5,
        borderRadius: { topLeft: 6, topRight: 6 },
        barPercentage: 0.65,
        categoryPercentage: 0.65
      },
      {
        label: 'Actual Expended ($)',
        data: [95000, 68000, 35000, 80000, 40000],
        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald
        borderColor: '#34d399',
        borderWidth: 1.5,
        borderRadius: { topLeft: 6, topRight: 6 },
        barPercentage: 0.65,
        categoryPercentage: 0.65
      }
    ]
  };

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
          label: (context) => ` ${context.dataset.label}: $${context.raw.toLocaleString()}`
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
        max: 130000,
        ticks: {
          stepSize: 20000,
          callback: (value) => {
            if (value === 0) return '0';
            return `${value / 1000}k`;
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

  // 2. Category Distribution Donut Chart Data (Figma Exact)
  const categoryDonutData = {
    labels: ['Clean Water', 'Solar Resilience', 'Youth Literacy', 'Health Access', 'Food Security', 'Admin & Overhead'],
    datasets: [
      {
        data: [27, 18, 10, 20, 15, 10],
        backgroundColor: [
          '#818cf8', // Indigo - Clean Water (27%)
          '#34d399', // Emerald - Solar Resilience (18%)
          '#f472b6', // Pink - Youth Literacy (10%)
          '#fbbf24', // Amber - Health Access (20%)
          '#38bdf8', // Cyan - Food Security (15%)
          '#94a3b8'  // Slate - Admin & Overhead (10%)
        ],
        borderColor: '#0b101b',
        borderWidth: 4,
        hoverOffset: 6
      }
    ]
  };

  // 3. Logframe Indicator Velocity Data
  const INDICATOR_VELOCITY_DATA = [
    { title: 'Education MEL', current: 78, target: 85, color: 'from-indigo-500 to-cyan-400' },
    { title: 'WASH Indicators', current: 89, target: 92, color: 'from-cyan-500 to-emerald-400' },
    { title: 'Health Targets', current: 71, target: 76, color: 'from-emerald-500 to-amber-400' },
    { title: 'Livelihood KPIs', current: 65, target: 88, color: 'from-pink-500 to-purple-400' },
    { title: 'Gender Equity', current: 82, target: 95, color: 'from-blue-500 to-indigo-400' }
  ];

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

                {/* Bottom 5 Program Metrics Summary Row */}
                <div className="pt-4 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[11px] font-medium text-slate-400 truncate">Clean Water</p>
                    <p className="text-base font-black text-indigo-400 font-mono mt-0.5">79%</p>
                    <p className="text-[10px] font-bold text-slate-500">$95k</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[11px] font-medium text-slate-400 truncate">Solar Resilience</p>
                    <p className="text-base font-black text-emerald-400 font-mono mt-0.5">85%</p>
                    <p className="text-[10px] font-bold text-slate-500">$68k</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[11px] font-medium text-slate-400 truncate">Youth Literacy</p>
                    <p className="text-base font-black text-pink-400 font-mono mt-0.5">78%</p>
                    <p className="text-[10px] font-bold text-slate-500">$35k</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[11px] font-medium text-slate-400 truncate">Health Access</p>
                    <p className="text-base font-black text-amber-400 font-mono mt-0.5">89%</p>
                    <p className="text-[10px] font-bold text-slate-500">$88k</p>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[11px] font-medium text-slate-400 truncate">Food Security</p>
                    <p className="text-base font-black text-cyan-400 font-mono mt-0.5">59%</p>
                    <p className="text-[10px] font-bold text-slate-500">$40k</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2 VIEW: LOGFRAME INDICATOR VELOCITY ── */}
            {activeTab === 'velocity' && (
              <div className="space-y-6 pt-2 animate-fade-up">
                <div className="space-y-5">
                  {INDICATOR_VELOCITY_DATA.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-200">{item.title}</span>
                        <span className="font-mono text-slate-400">
                          <span className="text-white font-black">{item.current}%</span> / {item.target}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.color} shadow-sm transition-all duration-700`}
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
                  {/* Column 1 */}
                  <div className="space-y-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#818cf8] mt-1 shrink-0 shadow-[0_0_8px_#818cf8]" />
                      <div>
                        <p className="font-bold text-white">Clean Water</p>
                        <p className="font-mono font-black text-indigo-300 text-sm">27%</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f472b6] mt-1 shrink-0 shadow-[0_0_8px_#f472b6]" />
                      <div>
                        <p className="font-bold text-white">Youth Literacy</p>
                        <p className="font-mono font-black text-pink-300 text-sm">10%</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8] mt-1 shrink-0 shadow-[0_0_8px_#38bdf8]" />
                      <div>
                        <p className="font-bold text-white">Food Security</p>
                        <p className="font-mono font-black text-cyan-300 text-sm">15%</p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#34d399] mt-1 shrink-0 shadow-[0_0_8px_#34d399]" />
                      <div>
                        <p className="font-bold text-white">Solar Resilience</p>
                        <p className="font-mono font-black text-emerald-300 text-sm">18%</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24] mt-1 shrink-0 shadow-[0_0_8px_#fbbf24]" />
                      <div>
                        <p className="font-bold text-white">Health Access</p>
                        <p className="font-mono font-black text-amber-300 text-sm">20%</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#94a3b8] mt-1 shrink-0 shadow-[0_0_8px_#94a3b8]" />
                      <div>
                        <p className="font-bold text-white">Admin & Overhead</p>
                        <p className="font-mono font-black text-slate-300 text-sm">10%</p>
                      </div>
                    </div>
                  </div>
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
                    strokeDasharray="89.4, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-black text-white font-mono leading-none">89.4%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">executed</span>
                </div>
              </div>

              {/* Program Mini-Bars List */}
              <div className="flex-1 space-y-2 text-[11px] font-bold">
                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Clean</span>
                    <span className="text-indigo-400 font-mono">79%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: '79%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Solar</span>
                    <span className="text-emerald-400 font-mono">85%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: '85%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Youth</span>
                    <span className="text-pink-400 font-mono">78%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-pink-400" style={{ width: '78%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Health</span>
                    <span className="text-amber-400 font-mono">89%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: '89%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300">
                    <span>Food</span>
                    <span className="text-cyan-400 font-mono">59%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: '59%' }} />
                  </div>
                </div>
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
                100% Passed
              </span>
            </div>

            {/* Threshold Overspend Box */}
            <div className="flex items-center justify-between rounded-2xl border border-indigo-500/30 bg-[#0c1830]/70 p-3.5">
              <span className="text-xs font-bold text-slate-200">Threshold Overspend</span>
              <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-mono font-black text-indigo-300 border border-indigo-500/30">
                $0 Unflagged
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
