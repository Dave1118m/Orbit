import React, { useState, useEffect } from 'react';

export default function CommentSection({ entityType, entityId, additionalActivity = [] }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const API_URL = `https://localhost:7065/api/v1/${entityType}/${entityId}/comments`;

  useEffect(() => {
    if (entityId) {
      fetchComments();
    }
  }, [entityId, entityType]);

  const fetchComments = async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setComments(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        const created = await res.json();
        setComments(prev => [created, ...prev]);
        setNewComment('');
      }
    } catch (err) { console.error(err); }
  };

  const activityFeed = [
    ...comments.map(c => ({ ...c, type: 'comment', date: new Date(c.createdAt) })),
    ...additionalActivity
  ].sort((a, b) => b.date - a.date);

  const entityLabel = (() => {
    if (!entityType) return '';
    if (entityType.toLowerCase().startsWith('project')) return 'Project';
    if (entityType.toLowerCase().startsWith('task')) return 'Task';
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  })();

  return (
    <div className="flex flex-col space-y-4 h-full">
      <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[200px]">
        {activityFeed.map((item, idx) => (
          <div key={idx} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shadow-sm">
              {item.type === 'comment' ? (item.userName?.charAt(0) || 'U') : '🤖'}
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-800">
                    {item.type === 'comment' ? item.userName : 'System'}
                  </span>
                  {entityLabel && (
                    <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      {entityLabel}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
      <form onSubmit={handleAddComment} className="border-t border-slate-100 pt-3 flex gap-2 shrink-0">
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
  );
}
