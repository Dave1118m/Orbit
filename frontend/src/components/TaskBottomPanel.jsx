import React, { useState, useEffect, useRef } from 'react';
import InAppFileViewer from './InAppFileViewer';

const API_URL = 'https://localhost:7065/api/v1/tasks';

export default function TaskBottomPanel({ task, onClose }) {
  const [activeTab, setActiveTab] = useState('subtasks'); // subtasks, activity, attachments
  
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [history, setHistory] = useState([]);
  
  const [attachments, setAttachments] = useState([]);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (task) {
      fetchSubtasks();
      fetchComments();
      fetchHistory();
      fetchAttachments();
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

  const fetchComments = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/comments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setComments(await res.json());
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

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`${API_URL}/${task.id}/attachments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setAttachments(await res.json());
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`${API_URL}/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/${task.id}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      if (res.ok) {
        fetchAttachments();
      }
    } catch (err) { console.error(err); }
  };

  if (!task) return null;

  // Combine comments and history for activity feed
  const activityFeed = [
    ...comments.map(c => ({ ...c, type: 'comment', date: new Date(c.createdAt) })),
    ...history.map(h => ({ ...h, type: 'history', date: new Date(h.changedAt) }))
  ].sort((a, b) => b.date - a.date);

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
          <div className="flex flex-col space-y-4">
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {activityFeed.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shadow-sm">
                    {item.type === 'comment' ? (item.userName?.charAt(0) || 'U') : '🤖'}
                  </div>
                  <div className="flex-1 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-800">
                        {item.type === 'comment' ? item.userName : 'System'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.date.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.type === 'comment' ? (
                        item.content
                      ) : (
                        <>Changed status from <span className="font-semibold">{item.oldStatus}</span> to <span className="font-semibold">{item.newStatus}</span></>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && (
                <p className="text-center text-xs text-slate-500">No activity yet.</p>
              )}
            </div>
            <form onSubmit={handleAddComment} className="border-t border-slate-100 pt-3 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* ATTACHMENTS TAB */}
        {activeTab === 'attachments' && (
          <div className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 hover:bg-slate-100 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="rounded-full bg-brand-100 p-2 text-brand-600 mb-2 shadow-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-xs font-medium text-slate-600">Click to upload</p>
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  onClick={() => setSelectedAttachment(att)}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm hover:border-brand-300 hover:shadow transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{att.fileName}</p>
                    <p className="text-[10px] text-slate-500">{(att.fileSizeBytes / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <InAppFileViewer 
        attachment={selectedAttachment} 
        isOpen={!!selectedAttachment} 
        onClose={() => setSelectedAttachment(null)} 
      />
    </div>
  );
}
