import React, { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = import.meta.env.VITE_API_URL;

export default function CommonAnalyticsHub() {
  const [analytics, setAnalytics] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [analyticsRes, projectsRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/tasks`, { headers }),
          fetch(`${API_BASE}/projects`, { headers })
        ]);

        if (analyticsRes.ok) {
          setAnalytics(await analyticsRes.json());
        }
        if (projectsRes.ok) {
          setProjects(await projectsRes.json());
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const burndownChartData = useMemo(() => {
    if (!analytics?.burndownData) return null;
    
    return {
      labels: analytics.burndownData.map(d => d.label),
      datasets: [
        {
          label: 'Remaining Tasks',
          data: analytics.burndownData.map(d => d.value),
          borderColor: '#3b82f6', // brand-500 blue
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    };
  }, [analytics]);

  const burndownOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 13 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9', drawBorder: false },
        ticks: { color: '#64748b' }
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: '#64748b', maxRotation: 45, minRotation: 45 }
      },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  const workloadChartData = useMemo(() => {
    if (!analytics?.workloadDistribution || analytics.workloadDistribution.length === 0) return null;
    
    // Sort to get top 5 busiest members
    const topMembers = [...analytics.workloadDistribution]
      .sort((a, b) => (b.onTrackCount + b.overdueCount) - (a.onTrackCount + a.overdueCount))
      .slice(0, 5);

    return {
      labels: topMembers.map(m => m.userName),
      datasets: [
        {
          data: topMembers.map(m => m.onTrackCount + m.overdueCount),
          backgroundColor: [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'
          ],
          borderWidth: 0,
          hoverOffset: 4,
        }
      ]
    };
  }, [analytics]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'right',
        labels: { usePointStyle: true, boxWidth: 8, color: '#475569', padding: 20 },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-500"></div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="flex flex-col gap-6 w-full mb-8">
      
      {/* ── Top Row: KPIs ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-blue-50 transition-transform group-hover:scale-150"></div>
          <div className="relative">
            <p className="text-sm font-medium text-slate-500 mb-1">Completion Rate</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-bold text-slate-900">{analytics.completionRate}%</h3>
            </div>
            <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${analytics.completionRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-emerald-50 transition-transform group-hover:scale-150"></div>
          <div className="relative">
            <p className="text-sm font-medium text-slate-500 mb-1">On-Time Delivery</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-bold text-slate-900">{analytics.onTimeDeliveryRate}%</h3>
              <span className={`flex items-center text-sm font-semibold mb-1 ${analytics.onTimeDeliveryRate > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {analytics.onTimeDeliveryRate > 80 ? '↗ Good' : '↘ Needs work'}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${analytics.onTimeDeliveryRate > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${analytics.onTimeDeliveryRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-purple-50 transition-transform group-hover:scale-150"></div>
          <div className="relative">
            <p className="text-sm font-medium text-slate-500 mb-1">Avg Cycle Time</p>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl font-bold text-slate-900">{analytics.avgCycleTimeDays}</h3>
              <span className="text-slate-500 font-medium mb-1">days</span>
            </div>
            <p className="text-xs text-slate-400 mt-4">Time from start to completion</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-rose-50 transition-transform group-hover:scale-150"></div>
          <div className="relative">
            <p className="text-sm font-medium text-slate-500 mb-1">Tasks Overdue</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-bold text-slate-900">{analytics.tasksOverdue}</h3>
              {analytics.tasksOverdue > 0 && (
                <span className="flex items-center text-sm font-semibold text-rose-500 mb-1">⚠️ Action Required</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-4">Active tasks past deadline</p>
          </div>
        </div>
      </div>

      {/* ── Middle Row: Visualizations ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Burndown Chart (2/3) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col min-h-[350px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Task Velocity (Burndown)</h2>
              <p className="text-sm text-slate-500">Remaining tasks over the last 14 days</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-100">
              14-Day View
            </div>
          </div>
          <div className="flex-1 w-full relative">
            {burndownChartData ? (
              <Line data={burndownChartData} options={burndownOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Not enough data to render burndown chart.</div>
            )}
          </div>
        </div>

        {/* Workload Doughnut (1/3) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col min-h-[350px]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Top Workloads</h2>
            <p className="text-sm text-slate-500">Busiest team members</p>
          </div>
          <div className="flex-1 w-full relative flex items-center justify-center">
            {workloadChartData ? (
              <div className="w-full h-full pb-4">
                <Doughnut data={workloadChartData} options={doughnutOptions} />
              </div>
            ) : (
              <div className="text-sm text-slate-400">No workload data available.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Active Projects ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex justify-between items-center">
          <h2 className="font-bold text-slate-900">Active Projects Tracker</h2>
          <span className="text-xs font-semibold bg-brand-100 text-brand-700 px-3 py-1 rounded-full">{projects.length} Projects</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Project Name</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Timeline</th>
                <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.slice(0, 5).map(project => (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[250px]">{project.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      project.status === 1 ? 'bg-blue-100 text-blue-700' :
                      project.status === 3 ? 'bg-emerald-100 text-emerald-700' :
                      project.status === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {project.status === 1 ? 'Active' : project.status === 3 ? 'Completed' : project.status === 2 ? 'On Hold' : 'Planned'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-700">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</p>
                    <p className="text-xs text-slate-400">to {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {project.budget ? `$${project.budget.toLocaleString()}` : '-'}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No active projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
