// ProjectDetailsPanel is now embedded directly in Projects.jsx as ProjectDetailPanel.
// This file is kept for backward compatibility with any other pages that may import it.
import React from 'react';
import CommentSection from './CommentSection';
import AttachmentList from './AttachmentList';
import RiskRegister from './RiskRegister';
import { useState } from 'react';

const AVATAR_COLORS = [
  'bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-cyan-500','bg-pink-500','bg-indigo-500',
];
function avatarColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name = '') {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function ProjectDetailsPanel({ project, onClose }) {
  const [activeTab, setActiveTab] = useState('comments');

  if (!project) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg bg-white shadow-2xl border-l border-slate-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm flex-shrink-0 ${avatarColor(project.title)}`}>
              {initials(project.title)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">{project.title}</h2>
              <p className="text-xs text-slate-400">Project Details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-6 py-3 border-b border-slate-100 flex-shrink-0">
          {['comments', 'attachments', 'risks'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                activeTab === tab ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {activeTab === 'comments' && <CommentSection entityType="projects" entityId={project.id} />}
          {activeTab === 'attachments' && <AttachmentList entityType="projects" entityId={project.id} />}
          {activeTab === 'risks' && <RiskRegister projectId={project.id} />}
        </div>
      </div>
    </>
  );
}
