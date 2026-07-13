import React, { useEffect, useState, useRef } from 'react';
import { createOrGetConnection, joinProjectGroup, leaveProjectGroup, onEvent, offEvent } from '../lib/signalrClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7065';

export default function RiskRegister({ projectId }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [form, setForm] = useState({ type: 'Risk', likelihood: '', impact: '', owner: '', status: 'Open' });
  const connRef = useRef(null);

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
          if (mounted) setRisks(data);
        }

        const conn = await createOrGetConnection(token);
        connRef.current = conn;
        // reflect connection state in UI
        try {
          if (conn) {
            const state = conn.state || 'Disconnected';
            setConnectionStatus(state.toLowerCase());
            conn.onclose(() => setConnectionStatus('disconnected'));
            conn.onreconnecting(() => setConnectionStatus('reconnecting'));
            conn.onreconnected(() => setConnectionStatus('connected'));
          }
        } catch (e) { /* ignore */ }

        joinProjectGroup(conn, projectId);

        const createdHandler = (r) => setRisks(prev => [normalizeServerRisk(r), ...prev]);
        const updatedHandler = (r) => setRisks(prev => prev.map(x => x.id === r.Id || x.id === r.id ? { ...x, ...normalizeServerRisk(r) } : x));
        const deletedHandler = (r) => setRisks(prev => prev.filter(x => x.id !== (r.Id ?? r.id)));

        onEvent(conn, 'RiskIssueCreated', createdHandler);
        onEvent(conn, 'RiskIssueUpdated', updatedHandler);
        onEvent(conn, 'RiskIssueDeleted', deletedHandler);

        // cleanup handlers on unmount
        return () => {
          try {
            offEvent(conn, 'RiskIssueCreated', createdHandler);
            offEvent(conn, 'RiskIssueUpdated', updatedHandler);
            offEvent(conn, 'RiskIssueDeleted', deletedHandler);
            leaveProjectGroup(conn, projectId);
          } catch (e) { console.error(e); }
        };
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
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
      likelihood: r.Likelihood ?? r.likelihood,
      impact: r.Impact ?? r.impact,
      owner: r.Owner ?? r.owner,
      status: r.Status ?? r.status
    };
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const created = await res.json();
        setRisks(prev => [created, ...prev]);
        setForm({ type: 'Risk', likelihood: '', impact: '', owner: '', status: 'Open' });
      } else {
        const t = await res.text();
        alert('Failed to create risk: ' + t);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create risk');
    }
  };

  const handleUpdate = async (riskId, updates) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks/${riskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setRisks(prev => prev.map(r => (r.id === updated.Id || r.id === updated.id) ? normalizeServerRisk(updated) : r));
      } else {
        alert('Failed to update');
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (riskId) => {
    if (!window.confirm('Delete this risk/issue?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/risks/${riskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 204) {
        setRisks(prev => prev.filter(r => r.id !== riskId));
      } else {
        alert('Failed to delete');
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading risks...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Real-time status:</div>
        <div className={`text-xs font-medium ${connectionStatus === 'connected' ? 'text-emerald-600' : connectionStatus === 'reconnecting' ? 'text-amber-600' : 'text-slate-500'}`}>
          {connectionStatus}
        </div>
      </div>
      <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
        <select name="type" value={form.type} onChange={handleChange} className="rounded-xl border px-3 py-2">
          <option>Risk</option>
          <option>Issue</option>
        </select>
        <input name="owner" placeholder="Owner" value={form.owner} onChange={handleChange} className="rounded-xl border px-3 py-2" />
        <input name="likelihood" placeholder="Likelihood" value={form.likelihood} onChange={handleChange} className="rounded-xl border px-3 py-2" />
        <input name="impact" placeholder="Impact" value={form.impact} onChange={handleChange} className="rounded-xl border px-3 py-2" />
        <select name="status" value={form.status} onChange={handleChange} className="rounded-xl border px-3 py-2">
          <option>Open</option>
          <option>Mitigated</option>
          <option>Closed</option>
        </select>
        <div className="flex items-center">
          <button className="rounded-full bg-brand-500 px-4 py-2 text-white">Add</button>
        </div>
      </form>

      <div className="mt-2 flex flex-col gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              // developer helper: simulate receiving a RiskIssueCreated event locally
              const mock = { id: Date.now(), projectId, Type: 'Risk', Likelihood: 'Low', Impact: 'Low', Owner: 'Dev', Status: 'Open' };
              setRisks(prev => [normalizeServerRisk(mock), ...prev]);
            }}
            className="mb-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
          >
            Simulate event
          </button>
        </div>
        {risks.length === 0 && <div className="text-sm text-slate-500">No risks or issues recorded.</div>}
        {risks.map(r => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase text-slate-600">{r.type || r.Type}</span>
                <h4 className="font-medium text-slate-900">Owner: {r.owner || r.Owner || 'Unassigned'}</h4>
              </div>
              <p className="text-sm text-slate-600">Likelihood: {r.likelihood || r.Likelihood}</p>
              <p className="text-sm text-slate-600">Impact: {r.impact || r.Impact}</p>
              <p className="text-xs text-slate-500">Status: {r.status || r.Status}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => {
                const newStatus = (r.status || r.Status) === 'Open' ? 'Closed' : 'Open';
                handleUpdate(r.id, { status: newStatus });
              }} className="text-sm text-brand-500">Toggle Status</button>
              <button onClick={() => handleDelete(r.id)} className="text-sm text-red-500">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
