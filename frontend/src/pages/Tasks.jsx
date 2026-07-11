import { useEffect, useState, useCallback } from 'react';
import Modal from '../components/Modal';
import KanbanBoard from '../components/KanbanBoard';
import TaskBottomPanel from '../components/TaskBottomPanel';

const API_URL = 'https://localhost:7065/api/v1/tasks';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 0, 1, 2, 3, 4
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 0,
    priority: 1,
    deadline: ''
  });

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: 1,
          title: formData.title,
          description: formData.description || null,
          status: parseInt(formData.status, 10),
          priority: parseInt(formData.priority, 10),
          deadline: formData.deadline || null
        })
      });

      if (response.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', description: '', status: 0, priority: 1, deadline: '' });
        fetchTasks();
      } else {
        alert('Failed to create task. Ensure you have the right permissions.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskMove = async (taskId, newStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        // Revert on failure
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const statusMap = {
    0: 'To Do',
    1: 'In Progress',
    2: 'In Review',
    3: 'Blocked',
    4: 'Done'
  };

  const priorityMap = {
    0: 'Low',
    1: 'Medium',
    2: 'High',
    3: 'Urgent'
  };

  const getPriorityColor = (priority) => {
    if (priority === 3) return 'text-red-600 bg-red-100';
    if (priority === 2) return 'text-orange-600 bg-orange-100';
    if (priority === 1) return 'text-blue-600 bg-blue-100';
    return 'text-slate-600 bg-slate-100';
  };

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Tasks</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your workflow with drag-and-drop boards.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            New Task <span className="hidden sm:inline opacity-50 ml-1 text-xs border border-white/20 rounded px-1">N</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-4 shrink-0 overflow-x-auto">
        <button
          onClick={() => setStatusFilter('all')}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          All
        </button>
        {Object.entries(statusMap).map(([statusIdStr, title]) => {
          const statusId = parseInt(statusIdStr, 10);
          return (
            <button
              key={statusId}
              onClick={() => setStatusFilter(statusId)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${statusFilter === statusId ? 'bg-brand-500 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {title}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 min-h-0 gap-6 overflow-hidden relative">
        <div className="flex flex-col flex-1 min-h-0 w-full">
          {viewMode === 'kanban' ? (
            <KanbanBoard 
              tasks={tasks} 
              onTaskMove={handleTaskMove}
              onTaskClick={(task) => setSelectedTask(prev => prev?.id === task.id ? null : task)}
              selectedTaskId={selectedTask?.id}
              statusFilter={statusFilter}
            />
          ) : (
            <div className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Title</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Priority</th>
                    <th className="px-6 py-4 font-medium">Deadline</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.filter(t => statusFilter === 'all' || t.status === statusFilter).map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/50 cursor-pointer">
                      <td className="px-6 py-4 font-medium text-slate-900">{task.title}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                          {statusMap[task.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {priorityMap[task.priority]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                        No tasks found. Create one to get started!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Task Detail Panel ───────────────────────────────── */}
      {selectedTask && (
        <div
          className="shrink-0 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden transition-all duration-300"
          style={{ height: '340px' }}
        >
          {/* Panel title strip */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
            <span className="font-semibold text-slate-800 truncate">{selectedTask.title}</span>
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              selectedTask.priority === 3 ? 'bg-red-100 text-red-600' :
              selectedTask.priority === 2 ? 'bg-orange-100 text-orange-600' :
              selectedTask.priority === 1 ? 'bg-blue-100 text-blue-600' :
              'bg-slate-100 text-slate-600'
            }`}>
              {['Low','Medium','High','Urgent'][selectedTask.priority]}
            </span>
          </div>
          <TaskBottomPanel
            task={selectedTask}
            onClose={() => { setSelectedTask(null); fetchTasks(); }}
          />
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Task">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input
              required
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="E.g. Setup database schema"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Add more details..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={0}>To Do</option>
                <option value={1}>In Progress</option>
                <option value={2}>In Review</option>
                <option value={3}>Blocked</option>
                <option value={4}>Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={0}>Low</option>
                <option value={1}>Medium</option>
                <option value={2}>High</option>
                <option value={3}>Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Deadline</label>
            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-3xl px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
