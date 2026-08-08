import React, { useState, useEffect } from 'react';
import { AutoText } from '../contexts/TranslationContext';

export default function CommentSection({ entityType, entityId, additionalActivity = [] }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [cursorPos, setCursorPos] = useState(0);

  const API_URL = `${import.meta.env.VITE_API_URL}/${entityType}/${entityId}/comments`;

  useEffect(() => {
    if (entityId) {
      fetchComments();
      fetchUsers();
    }
  }, [entityId, entityType]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setUsersList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setComments(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNewComment(val);
    setCursorPos(pos);

    // Detect @ symbol before cursor
    const lastAt = val.lastIndexOf('@', pos);
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(val[lastAt - 1]))) {
      const query = val.slice(lastAt + 1, pos);
      if (!/\s/.test(query)) {
        setMentionQuery({ query, atIndex: lastAt });
        return;
      }
    }
    setMentionQuery(null);
  };

  const selectMentionUser = (user) => {
    if (!mentionQuery) return;
    const handle = user.name ? user.name.replace(/\s+/g, '') : (user.email ? user.email.split('@')[0] : 'user');
    const before = newComment.slice(0, mentionQuery.atIndex);
    const after = newComment.slice(cursorPos);
    setNewComment(`${before}@${handle} ${after}`);
    setMentionQuery(null);
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
        setMentionQuery(null);
      }
    } catch (err) { console.error(err); }
  };

  const parseDate = (d) => {
    if (!d) return new Date(0);
    if (d instanceof Date) return isNaN(d.getTime()) ? new Date(0) : d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const activityFeed = [
    ...comments.map(c => ({ ...c, type: 'comment', date: parseDate(c.createdAt) })),
    ...additionalActivity.map(a => ({
      ...a,
      type: a.type || 'system',
      date: parseDate(a.date || a.createdAt)
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const entityLabel = (() => {
    if (!entityType) return '';
    if (entityType.toLowerCase().startsWith('project')) return 'Project';
    if (entityType.toLowerCase().startsWith('task')) return 'Task';
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  })();

  return (
    <div className="flex flex-col space-y-4 h-full">
      <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[200px]">
        {activityFeed.map((item, idx) => {
          const itemDate = item.date instanceof Date && !isNaN(item.date) ? item.date : new Date();
          const userName = item.type === 'comment' 
            ? (item.userName || item.user?.name || 'User') 
            : (item.user?.name || 'System');

          return (
            <div key={item.id || idx} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shadow-sm">
                {item.type === 'comment' ? (userName.charAt(0) || 'U') : '🤖'}
              </div>
              <div className="flex-1 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-800">
                      {userName}
                    </span>
                    {entityLabel && (
                      <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        <AutoText text={entityLabel} />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {itemDate.toLocaleDateString()} {itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.type === 'comment' ? (
                    <AutoText text={item.content} />
                  ) : item.oldStatus || item.newStatus ? (
                    <>Changed status from <span className="font-semibold"><AutoText text={item.oldStatus} /></span> to <span className="font-semibold"><AutoText text={item.newStatus} /></span></>
                  ) : (
                    <AutoText text={item.content} />
                  )}
                </p>
              </div>
            </div>
          );
        })}
        {activityFeed.length === 0 && (
          <p className="text-center text-xs text-slate-500"><AutoText text="No activity yet." /></p>
        )}
      </div>
      <form onSubmit={handleAddComment} className="relative border-t border-slate-100 pt-3 flex gap-2 shrink-0">
        {/* @Mention Autocomplete Dropdown */}
        {mentionQuery && (
          <div className="absolute bottom-full mb-2 left-0 w-64 max-h-48 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-1 divide-y divide-slate-100 animate-fadeIn">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Mention Teammate
            </div>
            {usersList
              .filter(u => !mentionQuery.query || (u.name && u.name.toLowerCase().includes(mentionQuery.query.toLowerCase())) || (u.email && u.email.toLowerCase().includes(mentionQuery.query.toLowerCase())))
              .map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectMentionUser(user)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 rounded-lg flex items-center justify-between transition"
                >
                  <span className="font-semibold text-slate-800">{user.name || user.email}</span>
                  <span className="text-[10px] text-indigo-600 font-mono">@{user.name ? user.name.replace(/\s+/g, '') : 'user'}</span>
                </button>
              ))}
          </div>
        )}

        <input
          type="text"
          value={newComment}
          onChange={handleInputChange}
          placeholder="Write a comment... (use @ to mention)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition"
        >
          <AutoText text="Send" />
        </button>
      </form>
    </div>
  );
}
