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
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { BarChart3, TrendingUp, PieChart, Layers, DollarSign, Calendar, Sparkles, Filter } from 'lucide-react';

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
  const [activeReportTab, setActiveReportTab] = useState('budget');
  const [chartKey, setChartKey] = useState(0);

  // Trigger chart re-animation on tab change
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [activeReportTab]);

  // 1. Budget vs. Actual Bar Chart Data
  const budgetChartData = {
    labels: ['Clean Water', 'Solar Resilience', 'Youth Literacy', 'Health Access', 'Food Security'],
    datasets: [
      {
        label: 'Allocated Budget ($)',
        data: [120000, 85000, 45000, 95000, 60000],
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
        borderRadius: 8
      },
      {
        label: 'Actual Expended ($)',
        data: [98000, 72000, 38500, 89000, 42000],
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  };

  // 2. MEL Logframe Progress Line Chart Data
  const melChartData = {
    labels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
    datasets: [
      {
        label: 'Target Indicator Progress (%)',
        data: [20, 38, 55, 72, 85, 94],
        fill: true,
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        borderColor: 'rgb(6, 182, 212)',
        pointBackgroundColor: 'rgb(6, 182, 212)',
        pointBorderColor: '#fff',
        pointHoverRadius: 7,
        tension: 0.4
      },
      {
        label: 'Baseline Expected (%)',
        data: [15, 30, 45, 60, 75, 90],
        borderColor: 'rgba(148, 163, 184, 0.5)',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.4
      }
    ]
  };

  // 3. Category Doughnut Chart Data
  const categoryChartData = {
    labels: ['Personnel', 'Equipment', 'Operations', 'Training', 'Supplies', 'Travel'],
    datasets: [
      {
        data: [35, 25, 15, 12, 8, 5],
        backgroundColor: [
          'rgb(99, 102, 241)',
          'rgb(6, 182, 212)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(236, 72, 153)',
          'rgb(139, 92, 246)'
        ],
        borderWidth: 2,
        borderColor: '#0f172a'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1200,
      easing: 'easeOutQuart'
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 p-6 md:p-8 text-white shadow-2xl backdrop-blur-xl">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl"></div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse"></span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">Interactive Reports & Animated Analytics</h3>
            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/30">
              Live Chart.js Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Visualize financial allocations, Logframe MEL target trajectories, and expense breakdowns with smooth animations.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-950 p-1.5 border border-slate-800">
          <button
            onClick={() => setActiveReportTab('budget')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeReportTab === 'budget' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Budget vs. Actual</span>
          </button>

          <button
            onClick={() => setActiveReportTab('mel')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeReportTab === 'mel' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Logframe Indicator Velocity</span>
          </button>

          <button
            onClick={() => setActiveReportTab('categories')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeReportTab === 'categories' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieChart className="h-3.5 w-3.5" />
            <span>Category Distribution</span>
          </button>
        </div>
      </div>

      {/* Main Chart Card View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-center">
        {/* Chart Canvas Display */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-950 p-5 h-80 relative shadow-inner">
          {activeReportTab === 'budget' && (
            <Bar key={chartKey} data={budgetChartData} options={chartOptions} />
          )}

          {activeReportTab === 'mel' && (
            <Line key={chartKey} data={melChartData} options={chartOptions} />
          )}

          {activeReportTab === 'categories' && (
            <div className="flex h-full items-center justify-center">
              <Doughnut
                key={chartKey}
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 12 } }
                    }
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Dynamic Metric Widgets Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Total Program Execution</span>
              <span className="font-mono font-bold text-cyan-400">89.4%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 animate-pulse" style={{ width: '89.4%' }}></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs font-bold text-slate-300">Financial Audit Status</p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Receipt Compliance</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-500/30">
                100% Passed
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Threshold Overspend</span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-bold text-indigo-300 border border-indigo-500/30">
                $0 Unflagged
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-900/60 bg-gradient-to-br from-indigo-950/80 to-slate-950 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 mb-1">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>1-Click Donor Export Ready</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Instantly export PDF/Excel reports formatted for USAID, EU, and institutional donors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
