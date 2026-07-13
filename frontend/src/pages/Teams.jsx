import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import MultiSelectMembers from '../components/MultiSelectMembers';
import WorkloadChart from '../components/WorkloadChart';

const API_BASE = 'https://localhost:7065/api/v1';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const [createData, setCreateData] = useState({ name: '', description: '', teamLeadUserId: null, workspaceId: null });
  const [editData, setEditData] = useState({ name: '', description: '', teamLeadUserId: null });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const [workloadData, setWorkloadData] = useState(null);
  const [copyData, setCopyData] = useState({ newTeamName: '' });
  const [replaceData, setReplaceData] = useState({ projectId: null, newTeamId: null });
  const [teamProjects, setTeamProjects] = useState([]);
  const [allTeams, setAllTeams] = useState([]);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const orgId = localStorage.getItem('selectedOrganizationId');
    console.log('Organization ID from localStorage:', orgId);
    if (orgId) {
      fetchWorkspaces(orgId);
    } else {
      console.error('No organization ID found in localStorage');
    }
    fetchUserRole();
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadTeams();
    }
  }, [selectedWorkspaceId]);

  const fetchWorkspaces = async (orgId) => {
    console.log('Fetching workspaces for orgId:', orgId);
    try {
      const resp = await fetch(`${API_BASE}/workspaces?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Workspace fetch response status:', resp.status);
      if (resp.ok) {
        const data = await resp.json();
        console.log('Fetched workspaces:', data);
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedWorkspaceId(data[0].id);
          console.log('Set selected workspace to:', data[0].id);
        } else {
          console.log('No workspaces found for organization');
        }
      } else {
        const error = await resp.text();
        console.error('Failed to fetch workspaces:', resp.status, error);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    }
  };

  const fetchUserRole = async () => {
    try {
      const resp = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setUserRole(data.role);
      }
    } catch (err) {
      console.error('Failed to fetch user role', err);
    }
  };

  const loadUsers = async () => {
    try {
      const resp = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/teams?workspaceId=${selectedWorkspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setTeams(data.filter(t => !t.isArchived));
        setAllTeams(data);
      }
    } catch (err) {
      console.error('Failed to load teams', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (team) => {
    setSelectedTeam(team);
    setEditData({ name: team.name, description: team.description, teamLeadUserId: team.teamLeadUserId });
    try {
      const resp = await fetch(`${API_BASE}/teams/${team.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSelectedTeam(data);
      }
    } catch (err) {
      console.error('Failed to fetch team details', err);
    }
    setIsDetailModalOpen(true);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const workspaceId = createData.workspaceId || selectedWorkspaceId;
      if (!workspaceId) {
        alert('Please select a workspace');
        return;
      }
      
      const resp = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId, name: createData.name, description: createData.description, teamLeadUserId: createData.teamLeadUserId })
      });
      if (resp.ok) {
        setIsCreateModalOpen(false);
        setCreateData({ name: '', description: '', teamLeadUserId: null, workspaceId: null });
        loadTeams();
      } else {
        const error = await resp.text();
        console.error('Failed to create team:', error);
        alert('Failed to create team: ' + error);
      }
    } catch (err) {
      console.error('Failed to create team', err);
      alert('Failed to create team: ' + err.message);
    }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE}/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editData)
      });
      if (resp.ok) {
        setIsEditModalOpen(false);
        loadTeams();
        setIsDetailModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to update team', err);
    }
  };

  const handleArchiveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to archive this team?')) return;
    try {
      await fetch(`${API_BASE}/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTeams();
      setIsDetailModalOpen(false);
    } catch (err) {
      console.error('Failed to archive team', err);
    }
  };

  const handleLoadRoster = async (teamId) => {
    try {
      const resp = await fetch(`${API_BASE}/teams/${teamId}/roster`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setRosterData(data);
        setIsRosterModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load roster', err);
    }
  };

  const handleLoadWorkload = async (teamId) => {
    try {
      const resp = await fetch(`${API_BASE}/teams/${teamId}/workload`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setWorkloadData(data);
        setIsWorkloadModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load workload', err);
    }
  };

  const handleCopyTeam = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE}/teams/${selectedTeam.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newTeamName: copyData.newTeamName, workspaceId: selectedWorkspaceId })
      });
      if (resp.ok) {
        setIsCopyModalOpen(false);
        setCopyData({ newTeamName: '' });
        loadTeams();
      }
    } catch (err) {
      console.error('Failed to copy team', err);
    }
  };

  const handleReplaceTeam = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE}/teams/${selectedTeam.id}/replace-on-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: replaceData.projectId, newTeamId: replaceData.newTeamId })
      });
      if (resp.ok) {
        setIsReplaceModalOpen(false);
        setReplaceData({ projectId: null, newTeamId: null });
        alert('Team replaced successfully!');
      }
    } catch (err) {
      console.error('Failed to replace team', err);
    }
  };

  const handleAddMembers = async (e) => {
    e.preventDefault();
    try {
      for (const member of selectedMembers) {
        await fetch(`${API_BASE}/teams/${selectedTeam.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: member.id || member.userId })
        });
      }
      setIsMembersModalOpen(false);
      setSelectedMembers([]);
      loadTeams();
      handleOpenDetail(selectedTeam);
    } catch (err) {
      console.error('Failed to add members', err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await fetch(`${API_BASE}/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await handleLoadRoster(selectedTeam.id);
    } catch (err) {
      console.error('Failed to remove member', err);
    }
  };

  const canManageTeams = () => {
    return ['Owner', 'Admin', 'Coordinator'].includes(userRole);
  };

  const canViewTeams = () => {
    return userRole !== null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">👥 Teams</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage workspace teams and their project assignments
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 shadow-md hover:shadow-lg transition flex items-center gap-2"
        >
          <span>+</span> Create Team
        </button>
      </div>

      {workspaces.length > 1 && (
        <div className="flex gap-2">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => setSelectedWorkspaceId(ws.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedWorkspaceId === ws.id
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No teams yet. {canManageTeams() ? 'Create one to get started.' : 'Teams will appear here.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <div key={team.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg transition hover:border-brand-200 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👥</span>
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-600">{team.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{team.description || 'No description'}</p>
                </div>
                {canManageTeams() && (
                  <button
                    onClick={() => handleOpenDetail(team)}
                    className="text-slate-400 hover:text-brand-600 transition"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="space-y-2 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">👤 Members:</span>
                  <span className="font-medium text-slate-900">{team.members?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">📋 Projects:</span>
                  <span className="font-medium text-slate-900">{team.projects?.length || 0}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleLoadRoster(team.id)}
                  className="flex-1 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1.5 rounded border border-brand-200 hover:bg-brand-50 transition"
                  title="View team members"
                >
                  Roster
                </button>
                <button
                  onClick={() => handleLoadWorkload(team.id)}
                  className="flex-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1.5 rounded border border-emerald-200 hover:bg-emerald-50 transition"
                  title="View workload"
                >
                  Workload
                </button>
                {canManageTeams() && (
                  <button
                    onClick={() => handleOpenDetail(team)}
                    className="flex-1 text-xs font-medium text-purple-600 hover:text-purple-700 px-2 py-1.5 rounded border border-purple-200 hover:bg-purple-50 transition"
                    title="Manage team"
                  >
                    Manage
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="🆕 Create New Team">
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Workspace *</label>
            <select
              required
              value={createData.workspaceId || selectedWorkspaceId || ''}
              onChange={(e) => setCreateData({ ...createData, workspaceId: parseInt(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select a workspace</option>
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Team Name *</label>
            <input
              required
              value={createData.name}
              onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g., Product Development"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={createData.description || ''}
              onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="What is this team responsible for?"
              rows="3"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">💡 You can add members after creating the team using the roster management feature.</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition shadow-md hover:shadow-lg"
            >
              Create Team
            </button>
          </div>
        </form>
      </Modal>

      {/* Team Detail Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={selectedTeam?.name}>
        {selectedTeam && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-500 font-semibold">Description</p>
              <p className="mt-1 text-sm text-slate-600">{selectedTeam.description || 'No description'}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 py-3 border-t border-b">
              <div>
                <p className="text-xs text-slate-500 font-medium">Members</p>
                <p className="text-lg font-bold text-slate-900">{selectedTeam.members?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Projects</p>
                <p className="text-lg font-bold text-slate-900">{selectedTeam.projects?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Status</p>
                <p className="text-lg font-bold text-emerald-600">Active</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {canManageTeams() && (
                <>
                  <button
                    onClick={() => { setIsDetailModalOpen(false); setIsEditModalOpen(true); }}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded border border-brand-200 hover:bg-brand-50 transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => { setIsDetailModalOpen(false); setIsRosterModalOpen(true); handleLoadRoster(selectedTeam.id); }}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded border border-emerald-200 hover:bg-emerald-50 transition"
                  >
                    👥 Members
                  </button>
                </>
              )}
              <button
                onClick={() => { setIsDetailModalOpen(false); handleLoadWorkload(selectedTeam.id); }}
                className="text-sm font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-50 transition"
              >
                📊 Workload
              </button>
              {canManageTeams() && (
                <>
                  <button
                    onClick={() => { setIsDetailModalOpen(false); setIsCopyModalOpen(true); }}
                    className="text-sm font-medium text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-50 transition"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => handleArchiveTeam(selectedTeam.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 hover:bg-red-50 transition"
                  >
                    🗑️ Archive
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Team Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="✏️ Edit Team">
        <form onSubmit={handleUpdateTeam} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Team Name</label>
            <input
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Team name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={editData.description || ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Team description"
              rows="3"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition shadow-md hover:shadow-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Roster Modal */}
      <Modal isOpen={isRosterModalOpen} onClose={() => setIsRosterModalOpen(false)} title="Team Roster">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {rosterData.length === 0 ? (
            <p className="text-sm text-slate-500">No members in this team</p>
          ) : (
            rosterData.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div className="flex-1">
                  <p className="font-medium text-sm text-slate-900">{member.userName}</p>
                  <p className="text-xs text-slate-500">{member.userEmail}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    <span>📋 {member.openTaskCount} open</span>
                    <span>⏰ {member.overdueTaskCount} overdue</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.currentRole === 'Team Lead' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-700'}`}>
                      {member.currentRole}
                    </span>
                  </div>
                </div>
                {canManageTeams() && (
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    className="ml-2 text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        {canManageTeams() && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={() => { setIsRosterModalOpen(false); setIsMembersModalOpen(true); }}
              className="w-full text-sm font-medium text-brand-600 hover:text-brand-700 px-3 py-2 rounded border border-brand-200 hover:bg-brand-50 transition"
            >
              + Add Members
            </button>
          </div>
        )}
      </Modal>

      {/* Workload Modal */}
      <Modal isOpen={isWorkloadModalOpen} onClose={() => setIsWorkloadModalOpen(false)} title="Team Workload Analysis">
        {workloadData && (
          <WorkloadChart workloadData={workloadData} />
        )}
      </Modal>

      {/* Members Management Modal */}
      <Modal isOpen={isMembersModalOpen} onClose={() => setIsMembersModalOpen(false)} title="Add Team Members">
        <form onSubmit={handleAddMembers} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Select Members to Add</label>
            <MultiSelectMembers
              selectedMembers={selectedMembers}
              onSelectionChange={setSelectedMembers}
              availableMembers={users.filter(u => !rosterData.some(r => r.userId === u.id))}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => { setIsMembersModalOpen(false); setSelectedMembers([]); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full disabled:opacity-50"
              disabled={selectedMembers.length === 0}
            >
              Add Members ({selectedMembers.length})
            </button>
          </div>
        </form>
      </Modal>

      {/* Copy Team Modal */}
      <Modal isOpen={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} title="📋 Copy Team">
        <form onSubmit={handleCopyTeam} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Team Name *</label>
            <input
              required
              value={copyData.newTeamName}
              onChange={(e) => setCopyData({ ...copyData, newTeamName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g., Product Development - Copy"
            />
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-emerald-900">✅ This will copy:</p>
            <ul className="text-xs text-emerald-700 space-y-1 ml-3">
              <li>✓ All team members</li>
              <li>✓ Team structure and metadata</li>
              <li>✗ NOT project assignments</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition shadow-md hover:shadow-lg"
            >
              Copy Team
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
