import React, { useState, useEffect } from 'react';
import CommentSection from './CommentSection';
import AttachmentList from './AttachmentList';

const API_URL = 'https://localhost:7065/api/v1/tasks';

export default function TaskBottomPanel({ task, onClose }) {
  const [activeTab, setActiveTab] = useState('activity'); // subtasks, activity, attachments

  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [history, setHistory] = useState([]);
  


  useEffect(() => {
    if (task) {
      fetchSubtasks();
      fetchHistory();
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
        body: JSON.stringify({ taskId: task.id, title: newSubtaskTitle })
      });
      if (res.ok) {
        setNewSubtaskTitle('');
        fetchSubtasks();
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtask = async (subtask) => {
    try {
      await fetch(`${API_URL}/${task.id}/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...subtask, isDone: !subtask.isDone })
      });
      fetchSubtasks();
    } catch (err) { console.error(err); }
  };

  if (!task) return null;

  // We only pass history to CommentSection for Tasks
  const additionalActivity = history.map(h => ({ ...h, type: 'history', date: new Date(h.changedAt) }));

  return (
    <div className="h-full flex flex-col bg-white border-t border-slate-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex gap-2 overflow-x-auto">
          {['subtasks', 'activity', 'attachments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition capitalize ${
                activeTab === tab 
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
              <button
                type="submit"
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition"
              >
                Add
              </button>
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
                  <span className={`text-xs font-medium ${st.isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {st.title}
                  </span>
                </div>
              ))}
              {subtasks.length === 0 && (
                <p className="text-center text-xs text-slate-500 pt-2">No subtasks yet.</p>
              )}
            </div>
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
      </div>
    </div>
  );
}
