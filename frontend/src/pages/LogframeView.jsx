import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Modal from '../components/Modal';
import SearchSelect from '../components/SearchSelect';
import { parseApiResponse, showErrorToast } from '../utils/toastHelper';

const API_URL = `${import.meta.env.VITE_API_URL}`;

/**
 * Logical Framework (Logframe) Matrix page component.
 * Visualizes hierarchical Goal -> Outcome -> Output -> Activity results chains with linked KPIs/indicators,
 * operational task associations, and risk dependencies.
 */
export default function LogframeView() {
  const { projectId } = useParams();
  const { hasPermission } = useUser();
  const [logframe, setLogframe] = useState({ goals: [], indicators: [] });
  const [tasks, setTasks] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'goal', 'outcome', 'output', 'activity', 'indicator', 'link-task'
  const [modalData, setModalData] = useState({});
  const [parentId, setParentId] = useState(null);
  const [entityId, setEntityId] = useState(null);
  const [indicatorLevel, setIndicatorLevel] = useState(0);

  const canEdit = hasPermission('ProjectEdit');
  const orgId = localStorage.getItem('selectedOrganizationId') || localStorage.getItem('selectedOrgId');
  const activePersona = localStorage.getItem('activePersona');
  const authHeaders = {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
    ...(orgId ? { 'X-Organization-Id': String(orgId) } : {}),
    ...(activePersona ? { 'X-Active-Role': activePersona } : {})
  };

  useEffect(() => {
    fetchLogframe();
    fetchTasks();
    fetchRisks();
  }, [projectId]);

  /**
   * Loads the structured logframe tree (goals, outcomes, outputs, activities, indicators) for this project.
   */
  const fetchLogframe = async () => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}/logframe`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch logframe');
      const data = await response.json();
      setLogframe(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches project tasks for linking to logframe operational activities.
   */
  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks?projectId=${projectId}`, { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Fetches risk register items linked to project logframe objectives.
   */
  const fetchRisks = async () => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}/risks`, { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        // Keep all risks that are of type Risk (including closed/mitigated) so they can be shown on the Logframe
        setRisks(data.filter(r => r.type === 'Risk'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIndicators = (levelInt, eId) => {
    return (logframe.indicators || []).filter(i => i.levelInt === levelInt && i.entityId === eId);
  };

  const openModal = (type, mode = 'create', data = {}) => {
    setModalType({ type, mode });
    setModalData(mode === 'create' ? data : { ...data });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalData({});
    setModalType(null);
    setParentId(null);
    setEntityId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    const { type, mode } = modalType;
    const pluralType = type === 'activity' ? 'activities' : `${type}s`;
    let url = `${API_URL}/projects/${projectId}/logframe/${pluralType}`;
    let method = mode === 'create' ? 'POST' : 'PUT';
    
    if (mode === 'edit') url += `/${modalData.id}`;
    if (type === 'indicator' && mode === 'edit') url = `${API_URL}/projects/${projectId}/logframe/indicators/${modalData.id}`;

    let body = { ...modalData };

    if (mode === 'edit' && type !== 'indicator') {
      body = { description: modalData.description || '' };
    }

    if (mode === 'create') {
      if (type === 'outcome') body.goalId = parentId;
      if (type === 'output') body.outcomeId = parentId;
      if (type === 'activity') body.outputId = parentId;
      if (type === 'indicator') {
        body.level = indicatorLevel;
        body.entityId = entityId;
      }
    }

    try {
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
      if (res.ok) {
        const savedEntity = await res.json();

        // Auto-create linked indicator if indicator fields were filled during creation
        if (mode === 'create' && type !== 'indicator' && modalData.indicatorName) {
          const levelEnumMap = { goal: 'Goal', outcome: 'Outcome', output: 'Output', activity: 'Activity' };
          const levelStr = levelEnumMap[type] || 'Goal';
          const entityId = savedEntity.id;

          await fetch(`${API_URL}/projects/${projectId}/logframe/indicators`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              level: levelStr,
              entityId: entityId,
              name: modalData.indicatorName,
              baseline: modalData.baseline || '0',
              target: modalData.target || '100',
              actual: modalData.baseline || '0',
              unit: modalData.unit || '%',
              notes: modalData.notes || ''
            })
          });
        }

        fetchLogframe();
        handleCloseModal();
      } else {
        const errText = await parseApiResponse(res);
        console.error('Logframe save error:', res.status, errText);
        showErrorToast(`Action failed: ${errText || 'Check your permissions or input data.'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (type, id) => {
    if (!canEdit) return;
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const pluralType = type === 'activity' ? 'activities' : `${type}s`;
      const url = `${API_URL}/projects/${projectId}/logframe/${pluralType}/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers: authHeaders });
      if (res.ok) {
        fetchLogframe();
      } else {
        showErrorToast('Failed to delete item.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkTask = async (activityId, taskId) => {
    if (!canEdit) return;
    try {
      const url = `${API_URL}/projects/${projectId}/logframe/activities/${activityId}/link-task`;
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ taskId: taskId ? parseInt(taskId) : null })
      });
      if (res.ok) {
        fetchLogframe();
        handleCloseModal();
      } else {
        showErrorToast('Failed to link task.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportLogframe = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/projects/${projectId}/logframe/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        showErrorToast('Failed to export logframe CSV');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Logframe_Project_${projectId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Export CSV failed', err);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-xl text-slate-400">Loading Logframe canvas...</div>
    </div>
  );

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-xl text-red-400">Error: {error}</div>
    </div>
  );

  // ── Progress Bar component ─────────────────────────────────────────────────
  const ProgressBar = ({ value, label, size = 'md' }) => {
    if (value === null || value === undefined) return null;
    const pct = Math.min(Math.max(Number(value), 0), 100);
    const color = pct >= 100 ? 'from-emerald-500 to-emerald-400'
                : pct >= 60  ? 'from-blue-500 to-indigo-400'
                : pct >= 30  ? 'from-amber-500 to-yellow-400'
                :              'from-red-500 to-rose-400';
    const heightCls = size === 'sm' ? 'h-1' : 'h-1.5';
    return (
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>}
          <span className={`text-[11px] font-bold ml-auto ${
            pct >= 100 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : pct >= 30 ? 'text-amber-400' : 'text-red-400'
          }`}>{pct.toFixed(pct % 1 === 0 ? 0 : 1)}%</span>
        </div>
        <div className={`w-full ${heightCls} bg-slate-800 rounded-full overflow-hidden`}>
          <div
            className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const RiskBadge = ({ level, entityId }) => {
    const linkedRisks = risks.filter(r => r.logframeLevel === level && parseInt(r.logframeEntityId) === entityId);
    if (!linkedRisks.length) return null;
    
    const activeRisks = linkedRisks.filter(r => r.status !== 'Closed' && r.status !== 'Mitigated' && r.status !== 'Resolved');
    const resolvedRisks = linkedRisks.filter(r => r.status === 'Closed' || r.status === 'Mitigated' || r.status === 'Resolved');
    
    return (
      <div className="flex flex-col gap-1 mt-2">
        {activeRisks.length > 0 && (() => {
          const maxScore = Math.max(...activeRisks.map(r => r.impactScore * r.likelihoodScore));
          const isCritical = maxScore >= 15;
          const isHigh = maxScore >= 10;
          
          const color = isCritical ? 'bg-red-500/20 text-red-400 border-red-500/50' 
                      : isHigh ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/50';

          return (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold w-fit ${color}`} title={`${activeRisks.length} active risk(s) threatening this ${level}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {activeRisks.length} Active Risk{activeRisks.length > 1 ? 's' : ''}
            </div>
          );
        })()}

        {resolvedRisks.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold w-fit bg-emerald-500/20 text-emerald-400 border-emerald-500/50" title={`${resolvedRisks.length} mitigated or resolved risk(s)`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {resolvedRisks.length} Mitigated Risk{resolvedRisks.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  const EditControls = ({ type, data, addSubLabel, onAddSub, onAddIndicator }) => {
    if (!canEdit) return null;
    return (
      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700/50 justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button onClick={() => openModal(type, 'edit', data)} title="Edit" className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => handleDelete(type, data.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={onAddIndicator} title="Add Indicator" className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded border border-slate-600 transition-colors">
            + Ind
          </button>
          {addSubLabel && (
            <button onClick={onAddSub} className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white rounded border border-indigo-500/30 transition-colors">
              + {addSubLabel}
            </button>
          )}
        </div>
      </div>
    );
  };

  const IndicatorPanel = ({ type, entityId, levelInt }) => {
    const inds = getIndicators(levelInt, entityId);
    if (!inds.length) return null;
    return (
      <div className="mt-4 space-y-2">
        {inds.map(ind => {
          const actual = parseFloat(ind.actual) || 0;
          const target = parseFloat(ind.target) || 0;
          const baseline = parseFloat(ind.baseline) || 0;
          const max = Math.max(target, actual, baseline) || 1;
          const isGood = actual >= target;
          const isWarning = actual >= baseline && actual < target;
          const colorClass = isGood ? 'bg-emerald-500' : (isWarning ? 'bg-amber-500' : 'bg-red-500');
          const pct = Math.min(Math.max((actual / max) * 100, 0), 100);

          return (
            <div key={ind.id} className="relative group/ind rounded border border-slate-700 bg-slate-900/60 p-3">
              {canEdit && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/ind:opacity-100 transition-opacity">
                  <button onClick={() => openModal('indicator', 'edit', ind)} className="p-1 text-slate-400 hover:text-white"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                  <button onClick={() => handleDelete('indicator', ind.id)} className="p-1 text-slate-400 hover:text-red-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
              )}
              <div className="font-semibold text-slate-300 text-xs pr-8">{ind.name}</div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-medium">
                <span>B: {ind.baseline}</span>
                <span>A: {ind.actual}</span>
                <span>T: {ind.target}</span>
                <span className="text-slate-500">{ind.unit}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
              </div>
              {ind.notes && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 leading-relaxed font-medium">
                  {ind.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const inputClass = "w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 font-sans text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-4 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <Link to="/projects" className="rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Project Logical Framework</h1>
            <p className="text-xs text-slate-400">Strategic planning & results hierarchy</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportLogframe} className="rounded-md bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 shadow-sm hover:bg-slate-700 hover:text-white transition-colors">
            Export CSV
          </button>
          {canEdit && (
            <button onClick={() => openModal('goal', 'create')} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors">
              + Add Goal
            </button>
          )}
        </div>
      </header>

      {/* Horizontal Canvas */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar relative z-0">
        <div className="flex h-full min-w-max gap-8 pb-4">
          
          {/* Goals Column */}
          <div className="flex w-[350px] flex-col">
            <h2 className="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
              1. Impact (Goals)
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {logframe.goals?.map(goal => (
                <div key={`goal-${goal.id}`} className="group relative rounded-xl border border-indigo-500/30 bg-slate-800/80 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-indigo-500 hover:shadow-indigo-500/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20">G</span>
                    Goal
                  </div>
                  <p className="text-sm font-medium text-white">{goal.description}</p>
                  
                  <RiskBadge level="Goal" entityId={goal.id} />

                  <ProgressBar value={goal.progress} label="Overall Progress" />

                  <IndicatorPanel type="goal" entityId={goal.id} levelInt={0} />
                  
                  <EditControls 
                    type="goal" 
                    data={goal} 
                    addSubLabel="Outcome" 
                    onAddSub={() => { setParentId(goal.id); openModal('outcome', 'create'); }}
                    onAddIndicator={() => { setEntityId(goal.id); setIndicatorLevel(0); openModal('indicator', 'create'); }}
                  />
                </div>
              ))}
              {logframe.goals?.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                  No goals defined yet.
                </div>
              )}
            </div>
          </div>

          {/* Outcomes Column */}
          <div className="flex w-[350px] flex-col">
            <h2 className="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase">2. Outcomes</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {logframe.goals?.flatMap(g => g.outcomes)?.map(outcome => (
                <div key={`outcome-${outcome.id}`} className="group relative rounded-xl border border-emerald-500/30 bg-slate-800/80 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500 hover:shadow-emerald-500/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">O</span>
                    Outcome
                  </div>
                  <p className="text-sm font-medium text-white">{outcome.description}</p>
                  
                  <RiskBadge level="Outcome" entityId={outcome.id} />

                  <ProgressBar value={outcome.progress} label="Avg. Progress" />

                  <IndicatorPanel type="outcome" entityId={outcome.id} levelInt={1} />

                  <EditControls 
                    type="outcome" 
                    data={outcome} 
                    addSubLabel="Output" 
                    onAddSub={() => { setParentId(outcome.id); openModal('output', 'create'); }}
                    onAddIndicator={() => { setEntityId(outcome.id); setIndicatorLevel(1); openModal('indicator', 'create'); }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Outputs Column */}
          <div className="flex w-[350px] flex-col">
            <h2 className="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase">3. Outputs</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {logframe.goals?.flatMap(g => g.outcomes)?.flatMap(o => o.outputs)?.map(output => (
                <div key={`output-${output.id}`} className="group relative rounded-xl border border-cyan-500/30 bg-slate-800/80 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500 hover:shadow-cyan-500/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20">P</span>
                    Output
                  </div>
                  <p className="text-sm font-medium text-white">{output.description}</p>

                  <RiskBadge level="Output" entityId={output.id} />

                  <ProgressBar value={output.progress} label="Avg. Progress" />

                  <IndicatorPanel type="output" entityId={output.id} levelInt={2} />

                  <EditControls 
                    type="output" 
                    data={output} 
                    addSubLabel="Activity" 
                    onAddSub={() => { setParentId(output.id); openModal('activity', 'create'); }}
                    onAddIndicator={() => { setEntityId(output.id); setIndicatorLevel(2); openModal('indicator', 'create'); }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Activities Column */}
          <div className="flex w-[350px] flex-col">
            <h2 className="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase">4. Activities</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {logframe.goals?.flatMap(g => g.outcomes)?.flatMap(o => o.outputs)?.flatMap(p => p.activities)?.map(activity => (
                <div key={`activity-${activity.id}`} className="group relative rounded-xl border border-amber-500/30 bg-slate-800/80 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-amber-500 hover:shadow-amber-500/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">A</span>
                    Activity
                  </div>
                  <p className="text-sm font-medium text-white">{activity.description}</p>

                  {/* Activity-level task progress bar */}
                  <ProgressBar value={activity.taskProgress} size="sm" />

                  {/* Linked Task Badge */}
                  {activity.linkedTaskId ? (
                    <div className="mt-3 rounded border border-slate-700 bg-slate-900/50 p-2 text-xs flex justify-between items-center group/task">
                      <div className="truncate pr-2">
                        <span className="text-slate-500 mr-1">Task:</span> 
                        <span className="font-semibold text-slate-300">{activity.linkedTaskTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {activity.taskProgress !== null && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activity.taskProgress === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {activity.taskProgress}%
                          </span>
                        )}
                        {canEdit && (
                          <button onClick={() => openModal('link-task', 'edit', activity)} className="opacity-0 group-hover/task:opacity-100 text-slate-400 hover:text-white" title="Change linked task">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    canEdit && (
                      <button onClick={() => openModal('link-task', 'edit', activity)} className="mt-3 w-full rounded border border-dashed border-slate-600 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-colors">
                        + Link Task
                      </button>
                    )
                  )}

                  <IndicatorPanel type="activity" entityId={activity.id} levelInt={3} />

                  <EditControls 
                    type="activity" 
                    data={activity} 
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* CRUD Modal */}
      {modalOpen && modalType && modalType.type !== 'link-task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-5 text-lg font-bold text-white capitalize">
              {modalType.mode} {modalType.type}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Common Description & Extended Logframe Fields (Not for standalone indicators) */}
              {modalType.type !== 'indicator' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-400">
                      {modalType.type.toUpperCase()} Statement / Objective *
                    </label>
                    <textarea 
                      required 
                      rows={3} 
                      value={modalData.description || ''} 
                      onChange={e => setModalData({...modalData, description: e.target.value})} 
                      className={inputClass} 
                    />
                  </div>

                  {modalType.mode === 'create' && modalType.type !== 'activity' && (
                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Linked Key Indicator (OVI)
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">Indicator (OVI) Name</label>
                        <input 
                          type="text" 
                          value={modalData.indicatorName || ''} 
                          onChange={e => setModalData({...modalData, indicatorName: e.target.value})} 
                          className={inputClass} 
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Baseline</label>
                          <input 
                            type="text" 
                            value={modalData.baseline || ''} 
                            onChange={e => setModalData({...modalData, baseline: e.target.value})} 
                            className={inputClass} 
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Target</label>
                          <input 
                            type="text" 
                            value={modalData.target || ''} 
                            onChange={e => setModalData({...modalData, target: e.target.value})} 
                            className={inputClass} 
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">Unit</label>
                          <input 
                            type="text" 
                            value={modalData.unit || ''} 
                            onChange={e => setModalData({...modalData, unit: e.target.value})} 
                            className={inputClass} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Indicator Fields */}
              {modalType.type === 'indicator' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-400">Indicator Name *</label>
                    <input required type="text" value={modalData.name || ''} onChange={e => setModalData({...modalData, name: e.target.value})} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-400">Baseline</label>
                      <input required type="text" value={modalData.baseline || ''} onChange={e => setModalData({...modalData, baseline: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-400">Target</label>
                      <input required type="text" value={modalData.target || ''} onChange={e => setModalData({...modalData, target: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-400">Actual</label>
                      <input required type="text" value={modalData.actual || ''} onChange={e => setModalData({...modalData, actual: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-400">Unit *</label>
                    <input required type="text" value={modalData.unit || ''} onChange={e => setModalData({...modalData, unit: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-400">Notes (Optional)</label>
                    <textarea rows={2} value={modalData.notes || ''} onChange={e => setModalData({...modalData, notes: e.target.value})} className={inputClass} />
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Task Modal */}
      {modalOpen && modalType && modalType.type === 'link-task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-white">Link Task to Activity</h3>
            <p className="text-sm text-slate-400 mb-4 truncate">{modalData.description}</p>
            <form onSubmit={e => { e.preventDefault(); handleLinkTask(modalData.id, modalData.linkedTaskId); }} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-400">Select Project Task</label>
                <SearchSelect
                  options={tasks.map(t => ({ value: t.id, label: `${t.title} (${t.status === 4 ? 'Done' : 'Open'})` }))}
                  value={modalData.linkedTaskId ? parseInt(modalData.linkedTaskId) : null}
                  onChange={val => setModalData({...modalData, linkedTaskId: val ? String(val) : ''})}
                  placeholder="None (Unlink)"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm">Save Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.8);
        }
      `}} />
    </div>
  );
}
