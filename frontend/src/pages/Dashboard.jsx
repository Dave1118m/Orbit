import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { AutoText } from '../contexts/TranslationContext';
import OwnerDashboard from '../components/dashboard/OwnerDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import CoordinatorDashboard from '../components/dashboard/CoordinatorDashboard';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import FinanceOfficerDashboard from '../components/dashboard/FinanceOfficerDashboard';
import MemberDashboard from '../components/dashboard/MemberDashboard';
import ViewerDashboard from '../components/dashboard/ViewerDashboard';
import ProjectStatusChart from '../components/dashboard/ProjectStatusChart';
import TaskStatusChart from '../components/dashboard/TaskStatusChart';
import ActiveProjectsList from '../components/dashboard/ActiveProjectsList';
import ActivityFeed from '../components/dashboard/ActivityFeed';

const API = import.meta.env.VITE_API_URL;

function authHeaders() {
  const token = localStorage.getItem('token');
  const storedOrgId = localStorage.getItem('selectedOrganizationId');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null') {
    headers['X-Organization-Id'] = storedOrgId;
  }
  return headers;
}

export default function Dashboard() {
  const { user, loading: userLoading, getPrimaryRole } = useUser();
  const [stats, setStats] = useState({
    projectsCount: null,
    tasksCount: null,
    teamsCount: null,
    projects: [],
    tasks: [],
  });
  const [loading, setLoading] = useState(true);

  const storedOrgId = localStorage.getItem('selectedOrganizationId');
  const activeOrgId = (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null')
    ? storedOrgId
    : (user?.organizationId || user?.primaryOrganizationId);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const headers = authHeaders();
        if (activeOrgId && !headers['X-Organization-Id']) {
          headers['X-Organization-Id'] = activeOrgId;
        }

        const [projectsRes, tasksRes, teamsRes, workspacesRes, expensesRes] = await Promise.allSettled([
          fetch(`${API}/projects`, { headers }),
          fetch(`${API}/tasks`, { headers }),
          fetch(`${API}/teams`, { headers }),
          fetch(`${API}/workspaces`, { headers }),
          fetch(`${API}/expenses`, { headers }),
        ]);

        const parseData = async (result) => {
          if (result.status === 'fulfilled' && result.value.ok) {
            const data = await result.value.json();
            return Array.isArray(data) ? data : [];
          }
          return [];
        };

        const projectsData = await parseData(projectsRes);
        const tasksData = await parseData(tasksRes);
        const teamsData = await parseData(teamsRes);
        const workspacesData = await parseData(workspacesRes);
        const expensesData = await parseData(expensesRes);

        setStats({ 
          projectsCount: projectsData.length, 
          tasksCount: tasksData.length, 
          teamsCount: teamsData.length, 
          workspacesCount: workspacesData.length,
          projects: projectsData,
          tasks: tasksData,
          teams: teamsData,
          workspaces: workspacesData,
          expenses: expensesData,
        });
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [user, activeOrgId]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const primaryRole = getPrimaryRole();

  // Role-based dashboard rendering
  const renderDashboard = () => {
    const props = { 
      stats, 
      tasks: stats.tasks || [], 
      projects: stats.projects || [], 
      teams: stats.teams || [], 
      workspaces: stats.workspaces || [], 
      expenses: stats.expenses || [] 
    };
    switch (primaryRole) {
      case 'Owner':
        return <OwnerDashboard {...props} />;
      case 'Admin':
        return <AdminDashboard {...props} />;
      case 'Coordinator':
        return <CoordinatorDashboard {...props} />;
      case 'Manager':
        return <ManagerDashboard {...props} />;
      case 'FinanceOfficer':
        return <FinanceOfficerDashboard {...props} />;
      case 'Member':
        return <MemberDashboard {...props} />;
      case 'Viewer':
        return <ViewerDashboard {...props} />;
      default:
        return <DefaultDashboard {...props} />;
    }
  };

  return renderDashboard();
}

// Default dashboard for fallback or when no specific role dashboard is needed
function DefaultDashboard({ stats, tasks = [], projects = [] }) {
  const StatCard = ({ title, value, icon, color }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between h-40 transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start">
        <div className={`h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-slate-900">
          {value !== null ? value : 0}
        </p>
        <p className="text-sm font-medium text-slate-500 mt-1"><AutoText text={title} /></p>
      </div>
    </div>
  );

  const taskList = tasks.length > 0 ? tasks : (stats.tasks || []);
  const projectList = projects.length > 0 ? projects : (stats.projects || []);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-3">
        <StatCard 
          title="Total Projects" 
          value={stats.projectsCount} 
          color="text-brand-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        />
        <StatCard 
          title="Total Tasks" 
          value={stats.tasksCount} 
          color="text-emerald-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard 
          title="Teams" 
          value={stats.teamsCount} 
          color="text-indigo-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
      </div>

      {/* Charts Section - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProjectStatusChart projects={projectList} />
        <TaskStatusChart tasks={taskList} />
      </div>

      {/* Active Projects & Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActiveProjectsList projects={projectList} tasks={taskList} />
        <ActivityFeed />
      </div>
    </div>
  );
}
