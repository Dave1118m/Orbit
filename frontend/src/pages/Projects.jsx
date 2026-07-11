import { useEffect, useState } from 'react';
import Modal from '../components/Modal';

const API_URL = 'https://localhost:7065/api/v1/projects';
const WORKSPACES_URL = 'https://localhost:7065/api/v1/workspaces';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    const stored = localStorage.getItem('selectedOrganizationId');
    return stored ? parseInt(stored, 10) : null;
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Budget</th>
                  <th className="px-6 py-4 font-medium">Tasks</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">{project.title}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                        {statusMap[project.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{project.budget ? `$${project.budget.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{project.taskCount || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
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
    </div>
  );
}
