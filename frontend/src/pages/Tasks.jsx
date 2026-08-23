import { useEffect, useState, useCallback } from 'react';
import Modal from '../components/Modal';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailsDrawer from '../components/TaskDetailsDrawer';
import SearchSelect from '../components/SearchSelect';
import { parseApiResponse } from '../utils/toastHelper';

const API_URL = `${import.meta.env.VITE_API_URL}/tasks`;
const PROJECTS_URL = `${import.meta.env.VITE_API_URL}/projects`;
const WORKSPACES_URL = `${import.meta.env.VITE_API_URL}/workspaces`;

/**
 * Status style mapping configurations for task badges and Kanban lanes.
 */
const STATUS_CONFIG = {
  "ToDo":       { label: 'To Do',       color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'   },
  "InProgress": { label: 'In Progress', color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500'    },
  "InReview":   { label: 'In Review',   color: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500'  },
  "Blocked":    { label: 'Blocked',     color: 'bg-red-50 text-red-700',         dot: 'bg-red-500'     },
  "Done":       { label: 'Done',        color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
};

/**
 * Priority style mapping configurations for tasks.
 */
const PRIORITY_CONFIG = {
  "Low":    { label: 'Low',    color: 'bg-slate-100 text-slate-600'   },
  "Medium": { label: 'Medium', color: 'bg-blue-100 text-blue-700'     },
  "High":   { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  "Urgent": { label: 'Urgent', color: 'bg-red-100 text-red-700'       },
};

/**
 * Stat summary card for task counts.
 * @param {{ label: string, value: string|number, color: string }} props
 */
function StatCard({ label, value, color }) {
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

/**
 * Task Management page component supporting Drag-and-Drop Kanban boards, list views, subtasks,
 * team assignment, attachments, comments, and priority filtering.
 */
export default function Tasks() {
  const [tasks, setTasks]           = useState([]);
  const [projects, setProjects]     = useState([]);
  const [workspaces, setWorkspaces] = useState([]);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode]         = useState('kanban');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');

  const [formData, setFormData] = useState({
    title: '', description: '', status: 'ToDo', priority: 'Medium', startDate: '', deadline: '', projectId: '', categoryId: ''
  });
  const [createError, setCreateError] = useState('');

  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState({
    title: '', description: '', status: 'ToDo', priority: 'Medium', startDate: '', deadline: ''
  });
  const [editError, setEditError] = useState('');

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    const storedOrgId = localStorage.getItem('selectedOrganizationId');
    const headers = { Authorization: `Bearer ${token}` };
    if (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null') {
      headers['X-Organization-Id'] = storedOrgId;
    }
    return headers;
  }, []);

  // ── Fetchers ──
  const fetchWorkspaces = useCallback(async () => {
    try {
      const orgId = localStorage.getItem('selectedOrganizationId');
      const query = orgId ? `?orgId=${orgId}` : '';
      const res = await fetch(`${WORKSPACES_URL}${query}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (err) { console.error(err); }
  }, [authHeaders]);

  const fetchProjects = useCallback(async (workspaceId = null) => {
    try {
      const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const res = await fetch(`${PROJECTS_URL}${query}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) { console.error(err); }
  }, [authHeaders]);

  const fetchTasks = useCallback(async (projectId = null) => {
    try {
      const query = projectId ? `?projectId=${projectId}` : '';
      const res = await fetch(`${API_URL}${query}`, { headers: authHeaders() });
      if (res.ok) setTasks(await res.json());
    } catch (err) { console.error(err); }
  }, [authHeaders]);

  const [dynamicCategories, setDynamicCategories] = useState([]);
  const fetchDynamicCategories = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/FinancialCategories/flat`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDynamicCategories(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, [authHeaders]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchProjects(selectedWorkspaceId); }, [selectedWorkspaceId, fetchProjects]);
  useEffect(() => { fetchTasks(selectedProjectId); }, [selectedProjectId, fetchTasks]);
  useEffect(() => { fetchDynamicCategories(); }, [fetchDynamicCategories]);

  // ── Storage listener ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'selectedOrganizationId') {
        fetchWorkspaces();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── Keyboard shortcut (N = new task) ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); setIsModalOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Handlers ──
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    const projectId = formData.projectId ? parseInt(formData.projectId, 10) : selectedProjectId;
    if (!projectId) { setCreateError('Please select a project for this task.'); return; }
    
    const today = new Date().toISOString().split('T')[0];
    const project = projects.find(p => p.id === projectId);

    if (formData.startDate && formData.deadline && formData.deadline < formData.startDate) {
      setCreateError('Task End Date (Deadline) cannot be earlier than Task Start Date.');
      return;
    }

    if (project?.startDate && formData.startDate && formData.startDate < project.startDate.split('T')[0]) {
      setCreateError(`Task Start Date cannot be earlier than Project Start Date (${project.startDate.split('T')[0]}).`);
      return;
    }

    if (project?.endDate && formData.deadline && formData.deadline > project.endDate.split('T')[0]) {
      setCreateError(`Task Deadline cannot exceed Project End Date (${project.endDate.split('T')[0]}).`);
      return;
    }

    const isStatusInProgress = String(formData.status).toLowerCase() === 'inprogress' || String(formData.status).toLowerCase() === 'inreview';
    const isStatusDone = String(formData.status).toLowerCase() === 'done';

    if (isStatusInProgress && formData.startDate && formData.startDate > today) {
      setCreateError("An In Progress task cannot have a Start Date in the future. Please set status to 'To Do' or select today as the Start Date.");
      return;
    }

    if (isStatusDone && formData.deadline && formData.deadline > today) {
      setCreateError("A Completed (Done) task cannot have a Deadline in the future.");
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          projectId,
          title: formData.title,
          description: formData.description || null,
          status: formData.status,
          priority: formData.priority,
          startDate: formData.startDate || null,
          deadline: formData.deadline || null,
          categoryId: formData.categoryId ? parseInt(formData.categoryId, 10) : null
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setCreateError('');
        setFormData({ title: '', description: '', status: 'ToDo', priority: 'Medium', startDate: '', deadline: '', projectId: '', categoryId: '' });
        fetchTasks(selectedProjectId);
      } else {
        let errMsg = 'Failed to create task.';
        try { const j = await res.json(); errMsg = j.title || j.message || JSON.stringify(j); } catch { errMsg = await parseApiResponse(res); }
        setCreateError(errMsg);
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) fetchTasks(selectedProjectId);
    } catch (err) { console.error(err); }
  };

  const handleTaskMove = async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`${API_URL}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) fetchTasks(selectedProjectId);
    } catch (err) { console.error(err); fetchTasks(selectedProjectId); }
  };

  const handleOpenTaskEdit = (task, e) => {
    if (e) e.stopPropagation();
    const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
    setEditTaskData({
      title: task.title || '',
      description: task.description || '',
      status: task.status ?? 'ToDo',
      priority: task.priority ?? 'Medium',
      startDate: toDateStr(task.startDate),
      deadline: toDateStr(task.deadline),
      categoryId: task.categoryId ? String(task.categoryId) : '',
    });
    setSelectedTask(task);
    setIsEditTaskOpen(true);
  };

  const handleEditTaskChange = (e) => setEditTaskData({ ...editTaskData, [e.target.name]: e.target.value });

  const handleEditTaskSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (!selectedTask) return;

    const today = new Date().toISOString().split('T')[0];
    const project = projects.find(p => p.id === selectedTask.projectId);

    if (editTaskData.startDate && editTaskData.deadline && editTaskData.deadline < editTaskData.startDate) {
      setEditError('Task End Date (Deadline) cannot be earlier than Task Start Date.');
      return;
    }

    if (project?.startDate && editTaskData.startDate && editTaskData.startDate < project.startDate.split('T')[0]) {
      setEditError(`Task Start Date cannot be earlier than Project Start Date (${project.startDate.split('T')[0]}).`);
      return;
    }

    if (project?.endDate && editTaskData.deadline && editTaskData.deadline > project.endDate.split('T')[0]) {
      setEditError(`Task Deadline cannot exceed Project End Date (${project.endDate.split('T')[0]}).`);
      return;
    }

    const isStatusInProgress = String(editTaskData.status).toLowerCase() === 'inprogress' || String(editTaskData.status).toLowerCase() === 'inreview';
    const isStatusDone = String(editTaskData.status).toLowerCase() === 'done';

    if (isStatusInProgress && editTaskData.startDate && editTaskData.startDate > today) {
      setEditError("An In Progress task cannot have a Start Date in the future. Please set status to 'To Do' or select today as the Start Date.");
      return;
    }

    if (isStatusDone && editTaskData.deadline && editTaskData.deadline > today) {
      setEditError("A Completed (Done) task cannot have a Deadline in the future.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: editTaskData.title,
          description: editTaskData.description || null,
          status: editTaskData.status,
          priority: editTaskData.priority,
          startDate: editTaskData.startDate || null,
          deadline: editTaskData.deadline || null,
          categoryId: editTaskData.categoryId ? parseInt(editTaskData.categoryId, 10) : null
        }),
      });
      if (res.ok) {
        setIsEditTaskOpen(false);
        setEditError('');
        fetchTasks(selectedProjectId);
      } else {
        let errMsg = 'Failed to update task.';
        try { const j = await res.json(); errMsg = j.title || j.message || JSON.stringify(j); } catch { errMsg = await parseApiResponse(res); }
        setEditError(errMsg);
      }
    } catch (err) { console.error(err); }
  };

  // ── Derived data ──
  const filteredTasks = tasks.filter(t => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch = !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Project date bounds for form hints
  const selectedProject = projects.find(p => p.id === (selectedProjectId || parseInt(formData.projectId, 10)));
  const projectStartDate = selectedProject?.startDate ? new Date(selectedProject.startDate).toISOString().split('T')[0] : undefined;
  const projectEndDate   = selectedProject?.endDate   ? new Date(selectedProject.endDate).toISOString().split('T')[0]   : undefined;

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'InProgress').length,
    blocked: tasks.filter(t => t.status === 'Blocked').length,
    done: tasks.filter(t => t.status === 'Done').length,
  };

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 6rem)' }}>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}{selectedProjectId ? ` in this project` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Workspace selector */}
          <select
            value={selectedWorkspaceId ?? ''}
            onChange={e => {
              const val = e.target.value;
              setSelectedWorkspaceId(val === '' ? null : parseInt(val, 10));
              setSelectedProjectId(null);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none cursor-pointer font-medium"
          >
            <option value="">All Workspaces</option>
            {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
          </select>
          {/* Project selector */}
          <select
            value={selectedProjectId ?? ''}
            onChange={e => {
              const val = e.target.value;
              setSelectedProjectId(val === '' ? null : parseInt(val, 10));
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none cursor-pointer font-medium"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {/* View toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1">
            <button onClick={() => setViewMode('kanban')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>
              Kanban
            </button>
            <button onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>
              List
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
            <span className="hidden sm:inline opacity-50 text-xs border border-white/20 rounded px-1 ml-1">N</span>
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 flex-shrink-0">
        <StatCard label="Total Tasks"  value={stats.total}      color="text-slate-800" />
        <StatCard label="In Progress"  value={stats.inProgress} color="text-blue-600" />
        <StatCard label="Blocked"      value={stats.blocked}    color="text-red-600" />
        <StatCard label="Done"         value={stats.done}       color="text-emerald-600" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit flex-wrap">
          <button onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${statusFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            All
          </button>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${statusFilter === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {v.label}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-48" />
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* No project selected state */}
        {!selectedProjectId && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Select a project</h3>
            <p className="text-sm text-slate-400">Choose a workspace and project above to view tasks</p>
          </div>
        )}

        {selectedProjectId && viewMode === 'kanban' && (
          <div className="flex-1 min-h-0">
            <KanbanBoard
              tasks={filteredTasks}
              onTaskMove={handleTaskMove}
              onTaskClick={(task) => setSelectedTask(prev => prev?.id === task.id ? null : task)}
              selectedTaskId={selectedTask?.id}
              statusFilter={statusFilter}
            />
          </div>
        )}

        {selectedProjectId && viewMode === 'list' && (
          <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">✅</div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">No tasks found</h3>
                <p className="text-sm text-slate-400">
                  {searchQuery ? `No results for "${searchQuery}"` : 'Create a task to get started'}
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map(task => {
                    const st = STATUS_CONFIG[task.status] ?? STATUS_CONFIG["ToDo"];
                    const pr = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG["Medium"];
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Done';
                    return (
                      <tr key={task.id}
                        onClick={() => setSelectedTask(prev => prev?.id === task.id ? null : task)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            {task.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[300px]">{task.description}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pr.color}`}>
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {task.deadline ? (
                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                              {isOverdue && '⚠ '}
                              {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : <span className="text-slate-400">–</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => handleOpenTaskEdit(task, e)}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Task Detail Side Drawer ── */}
      {selectedTask && (
        <TaskDetailsDrawer 
          task={selectedTask} 
          onClose={() => { setSelectedTask(null); fetchTasks(selectedProjectId); }}
          onEdit={(t) => {
            setSelectedTask(null);
            handleOpenTaskEdit(t);
          }}
          onTaskUpdated={() => fetchTasks(selectedProjectId)}
        />
      )}

      {/* ── Create Task Modal ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Task">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project *</label>
            <SearchSelect
              options={projects.map(p => ({ value: p.id, label: p.title }))}
              value={formData.projectId || selectedProjectId}
              onChange={val => handleChange({ target: { name: 'projectId', value: val } })}
              isClearable={false}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Financial Category</label>
            <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 bg-white">
              <option value="">No Financial Category</option>
              {dynamicCategories.map(c => (
                <option key={c.id} value={c.id}>{c.fullName || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input required name="title" value={formData.title} onChange={handleChange}
              className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange}
              rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                <option value="ToDo">To Do</option>
                <option value="InProgress">In Progress</option>
                <option value="InReview">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          {/* Inline error banner */}
          {createError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <span>{createError}</span>
            </div>
          )}

          {/* Project boundary hint */}
          {(projectStartDate || projectEndDate) && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-xs text-blue-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Project window: <strong>{projectStartDate || '—'}</strong> → <strong>{projectEndDate || '—'}</strong></span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange}
                min={projectStartDate} max={formData.deadline || projectEndDate}
                className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date (Deadline)</label>
              <input type="date" name="deadline" value={formData.deadline} onChange={handleChange}
                min={formData.startDate || projectStartDate} max={projectEndDate}
                className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsModalOpen(false)}
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit"
              className="rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition shadow-sm">Create</button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Task Modal ── */}
      <Modal isOpen={isEditTaskOpen} onClose={() => setIsEditTaskOpen(false)} title="Edit Task">
        <form onSubmit={handleEditTaskSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input required name="title" value={editTaskData.title} onChange={handleEditTaskChange}
              className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Financial Category</label>
            <select name="categoryId" value={editTaskData.categoryId || ''} onChange={handleEditTaskChange} className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 bg-white">
              <option value="">No Financial Category</option>
              {dynamicCategories.map(c => (
                <option key={c.id} value={c.id}>{c.fullName || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" value={editTaskData.description} onChange={handleEditTaskChange}
              rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select name="status" value={editTaskData.status} onChange={handleEditTaskChange} className={inputClass}>
                <option value="ToDo">To Do</option>
                <option value="InProgress">In Progress</option>
                <option value="InReview">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={editTaskData.priority} onChange={handleEditTaskChange} className={inputClass}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          {/* Inline error banner */}
          {editError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <span>{editError}</span>
            </div>
          )}

          {/* Project boundary hint */}
          {(projectStartDate || projectEndDate) && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-xs text-blue-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Project window: <strong>{projectStartDate || '—'}</strong> → <strong>{projectEndDate || '—'}</strong></span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={editTaskData.startDate} onChange={handleEditTaskChange}
                min={projectStartDate} max={editTaskData.deadline || projectEndDate}
                className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date (Deadline)</label>
              <input type="date" name="deadline" value={editTaskData.deadline} onChange={handleEditTaskChange}
                min={editTaskData.startDate || projectStartDate} max={projectEndDate}
                className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsEditTaskOpen(false)}
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit"
              className="rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition shadow-sm">Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
