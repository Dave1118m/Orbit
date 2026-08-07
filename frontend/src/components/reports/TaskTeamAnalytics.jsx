import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE = import.meta.env.VITE_API_URL;

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
  if (orgId && orgId !== 'undefined' && orgId !== 'null') {
    headers['X-Organization-Id'] = String(orgId);
  }
  return headers;
}

export default function TaskTeamAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const storedOrgId = localStorage.getItem('selectedOrganizationId');

  const defaultData = {
    completionRate: 0,
    tasksOverdue: 0,
    onTimeDeliveryRate: 0,
    avgCycleTimeDays: 0,
    taskStatusDistribution: [],
    workloadDistribution: [],
    burndownData: []
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/analytics/tasks`, {
          headers: authHeaders(),
        });
        if (response.ok) {
          const json = await response.json();
          setData(json || defaultData);
        } else {
          setData(defaultData);
        }
      } catch (err) {
        console.warn('Analytics fetch warning:', err);
        setData(defaultData);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [storedOrgId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        Error loading analytics: {error}
      </div>
    );
  }

  if (!data) return null;

  // KPI Cards Configuration
  const kpis = [
    {
      title: 'Completion Rate',
      value: `${data.completionRate}%`,
      subtitle: 'Overall tasks completed',
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      iconBg: 'bg-emerald-50',
    },
    {
      title: 'Tasks Overdue',
      value: data.tasksOverdue,
      subtitle: 'Past planned deadline',
      icon: (
        <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-rose-50',
    },
    {
      title: 'On-Time Delivery',
      value: `${data.onTimeDeliveryRate}%`,
      subtitle: 'Completed before deadline',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-blue-50',
    },
    {
      title: 'Avg. Cycle Time',
      value: `${data.avgCycleTimeDays} Days`,
      subtitle: 'From creation to Done',
      icon: (
        <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      iconBg: 'bg-violet-50',
    },
  ];

  // Chart Data: Burndown
  const burndownData = {
    labels: data.burndownData.map(d => d.label),
    datasets: [
      {
        label: 'Remaining Tasks',
        data: data.burndownData.map(d => d.value),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const burndownOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Chart Data: Status Distribution
  // Map our enum values to friendly strings if needed, or use them as is.
  // Enums in backend: ToDo, InProgress, InReview, Blocked, Done
  const statusColors = {
    ToDo: '#94a3b8',
    InProgress: '#3b82f6',
    InReview: '#a855f7',
    Blocked: '#ef4444',
    Done: '#22c55e'
  };

  const statusLabels = data.taskStatusDistribution.map(d => d.label);
  const statusValues = data.taskStatusDistribution.map(d => d.value);
  const statusBgColors = statusLabels.map(label => statusColors[label] || '#cbd5e1');

  const statusData = {
    labels: statusLabels,
    datasets: [
      {
        data: statusValues,
        backgroundColor: statusBgColors,
        borderWidth: 0,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom' },
    },
  };

  // Chart Data: Workload
  const workloadLabels = data.workloadDistribution.map(d => d.userName);
  const workloadData = {
    labels: workloadLabels,
    datasets: [
      {
        label: 'On Track',
        data: data.workloadDistribution.map(d => d.onTrackCount),
        backgroundColor: '#3b82f6', // blue
      },
      {
        label: 'Overdue',
        data: data.workloadDistribution.map(d => d.overdueCount),
        backgroundColor: '#f43f5e', // rose
      },
    ],
  };

  const workloadOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{kpi.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">{kpi.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Burndown */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Project Burndown</h3>
          <p className="text-sm text-slate-500 mb-6">Remaining tasks across the last 14 days</p>
          <div className="h-64">
            <Line data={burndownData} options={burndownOptions} />
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Task Status</h3>
          <p className="text-sm text-slate-500 mb-6">Distribution across active projects</p>
          <div className="h-64">
            <Doughnut data={statusData} options={statusOptions} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-1">
        {/* Workload */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Team Workload</h3>
          <p className="text-sm text-slate-500 mb-6">Active tasks assigned per member</p>
          <div className="h-72">
            <Bar data={workloadData} options={workloadOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
