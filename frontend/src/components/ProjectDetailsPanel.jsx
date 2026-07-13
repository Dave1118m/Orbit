import React, { useState } from 'react';
import CommentSection from './CommentSection';
import AttachmentList from './AttachmentList';
import RiskRegister from './RiskRegister';

export default function ProjectDetailsPanel({ project, onClose }) {
  const [activeTab, setActiveTab] = useState('comments'); // comments, attachments, risks

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 shadow-xl w-96 fixed right-0 top-0 z-50">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{project.title}</h2>
          <p className="text-xs text-slate-500">Project Details</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-2 hover:bg-slate-100 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-2 border-b border-slate-100 shrink-0">
        <div className="flex gap-2">
          {['comments', 'attachments', 'risks'].map((tab) => (
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
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        {activeTab === 'comments' && (
          <CommentSection entityType="projects" entityId={project.id} />
        )}

        {activeTab === 'attachments' && (
          <AttachmentList entityType="projects" entityId={project.id} />
        )}

        {activeTab === 'risks' && (
          <RiskRegister projectId={project.id} />
        )}
      </div>
    </div>
  );
}
