import React, { useState, useEffect } from 'react';
import CommentSection from './CommentSection';
import AttachmentList from './AttachmentList';
import TaskVolunteersTab from './TaskVolunteersTab';
import { Calendar, CheckCircle, Clock, Link as LinkIcon, Pencil, Target, X } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL}/tasks`;

/**
 * Task Details Drawer component rendering a flyout panel for managing subtasks,
 * team member assignments, task dependencies, volunteer assignments, comments, attachments, and audit history.
 * @param {{ task: Object, onClose: () => void, onEdit?: (task: Object) => void, onTaskUpdated?: () => void }} props
 */
export default function TaskDetailsDrawer({ task, onClose, onEdit, onTaskUpdated }) {
  const [activeTab, setActiveTab] = useState('subtasks'); // subtasks, activity, attachments
  const [currentTask, setCurrentTask] = useState(task);

  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  
  const [history, setHistory] = useState([]);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [addMemberId, setAddMemberId] = useState('');

  const [dependencies, setDependencies] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [addDepTaskId, setAddDepTaskId] = useState('');
  const [loadingDeps, setLoadingDeps] = useState(false);

  const [logframeActivity, setLogframeActivity] = useState(null);
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [updatingCategory, setUpdatingCategory] = useState(false);

  useEffect(() => {
    if (task) {
      setCurrentTask(task);
      fetchSubtasks();
      fetchHistory();
      fetchMembers();
      fetchAllUsers();
      fetchDependencies();
      fetchProjectTasks();
      fetchLogframe();
      fetchDynamicCategories();
    }
  }, [task]);

  const fetchDynamicCategories = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/FinancialCategories/flat`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDynamicCategories(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const handleCategoryChange = async (newCategoryId) => {
    try {
      setUpdatingCategory(true);
      const parsedCatId = newCategoryId ? parseInt(newCategoryId, 10) : null;
      const res = await fetch(`${API_URL}/${currentTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ categoryId: parsedCatId })
      });
      if (res.ok) {
        const updated = await res.json();
        const matchedCat = dynamicCategories.find(c => c.id === parsedCatId);
        setCurrentTask(prev => ({
          ...prev,
          categoryId: parsedCatId,
          categoryName: matchedCat?.name || updated.categoryName || ''
        }));
        onTaskUpdated?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCategory(false);
    }
  };

  function authHeaders() {
    const token = localStorage.getItem('token');
    let orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
    if (!orgId) {
      const storedOrg = localStorage.getItem('selectedOrganization');
      if (storedOrg) { try { orgId = JSON.parse(storedOrg).id; } catch {} }
    }
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['X-Organization-Id'] = String(orgId);
    return headers;
  }

  const fetchSubtasks = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks`, { headers: authHeaders() });
      if (res.ok) setSubtasks(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/history`, { headers: authHeaders() });
      if (res.ok) setHistory(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/members`, { headers: authHeaders() });
      if (res.ok) setMembers(await res.json());
      else setMembers([]);
    } catch (err) { setMembers([]); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: authHeaders() });
      if (res.ok) setAllUsers(await res.json());
      else setAllUsers([]);
    } catch (err) { setAllUsers([]); }
  };

  const fetchDependencies = async () => {
    if (!task) return;
    try {
      setLoadingDeps(true);
      const res = await fetch(`${API_URL}/${task.id}/dependencies`, { headers: authHeaders() });
      if (res.ok) setDependencies(await res.json());
      else setDependencies([]);
    } catch (err) {
      setDependencies([]);
    } finally { setLoadingDeps(false); }
  };

  const fetchProjectTasks = async () => {
    if (!task) return;
    try {
      let candidateTasks = [];
      if (task.projectId) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks?projectId=${task.projectId}`, { headers: authHeaders() });
        if (res.ok) {
          const fetchedTasks = await res.json();
          if (Array.isArray(fetchedTasks)) candidateTasks = fetchedTasks;
        }
      }
      setProjectTasks(candidateTasks.filter(t => t.id !== task.id));
    } catch (err) { console.error(err); }
  };


  const fetchLogframe = async () => {
    if (!task || !task.projectId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${task.projectId}/logframe`, { headers: authHeaders() });
      if (res.ok) {
        const lf = await res.json();
        let matchedActivity = null;
        let matchedOutput = null;
        let matchedOutcome = null;
        let matchedGoal = null;

        if (lf && Array.isArray(lf.goals)) {
          for (const g of lf.goals) {
            for (const o of (g.outcomes || [])) {
              for (const op of (o.outputs || [])) {
                for (const a of (op.activities || [])) {
                  if (String(a.linkedTaskId) === String(task.id)) {
                    matchedActivity = a;
                    matchedOutput = op;
                    matchedOutcome = o;
                    matchedGoal = g;
                    break;
                  }
                }
                if (matchedActivity) break;
              }
              if (matchedActivity) break;
            }
            if (matchedActivity) break;
          }
        }

        if (matchedActivity) {
          setLogframeActivity({
            activityId: matchedActivity.id,
            description: matchedActivity.description,
            outputTitle: matchedOutput?.description,
            outcomeTitle: matchedOutcome?.description,
            goalTitle: matchedGoal?.description,
          });
        } else {
          setLogframeActivity(null);
        }
      }
    } catch (err) {
      setLogframeActivity(null);
    }
  };

  // Subtask handlers
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: newSubtaskTitle })
      });
      if (res.ok) { setNewSubtaskTitle(''); fetchSubtasks(); }
    } catch (err) { console.error(err); }
  };

  const handleEditSubtask = async (st) => {
    if (!editingSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks/${st.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: editingSubtaskTitle, isDone: st.isDone })
      });
      if (res.ok) { setEditingSubtaskId(null); setEditingSubtaskTitle(''); fetchSubtasks(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteSubtask = async (stId) => {
    if (!window.confirm('Delete this subtask?')) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks/${stId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) fetchSubtasks();
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtask = async (st) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subtasks/${st.id}/toggle`, {
        method: 'PATCH', headers: authHeaders()
      });
      if (res.ok) fetchSubtasks();
    } catch (err) { console.error(err); }
  };

  // Dependency handlers
  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!addDepTaskId) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ dependsOnTaskId: parseInt(addDepTaskId) })
      });
      if (res.ok) { setAddDepTaskId(''); fetchDependencies(); }
    } catch (err) { console.error(err); }
  };

  const handleRemoveDependency = async (depId) => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/dependencies/${depId}`, {
        method: 'DELETE', headers: authHeaders()
      });
      if (res.ok) fetchDependencies();
    } catch (err) { console.error(err); }
  };

  // Member handlers
  const handleAddMember = async () => {
    if (!addMemberId) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: parseInt(addMemberId) })
      });
      if (res.ok) { setAddMemberId(''); fetchMembers(); }
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/members/${userId}`, {
        method: 'DELETE', headers: authHeaders()
      });
      if (res.ok) fetchMembers();
    } catch (err) { console.error(err); }
  };

  // Google Calendar handler
  const handleGoogleCalendarSync = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/google-calendar-url`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.url) window.open(data.url, '_blank');
      }
    } catch (err) { console.error(err); }
  };

  const additionalActivity = history.map((h) => ({
    id: `hist-${h.id}`,
    type: 'history',
    user: { name: h.changedByUserName || 'System' },
    oldStatus: h.oldStatus,
    newStatus: h.newStatus,
    content: `Status changed from ${h.oldStatus} to ${h.newStatus}`,
    date: h.changedAt ? new Date(h.changedAt) : new Date(),
    createdAt: h.changedAt
  }));


  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-slate-200 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
              task.status === 'Done' ? 'bg-emerald-100 text-emerald-700' :
              task.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {task.status}
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(currentTask)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-600 border border-brand-200 hover:bg-brand-100 transition shadow-sm"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Task
              </button>
            )}
            <button
              onClick={handleGoogleCalendarSync}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600 border border-blue-200 hover:bg-blue-100 transition shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              Sync to Google
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          
          {/* Main Left Column */}
          <div className="flex-1 md:overflow-y-auto bg-white p-4 sm:p-6 md:border-r border-slate-200">
            {task.description && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Description</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex gap-4 border-b border-slate-200 mb-6 flex-wrap">
              {[
                { key: 'subtasks', label: 'Checklist' },
                { key: 'comments', label: 'Comments' },
                { key: 'activity', label: 'Activity Log' },
                { key: 'attachments', label: 'Attachments' },
                { key: 'volunteers', label: 'Volunteers' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-sm font-bold transition border-b-2 ${
                    activeTab === tab.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Panels */}
            {activeTab === 'subtasks' && (
              <div className="space-y-4">
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a checklist item..."
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition shadow-sm">Add</button>
                </form>
                <div className="space-y-2">
                  {subtasks.map((st) => (
                    <div key={st.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-200 transition group">
                      <input
                        type="checkbox"
                        checked={st.isDone}
                        onChange={() => handleToggleSubtask(st)}
                        className="h-5 w-5 cursor-pointer rounded border-slate-300 text-brand-500 focus:ring-brand-500 transition"
                      />
                      {editingSubtaskId === st.id ? (
                        <input
                          autoFocus
                          value={editingSubtaskTitle}
                          onChange={e => setEditingSubtaskTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditSubtask(st); if (e.key === 'Escape') { setEditingSubtaskId(null); }}}
                          className="flex-1 rounded border border-brand-400 px-2 py-1 text-sm focus:outline-none"
                        />
                      ) : (
                        <span className={`flex-1 text-sm font-medium transition ${st.isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{st.title}</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        {editingSubtaskId === st.id ? (
                          <>
                            <button onClick={() => handleEditSubtask(st)} className="rounded px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition">Save</button>
                            <button onClick={() => setEditingSubtaskId(null)} className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingSubtaskId(st.id); setEditingSubtaskTitle(st.title); }} className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition">Edit</button>
                            <button onClick={() => handleDeleteSubtask(st.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {subtasks.length === 0 && <p className="text-sm text-slate-500 italic py-2">No checklist items yet.</p>}
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <CommentSection entityType="tasks" entityId={task.id} />
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Trail & Status History</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4">No status change events recorded yet.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-200 ml-4 space-y-4 pl-4 py-2">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="relative group">
                        <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-500 border-2 border-white ring-2 ring-slate-100" />
                        <p className="text-xs font-semibold text-slate-900">
                          {h.changedByUserName || 'User'} moved status from <span className="font-bold text-slate-600">{h.oldStatus}</span> → <span className="font-bold text-brand-600">{h.newStatus}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(h.changedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'attachments' && (
              <AttachmentList entityType="tasks" entityId={task.id} />
            )}

            {activeTab === 'volunteers' && (
              <TaskVolunteersTab taskId={task.id} />
            )}
          </div>

          {/* Right Sidebar - Metadata & Compliance */}
          <div className="w-full md:w-80 bg-slate-50 p-4 sm:p-6 md:overflow-y-auto border-t md:border-t-0 border-slate-200">
            
            {/* Strategic Alignment Widget */}
            <div className="mb-6 rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
              <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Strategic Alignment</h4>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Logframe Alignment</p>
                  <div className="flex items-start gap-2.5 mt-2">
                    <LinkIcon className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      {logframeActivity ? (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 leading-snug">
                            {logframeActivity.description}
                          </p>
                          {logframeActivity.outputTitle && (
                            <p className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block font-medium">
                              Output: {logframeActivity.outputTitle}
                            </p>
                          )}
                          {logframeActivity.goalTitle && (
                            <p className="text-[10px] text-slate-400">
                              Goal: {logframeActivity.goalTitle}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="font-medium text-slate-400 italic">
                          Not linked to Logframe Activity
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Properties */}
            <div className="space-y-4 mb-8">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500">Financial Category</p>
                  {updatingCategory && <span className="text-[10px] text-brand-600 font-bold animate-pulse">Saving...</span>}
                </div>
                <select
                  value={currentTask.categoryId || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  disabled={updatingCategory}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                >
                  <option value="">No Financial Category Assigned</option>
                  {dynamicCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName || c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Assign to a financial category for project expense claims and budget tracking.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Priority</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  task.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                  task.priority === 'Low' ? 'bg-slate-200 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{task.priority}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Schedule</p>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {task.startDate ? new Date(task.startDate).toLocaleDateString() : '--'} &rarr; {task.deadline ? new Date(task.deadline).toLocaleDateString() : '--'}
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Assignees</h4>
              </div>
              <div className="space-y-2 mb-3">
                {members.map(m => (
                  <div key={m.userId ?? m.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                        {(m.userName ?? m.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-slate-700">{m.userName ?? m.name}</p>
                    </div>
                    <button onClick={() => handleRemoveMember(m.userId ?? m.id)} className="text-[10px] font-semibold text-rose-500 opacity-0 group-hover:opacity-100 transition">Remove</button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-xs text-slate-500 italic">Unassigned</p>}
              </div>
              <div className="flex gap-2">
                <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:border-brand-500">
                  <option value="">Add member...</option>
                  {allUsers.filter(u => !members.some(m => m.userId === u.id || m.id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button onClick={handleAddMember} disabled={!addMemberId} className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Add</button>
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase mb-2">Predecessors</h4>
              <div className="space-y-2 mb-3">
                {dependencies.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 text-xs group">
                    <span className="truncate max-w-[150px] font-medium text-slate-700" title={dep.dependsOnTaskTitle}>{dep.dependsOnTaskTitle}</span>
                    <button onClick={() => handleRemoveDependency(dep.id)} className="text-rose-500 font-semibold opacity-0 group-hover:opacity-100 transition">Remove</button>
                  </div>
                ))}
                {dependencies.length === 0 && <p className="text-xs text-slate-500 italic">No blocked links.</p>}
              </div>
              <form onSubmit={handleAddDependency} className="flex gap-2">
                <select value={addDepTaskId} onChange={e => setAddDepTaskId(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:border-brand-500">
                  <option value="">Add dependency...</option>
                  {projectTasks.filter(t => !dependencies.some(d => d.dependsOnTaskId === t.id)).map(t => (
                    <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>
                  ))}
                </select>
                <button type="submit" disabled={!addDepTaskId} className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Link</button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
