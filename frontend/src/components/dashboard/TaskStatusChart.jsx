import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const TASK_STATUS_MAP = {
  0: 'To Do',
  1: 'In Progress',
  2: 'In Review',
  3: 'Blocked',
  4: 'Done'
};

const STATUS_COLORS = {
  0: '#e2e8f0', // To Do - slate 200
  1: '#3b82f6', // In Progress - blue 500
  2: '#06b6d4', // In Review - cyan 500
  3: '#ef4444', // Blocked - red 500
  4: '#6366f1', // Done - indigo 500
};

function normalizeStatus(s) {
  if (s === 'Done' || s === 4 || s === '4') return 4;
  if (s === 'InProgress' || s === 1 || s === '1') return 1;
  if (s === 'InReview' || s === 2 || s === '2') return 2;
  if (s === 'Blocked' || s === 3 || s === '3') return 3;
  return 0; // ToDo
}

export default function TaskStatusChart({ tasks = [] }) {
  // Count tasks by status
  const statusCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalTasks = 0;

  tasks.forEach((task) => {
    const raw = task.status ?? task.Status;
    const st = normalizeStatus(raw);
    statusCounts[st]++;
    totalTasks++;
  });

  const doneCount = statusCounts[4];
  const donePercentage = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  // Chart data
  const data = {
    labels: ['Done', 'In Progress', 'In Review', 'Blocked', 'To Do'],
    datasets: [
      {
        data: [
          statusCounts[4],
          statusCounts[1],
          statusCounts[2],
          statusCounts[3],
          statusCounts[0],
        ],
        backgroundColor: [
          STATUS_COLORS[4],
          STATUS_COLORS[1],
          STATUS_COLORS[2],
          STATUS_COLORS[3],
          STATUS_COLORS[0],
        ],
        borderWidth: 0,
        hoverOffset: 4,
        cutout: '75%', // Make it a thin donut
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide default legend, we will build a custom one to match Figma
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = totalTasks > 0 ? Math.round((value / totalTasks) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Task Status</h2>
        <p className="text-sm text-slate-500">All active projects</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Donut Chart Container */}
        <div className="relative w-48 h-48 mb-6">
          <Doughnut data={data} options={options} />
          
          {/* Centered Text inside Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-slate-900">{donePercentage}%</span>
            <span className="text-xs font-medium text-slate-500">Done</span>
          </div>
        </div>

        {/* Custom Legend */}
        <div className="w-full grid grid-cols-1 gap-2 mt-auto">
          {data.labels.map((label, index) => {
            const count = data.datasets[0].data[index];
            const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
            const color = data.datasets[0].backgroundColor[index];
            
            return (
              <div key={label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                  <span className="text-slate-600">{label}</span>
                </div>
                <span className="font-semibold text-slate-900">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
