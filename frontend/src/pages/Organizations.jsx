import { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal';
import OrgRiskRollup from '../components/OrgRiskRollup';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../utils/toastHelper';

const API_URL = `${import.meta.env.VITE_API_URL}/organizations`;

export default function Organizations() {
  const fileInputRef = useRef(null);
  const [organizations, setOrganizations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedOrgForTransfer, setSelectedOrgForTransfer] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    registrationNumber: '',
    country: '',
    budget: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  const [isPartnersModalOpen, setIsPartnersModalOpen] = useState(false);
  const [selectedOrgForPartners, setSelectedOrgForPartners] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnerOrgIdInput, setPartnerOrgIdInput] = useState('');
  const [partnerNotesInput, setPartnerNotesInput] = useState('');
  const [loadingPartners, setLoadingPartners] = useState(false);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setOrganizations([]);
        return;
      }
      const response = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      } else if (response.status === 401) {
        setOrganizations([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch current user', err);
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
    fetchCurrentUser();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleFileChange = (file) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreview('');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', logoUrl: '', registrationNumber: '', country: '', budget: '' });
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Organizations.create submit', formData, logoFile);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showSuccessToast('You must be signed in to create an organization. Please sign in and try again.');
        return;
      }
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          logoUrl: formData.logoUrl, // Only use string if no file
          registrationNumber: formData.registrationNumber,
          country: formData.country,
          budget: formData.budget ? parseFloat(formData.budget) : null
        })
      });

      if (response.ok) {
        const newOrg = await response.json();

        // If there's a file, upload it with progress and update the created org immediately
        if (logoFile) {
          const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_URL}/${newOrg.id}/logo`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(pct);
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve(null); }
              } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error('Upload network error'));
            const fd = new FormData();
            fd.append('file', logoFile);
            xhr.send(fd);
          });

          if (uploadResult && uploadResult.LogoUrl) {
            newOrg.logoUrl = uploadResult.LogoUrl;
          }

          // Insert the new org into the current list for immediate UX feedback
          setOrganizations(prev => [newOrg, ...prev]);
          setUploadProgress(0);
        } else {
          // No file: just prepend the created org
          setOrganizations(prev => [newOrg, ...prev]);
        }

        setIsModalOpen(false);
        resetForm();
      } else {
        const errorText = await parseApiResponse(response);
        showErrorToast(`Failed to create organization: ${response.status} ${response.statusText}\n${errorText}`);
      }
    } catch (err) {
      console.error(err);
      showErrorToast(`Failed to create organization: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to soft-delete this organization?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchOrganizations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!selectedOrgForTransfer || !selectedNewOwner) {
      showSuccessToast('Please select a new owner');
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
        showSuccessToast('Ownership transfer request sent. The new owner will receive an email to confirm the transfer.');
        setIsTransferModalOpen(false);
        setSelectedOrgForTransfer(null);
        setSelectedNewOwner(null);
        setOrgMembers([]);
      } else {
        const error = await parseApiResponse(response);
        showErrorToast('Failed to transfer ownership: ' + error);
      }
    } catch (err) {
      console.error('Failed to transfer ownership', err);
      showErrorToast('Failed to transfer ownership: ' + err.message);
    }
  };

  const openTransferModal = async (org) => {
    setSelectedOrgForTransfer(org);
    setSelectedNewOwner(null);
    await fetchOrgMembers(org.id);
    setIsTransferModalOpen(true);
  };

  const fetchPartners = async (orgId) => {
    try {
      setLoadingPartners(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch (err) {
      console.error('Failed to fetch partners', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  const openPartnersModal = async (org) => {
    setSelectedOrgForPartners(org);
    setPartnerOrgIdInput('');
    setPartnerNotesInput('');
    await fetchPartners(org.id);
    setIsPartnersModalOpen(true);
  };

  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!partnerOrgIdInput || !selectedOrgForPartners) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/${selectedOrgForPartners.id}/partners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          partnerOrgId: parseInt(partnerOrgIdInput),
          notes: partnerNotesInput
        })
      });
      if (res.ok) {
        setPartnerOrgIdInput('');
        setPartnerNotesInput('');
        fetchPartners(selectedOrgForPartners.id);
        fetchOrganizations();
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(`Failed to add partner: ${errText}`);
      }
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleUnlinkPartner = async (partnerOrgId) => {
    if (!selectedOrgForPartners || !window.confirm('Remove this partner link?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/${selectedOrgForPartners.id}/partners/${partnerOrgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPartners(selectedOrgForPartners.id);
        fetchOrganizations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Organizations</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">All organizations</h1>
            <p className="mt-1 text-sm text-slate-500">Manage consortiums, partners, and your own entities.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            New Organization
          </button>
        </div>

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
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex gap-2">
                  {org.hasCompliance && (
                    <span title="Compliance Docs Added" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-700">✓</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPartnersModal(org)}
                    className="text-sm font-medium text-slate-700 hover:text-brand-600 transition flex items-center gap-1"
                  >
                    🤝 Partners ({org.partnerCount || 0})
                  </button>
                  {currentUser && org.ownerId === currentUser.id && (
                    <button
                      onClick={() => openTransferModal(org)}
                      className="text-sm font-medium text-brand-500 hover:text-brand-700"
                    >
                      Transfer Ownership
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
      </div>

      {/* Organization Risk & Issue Register Roll-up */}
      {organizations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <OrgRiskRollup
            orgId={localStorage.getItem('selectedOrganizationId') ? parseInt(localStorage.getItem('selectedOrganizationId'), 10) : organizations[0].id}
          />
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create Organization">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
            <input
              required
              name="name"
              value={formData.name}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
              <input
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reg Number</label>
              <input
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
            <input
              name="logoUrl"
              value={formData.logoUrl}
              onChange={(e) => {
                setFormData({ ...formData, logoUrl: e.target.value });
                if (logoFile) {
                  setLogoFile(null);
                  setLogoPreview('');
                }
              }}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Upload logo</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-brand-500"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="max-h-32 rounded-xl object-contain" />
              ) : (
                <div className="space-y-2 text-slate-500">
                  <p className="text-sm">Drag & drop an image here, or browse to upload.</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    Browse file
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Supported formats: PNG, JPG, JPEG, SVG</p>
            {logoPreview && (
              <p className="mt-3 text-sm text-slate-500">Selected file: {logoFile?.name}</p>
            )}
            {uploadProgress > 0 && (
              <div className="mt-3">
                <div className="w-full rounded-full bg-slate-100 h-2">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Uploading: {uploadProgress}%</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
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

      {/* Transfer Ownership Modal */}
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
            {orgMembers.filter(m => m.userId !== selectedOrgForTransfer?.ownerId && !m.email?.toLowerCase().startsWith('demo.') && !m.userName?.toLowerCase().includes('demo')).length === 0 ? (
              <p className="text-sm text-slate-500">No real members available to transfer ownership to.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orgMembers
                  .filter(m => m.userId !== selectedOrgForTransfer?.ownerId && !m.email?.toLowerCase().startsWith('demo.') && !m.userName?.toLowerCase().includes('demo'))
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

      {/* Consortium Partners Modal */}
      <Modal
        isOpen={isPartnersModalOpen}
        onClose={() => setIsPartnersModalOpen(false)}
        title={`Consortium Partnerships: ${selectedOrgForPartners?.name || ''}`}
      >
        <div className="space-y-6">
          <form onSubmit={handleAddPartner} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Link External Consortium Partner</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                required
                value={partnerOrgIdInput}
                onChange={(e) => setPartnerOrgIdInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select Partner Organization...</option>
                {organizations
                  .filter(o => o.id !== selectedOrgForPartners?.id && !partners.some(p => p.partnerOrgId === o.id))
                  .map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.country || 'Global'})
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={partnerNotesInput}
                onChange={(e) => setPartnerNotesInput(e.target.value)}
                placeholder="Partnership notes / scope..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={!partnerOrgIdInput}
                className="rounded-xl bg-[#5A45FF] px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition disabled:opacity-50"
              >
                + Link Partner
              </button>
            </div>
          </form>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Linked Partner Network</h4>
            {loadingPartners ? (
              <p className="text-xs text-slate-500 text-center py-6">Loading partners...</p>
            ) : partners.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                No active consortium partners linked yet. Select an organization above to establish a joint partnership link.
              </div>
            ) : (
              <div className="space-y-2">
                {partners.map((p) => (
                  <div key={p.partnerOrgId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div>
                      <h5 className="font-bold text-sm text-slate-900">{p.partnerName}</h5>
                      {p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}
                      <span className="text-[10px] text-slate-400">Linked: {new Date(p.linkedAt).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => handleUnlinkPartner(p.partnerOrgId)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-3 py-1 rounded-lg hover:bg-rose-50 transition"
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
