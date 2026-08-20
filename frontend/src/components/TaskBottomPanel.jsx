import React, { useState, useEffect } from 'react';
import CommentSection from './CommentSection';
import AttachmentList from './AttachmentList';
import TaskVolunteersTab from './TaskVolunteersTab';
import { parseApiResponse, showErrorToast } from '../utils/toastHelper';

const API_URL = `${import.meta.env.VITE_API_URL}/tasks`;

export default function TaskBottomPanel({ task, onClose }) {
  const [activeTab, setActiveTab] = useState('activity'); // subtasks, activity, attachments, volunteers

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

  useEffect(() => {
    if (task) {
      fetchSubtasks();
      fetchHistory();
      fetchMembers();
      fetchAllUsers();
      fetchDependencies();
      fetchProjectTasks();
    }
  }, [task]);

  const fetchSubtasks = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setSubtasks(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setHistory(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: newSubtaskTitle })
      });
      if (res.ok) {
        setNewSubtaskTitle('');
        fetchSubtasks();
      }
    } catch (err) { console.error(err); }
  };

  const handleEditSubtask = async (st) => {
    if (!editingSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/subtasks/${st.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchSubtasks();
    } catch (err) { console.error(err); }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setMembers(await res.json());
      else setMembers([]);
    } catch (err) { setMembers([]); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setAllUsers(await res.json());
      else setAllUsers([]);
    } catch (err) { setAllUsers([]); }
  };

  const fetchDependencies = async () => {
    if (!task) return;
    try {
      setLoadingDeps(true);
      const res = await fetch(`${API_URL}/${task.id}/dependencies`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setDependencies(await res.json());
      else setDependencies([]);
    } catch (err) {
      console.error(err);
      setDependencies([]);
    } finally {
      setLoadingDeps(false);
    }
  };

  function authHeaders() {
    const token = localStorage.getItem('token');
    let orgId = localStorage.getItem('selectedOrganizationId');
    if (!orgId) {
      const storedOrg = localStorage.getItem('selectedOrganization');
      if (storedOrg) {
        try { orgId = JSON.parse(storedOrg).id; } catch {}
      }
    }
    if (!orgId) orgId = localStorage.getItem('selectedOrgId');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['X-Organization-Id'] = String(orgId);
    return headers;
  }

  const fetchProjectTasks = async () => {
    if (!task) return;
    try {
      let candidateTasks = [];
      if (task.projectId) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${task.projectId}`, {
          headers: authHeaders()
        });
        if (res.ok) {
          const projectData = await res.json();
          if (projectData && Array.isArray(projectData.tasks)) {
            candidateTasks = projectData.tasks;
          }
        }
      }
      if (candidateTasks.length === 0) {
        const res = await fetch(`${API_URL}`, {
          headers: authHeaders()
        });
        if (res.ok) {
          const allTasksData = await res.json();
          if (Array.isArray(allTasksData)) {
            candidateTasks = allTasksData;
          }
        }
      }
      setProjectTasks(candidateTasks.filter(t => t.id !== task.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!addDepTaskId) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ dependsOnTaskId: parseInt(addDepTaskId) })
      });
      if (res.ok) {
        setAddDepTaskId('');
        fetchDependencies();
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(`Failed to add dependency: ${errText}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveDependency = async (depId) => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/dependencies/${depId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchDependencies();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberId) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ userId: parseInt(addMemberId) })
      });
      if (res.ok) { setAddMemberId(''); fetchMembers(); }
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchMembers();
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtask = async (st) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subtasks/${st.id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchSubtasks();
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

  const handleGoogleCalendarSync = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/google-calendar-url`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadICal = () => {
    window.open(`${API_URL}/${task.id}/ical`, '_blank');
  };

  return (
    <div className="fixed inset-x-0 lg:left-[260px] bottom-0 z-40 flex h-96 flex-col border-t border-slate-200 bg-white shadow-2xl transition-all animate-in slide-in-from-bottom duration-200 max-w-7xl mx-auto rounded-t-3xl overflow-hidden">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
            {task.title}
          </h2>
          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
            Active Task
          </span>
          {/* Add to Calendar buttons (hidden for now) */}
          {/*
          <button
            onClick={handleGoogleCalendarSync}
            title="Add to Google Calendar"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-100 transition"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
            </svg>
            Add to Calendar
          </button>
          <button
            onClick={handleDownloadICal}
            title="Download .ics Calendar File"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
          >
            .ics
          </button>
          */}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {['subtasks', 'dependencies', 'activity', 'attachments', 'members', 'volunteers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition capitalize ${activeTab === tab
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-2 hover:bg-slate-100 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>



      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* SUBTASKS TAB */}
        {activeTab === 'subtasks' && (
          <div className="space-y-4">
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add subtask..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button type="submit" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition">Add</button>
            </form>
            <div className="space-y-2">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={st.isDone}
                    onChange={() => handleToggleSubtask(st)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                  />
                  {editingSubtaskId === st.id ? (
                    <input
                      autoFocus
                      value={editingSubtaskTitle}
                      onChange={e => setEditingSubtaskTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSubtask(st); if (e.key === 'Escape') { setEditingSubtaskId(null); }}}
                      className="flex-1 rounded border border-brand-400 px-2 py-0.5 text-xs focus:outline-none"
                    />
                  ) : (
                    <span className={`flex-1 text-xs font-medium ${st.isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{st.title}</span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {editingSubtaskId === st.id ? (
                      <>
                        <button onClick={() => handleEditSubtask(st)} className="rounded px-2 py-0.5 text-[10px] font-semibold text-brand-600 hover:bg-brand-50 transition">Save</button>
                        <button onClick={() => setEditingSubtaskId(null)} className="rounded px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingSubtaskId(st.id); setEditingSubtaskTitle(st.title); }} className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition" title="Edit">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSubtask(st.id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Delete">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {subtasks.length === 0 && (
                <p className="text-center text-xs text-slate-500 pt-2">No subtasks yet.</p>
              )}
            </div>
          </div>
        )}

        {/* DEPENDENCIES TAB */}
        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Predecessor Dependencies</h4>
                <p className="text-[11px] text-slate-500">Tasks that must be completed before this task can start.</p>
              </div>
              <form onSubmit={handleAddDependency} className="flex gap-2 w-full sm:w-auto">
                <select
                  value={addDepTaskId}
                  onChange={(e) => setAddDepTaskId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select Predecessor Task...</option>
                  {projectTasks
                    .filter(t => !dependencies.some(d => d.dependsOnTaskId === t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        #{t.id} - {t.title} ({t.status})
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={!addDepTaskId}
                  className="rounded-lg bg-[#5A45FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 transition disabled:opacity-50"
                >
                  Link
                </button>
              </form>
            </div>

            {loadingDeps ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading task dependencies...</p>
            ) : dependencies.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-8 text-center text-xs text-slate-500">
                No predecessor dependencies configured for this task. Select a task above to link a prerequisite blocking task.
              </div>
            ) : (
              <div className="space-y-2">
                {dependencies.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-400">🔗 Blocked by:</span>
                      <span className="font-bold text-slate-900">{dep.dependsOnTaskTitle || 'Prerequisite Task'}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dep.dependsOnTaskStatus === 'Done' ? 'bg-emerald-100 text-emerald-800' :
                        dep.dependsOnTaskStatus === 'InProgress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {dep.dependsOnTaskStatus || 'ToDo'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveDependency(dep.id)}
                      className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 rounded hover:bg-rose-50 transition"
                      title="Remove dependency link"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <CommentSection entityType="tasks" entityId={task.id} additionalActivity={additionalActivity} />
        )}

        {/* ATTACHMENTS TAB */}
        {activeTab === 'attachments' && (
          <AttachmentList entityType="tasks" entityId={task.id} />
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={addMemberId}
                onChange={e => setAddMemberId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
              >
                <option value="">Select a user to add...</option>
                {allUsers.filter(u => !members.some(m => m.userId === u.id || m.id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!addMemberId}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition disabled:opacity-50"
              >Add</button>
            </div>
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-center text-xs text-slate-500 pt-2">No members assigned to this task.</p>
              ) : members.map(m => (
                <div key={m.userId ?? m.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                      {(m.userName ?? m.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{m.userName ?? m.name}</p>
                      {m.email && <p className="text-[10px] text-slate-500">{m.email}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.userId ?? m.id)}
                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 transition"
                  >Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VOLUNTEERS TAB */}
        {activeTab === 'volunteers' && (
          <TaskVolunteersTab taskId={task.id} />
        )}
      </div>
    </div>
  );
}
