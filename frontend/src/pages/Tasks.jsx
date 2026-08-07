import { useEffect, useState, useCallback } from 'react';
import Modal from '../components/Modal';
import KanbanBoard from '../components/KanbanBoard';
import TaskBottomPanel from '../components/TaskBottomPanel';
import SearchSelect from '../components/SearchSelect';

const API_URL = `${import.meta.env.VITE_API_URL}/tasks`;
const PROJECTS_URL = `${import.meta.env.VITE_API_URL}/projects`;
const WORKSPACES_URL = `${import.meta.env.VITE_API_URL}/workspaces`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  0: { label: 'To Do',       color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'   },
  1: { label: 'In Progress', color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500'    },
  2: { label: 'In Review',   color: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500'  },
  3: { label: 'Blocked',     color: 'bg-red-50 text-red-700',         dot: 'bg-red-500'     },
  4: { label: 'Done',        color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
};

const PRIORITY_CONFIG = {
  0: { label: 'Low',    color: 'bg-slate-100 text-slate-600'   },
  1: { label: 'Medium', color: 'bg-blue-100 text-blue-700'     },
  2: { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  3: { label: 'Urgent', color: 'bg-red-100 text-red-700'       },
};

function StatCard({ label, value, color }) {
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

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
    title: '', description: '', status: 0, priority: 1, startDate: '', deadline: '', projectId: ''
  });

  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState({
    title: '', description: '', status: 0, priority: 1, startDate: '', deadline: ''
  });

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

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchProjects(selectedWorkspaceId); }, [selectedWorkspaceId, fetchProjects]);
  useEffect(() => { fetchTasks(selectedProjectId); }, [selectedProjectId, fetchTasks]);

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
    const projectId = formData.projectId ? parseInt(formData.projectId, 10) : selectedProjectId;
    if (!projectId) { alert('Please select a project for this task.'); return; }
    if (formData.startDate && formData.deadline && new Date(formData.deadline) < new Date(formData.startDate)) {
      alert('Task End Date (Deadline) cannot be earlier than Task Start Date.');
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
          status: parseInt(formData.status, 10),
          priority: parseInt(formData.priority, 10),
          startDate: formData.startDate || null,
          deadline: formData.deadline || null,
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', description: '', status: 0, priority: 1, startDate: '', deadline: '', projectId: '' });
        fetchTasks(selectedProjectId);
      } else {
        const errorText = await res.text();
        alert(`Failed to create task: ${errorText}`);
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
      status: task.status ?? 0,
      priority: task.priority ?? 1,
      startDate: toDateStr(task.startDate),
      deadline: toDateStr(task.deadline),
    });
    setSelectedTask(task);
    setIsEditTaskOpen(true);
  };

  const handleEditTaskChange = (e) => setEditTaskData({ ...editTaskData, [e.target.name]: e.target.value });

  const handleEditTaskSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (editTaskData.startDate && editTaskData.deadline && new Date(editTaskData.deadline) < new Date(editTaskData.startDate)) {
      alert('Deadline cannot be earlier than Start Date.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: editTaskData.title,
          description: editTaskData.description || null,
          status: parseInt(editTaskData.status, 10),
          priority: parseInt(editTaskData.priority, 10),
          startDate: editTaskData.startDate || null,
          deadline: editTaskData.deadline || null,
        }),
      });
      if (res.ok) {
        setIsEditTaskOpen(false);
        fetchTasks(selectedProjectId);
      } else {
        const err = await res.text();
        alert(`Failed to update task: ${err}`);
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

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 1).length,
    blocked: tasks.filter(t => t.status === 3).length,
    done: tasks.filter(t => t.status === 4).length,
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
            <button key={k} onClick={() => setStatusFilter(parseInt(k))}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${statusFilter === parseInt(k) ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
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
                    const st = STATUS_CONFIG[task.status] ?? STATUS_CONFIG[0];
                    const pr = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[1];
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 4;
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

      {/* ── Task Detail Bottom Panel ── */}
      {selectedTask && (
        <div className="flex-shrink-0 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden" style={{ height: '340px' }}>
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 text-xs font-bold">
              {selectedTask.title.slice(0, 1).toUpperCase()}
            </div>
            <span className="font-semibold text-slate-800 truncate">{selectedTask.title}</span>
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${(PRIORITY_CONFIG[selectedTask.priority] ?? PRIORITY_CONFIG[1]).color}`}>
              {(PRIORITY_CONFIG[selectedTask.priority] ?? PRIORITY_CONFIG[1]).label}
            </span>
            <button
              onClick={(e) => handleOpenTaskEdit(selectedTask, e)}
              className="p-1 rounded-full text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition flex-shrink-0"
              title="Edit task"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => setSelectedTask(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <TaskBottomPanel task={selectedTask} onClose={() => { setSelectedTask(null); fetchTasks(selectedProjectId); }} />
        </div>
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
              placeholder="Select project..."
              isClearable={false}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input required name="title" value={formData.title} onChange={handleChange}
              placeholder="E.g. Setup database schema" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange}
              rows={3} placeholder="Add more details..." className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                <option value={0}>To Do</option>
                <option value={1}>In Progress</option>
                <option value={2}>In Review</option>
                <option value={3}>Blocked</option>
                <option value={4}>Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                <option value={0}>Low</option>
                <option value={1}>Medium</option>
                <option value={2}>High</option>
                <option value={3}>Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date (Deadline)</label>
              <input type="date" name="deadline" min={formData.startDate || undefined} value={formData.deadline} onChange={handleChange} className={inputClass} />
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
              className={inputClass} placeholder="Task title" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea name="description" value={editTaskData.description} onChange={handleEditTaskChange}
              rows={3} className={inputClass} placeholder="Add more details..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select name="status" value={editTaskData.status} onChange={handleEditTaskChange} className={inputClass}>
                <option value={0}>To Do</option>
                <option value={1}>In Progress</option>
                <option value={2}>In Review</option>
                <option value={3}>Blocked</option>
                <option value={4}>Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select name="priority" value={editTaskData.priority} onChange={handleEditTaskChange} className={inputClass}>
                <option value={0}>Low</option>
                <option value={1}>Medium</option>
                <option value={2}>High</option>
                <option value={3}>Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input type="date" name="startDate" value={editTaskData.startDate} onChange={handleEditTaskChange} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date (Deadline)</label>
              <input type="date" name="deadline" min={editTaskData.startDate || undefined} value={editTaskData.deadline} onChange={handleEditTaskChange} className={inputClass} />
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

