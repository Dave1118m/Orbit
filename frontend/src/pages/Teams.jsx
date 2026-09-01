import { useEffect, useState, useMemo } from 'react';
import WorkloadChart from '../components/WorkloadChart';
import MultiSelectMembers from '../components/MultiSelectMembers';
import SearchSelect from '../components/SearchSelect';
import { useUser } from '../contexts/UserContext';
import { AutoText } from '../contexts/TranslationContext';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../utils/toastHelper';

const API_BASE = import.meta.env.VITE_API_URL;

// Generate avatar initials / color from name
const AVATAR_COLORS = [
  'bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-cyan-500','bg-pink-500','bg-indigo-500',
];

/**
 * Deterministically generates an avatar background color from a string hash.
 * @param {string} str - User or team name.
 * @returns {string} Tailwind CSS background color class.
 */
function avatarColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Extracts 2-letter uppercase initials from full name.
 * @param {string} name - Full name string.
 * @returns {string} Two-letter initials.
 */
function initials(name = '') {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/**
 * Team and Workforce Management page component supporting roster views, capacity/workload analytics,
 * multi-user assignments, project linkages, and audit histories.
 */
export default function Teams() {
  const token = localStorage.getItem('token');
  const { user, hasPermission } = useUser();

  // Granular permissions
  const canCreateTeam = hasPermission('TeamCreate');
  const canEditTeam = hasPermission('TeamEdit');
  const canDeleteTeam = hasPermission('TeamDelete');
  const canManageMembers = hasPermission('TeamManageMembers');
  const canAssignProject = hasPermission('TeamAssignProject') || hasPermission('ProjectAssignTeam');

  // ── Global State ──
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  
  // ── Teams State ──
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  
  // ── Selected Team State ──
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, roster, projects, history, settings
  
  // ── Team Data State ──
  const [rosterData, setRosterData] = useState([]);
  const [workloadData, setWorkloadData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  
  // ── Users State (for adding members) ──
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  // ── Form State ──
  const [isCreating, setIsCreating] = useState(false);
  const [createData, setCreateData] = useState({ name: '', description: '', teamLeadUserId: '' });
  const [editData, setEditData] = useState({ name: '', description: '', teamLeadUserId: '' });
  const [isCopying, setIsCopying] = useState(false);
  const [copyData, setCopyData] = useState({ name: '', description: '' });

  // ── Modals State ──
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceData, setReplaceData] = useState({ projectId: '', newTeamId: '', reason: '', newEndDate: '' });
  const [isMoving, setIsMoving] = useState(false);
  const [moveProjectId, setMoveProjectId] = useState('');
  
  // ── Admin Reset Password State ──
  const [resetUserModal, setResetUserModal] = useState(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // ── Initialization ──
  useEffect(() => {
    fetchWorkspaces();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchTeams(selectedWorkspaceId);
    fetchAllProjects(selectedWorkspaceId);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (selectedTeam) {
      fetchRoster(selectedTeam.id);
      fetchWorkload(selectedTeam.id);
      fetchHistory(selectedTeam.id);
      setEditData({ name: selectedTeam.name, description: selectedTeam.description || '', teamLeadUserId: selectedTeam.teamLeadUserId || '' });
    }
  }, [selectedTeam?.id]);

  // ── Fetchers ──
  const getHeaders = () => {
    const token = localStorage.getItem('token');
    const storedOrgId = localStorage.getItem('selectedOrganizationId');
    const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null') {
      h['X-Organization-Id'] = storedOrgId;
    }
    return h;
  };

  const fetchWorkspaces = async () => {
    try {
      const orgId = localStorage.getItem('selectedOrganizationId') || user?.organizationId || user?.primaryOrganizationId;
      const query = orgId ? `?orgId=${orgId}` : '';
      const res = await fetch(`${API_BASE}/workspaces${query}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (err) { console.error('Failed to fetch workspaces', err); }
  };

  const fetchUsers = async () => {
    try {
      const orgId = localStorage.getItem('selectedOrganizationId') || user?.organizationId || user?.primaryOrganizationId;
      const query = orgId ? `?orgId=${orgId}` : '';
      const res = await fetch(`${API_BASE}/users${query}`, { headers: getHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchTeams = async (wsId = null) => {
    setLoadingTeams(true);
    try {
      const query = wsId ? `?workspaceId=${wsId}` : '';
      const res = await fetch(`${API_BASE}/teams${query}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
        if (selectedTeam) {
          const updated = data.find(t => t.id === selectedTeam.id);
          if (updated) setSelectedTeam(updated);
          else setSelectedTeam(data[0] || null);
        } else if (data.length > 0) {
          setSelectedTeam(data[0]);
        } else {
          setSelectedTeam(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchRoster = async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/roster`, { headers: getHeaders() });
      if (res.ok) setRosterData(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchWorkload = async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/workload`, { headers: getHeaders() });
      if (res.ok) setWorkloadData(await res.json());
      else setWorkloadData(null);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/history`, { headers: getHeaders() });
      if (res.ok) setHistoryData(await res.json());
      else setHistoryData([]);
    } catch (err) { console.error(err); }
  };

  const fetchAllProjects = async (wsId = null) => {
    try {
      const query = wsId ? `?workspaceId=${wsId}` : '';
      const res = await fetch(`${API_BASE}/projects${query}`, { headers: getHeaders() });
      if (res.ok) setAllProjects(await res.json());
    } catch (err) { console.error(err); }
  };

  // ── Actions ──
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    const targetWsId = selectedWorkspaceId || (workspaces.length > 0 ? workspaces[0].id : null);
    if (!targetWsId) {
      showSuccessToast('Please select or create a workspace first.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...createData, workspaceId: targetWsId })
      });
      if (res.ok) {
        setCreateData({ name: '', description: '', teamLeadUserId: '' });
        setIsCreating(false);
        fetchTeams(selectedWorkspaceId);
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(errText, 'Failed to create team.');
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editData)
      });
      if (res.ok) fetchTeams(selectedWorkspaceId);
    } catch (err) { console.error(err); }
  };

  const handleArchiveTeam = async () => {
    if (!window.confirm(`Archive team "${selectedTeam.name}"? Historical project assignment records will be retained for audit.`)) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok || res.status === 204) {
        fetchTeams(selectedWorkspaceId);
      }
    } catch (err) { console.error(err); }
  };

  const handleBulkAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    try {
      const userIds = selectedNewMembers.map(m => m.id);
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/members/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userIds })
      });
      if (res.ok) {
        setSelectedNewMembers([]);
        fetchRoster(selectedTeam.id);
        fetchTeams(selectedWorkspaceId);
        fetchWorkload(selectedTeam.id);
      }
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from team?')) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        fetchRoster(selectedTeam.id);
        fetchTeams(selectedWorkspaceId);
        fetchWorkload(selectedTeam.id);
      }
    } catch (err) { console.error(err); }
  };

  const handleAssignProject = async (e) => {
    e.preventDefault();
    if (!assignProjectId) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assign-project`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ projectId: parseInt(assignProjectId) })
      });
      if (res.ok) {
        setIsAssigning(false);
        setAssignProjectId('');
        fetchHistory(selectedTeam.id);
        fetchTeams(selectedWorkspaceId);
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(errText, 'Failed to assign team to project.');
      }
    } catch (err) { console.error(err); }
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!adminNewPassword || adminNewPassword.trim().length < 6) {
      showSuccessToast('Password must be at least 6 characters long.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/admin-reset-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId: resetUserModal.userId, newPassword: adminNewPassword.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        showSuccessToast(data.message || `Password for ${resetUserModal.userName} reset successfully! Notification sent via SendGrid.`);
        setResetUserModal(null);
        setAdminNewPassword('');
      } else {
        const text = await parseApiResponse(res);
        showErrorToast(`Failed to reset password: ${text}`);
      }
    } catch (err) {
      showErrorToast(`Error resetting password: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleReplaceTeam = async (e) => {
    e.preventDefault();
    if (!replaceData.projectId || !replaceData.newTeamId) return;
    try {
      const payload = {
        projectId: parseInt(replaceData.projectId),
        newTeamId: parseInt(replaceData.newTeamId),
        reason: replaceData.reason || null,
        newEndDate: replaceData.newEndDate ? new Date(replaceData.newEndDate).toISOString() : null
      };
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/replace-on-project`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsReplacing(false);
        setReplaceData({ projectId: '', newTeamId: '', reason: '', newEndDate: '' });
        fetchHistory(selectedTeam.id);
        fetchTeams(selectedWorkspaceId);
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(errText, 'Failed to replace team.');
      }
    } catch (err) { console.error(err); }
  };

  const handleMoveTeam = async (e) => {
    e.preventDefault();
    if (!moveProjectId) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/move-to-project`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ projectId: parseInt(moveProjectId) })
      });
      if (res.ok) {
        setIsMoving(false);
        setMoveProjectId('');
        fetchHistory(selectedTeam.id);
        fetchTeams(selectedWorkspaceId);
      } else {
        const err = await res.json();
        showErrorToast(err.title || err.message || 'Failed to move team.');
      }
    } catch (err) { console.error(err); }
  };

  const handleCopyTeam = async (e) => {
    e.preventDefault();
    try {
      const targetWsId = selectedWorkspaceId || (workspaces.length > 0 ? workspaces[0].id : null);
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/copy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          workspaceId: targetWsId,
          newTeamName: copyData.name,
          newTeamDescription: copyData.description
        })
      });
      if (res.ok) {
        setIsCopying(false);
        setCopyData({ name: '', description: '' });
        fetchTeams(selectedWorkspaceId);
      }
    } catch (err) { console.error(err); }
  };

  // ── Derived State ──
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));
  
  const availableUsers = useMemo(() => {
    const rosterIds = new Set(rosterData.map(r => r.userId));
    return users.filter(u => !rosterIds.has(u.id) && 
      (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    );
  }, [users, rosterData, userSearch]);

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 pb-4">
      {/* ── Left Panel: Master Team List ── */}
      <div className="flex w-1/3 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-shrink-0">
        
        {/* Workspace Context & Header */}
        <div className="border-b border-slate-200 bg-slate-50 p-4 shrink-0">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-900">Teams</h1>
            <p className="text-xs text-slate-500">Reusable workspace groups & project assignment units</p>
          </div>
          
          <div className="mb-3">
            <SearchSelect
              options={[{ value: '', label: 'All Workspaces' }, ...workspaces.map(ws => ({ value: ws.id, label: ws.name }))]}
              value={selectedWorkspaceId ?? ''}
              onChange={val => setSelectedWorkspaceId(val || null)}
              placeholder="All Workspaces"
              isClearable={false}
            />
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search teams..."
              value={teamSearch}
              onChange={e => setTeamSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-brand-500 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Team List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loadingTeams ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading teams...</div>
          ) : filteredTeams.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No teams found in this workspace.</div>
          ) : (
            <div className="space-y-1">
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                    selectedTeam?.id === team.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm ${avatarColor(team.name)}`}>
                    {initials(team.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`truncate font-semibold text-sm ${selectedTeam?.id === team.id ? 'text-brand-700' : 'text-slate-900'}`}>
                        {team.name}
                      </p>
                      {team.isArchived && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">Archived</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500 mt-0.5">
                      {(team.members && team.members.length > 0) ? team.members.length : (team.teamLeadUserId ? 1 : 0)} members · {team.projects?.length || 0} projects
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Team Button */}
        {canCreateTeam && (
          <div className="border-t border-slate-200 p-4 shrink-0 bg-white">
            {isCreating ? (
              <form onSubmit={handleCreateTeam} className="space-y-3">
                <input required autoFocus placeholder="Team name (e.g. Infrastructure Squad)" value={createData.name} onChange={e => setCreateData({...createData, name: e.target.value})} className={inputClass} />
                <textarea rows={2} placeholder="Description / Purpose" value={createData.description} onChange={e => setCreateData({...createData, description: e.target.value})} className={inputClass} />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Designated Team Lead</label>
                  <SearchSelect
                    options={users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                    value={createData.teamLeadUserId}
                    onChange={val => setCreateData({...createData, teamLeadUserId: val || ''})}
                    placeholder="Select Designated Team Lead..."
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsCreating(false)} className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button type="submit" className="flex-1 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600">Save Team</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition">
                + Create New Team
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Right Panel: Detail View ── */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {!selectedTeam ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">👥</div>
            <h2 className="text-lg font-bold text-slate-700">Select a Team</h2>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Choose a team from the left sidebar to view roster workload, assign projects, or manage members.</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="border-b border-slate-200 bg-slate-50 px-8 py-6 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-2xl shadow-sm ${avatarColor(selectedTeam.name)}`}>
                    {initials(selectedTeam.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900"><AutoText text={selectedTeam.name} /></h2>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${selectedTeam.isArchived ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        <AutoText text={selectedTeam.isArchived ? 'Archived' : 'Active'} />
                      </span>
                    </div>
                    {selectedTeam.description && (
                      <p className="text-sm text-slate-500 mt-1 max-w-xl"><AutoText text={selectedTeam.description} /></p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canCreateTeam && (
                    <button onClick={() => setIsCopying(true)} className="rounded-full bg-white border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm">
                      Copy Team
                    </button>
                  )}
                  {canDeleteTeam && !selectedTeam.isArchived && (
                    <button onClick={handleArchiveTeam} className="rounded-full bg-rose-50 border border-rose-200 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-sm">
                      Archive Team
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-slate-200 px-8 bg-white shrink-0 overflow-x-auto">
              {['overview', 'roster', 'projects', 'history', 'settings'].map(tab => {
                if (tab === 'settings' && !canEditTeam) return null;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-shrink-0 border-b-2 py-4 text-sm font-semibold capitalize transition-colors ${
                      activeTab === tab ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'history' ? '📋 History' : tab}
                    {tab === 'history' && historyData.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{historyData.length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
              
              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <div className="space-y-6 max-w-4xl">
                  {workloadData ? (
                    <WorkloadChart workloadData={workloadData} />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      No workload statistics available for this team.
                    </div>
                  )}
                </div>
              )}

              {/* ── ROSTER TAB ── */}
              {activeTab === 'roster' && (
                <div className="flex h-full gap-6">
                  {/* Current Members */}
                  <div className="flex-1 rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4 shrink-0 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">Team Roster ({rosterData.length} Members)</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10">
                          <tr>
                            <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase">Member</th>
                            <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase">Team Role</th>
                            <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase">Workload</th>
                            {canManageMembers && <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rosterData.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-500">No members assigned to this team yet.</td></tr>
                          ) : rosterData.map(member => (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  {member.userPhotoUrl ? (
                                    <img src={member.userPhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold ${avatarColor(member.userName)}`}>
                                      {initials(member.userName)}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-slate-900">{member.userName}</p>
                                    <p className="text-xs text-slate-500">{member.userEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${member.currentRole === 'Team Lead' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                  {member.currentRole || 'Member'}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="text-xs">
                                  <span className="font-semibold text-slate-700">{member.openTaskCount}</span> open tasks
                                  {member.overdueTaskCount > 0 && <span className="text-red-500 ml-1 font-semibold">({member.overdueTaskCount} overdue)</span>}
                                </div>
                              </td>
                              {canManageMembers && (
                                <td className="px-5 py-3 text-right shrink-0 whitespace-nowrap">
                                  <button
                                    onClick={() => { setResetUserModal({ userId: member.userId, userName: member.userName, email: member.userEmail }); setAdminNewPassword(''); }}
                                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline mr-3 transition"
                                    title="Admin Direct Password Reset"
                                  >
                                    🔑 Reset Password
                                  </button>
                                  <button onClick={() => handleRemoveMember(member.userId)} className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline">
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Members (Multi-Select) */}
                  {canManageMembers && (
                    <div className="w-80 shrink-0 rounded-xl border border-slate-200 bg-white flex flex-col shadow-sm h-fit">
                      <div className="border-b border-slate-100 px-5 py-4 shrink-0 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-800 mb-4">Add Members to Team</h3>
                        <MultiSelectMembers
                          availableMembers={availableUsers}
                          selectedMembers={selectedNewMembers}
                          onSelectionChange={setSelectedNewMembers}
                        />
                        <button
                          onClick={handleBulkAddMembers}
                          disabled={selectedNewMembers.length === 0}
                          className="mt-4 w-full rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Selected Members ({selectedNewMembers.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PROJECTS TAB ── */}
              {activeTab === 'projects' && (
                <div className="max-w-4xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800">Assigned Projects</h3>
                      <p className="text-xs text-slate-500">Team members participate as a unit in these projects.</p>
                    </div>
                    {canAssignProject && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsMoving(true)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                          🔀 Move Team
                        </button>
                        <button
                          onClick={() => setIsReplacing(true)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition shadow-sm"
                        >
                          🔄 Replace Team
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedTeam.projects && selectedTeam.projects.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedTeam.projects.map(proj => {
                        const projInfo = allProjects.find(p => Number(p.id) === Number(proj.projectId));
                        const projectTitle = proj.projectTitle || projInfo?.title || 'Active Project';
                        return (
                          <div key={proj.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{projectTitle}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Assigned Date: {new Date(proj.assignedAt).toLocaleDateString()}</p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Active Assignment</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-white">
                      This team is not currently assigned to any active projects.
                    </div>
                  )}
                </div>
              )}

              {/* ── HISTORY TAB ── */}
              {activeTab === 'history' && (
                <div className="max-w-4xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800">Project Assignment & Replacement History</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Complete audit trail of all project assignments, removals, and replacements.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">{historyData.length} records</span>
                  </div>

                  {historyData.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-white">
                      No historical project assignments found for this team.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Project</th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Assigned</th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Removed</th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Replaced By</th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {historyData.map(record => {
                            const projInfo = allProjects.find(p => Number(p.id) === Number(record.projectId));
                            const projectTitle = record.projectTitle || projInfo?.title || 'Project';
                            const replacedByTeam = record.replacedByTeamId ? teams.find(t => t.id === record.replacedByTeamId) : null;
                            const isActive = !record.removedAt;
                            return (
                              <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3">
                                  <span className="font-medium text-slate-900">
                                    {projectTitle}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-600 text-xs">
                                  {new Date(record.assignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-5 py-3 text-slate-600 text-xs">
                                  {record.removedAt
                                    ? new Date(record.removedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                    : <span className="text-slate-400 italic">Active</span>}
                                </td>
                                <td className="px-5 py-3 text-xs">
                                  {replacedByTeam
                                    ? <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-medium">{replacedByTeam.name}</span>
                                    : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {isActive ? 'Active' : 'Ended'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── SETTINGS TAB ── */}
              {activeTab === 'settings' && canEditTeam && (
                <div className="max-w-2xl">
                  <form onSubmit={handleUpdateTeam} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                    <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-3">Edit Team Metadata</h3>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Team Name</label>
                      <input required value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                      <textarea rows={3} value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Designated Team Lead</label>
                      <SearchSelect
                        options={users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                        value={editData.teamLeadUserId}
                        onChange={val => setEditData({...editData, teamLeadUserId: val})}
                        placeholder="Select Designated Team Lead..."
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">Save Team Settings</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Assign Team to Project Modal ── */}
      {isAssigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-slate-900">Assign Team to Project</h3>
              <p className="text-sm text-slate-500 mt-1">Assign <strong>{selectedTeam?.name}</strong> as a unit to a project.</p>
            </div>
            <form onSubmit={handleAssignProject} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Select Project</label>
                <SearchSelect
                  options={allProjects.map(p => ({ value: p.id, label: p.title }))}
                  value={assignProjectId ? parseInt(assignProjectId) : null}
                  onChange={val => setAssignProjectId(val || '')}
                  placeholder="Choose a project..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsAssigning(false); setAssignProjectId(''); }} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">Assign Team</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* ── Copy Team Modal ── */}
      {isCopying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Copy Team "{selectedTeam?.name}"</h3>
            <form onSubmit={handleCopyTeam} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New Team Name</label>
                <input required autoFocus value={copyData.name} onChange={e => setCopyData({...copyData, name: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New Team Description</label>
                <textarea rows={3} value={copyData.description} onChange={e => setCopyData({...copyData, description: e.target.value})} className={inputClass} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsCopying(false)} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">Copy Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Replace Team on Project Modal ── */}
      {isReplacing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>🔄</span> Replace Team
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Replacing <span className="font-semibold text-slate-800">{selectedTeam?.name}</span> on project
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsReplacing(false); setReplaceData({ projectId: '', newTeamId: '', reason: '', newEndDate: '' }); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReplaceTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Project *</label>
                <SearchSelect
                  options={(selectedTeam?.projects || []).map(p => {
                    const info = allProjects.find(ap => Number(ap.id) === Number(p.projectId));
                    return { value: p.projectId, label: p.projectTitle || info?.title || `Project #${p.projectId}` };
                  })}
                  value={replaceData.projectId ? parseInt(replaceData.projectId) : null}
                  onChange={val => setReplaceData({...replaceData, projectId: val || ''})}
                  placeholder="Select assigned project..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Replacement Team *</label>
                <SearchSelect
                  options={teams.filter(t => Number(t.id) !== Number(selectedTeam?.id) && !t.isArchived).map(t => ({ value: t.id, label: t.name }))}
                  value={replaceData.newTeamId ? parseInt(replaceData.newTeamId) : null}
                  onChange={val => setReplaceData({...replaceData, newTeamId: val || ''})}
                  placeholder="Select replacement team..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Extension End Date</label>
                  <input
                    type="date"
                    value={replaceData.newEndDate}
                    onChange={e => setReplaceData({...replaceData, newEndDate: e.target.value})}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                  <input
                    type="text"
                    placeholder="Reason for team swap..."
                    value={replaceData.reason}
                    onChange={e => setReplaceData({...replaceData, reason: e.target.value})}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => { setIsReplacing(false); setReplaceData({ projectId: '', newTeamId: '', reason: '', newEndDate: '' }); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replaceData.projectId || !replaceData.newTeamId}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  Confirm Replace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Move Team to Project Modal ── */}
      {isMoving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>🔀</span> Move Team
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reassign <span className="font-semibold text-slate-800">{selectedTeam?.name}</span> to a new project destination
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsMoving(false); setMoveProjectId(''); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMoveTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Project *</label>
                <SearchSelect
                  options={allProjects
                    .filter(ap => !(selectedTeam?.projects || []).some(pt => Number(pt.projectId) === Number(ap.id)))
                    .map(p => ({ value: p.id, label: p.title }))
                  }
                  value={moveProjectId ? parseInt(moveProjectId) : null}
                  onChange={val => setMoveProjectId(val || '')}
                  placeholder="Select destination project..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => { setIsMoving(false); setMoveProjectId(''); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!moveProjectId}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  Confirm Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin Password Reset Modal ── */}
      {resetUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>🔑</span> Admin Direct Password Reset
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set a new password for <span className="font-semibold text-slate-800">{resetUserModal.userName}</span> ({resetUserModal.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setResetUserModal(null); setAdminNewPassword(''); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new password (min 6 chars)..."
                  value={adminNewPassword}
                  onChange={e => setAdminNewPassword(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 A notification email containing this new password will automatically be sent to {resetUserModal.email} via SendGrid.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => { setResetUserModal(null); setAdminNewPassword(''); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !adminNewPassword || adminNewPassword.length < 6}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
