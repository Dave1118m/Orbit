import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Priority badge colors derived from task priorities within a project.
 * Not hardcoded — dynamically calculated from the highest-priority task.
 */
const PRIORITY_CONFIG = {
  3: { label: 'URGENT', className: 'bg-red-100 text-red-600' },
  2: { label: 'HIGH', className: 'bg-orange-100 text-orange-600' },
  1: { label: 'MEDIUM', className: 'bg-yellow-100 text-yellow-600' },
  0: { label: 'LOW', className: 'bg-green-100 text-green-600' },
};

/**
 * Avatar color rotation — deterministic per user name.
 */
const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-teal-500',
];

function getAvatarColor(name) {
  if (!name) return 'bg-slate-400';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Formats a date to a short display string like "Jul 28".
 */
function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActiveProjectsList({ projects = [], tasks = [] }) {
  const navigate = useNavigate();

  // Compute enriched project data from real tasks
  const enrichedProjects = useMemo(() => {
    // Group tasks by projectId for efficient lookup
    const tasksMap = tasks.reduce((acc, t) => {
      const pid = t.projectId ?? t.ProjectId;
      if (!pid) return acc;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(t);
      return acc;
    }, {});

    // Show all non-deleted projects
    const activeProjects = projects.filter(p => {
      if (!p) return false;
      const isDel = p.isDeleted ?? p.IsDeleted;
      return !isDel;
    });

    return activeProjects.map(project => {
      const pId = project.id ?? project.Id;
      const projectTasks = tasksMap[pId] || [];
      const totalTasks = projectTasks.length;
      const doneTasks = projectTasks.filter(t => {
        const s = t.status ?? t.Status;
        return s === 4 || s === 'Done';
      }).length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // Determine highest priority
      let highestPriority = 0;
      projectTasks.forEach(t => {
        const prio = t.priority ?? t.Priority ?? 0;
        if (prio > highestPriority) highestPriority = prio;
      });

      // Collect assigned user ids
      const assignedUsers = [];
      const seen = new Set();
      projectTasks.forEach(t => {
        const ids = (t.assignedUserIds ?? t.AssignedUserIds) || [];
        ids.forEach(uid => {
          if (!seen.has(uid)) {
            seen.add(uid);
            assignedUsers.push(uid);
          }
        });
      });

      return {
        ...project,
        id: pId,
        title: project.title || project.Title || 'Untitled Project',
        progress,
        totalTasks,
        doneTasks,
        highestPriority,
        assignedUserIds: assignedUsers,
      };
    }).slice(0, 10);
  }, [projects, tasks]);

  const priorityInfo = (priority) => {
    return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[0];
  };

  const statusColor = (status) => {
    switch (status) {
      case 0:
      case 'Planning':
        return '#6b7280'; // gray
      case 1:
      case 'Active':
        return '#6366f1'; // indigo
      case 2:
      case 'OnHold':
        return '#f59e0b'; // amber
      case 3:
      case 'Completed':
        return '#22c55e'; // green
      default:
        return '#6366f1';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full lg:col-span-2">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-slate-900">Active Projects</h2>
        <button
          onClick={() => navigate('/projects')}
          className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1"
        >
          View all
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {enrichedProjects.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No projects found
          </div>
        ) : (
          enrichedProjects.map((project) => {
            const pInfo = priorityInfo(project.highestPriority);

            return (
              <div
                key={project.id}
                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate('/projects')}
              >
                {/* Project icon */}
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>

                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{project.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pInfo.className}`}>
                      {pInfo.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: statusColor(project.status ?? project.Status),
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 w-10 text-right">
                      {project.progress}%
                    </span>
                  </div>
                </div>

                {/* Deadline */}
                {project.endDate && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDeadline(project.endDate)}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
