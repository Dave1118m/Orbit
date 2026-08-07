import React, { useEffect, useState, useRef } from 'react';
import { createOrGetConnection, joinProjectGroup, leaveProjectGroup, onEvent, offEvent } from '../lib/signalrClient';
import { useUser } from '../contexts/UserContext';

const rawApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://localhost:7065';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');

export default function RiskRegister({ projectId }) {
  const { hasPermission } = useUser();
  const canEditRisk = hasPermission('RiskLogEdit');
  const canCreateIssue = hasPermission('IssueCreate');

  const [activeTab, setActiveTab] = useState('Risk'); // 'Risk' | 'Issue'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [expandedId, setExpandedId] = useState(null);
  const connRef = useRef(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(getInitialForm('Risk'));

  function getInitialForm(type) {
    return {
      type: type,
      description: '',
      likelihood: '',
      impact: '',
      likelihoodScore: 1,
      impactScore: 1,
      mitigationPlan: '',
      owner: '',
      status: 'Open',
      resolutionNotes: '',
    };
  }

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');

    const init = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted) setItems(data);
        }

        const conn = await createOrGetConnection(token);
        connRef.current = conn;
        try {
          if (conn) {
            setConnectionStatus(conn.state?.toLowerCase() || 'disconnected');
            conn.onclose(() => setConnectionStatus('disconnected'));
            conn.onreconnecting(() => setConnectionStatus('reconnecting'));
            conn.onreconnected(() => setConnectionStatus('connected'));
          }
        } catch (e) {}

        joinProjectGroup(conn, projectId);

        const createdHandler = (r) => setItems(prev => [normalizeServerRisk(r), ...prev]);
        const updatedHandler = (r) => setItems(prev => prev.map(x => x.id === r.Id || x.id === r.id ? { ...x, ...normalizeServerRisk(r) } : x));
        const deletedHandler = (r) => setItems(prev => prev.filter(x => x.id !== (r.Id ?? r.id)));

        onEvent(conn, 'RiskIssueCreated', createdHandler);
        onEvent(conn, 'RiskIssueUpdated', updatedHandler);
        onEvent(conn, 'RiskIssueDeleted', deletedHandler);

        return () => {
          try {
            offEvent(conn, 'RiskIssueCreated', createdHandler);
            offEvent(conn, 'RiskIssueUpdated', updatedHandler);
            offEvent(conn, 'RiskIssueDeleted', deletedHandler);
            leaveProjectGroup(conn, projectId);
          } catch (e) { }
        };
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const cleanupPromise = init();
    return () => { mounted = false; cleanupPromise.then(fn => fn && fn()); };
  }, [projectId]);

  function normalizeServerRisk(r) {
    return {
      id: r.Id ?? r.id,
      projectId: r.ProjectId ?? r.projectId,
      type: (r.Type ?? r.type) || 'Risk',
      description: r.Description ?? r.description,
      likelihood: r.Likelihood ?? r.likelihood,
      impact: r.Impact ?? r.impact,
      likelihoodScore: r.LikelihoodScore ?? r.likelihoodScore ?? 1,
      impactScore: r.ImpactScore ?? r.impactScore ?? 1,
      riskScore: r.RiskScore ?? r.riskScore ?? ((r.LikelihoodScore ?? 1) * (r.ImpactScore ?? 1)),
      mitigationPlan: r.MitigationPlan ?? r.mitigationPlan,
      owner: r.Owner ?? r.owner,
      status: r.Status ?? r.status,
      resolutionNotes: r.ResolutionNotes ?? r.resolutionNotes,
      resolvedAt: r.ResolvedAt ?? r.resolvedAt,
      resolvedByUserId: r.ResolvedByUserId ?? r.resolvedByUserId,
      createdAt: r.CreatedAt ?? r.createdAt
    };
  }

  const handleChange = (e) => {
    const val = e.target.type === 'number' || e.target.type === 'range' ? parseInt(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const openCreateForm = () => {
    setForm(getInitialForm(activeTab));
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item) => {
    setForm({
      ...item,
      likelihoodScore: item.likelihoodScore || 1,
      impactScore: item.impactScore || 1
    });
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const url = editingId 
      ? `${API_BASE}/api/v1/projects/${projectId}/risks/${editingId}`
      : `${API_BASE}/api/v1/projects/${projectId}/risks`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setIsFormOpen(false);
        const data = await res.json();
        if (!editingId) {
          setItems(prev => [normalizeServerRisk(data), ...prev]);
        } else {
          setItems(prev => prev.map(r => r.id === editingId ? normalizeServerRisk(data) : r));
        }
      } else {
        const errText = await res.text();
        alert(`Operation failed (${res.status}): ${errText || 'Check permissions or input fields.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Operation failed');
    }
  };

  const handleResolve = async (id) => {
    const token = localStorage.getItem('token');
    const resolutionNotes = prompt("Enter resolution notes:");
    if (resolutionNotes === null) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolutionNotes, markResolved: true })
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(r => r.id === id ? normalizeServerRisk(data) : r));
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 204) {
        setItems(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) { console.error(err); }
  };

  const getScoreBadge = (score) => {
    if (score >= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Critical ({score})</span>;
    if (score >= 10) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">High ({score})</span>;
    if (score >= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Medium ({score})</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Low ({score})</span>;
  };

  const filteredItems = items.filter(i => i.type === activeTab);

  if (loading) return <div className="text-sm text-slate-500 p-4">Loading register...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('Risk')}
            className={`text-sm font-semibold pb-4 -mb-4 transition-colors ${activeTab === 'Risk' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Risks ({items.filter(i=>i.type==='Risk').length})
          </button>
          <button 
            onClick={() => setActiveTab('Issue')}
            className={`text-sm font-semibold pb-4 -mb-4 transition-colors ${activeTab === 'Issue' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Issues ({items.filter(i=>i.type==='Issue').length})
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
            <span className="text-xs text-slate-500 capitalize">{connectionStatus}</span>
          </div>
          
          {(activeTab === 'Risk' && canEditRisk) || (activeTab === 'Issue' && canCreateIssue) ? (
            <button onClick={openCreateForm} className={`px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm transition ${activeTab === 'Risk' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-rose-500 hover:bg-rose-600'}`}>
              + Add {activeTab}
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        
        {/* Form Panel */}
        {isFormOpen && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">{editingId ? 'Edit' : 'New'} {activeTab}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description *</label>
                <textarea required name="description" value={form.description} onChange={handleChange} rows={2} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none" placeholder={`Describe the ${activeTab.toLowerCase()}...`} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Likelihood Label</label>
                  <input name="likelihood" value={form.likelihood} onChange={handleChange} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="e.g. Rare, Probable" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Likelihood Score: {form.likelihoodScore}</label>
                  <input type="range" name="likelihoodScore" min="1" max="5" value={form.likelihoodScore} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1</span><span>5</span></div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Impact Label</label>
                  <input name="impact" value={form.impact} onChange={handleChange} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="e.g. Minor, Severe" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Impact Score: {form.impactScore}</label>
                  <input type="range" name="impactScore" min="1" max="5" value={form.impactScore} onChange={handleChange} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1</span><span>5</span></div>
                </div>
              </div>

              {activeTab === 'Risk' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mitigation Plan</label>
                  <textarea name="mitigationPlan" value={form.mitigationPlan} onChange={handleChange} rows={2} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="How to prevent or handle it..." />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Owner</label>
                  <input name="owner" value={form.owner} onChange={handleChange} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="Who is responsible?" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-brand-500 focus:outline-none bg-white">
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Mitigated</option>
                    <option>Closed</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
                <button type="submit" className={`px-6 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition ${activeTab === 'Risk' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-rose-500 hover:bg-rose-600'}`}>Save {activeTab}</button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {filteredItems.length === 0 && !isFormOpen && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <span className="text-3xl mb-3 block">{activeTab === 'Risk' ? '⚠️' : '🔥'}</span>
              <h4 className="text-sm font-semibold text-slate-700">No {activeTab}s recorded</h4>
              <p className="text-xs text-slate-500 mt-1">Keep track of potential risks and active issues here.</p>
            </div>
          )}
          
          {filteredItems.map(item => {
            const isExpanded = expandedId === item.id;
            const isResolved = item.resolvedAt != null;
            
            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md overflow-hidden">
                <div 
                  className="p-4 cursor-pointer flex items-center justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {getScoreBadge(item.riskScore)}
                      <span className="text-xs font-medium text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      {isResolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Resolved</span>
                      )}
                    </div>
                    <h4 className={`text-sm font-semibold truncate ${isResolved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.description}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Owner</p>
                      <p className="text-xs font-semibold text-slate-700">{item.owner || 'Unassigned'}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {item.status}
                      </span>
                    </div>
                    <svg className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Analysis</h5>
                        <div className="text-xs text-slate-700 grid grid-cols-2 gap-2">
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="block text-slate-400 mb-1">Likelihood</span>
                            <span className="font-semibold">{item.likelihood || '-'}</span> <span className="text-slate-400">({item.likelihoodScore}/5)</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="block text-slate-400 mb-1">Impact</span>
                            <span className="font-semibold">{item.impact || '-'}</span> <span className="text-slate-400">({item.impactScore}/5)</span>
                          </div>
                        </div>
                      </div>
                      
                      {item.type === 'Risk' && (
                        <div>
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mitigation Plan</h5>
                          <p className="text-xs text-slate-700 bg-white p-3 rounded border border-slate-200 whitespace-pre-wrap">
                            {item.mitigationPlan || <span className="italic text-slate-400">No plan documented.</span>}
                          </p>
                        </div>
                      )}

                      {item.type === 'Issue' && (
                        <div>
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resolution</h5>
                          <p className="text-xs text-slate-700 bg-white p-3 rounded border border-slate-200 whitespace-pre-wrap">
                            {item.resolutionNotes || <span className="italic text-slate-400">No resolution notes.</span>}
                          </p>
                          {item.resolvedAt && (
                            <p className="text-[10px] text-slate-500 mt-2">
                              Resolved on {new Date(item.resolvedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                      {item.type === 'Issue' && !isResolved && (canEditRisk || canCreateIssue) && (
                        <button onClick={() => handleResolve(item.id)} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition">
                          ✓ Mark Resolved
                        </button>
                      )}
                      
                      {canEditRisk && (
                        <>
                          <button onClick={() => openEditForm(item)} className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 transition">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
