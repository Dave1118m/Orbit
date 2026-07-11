import { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal';

const API_URL = 'https://localhost:7065/api/v1/organizations';

export default function Organizations() {
  const fileInputRef = useRef(null);
  const [organizations, setOrganizations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
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
      const logoValue = logoFile ? await readFileAsDataUrl(logoFile) : formData.logoUrl;
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          logoUrl: logoValue,
          registrationNumber: formData.registrationNumber,
          country: formData.country,
          budget: formData.budget ? parseFloat(formData.budget) : null
        })
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchOrganizations();
      } else {
        const errorText = await response.text();
        alert(`Failed to create organization: ${response.status} ${response.statusText}\n${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to create organization: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
                <button
                  onClick={() => handleDelete(org.id)}
                  className="text-sm font-medium text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div />
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
              type="button"
              onClick={handleSubmit}
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
