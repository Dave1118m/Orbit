import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

const rawApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://localhost:7065';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');

export default function OrgRiskRollup({ orgId, onSelectProject }) {
  const { hasPermission } = useUser();
  const canView = hasPermission('RiskLogView');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'open', 'high', 'critical'
  const [expandedProjectId, setExpandedProjectId] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    fetchRollupData();
  }, [orgId]);

  const fetchRollupData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/risks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else if (res.status === 403) {
        setError('You do not have permission to view organization risk roll-ups.');
      } else {
        setError('Failed to load risk register roll-up.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error fetching risk data.');
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 text-sm text-center">
        🔒 You do not have permission to access the Organization Risk &amp; Issue Register.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm animate-pulse">
        Loading organization risk &amp; issue roll-up...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm text-center">
        {error}
      </div>
    );
  }

  if (!data || !data.projects || data.projects.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
        🛡️ No active projects or risk registers found in this organization.
      </div>
    );
  }

  const { summary, projects } = data;

  const filteredProjects = projects.filter(p => {
    if (filter === 'open') return (p.openRisks + p.openIssues) > 0;
    if (filter === 'high') return p.highSeverityCount > 0 || p.criticalCount > 0;
    if (filter === 'critical') return p.criticalCount > 0;
    return true;
  });

  const getSeverityBadge = (level) => {
    switch (level) {
      case 'Critical':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Critical</span>;
      case 'High':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">High</span>;
      case 'Medium':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">Medium</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">Low / Healthy</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Organization Risk &amp; Issue Register</h3>
          <p className="text-xs text-slate-500 mt-0.5">Roll-up review across all projects in {data.orgName}</p>
        </div>
        <button
          onClick={fetchRollupData}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-extrabold text-slate-800">{summary.totalOpenRisks ?? 0}</p>
          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span> Open Risks
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-extrabold text-rose-600">{summary.totalOpenIssues ?? 0}</p>
          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span> Active Issues
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-extrabold text-orange-600">{summary.totalHighSeverity ?? 0}</p>
          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500"></span> High Severity
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-extrabold text-red-600">{summary.totalCritical ?? 0}</p>
          <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping"></span> Critical Threats
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          {[
            { id: 'all', label: `All Projects (${projects.length})` },
            { id: 'open', label: `With Open Risks/Issues (${summary.projectsWithOpenItems ?? 0})` },
            { id: 'high', label: `High / Critical` },
            { id: 'critical', label: `Critical Only` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                filter === t.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Rollup Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No projects match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Project Name</th>
                  <th className="px-6 py-3.5 text-center">Open Risks</th>
                  <th className="px-6 py-3.5 text-center">Open Issues</th>
                  <th className="px-6 py-3.5 text-center">Max Score</th>
                  <th className="px-6 py-3.5 text-center">Severity</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map(proj => {
                  const isExpanded = expandedProjectId === proj.projectId;
                  const isHighAlert = proj.severityLevel === 'Critical' || proj.severityLevel === 'High';

                  return (
                    <React.Fragment key={proj.projectId}>
                      <tr 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isHighAlert ? 'bg-amber-50/20' : ''
                        }`}
                        onClick={() => setExpandedProjectId(isExpanded ? null : proj.projectId)}
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-2">
                          <span className="text-slate-400 text-xs">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          {proj.projectTitle}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            proj.openRisks > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {proj.openRisks}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            proj.openIssues > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {proj.openIssues}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                          {proj.maxRiskScore > 0 ? proj.maxRiskScore : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getSeverityBadge(proj.severityLevel)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {onSelectProject ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectProject(proj.projectId);
                              }}
                              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                            >
                              Open Project &rarr;
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {proj.totalItems} total
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Item Breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="bg-slate-50 p-4 border-t border-b border-slate-200">
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Registered Items for {proj.projectTitle}
                              </h5>
                              {!proj.items || proj.items.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No risks or issues logged for this project.</p>
                              ) : (
                                <div className="grid gap-2">
                                  {proj.items.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-start justify-between text-xs gap-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                            item.type === 'Risk' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {item.type}
                                          </span>
                                          <span className="font-semibold text-slate-800">{item.description}</span>
                                        </div>
                                        <div className="text-slate-500 flex gap-4">
                                          <span>Owner: <strong>{item.owner || 'Unassigned'}</strong></span>
                                          <span>Status: <strong>{item.status}</strong></span>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="font-bold text-slate-700">Score: {item.riskScore}</span>
                                        <div className="text-slate-400 text-[10px]">L:{item.likelihoodScore} × I:{item.impactScore}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
