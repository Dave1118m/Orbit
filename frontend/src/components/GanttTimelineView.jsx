import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, AlertCircle, RefreshCw, ArrowRight, ChevronDown, ChevronRight, Layers, SlidersHorizontal, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import TaskDetailsDrawer from './TaskDetailsDrawer';

const API_URL = `${import.meta.env.VITE_API_URL}/tasks`;
const POSTPONEMENTS_URL = `${import.meta.env.VITE_API_URL}/projects`;

/**
 * Clean & Minimal Gantt Timeline View
 * Uses sleek pill buttons, collapsible audit logs, and minimal clean text.
 */
export default function GanttTimelineView({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [postponements, setPostponements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState('week'); // 'day' | 'week' | 'month'
  const [highlightCriticalPath, setHighlightCriticalPath] = useState(true);
  const [showPostponements, setShowPostponements] = useState(false);
  const [taskLogframeMap, setTaskLogframeMap] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);

  // Fetch real backend data
  const fetchData = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const tasksRes = await fetch(`${API_URL}?projectId=${projectId}`, { headers });
      if (!tasksRes.ok) throw new Error('Failed to fetch project tasks');
      const tasksData = await tasksRes.json();

      const depPromises = tasksData.map(async (task) => {
        try {
          const depRes = await fetch(`${API_URL}/${task.id}/dependencies`, { headers });
          if (depRes.ok) {
            const deps = await depRes.json();
            return deps.map(d => ({ taskId: task.id, dependsOnTaskId: d.dependsOnTaskId, dependencyType: d.dependencyType }));
          }
        } catch (e) {
          console.error(`Failed to fetch dependencies for task ${task.id}`, e);
        }
        return [];
      });
      const allDepsArray = await Promise.all(depPromises);
      const allDeps = allDepsArray.flat();

      let postData = [];
      try {
        const postRes = await fetch(`${POSTPONEMENTS_URL}/${projectId}/postponements`, { headers });
        if (postRes.ok) {
          postData = await postRes.json();
        }
      } catch (e) {
        console.warn('Postponements endpoint error:', e);
      }

      // Fetch Logframe to map Logframe Activities to Tasks
      let lfMap = {};
      try {
        const lfRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/logframe`, { headers });
        if (lfRes.ok) {
          const lfData = await lfRes.json();
          // Extract activities
          lfData.goals?.forEach(g => {
            g.outcomes?.forEach(o => {
              o.outputs?.forEach(p => {
                p.activities?.forEach(a => {
                  if (a.linkedTaskId) {
                    lfMap[String(a.linkedTaskId)] = a.description;
                  }
                });
              });
            });
          });
        }
      } catch (e) {
        console.warn('Logframe fetch error:', e);
      }

      setTasks(tasksData);
      setDependencies(allDeps);
      setPostponements(postData);
      setTaskLogframeMap(lfMap);
    } catch (err) {
      setError(err.message || 'Error loading timeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  // Timeline Scale bounds and dates
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { minDate: start, maxDate: end, totalDays: 60 };
    }

    let min = new Date();
    let max = new Date();
    let hasValidDates = false;

    tasks.forEach(t => {
      const start = t.createdAt ? new Date(t.createdAt) : new Date();
      const end = t.deadline ? new Date(t.deadline) : new Date(start.getTime() + 7 * 86400000);
      if (!hasValidDates) {
        min = new Date(start);
        max = new Date(end);
        hasValidDates = true;
      } else {
        if (start < min) min = new Date(start);
        if (end > max) max = new Date(end);
      }
    });

    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 5);
    const diffMs = max.getTime() - min.getTime();
    const days = Math.max(14, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return { minDate: min, maxDate: max, totalDays: days };
  }, [tasks]);

  // Critical path computation
  const criticalTaskIds = useMemo(() => {
    if (!highlightCriticalPath || tasks.length === 0) return new Set();
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const graph = new Map();
    
    tasks.forEach(t => graph.set(t.id, []));
    dependencies.forEach(dep => {
      if (graph.has(dep.dependsOnTaskId)) {
        graph.get(dep.dependsOnTaskId).push(dep.taskId);
      }
    });

    const duration = (t) => {
      const start = t.createdAt ? new Date(t.createdAt) : new Date();
      const end = t.deadline ? new Date(t.deadline) : new Date(start.getTime() + 7 * 86400000);
      return Math.max(1, Math.ceil((end - start) / 86400000));
    };

    let maxDist = 0;
    let criticalPath = [];

    const dfs = (currId, currentPath, currentDist) => {
      const currTask = taskMap.get(currId);
      if (!currTask) return;
      const d = duration(currTask);
      const newDist = currentDist + d;
      const newPath = [...currentPath, currId];

      const neighbors = graph.get(currId) || [];
      if (neighbors.length === 0) {
        if (newDist > maxDist) {
          maxDist = newDist;
          criticalPath = newPath;
        }
      } else {
        neighbors.forEach(nextId => dfs(nextId, newPath, newDist));
      }
    };

    tasks.forEach(t => dfs(t.id, [], 0));
    return new Set(criticalPath);
  }, [tasks, dependencies, highlightCriticalPath]);

  // Dependency conflict detection (Finish-to-Start violations)
  const conflictingTaskIds = useMemo(() => {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const conflicts = new Set();
    dependencies.forEach(dep => {
      const task = taskMap.get(dep.taskId);
      const prereq = taskMap.get(dep.dependsOnTaskId);
      if (task && prereq && task.startDate && prereq.deadline) {
        const taskStart = new Date(task.startDate);
        const prereqEnd = new Date(prereq.deadline);
        if (taskStart < prereqEnd) {
          conflicts.add(dep.taskId);
        }
      }
    });
    return conflicts;
  }, [tasks, dependencies]);

  // Calculate Gantt bar positions
  const getBarPosition = (task) => {
    const start = task.createdAt ? new Date(task.createdAt) : minDate;
    const end = task.deadline ? new Date(task.deadline) : new Date(start.getTime() + 7 * 86400000);

    const startDiff = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const durationDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const leftPercent = (startDiff / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;

    return {
      left: `${Math.min(98, Math.max(0, leftPercent))}%`,
      width: `${Math.min(100 - leftPercent, Math.max(3, widthPercent))}%`,
      durationDays: Math.ceil(durationDays)
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Loading Timeline Schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-700 text-xs">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden text-xs space-y-0">
      
      {/* ── Sleek Minimal Controls Bar (Pills & Dropdowns) ── */}
      <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        
        {/* Left Status Pills */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-xs">Gantt View</span>
          <span className="bg-slate-200/70 text-slate-700 font-semibold px-2 py-0.5 rounded-full text-[11px]">
            {tasks.length} Tasks
          </span>
          <span className="bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full text-[11px]">
            {Object.keys(taskLogframeMap).length} Linked
          </span>
          {conflictingTaskIds.size > 0 && (
            <span className="bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              {conflictingTaskIds.size} Date Conflict{conflictingTaskIds.size > 1 ? 's' : ''}
            </span>
          )}

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Quick Legend Pills */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Done
            </span>
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-brand-700 px-2 py-0.5 rounded-full font-medium border border-indigo-100">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Active
            </span>
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-medium border border-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Critical
            </span>
          </div>
        </div>

        {/* Right Controls: Zoom & Critical Toggle */}
        <div className="flex items-center gap-2">
          {/* Critical Path Toggle Pill */}
          <button
            onClick={() => setHighlightCriticalPath(!highlightCriticalPath)}
            className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition flex items-center gap-1.5 ${
              highlightCriticalPath
                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Critical Path</span>
          </button>

          {/* Zoom Level Dropdown Select */}
          <div className="relative">
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-full pl-3 pr-7 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 focus:outline-none cursor-pointer shadow-2xs"
            >
              <option value="day">Zoom: Days</option>
              <option value="week">Zoom: Weeks</option>
              <option value="month">Zoom: Months</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Clean Timeline Grid View ── */}
      {tasks.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No tasks scheduled.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px] p-3 space-y-2">
            
            {/* Minimal Header Dates */}
            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100 px-2">
              <div className="w-1/3">Task</div>
              <div className="w-16 text-center">Days</div>
              <div className="w-2/3 flex justify-between pl-3 pr-1">
                <span>{minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>{maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            {/* Task Rows */}
            <div className="space-y-1.5">
              {tasks.map((t, idx) => {
                const bar = getBarPosition(t);
                const isCritical = criticalTaskIds.has(t.id);
                const isDone = t.status === 3 || t.status === 'Done';

                return (
                  <div key={t.id} className="flex items-center hover:bg-slate-50/80 p-1.5 rounded-xl transition group cursor-pointer" onClick={() => setSelectedTask(t)}>
                    
                    {/* Task Title Pill */}
                  <div className="w-1/3 pr-2 flex flex-col justify-center overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-emerald-500' : isCritical ? 'bg-amber-500' : 'bg-brand-500'}`} />
                        <span className="font-semibold text-slate-800 truncate" title={t.title}>
                          {t.title}
                        </span>
                        {conflictingTaskIds.has(t.id) && (
                          <span title="⚠ Date conflict: this task starts before its prerequisite ends" className="ml-auto shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            Conflict
                          </span>
                        )}
                      </div>
                      {taskLogframeMap[String(t.id)] && (
                        <div className="ml-3.5 mt-0.5 flex items-center gap-1 text-[9px] text-amber-600 font-medium bg-amber-50 rounded px-1 py-0.5 w-fit border border-amber-100 shadow-sm">
                          <Layers className="w-2.5 h-2.5" />
                          <span className="truncate">{taskLogframeMap[String(t.id)]}</span>
                        </div>
                      )}
                    </div>

                    {/* Duration Badge */}
                    <div className="w-16 text-center font-mono text-[10px] text-slate-500">
                      {bar.durationDays}d
                    </div>

                    {/* Horizontal Bar Canvas */}
                    <div className="w-2/3 relative h-6 bg-slate-100/60 rounded-lg overflow-hidden border border-slate-200/50">
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded-md transition-all duration-300 flex items-center px-2 shadow-2xs ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isCritical
                            ? 'bg-amber-500 text-white'
                            : 'bg-brand-500 text-white'
                        }`}
                        style={{ left: bar.left, width: bar.width }}
                        title={`${t.title} (${bar.durationDays} days)`}
                      >
                        <span className="text-[10px] font-semibold truncate">
                          {t.title}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collapsible Postponements Dropdown Accordion */}
            {postponements.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowPostponements(!showPostponements)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-amber-50/60 hover:bg-amber-100/50 text-amber-800 font-semibold text-[11px] transition"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>Timeline Extensions / Postponement History ({postponements.length})</span>
                  </div>
                  {showPostponements ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {showPostponements && (
                  <div className="mt-2 space-y-1 pl-2">
                    {postponements.map((p, idx) => (
                      <div key={idx} className="text-[11px] bg-white p-2 rounded-lg border border-amber-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <span className="line-through text-slate-400">{new Date(p.oldEndDate).toLocaleDateString()}</span>
                          <ArrowRight className="w-3 h-3 text-amber-600" />
                          <span className="font-bold text-amber-700">{new Date(p.newEndDate).toLocaleDateString()}</span>
                        </div>
                        <span className="text-slate-500 italic text-[10px]">"{p.reason || 'No reason specified'}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
      {selectedTask && (
        <TaskDetailsDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </>
  );
}
