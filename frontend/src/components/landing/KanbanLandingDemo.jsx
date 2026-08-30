import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Plus, 
  GripVertical, 
  Tag, 
  User, 
  Sparkles,
  ArrowRight,
  Flame
} from 'lucide-react';

const INITIAL_COLUMNS = [
  {
    id: 'todo',
    title: 'To Do',
    color: 'border-white/[0.08] text-slate-300',
    dot: 'bg-slate-400',
    tasks: []
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    color: 'border-blue-500/20 text-blue-300',
    dot: 'bg-cyan-400',
    tasks: []
  },
  {
    id: 'in_review',
    title: 'In Review',
    color: 'border-purple-500/20 text-purple-300',
    dot: 'bg-violet-400',
    tasks: []
  },
  {
    id: 'done',
    title: 'Completed',
    color: 'border-emerald-500/20 text-emerald-300',
    dot: 'bg-emerald-400',
    tasks: []
  }
];

export default function KanbanLandingDemo() {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL;

  useEffect(() => {
    async function fetchLiveKanban() {
      try {
        const res = await fetch(`${API_BASE}/analytics/public-kanban`);
        if (res.ok) {
          const liveTasks = await res.json();
          if (liveTasks && liveTasks.length > 0) {
            const priorityColors = {
              Urgent: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
              High: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
              Medium: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
              Low: 'bg-white/[0.05] text-slate-300 border-white/[0.08]'
            };

            const todoList = [];
            const inProgressList = [];
            const inReviewList = [];
            const doneList = [];

            liveTasks.forEach(task => {
              const formattedTask = {
                id: task.id,
                title: task.title,
                project: task.project || 'Active Workspace',
                priority: task.priority || 'Medium',
                priorityColor: priorityColors[task.priority] || priorityColors.Medium,
                assignee: task.category || 'Operations',
                deadline: task.deadline || 'Active',
                comments: 0
              };

              const st = (task.status || '').toLowerCase();
              if (st === 'done' || st === 'completed') {
                doneList.push(formattedTask);
              } else if (st === 'inreview' || st === 'in_review') {
                inReviewList.push(formattedTask);
              } else if (st === 'inprogress' || st === 'in_progress') {
                inProgressList.push(formattedTask);
              } else {
                todoList.push(formattedTask);
              }
            });

            setColumns([
              { id: 'todo', title: 'To Do', color: 'border-white/[0.08] text-slate-300', dot: 'bg-slate-400', tasks: todoList },
              { id: 'in_progress', title: 'In Progress', color: 'border-blue-500/20 text-blue-300', dot: 'bg-cyan-400', tasks: inProgressList },
              { id: 'in_review', title: 'In Review', color: 'border-purple-500/20 text-purple-300', dot: 'bg-violet-400', tasks: inReviewList },
              { id: 'done', title: 'Completed', color: 'border-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400', tasks: doneList }
            ]);
          }
        }
      } catch (err) {
        console.log('Public kanban fetch notice:', err);
      }
    }
    fetchLiveKanban();
  }, [API_BASE]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    setDragOverColId(colId);
  };

  const handleDragLeave = () => {
    setDragOverColId(null);
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    let movedTask = null;

    // Find and remove task from old column
    const updatedCols = columns.map(col => {
      const found = col.tasks.find(t => t.id === taskId);
      if (found) {
        movedTask = found;
        return {
          ...col,
          tasks: col.tasks.filter(t => t.id !== taskId)
        };
      }
      return col;
    });

    if (!movedTask) return;

    // Add task to target column
    const finalCols = updatedCols.map(col => {
      if (col.id === targetColId) {
        return {
          ...col,
          tasks: [movedTask, ...col.tasks]
        };
      }
      return col;
    });

    const targetCol = finalCols.find(c => c.id === targetColId);
    setColumns(finalCols);
    setDraggedTaskId(null);
    showToast(`✨ Moved "${movedTask.title}" to ${targetCol?.title}!`);
  };

  const handleAddNewTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask = {
      id: `t-${Date.now()}`,
      title: newTaskText.trim(),
      project: 'New Project',
      priority: 'Medium',
      priorityColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      assignee: 'You',
      deadline: 'Just now',
      comments: 0
    };

    setColumns(prev => prev.map(col => col.id === 'todo' ? { ...col, tasks: [newTask, ...col.tasks] } : col));
    setNewTaskText('');
    showToast(`🎉 Added task "${newTask.title}" to To Do!`);
  };

  return (
    <div className="glass-obsidian-card relative rounded-3xl p-6 shadow-2xl backdrop-blur-2xl md:p-8 border border-white/[0.08]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xl animate-fade-up border border-indigo-400/30">
          <Sparkles className="h-4 w-4 text-amber-300 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400"></span>
            <h3 className="text-xl sm:text-2xl font-black text-white">Kanban Task Workspace</h3>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-300 border border-indigo-500/20">
              Active Pipeline
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            Organize project deliverables, manage task dependencies, and maintain team accountability.
          </p>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAddNewTask} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a new task & press Enter..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            className="w-64 rounded-xl border border-white/[0.1] bg-[#08090a]/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => {
          const isOver = dragOverColId === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col rounded-2xl border p-4 transition-all duration-200 ${
                isOver ? 'border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/30' : 'border-white/[0.06] bg-[#08090a]/60'
              }`}
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`}></span>
                  <span className="font-bold text-slate-200 text-sm">{col.title}</span>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-bold text-slate-300 border border-white/[0.08]">
                  {col.tasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex flex-1 flex-col gap-3 min-h-[260px]">
                {col.tasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-6 text-center">
                    <p className="text-xs text-slate-500">Drag task cards here</p>
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="group relative cursor-grab rounded-xl border border-white/[0.08] bg-[#0d1117] p-4 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-indigo-500/10 active:cursor-grabbing"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-300 transition-colors">
                          {task.project}
                        </span>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${task.priorityColor}`}>
                          {task.priority}
                        </span>
                      </div>

                      <h4 className="font-semibold text-white text-sm leading-snug">
                        {task.title}
                      </h4>

                      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-500/30 text-[10px] font-bold text-indigo-300">
                            {task.assignee.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-slate-300">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{task.deadline}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#08090a]/80 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-white">
            <Flame className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Enterprise Workflow Automation</p>
            <p className="text-sm font-medium text-slate-300">Automatically sync task completion with Project Logframes & Budget Allocations.</p>
          </div>
        </div>
        <a
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.12] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.15] active:scale-95"
        >
          <span>Try Full Kanban System</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
