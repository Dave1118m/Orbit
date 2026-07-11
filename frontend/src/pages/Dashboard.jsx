import { useEffect, useState } from 'react';

const API = 'https://localhost:7065/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    projects: null,
    tasks: null,
    teams: null,
    organizations: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const headers = authHeaders();
        const [projectsRes, tasksRes, teamsRes, orgsRes] = await Promise.allSettled([
          fetch(`${API}/projects`, { headers }),
          fetch(`${API}/tasks`, { headers }),
          fetch(`${API}/teams`, { headers }),
          fetch(`${API}/organizations`, { headers }),
        ]);

        const parseCount = async (result) => {
          if (result.status === 'fulfilled' && result.value.ok) {
            const data = await result.value.json();
            return Array.isArray(data) ? data.length : null;
          }
          return 0;
        };

        const [projects, tasks, teams, organizations] = await Promise.all([
          parseCount(projectsRes),
          parseCount(tasksRes),
          parseCount(teamsRes),
          parseCount(orgsRes),
        ]);

        setStats({ projects, tasks, teams, organizations });
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const StatCard = ({ title, value, icon, color }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between h-40 transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start">
        <div className={`h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <svg className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19l16-16m0 0H9m11 0v11"/></svg>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-slate-900">
          {loading ? <span className="inline-block h-8 w-12 animate-pulse bg-slate-200 rounded" /> : (value !== null ? value : 0)}
        </p>
        <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      
      {/* 4 Cards Grid - All real API data */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Projects" 
          value={stats.projects} 
          color="text-brand-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        />
        <StatCard 
          title="Total Tasks" 
          value={stats.tasks} 
          color="text-emerald-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard 
          title="Teams" 
          value={stats.teams} 
          color="text-indigo-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard 
          title="Organizations" 
          value={stats.organizations} 
          color="text-amber-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        />
      </div>

      {/* Recent Activity Placeholder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[300px]">
         <div className="flex justify-between items-center mb-6">
           <div>
             <h2 className="text-lg font-bold text-slate-900">Activity Overview</h2>
             <p className="text-sm text-slate-500">Your latest project and task activity</p>
           </div>
         </div>
         <div className="w-full h-[220px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
           <div className="text-center">
             <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
             <p className="text-slate-400 font-medium">Charts will populate as data grows</p>
           </div>
         </div>
      </div>
    </div>
  );
}
