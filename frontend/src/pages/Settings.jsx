import { useEffect, useState, useRef } from 'react';
import Modal from '../components/Modal';

const API_URL = 'https://localhost:7065/api/v1/organizations';

export default function Settings() {
  const fileInputRef = useRef(null);
  const [organizations, setOrganizations] = useState([]);
  const [user, setUser] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [inviteData, setInviteData] = useState({
    email: '',
    preAssignedRoleName: 'Member'
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [editOrgData, setEditOrgData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    country: '',
    registrationNumber: '',
    budget: ''
  });
  const [editOrgLogoFile, setEditOrgLogoFile] = useState(null);
  const [editOrgLogoPreview, setEditOrgLogoPreview] = useState('');
  const editOrgLogoInputRef = useRef(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedOrgForTransfer, setSelectedOrgForTransfer] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState(null);
  const [viewMode, setViewMode] = useState('table');

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('Failed to fetch organizations', err);
    }
  };

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://localhost:7065/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
    }
  };

  const fetchOrgMembers = async (orgId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${API_URL}/${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrgMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch organization members', err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchUser();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this organization?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchOrganizations();
      } else {
        alert('Failed to delete organization. Do you have Owner/Admin permissions?');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInviteChange = (e) => {
    setInviteData({ ...inviteData, [e.target.name]: e.target.value });
  };

  const handleOpenInvite = (orgId) => {
    setSelectedOrgId(orgId);
    setIsInviteModalOpen(true);
  };

  const handleOpenEditOrg = (org) => {
    setSelectedOrgId(org.id);
    setEditOrgData({
      name: org.name || '',
      description: org.description || '',
      logoUrl: org.logoUrl || '',
      country: org.country || '',
      registrationNumber: org.registrationNumber || '',
      budget: org.budget?.toString() || ''
    });
    setEditOrgLogoPreview(org.logoUrl || '');
    setEditOrgLogoFile(null);
    setIsEditOrgModalOpen(true);
  };

  const handleEditOrgLogoChange = (file) => {
    if (!file) {
      setEditOrgLogoFile(null);
      setEditOrgLogoPreview(editOrgData.logoUrl || '');
      return;
    }
    setEditOrgLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditOrgLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleEditOrgLogoDrop = (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) handleEditOrgLogoChange(file);
  };

  const handleEditOrgLogoDragOver = (e) => {
    e.preventDefault();
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleEditOrgSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const logoUrl = editOrgLogoFile ? await readFileAsDataUrl(editOrgLogoFile) : editOrgData.logoUrl;
      const response = await fetch(`${API_URL}/${selectedOrgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editOrgData.name,
          description: editOrgData.description,
          logoUrl,
          country: editOrgData.country,
          registrationNumber: editOrgData.registrationNumber,
          budget: editOrgData.budget ? parseFloat(editOrgData.budget) : null
        })
      });
      if (response.ok) {
        setIsEditOrgModalOpen(false);
        fetchOrganizations();
        alert('Organization updated successfully!');
      } else {
        alert('Failed to update organization.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating organization.');
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${selectedOrgId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteData)
      });
      if (response.ok) {
        setIsInviteModalOpen(false);
        setInviteData({ email: '', preAssignedRoleName: 'Member' });
        alert('Invitation sent successfully!');
      } else {
        alert('Failed to send invitation. Ensure you have the right permissions.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!selectedOrgForTransfer || !selectedNewOwner) {
      alert('Please select a new owner');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${selectedOrgForTransfer.id}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newOwnerUserId: selectedNewOwner.userId })
      });
      if (response.ok) {
        alert('Ownership transfer request sent. The new owner will receive an email to confirm the transfer.');
        setIsTransferModalOpen(false);
        setSelectedOrgForTransfer(null);
        setSelectedNewOwner(null);
        setOrgMembers([]);
      } else {
        const error = await response.text();
        alert('Failed to transfer ownership: ' + error);
      }
    } catch (err) {
      console.error('Failed to transfer ownership', err);
      alert('Failed to transfer ownership: ' + err.message);
    }
  };

  const openTransferModal = async (org) => {
    setSelectedOrgForTransfer(org);
    setSelectedNewOwner(null);
    await fetchOrgMembers(org.id);
    setIsTransferModalOpen(true);
  };

  const handlePhotoUpload = async (file) => {
    if (!file || !user) return;
    try {
      setIsUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`https://localhost:7065/api/v1/users/${user.id}/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        fetchUser();
      } else {
        alert('Failed to upload photo.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* User Profile Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold mb-6">Your Profile</p>
        
        {user ? (
          <div className="flex items-center gap-6">
            <div className="relative group">
              {user.photoUrl ? (
                <img src={`https://localhost:7065${user.photoUrl}`} alt={user.name} className="h-24 w-24 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/10 text-3xl font-bold text-brand-500 shadow-sm">
                  {user.name?.charAt(0)}
                </div>
              )}
              
              <div 
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-white text-xs font-semibold">{isUploadingPhoto ? 'Uploading...' : 'Change'}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                }}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-slate-500">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="animate-pulse flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-slate-200"></div>
            <div className="space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
              <div className="h-3 w-48 bg-slate-200 rounded"></div>
            </div>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Settings</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Organizations</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your NGOs, country offices, and legal entities.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Table View"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition ${viewMode === 'card' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Card View"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zm-10 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Country</th>
                  <th className="px-6 py-4 font-medium">Reg. Number</th>
                  <th className="px-6 py-4 font-medium">Members</th>
                  <th className="px-6 py-4 font-medium">Compliance</th>
                  <th className="px-6 py-4 font-medium">Budget</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.name} className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">
                            {org.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-slate-900">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{org.country || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{org.registrationNumber || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{org.memberCount ?? '-'} </td>
                    <td className="px-6 py-4 text-slate-600">
                      {org.hasCompliance ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Yes</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">No</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{org.budget ? `$${org.budget.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEditOrg(org)}
                        className="mr-4 text-brand-500 hover:text-brand-600 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleOpenInvite(org.id)}
                        className="mr-4 text-brand-500 hover:text-brand-600 font-medium"
                      >
                        Invite
                      </button>
                      {user && org.ownerId === user.id && (
                        <button
                          onClick={() => openTransferModal(org)}
                          className="mr-4 text-brand-500 hover:text-brand-600 font-medium"
                        >
                          Transfer
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(org.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                      No organizations found or you do not have permission to view them.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div key={org.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 p-6 transition hover:border-brand-500 hover:shadow-md">
                <div>
                  <div className="flex items-center gap-4">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-lg font-bold text-brand-500">
                        {org.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-900">{org.name}</h3>
                      <p className="text-sm text-slate-500">{org.country || 'No country specified'}</p>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm text-slate-600">{org.description || 'No description provided.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {org.memberCount ?? 0} Members
                    </span>
                    {org.hasCompliance && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        ✓ Compliance
                      </span>
                    )}
                    {org.budget && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        ${org.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex gap-2">
                    {org.registrationNumber && (
                      <span title="Registration Number" className="text-xs text-slate-500">Reg: {org.registrationNumber}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEditOrg(org)}
                      className="text-sm font-medium text-brand-500 hover:text-brand-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleOpenInvite(org.id)}
                      className="text-sm font-medium text-brand-500 hover:text-brand-700"
                    >
                      Invite
                    </button>
                    {user && org.ownerId === user.id && (
                      <button
                        onClick={() => openTransferModal(org)}
                        className="text-sm font-medium text-brand-500 hover:text-brand-700"
                      >
                        Transfer
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(org.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {organizations.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                <p className="text-slate-500">No organizations found. Create one to get started!</p>
              </div>
            )}
          </div>
        )}
      </div>


      <Modal isOpen={isEditOrgModalOpen} onClose={() => setIsEditOrgModalOpen(false)} title="Edit Organization">
        <form onSubmit={handleEditOrgSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Organization Name *</label>
            <input
              required
              value={editOrgData.name}
              onChange={(e) => setEditOrgData({ ...editOrgData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={editOrgData.description}
              onChange={(e) => setEditOrgData({ ...editOrgData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
            <input
              value={editOrgData.logoUrl}
              onChange={(e) => {
                setEditOrgData({ ...editOrgData, logoUrl: e.target.value });
                if (editOrgLogoFile) {
                  setEditOrgLogoFile(null);
                  setEditOrgLogoPreview('');
                }
              }}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Upload Logo</label>
            <div
              onDrop={handleEditOrgLogoDrop}
              onDragOver={handleEditOrgLogoDragOver}
              className="flex min-h-[100px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-brand-500"
            >
              {editOrgLogoPreview ? (
                <img src={editOrgLogoPreview} alt="Logo preview" className="max-h-24 rounded-xl object-contain" />
              ) : (
                <div className="space-y-2 text-slate-500">
                  <p className="text-sm">Drag & drop an image here, or browse to upload.</p>
                  <button
                    type="button"
                    onClick={() => editOrgLogoInputRef.current?.click()}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    Browse file
                  </button>
                </div>
              )}
              <input
                ref={editOrgLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleEditOrgLogoChange(e.target.files[0]);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
              <input
                value={editOrgData.country}
                onChange={(e) => setEditOrgData({ ...editOrgData, country: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reg Number</label>
              <input
                value={editOrgData.registrationNumber}
                onChange={(e) => setEditOrgData({ ...editOrgData, registrationNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Budget</label>
            <input
              type="number"
              step="0.01"
              value={editOrgData.budget}
              onChange={(e) => setEditOrgData({ ...editOrgData, budget: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditOrgModalOpen(false)}
              className="rounded-3xl px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Member">
        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
            <input
              required
              type="email"
              name="email"
              value={inviteData.email}
              onChange={handleInviteChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              name="preAssignedRoleName"
              value={inviteData.preAssignedRoleName}
              onChange={handleInviteChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="Admin">Admin</option>
              <option value="Coordinator">Coordinator</option>
              <option value="Manager">Manager</option>
              <option value="FinanceOfficer">Finance Officer</option>
              <option value="Member">Member</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="rounded-3xl px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Send Invite
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isTransferModalOpen} 
        onClose={() => {
          setIsTransferModalOpen(false);
          setSelectedOrgForTransfer(null);
          setSelectedNewOwner(null);
          setOrgMembers([]);
        }} 
        title={`Transfer Ownership: ${selectedOrgForTransfer?.name}`}
      >
        <form onSubmit={handleTransferOwnership} className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              ⚠️ You are about to transfer ownership of this organization. The new owner will receive an email to confirm the transfer. You will lose all owner privileges once the transfer is confirmed.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Select New Owner *</label>
            {orgMembers.length === 0 ? (
              <p className="text-sm text-slate-500">No members available to transfer ownership to.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orgMembers
                  .filter(member => member.userId !== selectedOrgForTransfer?.ownerId)
                  .map(member => (
                    <label 
                      key={member.userId} 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selectedNewOwner?.userId === member.userId 
                          ? 'border-brand-500 bg-brand-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newOwner"
                        checked={selectedNewOwner?.userId === member.userId}
                        onChange={() => setSelectedNewOwner(member)}
                        className="text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <p className="font-medium text-slate-900">{member.userName}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                        <p className="text-xs text-slate-600 mt-1">Role: {member.roleName}</p>
                      </div>
                    </label>
                  ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                setIsTransferModalOpen(false);
                setSelectedOrgForTransfer(null);
                setSelectedNewOwner(null);
                setOrgMembers([]);
              }}
              className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedNewOwner}
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Transfer Ownership
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
