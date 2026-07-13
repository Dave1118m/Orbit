import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';

const API_URL = 'https://localhost:7065/api/v1/projects';
const TEAMS_URL = 'https://localhost:7065/api/v1/teams';
const WORKSPACES_URL = 'https://localhost:7065/api/v1/workspaces';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    const stored = localStorage.getItem('selectedOrganizationId');
    return stored ? parseInt(stored, 10) : null;
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTeamAssignmentOpen, setIsTeamAssignmentOpen] = useState(false);
  const [isTeamReplacementOpen, setIsTeamReplacementOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [projectTeams, setProjectTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [selectedReplacementTeamId, setSelectedReplacementTeamId] = useState(null);
  const [selectedReplacementProject, setSelectedReplacementProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 0,
    budget: '',
    startDate: '',
    endDate: ''
  });

  const fetchProjects = async (workspaceId = null) => {
    try {
      const token = localStorage.getItem('token');
      const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const response = await fetch(`${API_URL}${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeams = async (workspaceId = null) => {
    try {
      const token = localStorage.getItem('token');
      const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
      const response = await fetch(`${TEAMS_URL}${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data.filter(t => !t.isArchived));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectTeams = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProjectTeams(data.teams || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = WORKSPACES_URL;
      if (selectedOrganizationId) {
        url += `?orgId=${selectedOrganizationId}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
        if (data.length > 0 && selectedWorkspaceId === null) {
          setSelectedWorkspaceId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'selectedOrganizationId') {
        setSelectedOrganizationId(e.newValue ? parseInt(e.newValue, 10) : null);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    setSelectedWorkspaceId(null);
    fetchWorkspaces();
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (selectedWorkspaceId !== null) {
      fetchProjects(selectedWorkspaceId);
      fetchTeams(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!selectedWorkspaceId) {
        alert('Select a workspace before creating a project.');
        return;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          title: formData.title,
          description: formData.description,
          status: parseInt(formData.status, 10),
          budget: formData.budget ? parseFloat(formData.budget) : null,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null
        })
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', description: '', status: 0, budget: '', startDate: '', endDate: '' });
        fetchProjects(selectedWorkspaceId);
      } else {
        const error = await response.text();
        console.error('Project creation failed:', error);
        alert('Failed to create project. Ensure you have the right permissions.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to soft-delete this project?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignTeam = async (e) => {
    e.preventDefault();
    if (selectedTeamIds.length === 0) {
      alert('Please select at least one team');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Assigning teams:', selectedTeamIds, 'to project:', selectedProject.id);
      
      const assignPromises = selectedTeamIds.map(async (teamId) => {
        const url = `${TEAMS_URL}/${teamId}/assign-project`;
        console.log(`Assigning team ${teamId} to project ${selectedProject.id}`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ projectId: selectedProject.id })
        });
        
        console.log(`Team ${teamId} assignment response:`, response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to assign team ${teamId}:`, errorText);
        }
        
        return { teamId, response };
      });

      const results = await Promise.all(assignPromises);
      
      // Treat 409 (already assigned) as success
      const allSuccessfulOrAlreadyAssigned = results.every(({ response }) => response.ok || response.status === 409);

      if (allSuccessfulOrAlreadyAssigned) {
        setIsTeamAssignmentOpen(false);
        setSelectedTeamIds([]);
        await fetchProjectTeams(selectedProject.id);
        const assignedTeams = teams.filter(t => selectedTeamIds.includes(t.id));
        setSelectedProject(prev => ({ ...prev, teams: [...(prev.teams || []), ...assignedTeams] }));
      } else {
        const failedTeams = results.filter(({ response }) => !response.ok && response.status !== 409).map(({ teamId }) => teamId);
        console.error('Failed teams:', failedTeams);
        alert(`Some teams failed to assign. Check console for details.`);
      }
    } catch (err) {
      console.error('Failed to assign team', err);
      alert('Failed to assign teams. Please try again.');
    }
  };

  const handleReplaceTeam = async (e) => {
    e.preventDefault();
    if (!selectedReplacementTeamId) {
      alert('Please select a replacement team');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const oldTeamId = projectTeams[0]?.id;
      const response = await fetch(`${TEAMS_URL}/${oldTeamId}/replace-on-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ projectId: selectedProject.id, newTeamId: selectedReplacementTeamId })
      });

      if (response.ok) {
        setIsTeamReplacementOpen(false);
        setSelectedReplacementTeamId(null);
        await fetchProjectTeams(selectedProject.id);
      }
    } catch (err) {
      console.error('Failed to replace team', err);
    }
  };

  const statusMap = { 0: 'Planning', 1: 'Active', 2: 'On Hold', 3: 'Completed', 4: 'Cancelled', 5: 'Archived' };

  const handleWorkspaceChange = (e) => {
    const workspaceId = parseInt(e.target.value, 10);
    setSelectedWorkspaceId(workspaceId);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Projects</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">All projects</h1>
            <p className="mt-1 text-sm text-slate-500">Track progress, boards, and timelines from one place.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Workspace</label>
              <select
                value={selectedWorkspaceId ?? ''}
                onChange={handleWorkspaceChange}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
            >
              New Project
            </button>
          </div>
        </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Budget</th>
                  <th className="px-6 py-4 font-medium">Tasks</th>
                  <th className="px-6 py-4 font-medium">👥 Teams</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {projects.map((project) => (
                  <tr 
                    key={project.id} 
                    className="hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => setSelectedProject(project)}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">{project.title}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        {statusMap[project.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{project.budget ? `$${project.budget.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{project.taskCount || 0}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex gap-1 flex-wrap">
                        {project.teams && project.teams.length > 0 ? (
                          project.teams.map(team => (
                            <span key={team.id} className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                              {team.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No teams</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedProject(project);
                            setSelectedTeamIds([]);
                            setIsTeamAssignmentOpen(true);
                          }}
                          className="text-brand-600 hover:text-brand-700 font-medium text-xs px-2 py-1 rounded hover:bg-brand-50 transition"
                        >
                          + Team
                        </button>
                        {project.teams && project.teams.length > 0 && (
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSelectedReplacementProject(project);
                              setIsTeamReplacementOpen(true);
                            }}
                            className="text-amber-600 hover:text-amber-700 font-medium text-xs px-2 py-1 rounded hover:bg-amber-50 transition"
                          >
                            🔄 Replace
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                          className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No projects found. Create one to get started!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Project">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input
              required
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Workspace *</label>
              <select
                value={selectedWorkspaceId ?? ''}
                onChange={(e) => setSelectedWorkspaceId(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={0}>Planning</option>
                <option value={1}>Active</option>
                <option value={2}>On Hold</option>
                <option value={3}>Completed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Budget</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-3xl px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Team to Project Modal */}
      <Modal isOpen={isTeamAssignmentOpen} onClose={() => setIsTeamAssignmentOpen(false)} title="🎯 Assign Teams to Project">
        <form onSubmit={handleAssignTeam} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Select teams to assign (multiple selection):</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teams.length === 0 ? (
                <p className="text-sm text-slate-500">No teams available in this workspace</p>
              ) : (
                teams.filter(team => !projectTeams.some(pt => pt.teamId === team.id)).map(team => (
                  <label key={team.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      value={team.id}
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={(e) => {
                        const teamId = parseInt(e.target.value);
                        setSelectedTeamIds(prev => 
                          e.target.checked 
                            ? [...prev, teamId] 
                            : prev.filter(id => id !== teamId)
                        );
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{team.name}</p>
                      <p className="text-xs text-slate-500">{team.members?.length || 0} members</p>
                    </div>
                  </label>
                ))
              )}
              {teams.filter(team => !projectTeams.some(pt => pt.teamId === team.id)).length === 0 && (
                <p className="text-sm text-slate-500">All teams are already assigned to this project</p>
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">ℹ️ Members' project-scoped roles will remain unchanged. Team assignment only adds them to the project.</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => { setIsTeamAssignmentOpen(false); setSelectedTeamIds([]); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedTeamIds.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign Teams ({selectedTeamIds.length})
            </button>
          </div>
        </form>
      </Modal>

      {/* Replace Team on Project Modal */}
      <Modal isOpen={isTeamReplacementOpen} onClose={() => setIsTeamReplacementOpen(false)} title="🔄 Replace Team on Project">
        <form onSubmit={handleReplaceTeam} className="space-y-4">
          {projectTeams.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-900">Current team: <span className="font-semibold">{projectTeams[0]?.name}</span></p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Select replacement team:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teams.filter(t => !projectTeams.some(pt => pt.id === t.id)).length === 0 ? (
                <p className="text-sm text-slate-500">No other teams available</p>
              ) : (
                teams.filter(t => !projectTeams.some(pt => pt.id === t.id)).map(team => (
                  <label key={team.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="team"
                      value={team.id}
                      checked={selectedReplacementTeamId === team.id}
                      onChange={(e) => setSelectedReplacementTeamId(parseInt(e.target.value))}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{team.name}</p>
                      <p className="text-xs text-slate-500">{team.members?.length || 0} members</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">⚠️ Replacing the team will remove the current team's assignment and add the new team's members to this project.</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => { setIsTeamReplacementOpen(false); setSelectedReplacementTeamId(null); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedReplacementTeamId}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace Team
            </button>
          </div>
        </form>
      </Modal>

      <ProjectDetailsPanel 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />
    </div>
  );
}
