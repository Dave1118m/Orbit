import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Modal from './Modal';
import GlobalSearchDropdown from './GlobalSearchDropdown';
import { createOrGetConnection, onEvent, offEvent } from '../lib/signalrClient';

export default function DashboardLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', preferredLanguage: '', mfaEnabled: false, photoUrl: '', phoneNumber: '' });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const profilePhotoInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pathName = location.pathname.split('/')[1] || 'Dashboard';
  const pageTitle = pathName.charAt(0).toUpperCase() + pathName.slice(1);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const resp = await fetch('https://localhost:7065/api/v1/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        setUser(data);
        setProfileForm({
          name: data.name || '',
          email: data.email || '',
          preferredLanguage: data.preferredLanguage || '',
          mfaEnabled: data.mfaEnabled || false,
          photoUrl: data.photoUrl || '',
          phoneNumber: data.phoneNumber || ''
        });
        setProfilePhotoPreview(data.photoUrl || '');
      } catch (err) {
        console.error('Failed to load current user', err);
      }
    }

    loadUser();
  }, []);

  // ── Setup SignalR for notifications ──────────────────────────────────────
  useEffect(() => {
    async function setupNotifications() {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Load unread count
        const countResp = await fetch('https://localhost:7065/api/v1/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (countResp.ok) {
          const data = await countResp.json();
          setUnreadNotificationCount(data.unreadCount);
        }

        // Setup SignalR listener
        const conn = await createOrGetConnection(token);
        const handleNotificationReceived = (notification) => {
          setUnreadNotificationCount(prev => prev + 1);
        };

        onEvent(conn, 'NotificationReceived', handleNotificationReceived);

        return () => {
          offEvent(conn, 'NotificationReceived', handleNotificationReceived);
        };
      } catch (err) {
        console.error('Failed to setup notifications', err);
      }
    }

    setupNotifications();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // ── Ctrl+K / Cmd+K shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleProfilePhotoChange = (file) => {
    if (!file) {
      setProfilePhotoFile(null);
      setProfilePhotoPreview(profileForm.photoUrl || '');
      return;
    }

    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setProfilePhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleProfileDrop = (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) handleProfilePhotoChange(file);
  };

  const handleProfileDragOver = (e) => {
    e.preventDefault();
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const photoUrl = profilePhotoFile ? await readFileAsDataUrl(profilePhotoFile) : profileForm.photoUrl;
      const response = await fetch(`https://localhost:7065/api/v1/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileForm.name,
          photoUrl,
          preferredLanguage: profileForm.preferredLanguage,
          phoneNumber: profileForm.phoneNumber,
          mfaEnabled: profileForm.mfaEnabled
        })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setProfileForm({
          name: updatedUser.name || '',
          email: updatedUser.email || '',
          preferredLanguage: updatedUser.preferredLanguage || '',
          mfaEnabled: updatedUser.mfaEnabled || false,
          photoUrl: updatedUser.photoUrl || '',
          phoneNumber: updatedUser.phoneNumber || ''
        });
        setProfilePhotoPreview(updatedUser.photoUrl || '');
        setProfilePhotoFile(null);
        setIsProfileModalOpen(false);
      } else {
        const error = await response.text();
        console.error('Failed to save profile', error);
        alert('Unable to save profile. Please try again.');
      }
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  };

  const userInitials = user?.name ? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : 'JK';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar - fixed left */}
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        
        {/* Top Header */}
        <header className="sticky top-0 z-10 flex h-20 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-slate-500 hover:text-slate-600 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-sm font-bold text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              </div>
              <span className="font-semibold text-slate-900">OrbitDesk</span>
            </div>
          </div>

          <div className="hidden lg:block w-1/3">
             <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
             <p className="text-sm text-slate-500">{today}</p>
          </div>

          {/* Desktop Search / Actions */}
          <div className="hidden flex-1 items-center justify-end lg:flex">
            <div className="w-full max-w-sm relative mr-6" ref={searchContainerRef}>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search anything..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-12 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                <kbd className="hidden rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-400 sm:inline-block">⌘K</kbd>
              </span>
              <GlobalSearchDropdown
                query={searchQuery}
                isOpen={isSearchOpen}
                onClose={() => { setIsSearchOpen(false); setSearchQuery(''); }}
              />
            </div>
            
            <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
              <button 
                onClick={() => navigate('/notifications')}
                className="relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-slate-600 transition shadow-sm"
              >
                <span className="sr-only">View notifications</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfile((prev) => !prev)}
                  className="h-10 w-10 overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-white shadow-sm"
                >
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-slate-800 text-sm text-white">
                      {userInitials}
                    </span>
                  )}
                </button>
                {showProfile && (
                  <div className="absolute right-0 top-full z-20 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-100">
                          {user?.photoUrl ? (
                            <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-700">
                              {userInitials}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{user?.name || 'Guest User'}</p>
                          <p className="text-sm text-slate-500">{user?.email || 'No email available'}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        <p>{user?.preferredLanguage ? `Language: ${user.preferredLanguage}` : 'No language preference set.'}</p>
                        <p>{user?.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          setIsProfileModalOpen(true);
                        }}
                        className="mt-4 w-full rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-2 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="User profile">
        <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">Profile photo</label>
              <div
                onDrop={handleProfileDrop}
                onDragOver={handleProfileDragOver}
                className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center"
              >
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-slate-500">
                    <p className="text-sm">Drop photo here</p>
                    <p className="text-xs">or click browse</p>
                  </div>
                )}
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleProfilePhotoChange(e.target.files[0]);
                  }}
                />
              </div>
              {profilePhotoFile && (
                <p className="mt-2 text-xs text-slate-400">Selected file: {profilePhotoFile.name}</p>
              )}
            </div>
            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  value={profileForm.email}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Preferred language</label>
                <input
                  value={profileForm.preferredLanguage}
                  onChange={(e) => setProfileForm({ ...profileForm, preferredLanguage: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="mfaEnabled"
                  type="checkbox"
                  checked={profileForm.mfaEnabled}
                  onChange={(e) => setProfileForm({ ...profileForm, mfaEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="mfaEnabled" className="text-sm font-medium text-slate-700">Enable MFA</label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact email</label>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{profileForm.email || 'Not set'}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact phone</label>
              <input
                value={profileForm.phoneNumber}
                onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                type="tel"
                placeholder="Enter phone number"
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Save profile
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
