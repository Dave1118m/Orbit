import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PROJECT_STATUS = {
  PLANNED: 0, // Draft
  ACTIVE: 1,
  ON_HOLD: 2,
  COMPLETED: 3,
};

const STATUS_COLORS = {
  [PROJECT_STATUS.PLANNED]: '#94a3b8',   // slate 400
  [PROJECT_STATUS.ACTIVE]: '#3b82f6',    // blue 500
  [PROJECT_STATUS.ON_HOLD]: '#f59e0b',   // amber 500
  [PROJECT_STATUS.COMPLETED]: '#6366f1', // indigo 500
};

const STATUS_LABELS = {
  [PROJECT_STATUS.PLANNED]: 'Planned',
  [PROJECT_STATUS.ACTIVE]: 'Active',
  [PROJECT_STATUS.ON_HOLD]: 'On Hold',
  [PROJECT_STATUS.COMPLETED]: 'Completed',
};

function normalizeProjectStatus(s) {
  if (s === 'Active' || s === 1 || s === '1') return 1;
  if (s === 'OnHold' || s === 2 || s === '2') return 2;
  if (s === 'Completed' || s === 3 || s === '3') return 3;
  return 0; // Planned / 0
}

export default function ProjectStatusChart({ projects = [] }) {
  const chartData = useMemo(() => {
    // W8 = current week, W1 = 7 weeks ago.
    const now = new Date();
    const weeks = 8;
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    
    // Initialize data arrays for each status
    const dataByStatus = {
      [PROJECT_STATUS.PLANNED]: Array(weeks).fill(0),
      [PROJECT_STATUS.ACTIVE]: Array(weeks).fill(0),
      [PROJECT_STATUS.ON_HOLD]: Array(weeks).fill(0),
      [PROJECT_STATUS.COMPLETED]: Array(weeks).fill(0),
    };

    projects.forEach(project => {
      // Use startDate or fallback to current date if missing so it shows up
      const rawDate = project.startDate || project.StartDate;
      const date = rawDate ? new Date(rawDate) : new Date();
      
      // Calculate how many weeks ago this project started
      const diffMs = now - date;
      const weeksAgo = Math.floor(diffMs / msInWeek);
      
      // If the project started within the last 8 weeks
      if (weeksAgo >= 0 && weeksAgo < weeks) {
        const arrayIndex = (weeks - 1) - weeksAgo; 
        const st = normalizeProjectStatus(project.status ?? project.Status);
        if (st in dataByStatus) {
          dataByStatus[st][arrayIndex]++;
        }
      }
    });

    // Make the data cumulative so the lines trend upwards
    for (const status in dataByStatus) {
      let runningTotal = 0;
      for (let i = 0; i < weeks; i++) {
        runningTotal += dataByStatus[status][i];
        dataByStatus[status][i] = runningTotal;
      }
    }

    const labels = Array.from({ length: weeks }, (_, i) => `W${i + 1}`);

    return {
      labels,
      datasets: [
        {
          label: STATUS_LABELS[PROJECT_STATUS.COMPLETED],
          data: dataByStatus[PROJECT_STATUS.COMPLETED],
          borderColor: STATUS_COLORS[PROJECT_STATUS.COMPLETED],
          backgroundColor: STATUS_COLORS[PROJECT_STATUS.COMPLETED] + '20', // transparent
          tension: 0.4, // smooth curves
          fill: true,
        },
        {
          label: STATUS_LABELS[PROJECT_STATUS.ACTIVE],
          data: dataByStatus[PROJECT_STATUS.ACTIVE],
          borderColor: STATUS_COLORS[PROJECT_STATUS.ACTIVE],
          backgroundColor: 'transparent',
          tension: 0.4,
          borderDash: [5, 5],
        },
        {
          label: STATUS_LABELS[PROJECT_STATUS.PLANNED],
          data: dataByStatus[PROJECT_STATUS.PLANNED],
          borderColor: STATUS_COLORS[PROJECT_STATUS.PLANNED],
          backgroundColor: 'transparent',
          tension: 0.4,
        },
        {
          label: STATUS_LABELS[PROJECT_STATUS.ON_HOLD],
          data: dataByStatus[PROJECT_STATUS.ON_HOLD],
          borderColor: STATUS_COLORS[PROJECT_STATUS.ON_HOLD],
          backgroundColor: 'transparent',
          tension: 0.4,
        },
      ],
    };
  }, [projects]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9', // slate 100
          drawBorder: false,
        },
        ticks: {
          stepSize: 8, // Just a suggestion, Chart.js will adapt
        },
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Project Status Trend</h2>
          <p className="text-sm text-slate-500">Cumulative projects over last 8 weeks</p>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-[250px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
