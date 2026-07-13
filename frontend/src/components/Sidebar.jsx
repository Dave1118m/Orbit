import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Modal from './Modal';

const BACKEND_ORGANIZATIONS_URL = 'https://localhost:7065/api/v1/organizations';
const BACKEND_WORKSPACES_URL = 'https://localhost:7065/api/v1/workspaces';

const fallbackLinks = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { id: 'projects', label: 'Projects', to: '/projects', icon: 'folder' },
  { id: 'tasks', label: 'My Tasks', to: '/tasks', icon: 'check' },
  { id: 'teams', label: 'Team', to: '/teams', icon: 'users' },
  { id: 'notifications', label: 'Notifications', to: '/notifications', icon: 'bell' },
  { id: 'finance', label: 'Finance & Grants', to: '/finance', icon: 'dollar' },
  { id: 'volunteers', label: 'Volunteers', to: '/volunteers', icon: 'heart' },
  { id: 'reports', label: 'Reports', to: '/reports', icon: 'chart' },
    // Timeline removed per request
];

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const [links, setLinks] = useState(fallbackLinks);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [createOrgData, setCreateOrgData] = useState({ name: '', description: '', logoUrl: '', registrationNumber: '', country: '', budget: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadOrganizations() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const [orgResponse, workspaceResponse] = await Promise.all([
          fetch(BACKEND_ORGANIZATIONS_URL, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(BACKEND_WORKSPACES_URL, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (orgResponse.ok) {
          const orgs = await orgResponse.json();
          if (Array.isArray(orgs)) {
            setOrganizations(orgs);

            const storedOrg = localStorage.getItem('selectedOrganization');
            if (storedOrg) {
              try {
                const parsed = JSON.parse(storedOrg);
                const found = orgs.find((org) => org.id === parsed.id);
                setSelectedOrganization(found || orgs[0] || null);
              } catch {
                setSelectedOrganization(orgs[0] || null);
              }
            } else if (orgs.length > 0) {
              setSelectedOrganization(orgs[0]);
            }
          }
        }



      } catch (err) {
        console.error('Failed to load organizations', err);
      }
    }

    loadOrganizations();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const closeMenu = () => {
    if (setIsMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const handleSelectOrganization = (organization) => {
    setSelectedOrganization(organization);
    localStorage.setItem('selectedOrganization', JSON.stringify(organization));
    localStorage.setItem('selectedOrganizationId', String(organization.id));
    setIsOrgDropdownOpen(false);
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleLogoFileChange = (file) => {
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

  const handleLogoDrop = (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) handleLogoFileChange(file);
  };

  const handleLogoDragOver = (e) => {
    e.preventDefault();
  };

  const resetCreateOrgForm = () => {
    setCreateOrgData({ name: '', description: '', logoUrl: '', registrationNumber: '', country: '', budget: '' });
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You must be signed in to create an organization. Please sign in first.');
        navigate('/login');
        return;
      }
      const logoValue = logoFile ? await readFileAsDataUrl(logoFile) : createOrgData.logoUrl;
      const response = await fetch(BACKEND_ORGANIZATIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: createOrgData.name,
          description: createOrgData.description,
          logoUrl: logoValue,
          registrationNumber: createOrgData.registrationNumber,
          country: createOrgData.country,
          budget: createOrgData.budget ? parseFloat(createOrgData.budget) : null
        })
      });

      if (response.ok) {
        const newOrganization = await response.json();
        setOrganizations((prev) => [newOrganization, ...prev]);
        handleSelectOrganization(newOrganization);
        resetCreateOrgForm();
        setIsCreateOrgModalOpen(false);
      } else {
        alert('Failed to create organization.');
      }
    } catch (err) {
      console.error('Failed to create organization', err);
    }
  };

  const Icon = ({ name, active }) => {
    const cls = `h-5 w-5 ${active ? 'text-white' : 'text-slate-400'}`;
    switch(name) {
      case 'dashboard': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zm-10 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
      case 'building': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
      case 'folder': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
      case 'check': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'users': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
      case 'bell': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
      case 'dollar': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'heart': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
      case 'chart': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
      case 'calendar': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      default: return <span className="h-5 w-5 bg-slate-700 rounded-full"/>;
    }
  }

  return (
    <>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-brand-sidebar/80 backdrop-blur-sm lg:hidden" onClick={closeMenu} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-col bg-brand-sidebar text-slate-300 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo */}
        <div className="flex h-20 items-center px-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-xl font-bold text-white shadow-lg shadow-brand-500/30">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </div>
            <span className="text-xl font-bold text-white tracking-wide">OrbitDesk</span>
          </div>
        </div>

        {/* Organization Switcher */}
        <div className="px-4 mb-8 relative">
          <button
            onClick={() => setIsOrgDropdownOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-[#161B26] p-3 transition hover:bg-slate-800/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-sm font-bold text-white overflow-hidden">
                {selectedOrganization?.logoUrl ? (
                  <img src={selectedOrganization.logoUrl} alt={selectedOrganization.name} className="h-full w-full object-cover" />
                ) : (
                  selectedOrganization?.name?.charAt(0)?.toUpperCase() || 'O'
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{selectedOrganization?.name || 'Select organization'}</p>
                <p className="text-xs text-slate-500">{selectedOrganization ? 'Active workspace' : 'No organizations yet'}</p>
              </div>
            </div>
            <svg className={`h-4 w-4 text-slate-500 transition-transform ${isOrgDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOrgDropdownOpen && (
            <div className="absolute left-4 right-4 top-full mt-2 rounded-xl border border-slate-800 bg-[#161B26] shadow-xl z-50">
              <div className="max-h-56 overflow-y-auto p-2">
                {organizations.length > 0 ? organizations.map((organization) => (
                  <button
                    key={organization.id}
                    onClick={() => handleSelectOrganization(organization)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${selectedOrganization?.id === organization.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/70'}`}
                  >
                    <span className="font-medium">{organization.name}</span>
                    {selectedOrganization?.id === organization.id && <span className="text-brand-500">Active</span>}
                  </button>
                )) : (
                  <div className="px-3 py-2 text-sm text-slate-400">No organizations yet</div>
                )}
              </div>
              <button
                onClick={() => {
                  setIsOrgDropdownOpen(false);
                  setIsCreateOrgModalOpen(true);
                }}
                className="flex w-full items-center gap-2 border-t border-slate-800 px-4 py-3 text-sm font-medium text-brand-500 hover:bg-slate-800/70"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create Organization
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.id}
              to={link.to}
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-brand-500 text-white shadow-[0_0_15px_rgba(90,69,255,0.4)]' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={link.icon} active={isActive} />
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto p-4 mb-4">
          <div className="flex items-center gap-3">
            <NavLink
              to="/settings"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </NavLink>

            <button onClick={handleLogout} className="ml-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8v8"/></svg>
              Logout
            </button>
          </div>
        </div>
      </aside>



      <Modal isOpen={isCreateOrgModalOpen} onClose={() => { setIsCreateOrgModalOpen(false); resetCreateOrgForm(); }} title="Create Organization">
        <form onSubmit={handleCreateOrganization} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Organization Name *</label>
            <input
              required
              value={createOrgData.name}
              onChange={(e) => setCreateOrgData({ ...createOrgData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={createOrgData.description}
              onChange={(e) => setCreateOrgData({ ...createOrgData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
            <input
              value={createOrgData.logoUrl}
              onChange={(e) => {
                setCreateOrgData({ ...createOrgData, logoUrl: e.target.value });
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
              onDrop={handleLogoDrop}
              onDragOver={handleLogoDragOver}
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
                  if (e.target.files?.[0]) handleLogoFileChange(e.target.files[0]);
                }}
              />
            </div>
            {logoPreview && (
              <p className="mt-3 text-xs text-slate-500">Selected file: {logoFile?.name}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
              <input
                value={createOrgData.country}
                onChange={(e) => setCreateOrgData({ ...createOrgData, country: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reg Number</label>
              <input
                value={createOrgData.registrationNumber}
                onChange={(e) => setCreateOrgData({ ...createOrgData, registrationNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsCreateOrgModalOpen(false)} className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">Create</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
