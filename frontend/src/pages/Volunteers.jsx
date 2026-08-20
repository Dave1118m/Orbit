import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import SearchSelect from '../components/SearchSelect';
import { AutoText } from '../contexts/TranslationContext';
import { parseApiResponse, showErrorToast, showSuccessToast } from '../utils/toastHelper';

const API_BASE = import.meta.env.VITE_API_URL;

// Generate color gradient based on string name
const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];
function getAvatarGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function InitialsAvatar({ name, size = 'md' }) {
  const initials = (name || '??')
    .split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
    
  const sizeClasses = size === 'lg' 
    ? 'h-14 w-14 text-lg font-bold' 
    : 'h-10 w-10 text-sm font-semibold';

  return (
    <div className={`${sizeClasses} flex items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarGradient(name)} text-white shadow-sm shrink-0`}>
      {initials}
    </div>
  );
}

export default function Volunteers() {
  const { user } = useUser();
  const token = localStorage.getItem('token');
  const storedOrgId = localStorage.getItem('selectedOrganizationId');
  const orgId = (storedOrgId && storedOrgId !== 'undefined' && storedOrgId !== 'null') 
    ? storedOrgId 
    : (user?.organizationId || user?.primaryOrganizationId || 0);

  // Master List State
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  
  // Selected Volunteer & Detail Workspace State
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'log-hours' | 'view-hours' | 'assignments'

  // Modals & New Volunteer Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVolunteerData, setNewVolunteerData] = useState({
    name: '', email: '', phoneNumber: '', skills: '', availability: '', backgroundCheckStatus: 'Pending', userId: ''
  });

  // Tab Data State (Fetched per selected volunteer)
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    skills: '',
    availability: '',
    backgroundCheckStatus: 'Pending',
    userId: ''
  });
  const [hoursList, setHoursList] = useState([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [availableTasks, setAvailableTasks] = useState([]);

  // Log Hours Form State inside tab
  const [logHoursForm, setLogHoursForm] = useState({
    taskId: '', hours: '', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [submittingHours, setSubmittingHours] = useState(false);

  // Edit Logged Hours State
  const [editingHourLog, setEditingHourLog] = useState(null);
  const [editHoursForm, setEditHoursForm] = useState({
    id: null, hours: '', date: '', notes: ''
  });
  const [updatingHours, setUpdatingHours] = useState(false);

  const handleStartEditHour = (h) => {
    setEditingHourLog(h);
    setEditHoursForm({
      id: h.id,
      hours: String(h.hours),
      date: h.date ? h.date.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: h.notes || ''
    });
  };

  const handleSaveEditHour = async (e) => {
    e.preventDefault();
    if (!editHoursForm.id || !editHoursForm.hours || !editHoursForm.date) return;
    setUpdatingHours(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/hours/${editHoursForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          hours: parseFloat(editHoursForm.hours),
          date: editHoursForm.date,
          notes: editHoursForm.notes
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const text = errJson.message || (await parseApiResponse(res).catch(() => ''));
        throw new Error(text || 'Failed to update hour log');
      }
      setEditingHourLog(null);
      if (selectedVolunteer) fetchVolunteerHours(selectedVolunteer.id);
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setUpdatingHours(false);
    }
  };

  const handleDeleteHourLog = async (hourId) => {
    if (!window.confirm('Are you sure you want to delete this logged hour entry?')) return;
    try {
      const res = await fetch(`${API_BASE}/volunteers/hours/${hourId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (selectedVolunteer) fetchVolunteerHours(selectedVolunteer.id);
      } else {
        showErrorToast('Failed to delete hour log.');
      }
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  // Assign Task Form State inside tab
  const [assignTaskId, setAssignTaskId] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Invite Modal State
  const [inviteModal, setInviteModal] = useState({
    isOpen: false,
    volunteerName: '',
    volunteerEmail: '',
    inviteUrl: '',
    sendingEmail: false,
    emailStatusMsg: null
  });

  const handleOpenInviteModal = async (volunteer) => {
    if (!volunteer) return;
    try {
      const res = await fetch(`${API_BASE}/volunteers/${volunteer.id}/invite-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInviteModal({
          isOpen: true,
          volunteerName: volunteer.name,
          volunteerEmail: volunteer.email || data.email,
          inviteUrl: data.inviteUrl,
          sendingEmail: false,
          emailStatusMsg: null
        });
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(`Notice: ${errText}`);
      }
    } catch (err) {
      showErrorToast(`Error generating setup link: ${err.message}`);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!selectedVolunteer) return;
    setInviteModal(prev => ({ ...prev, sendingEmail: true, emailStatusMsg: null }));
    try {
      const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}/send-invite-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInviteModal(prev => ({
        ...prev,
        sendingEmail: false,
        emailStatusMsg: data.message || `Invitation email sent to ${inviteModal.volunteerEmail}!`
      }));
    } catch (err) {
      setInviteModal(prev => ({ ...prev, sendingEmail: false, emailStatusMsg: `Error: ${err.message}` }));
    }
  };

  // ── 1. Fetch Master Volunteers List ──
  const fetchVolunteers = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/volunteers/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setVolunteers([]);
          return;
        }
        throw new Error('Failed to fetch volunteer registry.');
      }
      const data = await res.json();
      setVolunteers(data);
      if (data.length > 0 && !selectedVolunteer) {
        setSelectedVolunteer(data[0]);
      } else if (selectedVolunteer) {
        const refreshed = data.find(v => v.id === selectedVolunteer.id);
        if (refreshed) setSelectedVolunteer(refreshed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteers();
  }, [user, orgId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sync edit form data whenever selected volunteer changes
  useEffect(() => {
    if (selectedVolunteer) {
      setEditFormData({
        name: selectedVolunteer.name || '',
        email: selectedVolunteer.email || '',
        phoneNumber: selectedVolunteer.phoneNumber || '',
        skills: selectedVolunteer.skills || '',
        availability: selectedVolunteer.availability || '',
        backgroundCheckStatus: selectedVolunteer.backgroundCheckStatus || 'Pending',
        userId: selectedVolunteer.userId || ''
      });
      fetchVolunteerHours(selectedVolunteer.id);
      fetchVolunteerAssignments(selectedVolunteer.id);
    }
  }, [selectedVolunteer?.id]);

  // ── Fetch Volunteer Hours Log for Tab ──
  const fetchVolunteerHours = async (volId) => {
    if (!volId) return;
    setLoadingHours(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/${volId}/hours`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setHoursList(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHours(false);
    }
  };

  // ── Fetch Volunteer Task Assignments for Tab ──
  const fetchVolunteerAssignments = async (volId) => {
    if (!volId) return;
    setLoadingAssignments(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/${volId}/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAssignmentsList(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // ── Fetch Tasks for Assignment Pickers ──
  useEffect(() => {
    const fetchTasks = async () => {
      if (!orgId) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        if (orgId) {
          headers['X-Organization-Id'] = orgId;
        }
        const res = await fetch(`${API_BASE}/tasks`, { headers });
        if (res.ok) {
          setAvailableTasks(await res.json());
        }
      } catch (err) { console.error(err); }
    };
    fetchTasks();
  }, [token, orgId]);

  // Filter & Sort
  const filteredVolunteers = useMemo(() => {
    if (!debouncedSearch) return volunteers;
    return volunteers.filter(v => {
      const hay = `${v.name} ${v.email || ''} ${v.skills || ''}`.toLowerCase();
      return hay.includes(debouncedSearch);
    });
  }, [volunteers, debouncedSearch]);

  const sortedVolunteers = useMemo(() => {
    const arr = [...filteredVolunteers];
    if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'status') arr.sort((a, b) => (a.backgroundCheckStatus || '').localeCompare(b.backgroundCheckStatus || ''));
    return arr;
  }, [filteredVolunteers, sortBy]);

  // ── Actions ──
  const handleCreateVolunteer = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newVolunteerData,
        organizationId: parseInt(orgId, 10),
        userId: newVolunteerData.userId ? parseInt(newVolunteerData.userId, 10) : null
      };
      const res = await fetch(`${API_BASE}/volunteers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create volunteer');
      
      setIsAddModalOpen(false);
      setNewVolunteerData({ name: '', email: '', phoneNumber: '', skills: '', availability: '', backgroundCheckStatus: 'Pending', userId: '' });
      fetchVolunteers();
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleUpdateVolunteer = async (e) => {
    e.preventDefault();
    if (!selectedVolunteer) return;
    try {
      const payload = {
        ...editFormData,
        organizationId: parseInt(orgId, 10),
        userId: editFormData.userId ? parseInt(editFormData.userId, 10) : null
      };
      const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update volunteer profile');
      showSuccessToast('Volunteer profile updated successfully!');
      fetchVolunteers();
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleDeleteVolunteer = async (volId) => {
    if (!confirm('Are you sure you want to delete this volunteer profile? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/volunteers/${volId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete volunteer');
      setSelectedVolunteer(null);
      fetchVolunteers();
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleSubmitLogHours = async (e) => {
    e.preventDefault();
    if (!selectedVolunteer || !logHoursForm.hours || !logHoursForm.date) return;
    setSubmittingHours(true);
    try {
      const payload = {
        volunteerId: selectedVolunteer.id,
        taskId: logHoursForm.taskId ? parseInt(logHoursForm.taskId, 10) : null,
        hours: parseFloat(logHoursForm.hours),
        date: logHoursForm.date,
        notes: logHoursForm.notes
      };
      const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}/log-hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await parseApiResponse(res);
        throw new Error(text || 'Failed to log hours');
      }
      showSuccessToast(`Logged ${logHoursForm.hours} hours for ${selectedVolunteer.name}!`);
      setLogHoursForm({ taskId: '', hours: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchVolunteerHours(selectedVolunteer.id);
      setActiveTab('view-hours');
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmittingHours(false);
    }
  };

  const handleSubmitAssignTask = async (e) => {
    e.preventDefault();
    if (!selectedVolunteer || !assignTaskId) return;
    setSubmittingAssign(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/tasks/${assignTaskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ volunteerId: selectedVolunteer.id })
      });
      if (!res.ok) {
        const text = await parseApiResponse(res);
        throw new Error(text || 'Failed to assign task');
      }
      showSuccessToast(`Assigned ${selectedVolunteer.name} to task successfully!`);
      setAssignTaskId('');
      fetchVolunteerAssignments(selectedVolunteer.id);
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUnassignTask = async (taskId) => {
    if (!selectedVolunteer || !taskId) return;
    if (!confirm(`Are you sure you want to unassign ${selectedVolunteer.name} from this task?`)) return;
    try {
      const res = await fetch(`${API_BASE}/volunteers/tasks/${taskId}/assign/${selectedVolunteer.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to unassign task.');
      showSuccessToast('Task unassigned successfully!');
      fetchVolunteerAssignments(selectedVolunteer.id);
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Passed') return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Passed</span>;
    if (status === 'Failed') return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">Failed</span>;
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>;
  };

  const totalLoggedHours = useMemo(() => {
    return hoursList.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
  }, [hoursList]);

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-shadow shadow-sm";

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Loading volunteer registry...</div>;
  if (error) return <div className="p-12 text-center text-rose-600 font-medium">{error}</div>;

  return (
    <div className="flex flex-col lg:flex-row min-h-full lg:h-[calc(100vh-6rem)] gap-6 pb-4">
      
      {/* ── Left Panel: Compact Volunteer Cards List ── */}
      <div className="flex w-full lg:w-96 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0 max-h-[380px] lg:max-h-none">
        
        {/* Header & Controls */}
        <div className="border-b border-slate-200 bg-slate-50/80 p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Volunteers</h1>
              <p className="text-xs text-slate-500">{volunteers.length} registered volunteers</p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const orgId = localStorage.getItem('selectedOrganizationId') || '0';
                  const link = `${window.location.origin}/apply-volunteer?orgId=${orgId}`;
                  navigator.clipboard.writeText(link);
                  showSuccessToast(`Public Application Link copied to clipboard:\n${link}`);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1 shadow-sm"
                title="Copy Public Volunteer Application URL"
              >
                🔗 Link
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 transition flex items-center gap-1"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search volunteer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-500 focus:outline-none bg-white"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 px-2 py-2 text-xs bg-white text-slate-700 font-medium"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {/* Compact Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedVolunteers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No volunteers found matching your query.</div>
          ) : (
            sortedVolunteers.map(vol => {
              const isSelected = selectedVolunteer?.id === vol.id;
              return (
                <button
                  key={vol.id}
                  onClick={() => setSelectedVolunteer(vol)}
                  className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                    isSelected
                      ? 'bg-brand-50/80 border-2 border-brand-500 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <InitialsAvatar name={vol.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`truncate font-semibold text-xs ${isSelected ? 'text-brand-900' : 'text-slate-900'}`}>
                        {vol.name}
                      </p>
                      {getStatusBadge(vol.backgroundCheckStatus)}
                    </div>
                    <p className="truncate text-[11px] text-slate-500 mt-0.5">
                      {vol.email || vol.phoneNumber || 'No contact info'}
                    </p>
                    {vol.skills && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {vol.skills.split(',').slice(0, 2).map((s, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Tabbed Detail Workspace ── */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {!selectedVolunteer ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-4 text-slate-400">👈</div>
            <h2 className="text-lg font-bold text-slate-700">Select a Volunteer Card</h2>
            <p className="text-sm text-slate-500 max-w-sm mt-1">Click any volunteer card on the left panel to edit details, log hours, or assign tasks.</p>
          </div>
        ) : (
          <>
            {/* Detail Banner Header */}
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 sm:px-8 py-4 sm:py-6 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <InitialsAvatar name={selectedVolunteer.name} size="lg" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900"><AutoText text={selectedVolunteer.name} /></h2>
                      <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">V-{selectedVolunteer.id}</span>
                      {getStatusBadge(selectedVolunteer.backgroundCheckStatus)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>📧 {selectedVolunteer.email || 'No email'}</span>
                      <span>📞 {selectedVolunteer.phoneNumber || 'No phone'}</span>
                      <span>📅 Added: {new Date(selectedVolunteer.createdAt || selectedVolunteer.id).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {selectedVolunteer.backgroundCheckStatus === 'Pending' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ backgroundCheckStatus: 'Passed' })
                            });
                            if (res.ok) {
                              showSuccessToast(`Approved & Verified ${selectedVolunteer.name}!`);
                              fetchVolunteers();
                              setSelectedVolunteer({ ...selectedVolunteer, backgroundCheckStatus: 'Passed' });
                            } else {
                              const errText = await parseApiResponse(res);
                              showErrorToast(`Notice: ${errText || 'Failed to approve volunteer application.'}`);
                            }
                          } catch (err) { showErrorToast(`Error: ${err.message}`); }
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        ✓ Approve Application
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ backgroundCheckStatus: 'Failed' })
                            });
                            if (res.ok) {
                              showSuccessToast(`Declined application for ${selectedVolunteer.name}.`);
                              fetchVolunteers();
                              setSelectedVolunteer({ ...selectedVolunteer, backgroundCheckStatus: 'Failed' });
                            }
                          } catch (err) { console.error(err); }
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        ✕ Decline
                      </button>
                    </>
                  )}
                  {selectedVolunteer.backgroundCheckStatus === 'Passed' && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/volunteers/${selectedVolunteer.id}/invite-link`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (res.ok) {
                            const data = await res.json();
                            navigator.clipboard.writeText(data.inviteUrl);
                            showSuccessToast(`Password Setup Link copied for ${selectedVolunteer.name}:\n\n${data.inviteUrl}\n\nSend this link to ${selectedVolunteer.name} so they can set their password and log in!`);
                          } else {
                            const errText = await parseApiResponse(res);
                            showErrorToast(`Notice: ${errText}`);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                      title="Copy Password Setup Link for this volunteer"
                    >
                      🔑 Invite Link
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteVolunteer(selectedVolunteer.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 rounded-xl hover:bg-rose-50 transition"
                  >
                    Delete Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Tabs Navigation */}
            <div className="flex gap-4 sm:gap-8 border-b border-slate-200 px-4 sm:px-8 bg-white shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => setActiveTab('edit')}
                className={`py-4 text-sm font-semibold capitalize border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'edit' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>✏️</span> Edit Profile
              </button>
              <button
                onClick={() => setActiveTab('log-hours')}
                className={`py-4 text-sm font-semibold capitalize border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'log-hours' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>⏱️</span> Log Hours
              </button>
              <button
                onClick={() => setActiveTab('view-hours')}
                className={`py-4 text-sm font-semibold capitalize border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'view-hours' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📊</span> View Hours ({hoursList.length})
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`py-4 text-sm font-semibold capitalize border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'assignments' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>📋</span> Assign &amp; Tasks ({assignmentsList.length})
              </button>
            </div>

            {/* Tab Workspace View Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">

              {/* ── TAB 1: EDIT PROFILE ── */}
              {activeTab === 'edit' && (
                <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">Volunteer Profile Settings</h3>
                  <form onSubmit={handleUpdateVolunteer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                        <input required type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                        <input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                        <input type="text" value={editFormData.phoneNumber} onChange={e => setEditFormData({...editFormData, phoneNumber: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Background Check Status</label>
                        <select value={editFormData.backgroundCheckStatus} onChange={e => setEditFormData({...editFormData, backgroundCheckStatus: e.target.value})} className={inputClass}>
                          <option value="Pending">Pending</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="NotRequired">Not Required</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
                      <input type="text" placeholder="e.g. Translation, Logistics, First Aid" value={editFormData.skills} onChange={e => setEditFormData({...editFormData, skills: e.target.value})} className={inputClass} />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Availability Schedule</label>
                      <input type="text" placeholder="e.g. Weekends, Mon/Wed evenings" value={editFormData.availability} onChange={e => setEditFormData({...editFormData, availability: e.target.value})} className={inputClass} />
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-4">
                      <button
                        type="button"
                        onClick={() => handleDeleteVolunteer(selectedVolunteer.id)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs border border-rose-200 transition"
                      >
                        Delete Profile
                      </button>
                      <button type="submit" className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs shadow-sm transition">
                        Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── TAB 2: LOG HOURS ── */}
              {activeTab === 'log-hours' && (
                <div className="max-w-xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="border-b border-slate-100 pb-3 mb-5">
                    <h3 className="font-bold text-slate-900">Log Volunteer Hours for {selectedVolunteer.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Record contribution hours for completed tasks or general volunteer service.</p>
                  </div>

                  <form onSubmit={handleSubmitLogHours} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Select Project Task</label>
                      <SearchSelect
                        options={availableTasks.map(t => ({ value: t.id, label: t.title }))}
                        value={logHoursForm.taskId ? parseInt(logHoursForm.taskId) : null}
                        onChange={val => setLogHoursForm({...logHoursForm, taskId: val || ''})}
                        placeholder="General Service / Unlinked"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Hours Served *</label>
                        <input required type="number" step="0.5" min="0.5" placeholder="Hours" value={logHoursForm.hours} onChange={e => setLogHoursForm({...logHoursForm, hours: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                        <input required type="date" max={new Date().toISOString().split('T')[0]} value={logHoursForm.date} onChange={e => setLogHoursForm({...logHoursForm, date: e.target.value})} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Activity Details</label>
                      <textarea rows={3} placeholder="Describe service activities..." value={logHoursForm.notes} onChange={e => setLogHoursForm({...logHoursForm, notes: e.target.value})} className={inputClass} />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={submittingHours} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition disabled:opacity-50">
                        {submittingHours ? 'Logging...' : 'Log Hours'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── TAB 3: VIEW HOURS ── */}
              {activeTab === 'view-hours' && (
                <div className="max-w-4xl space-y-4">
                  {/* Total Stat Banner */}
                  <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Total Contribution Hours</p>
                      <h4 className="text-3xl font-extrabold text-brand-600 mt-1">{totalLoggedHours} <span className="text-sm font-semibold text-slate-600">hrs</span></h4>
                    </div>
                    <button
                      onClick={() => setActiveTab('log-hours')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      + Log Hours
                    </button>
                  </div>

                  {loadingHours ? (
                    <div className="p-8 text-center text-xs text-slate-500">Loading hours log...</div>
                  ) : hoursList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      No hours logged yet for this volunteer.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="px-5 py-3">Date</th>
                            <th className="px-5 py-3">Task / Project</th>
                            <th className="px-5 py-3">Hours</th>
                            <th className="px-5 py-3">Notes</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {hoursList.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-slate-900 text-xs">
                                {new Date(h.date).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-3 text-slate-700 text-xs font-semibold">
                                {h.taskTitle || 'General Service'}
                              </td>
                              <td className="px-5 py-3 text-emerald-700 font-bold text-xs">
                                +{h.hours} hrs
                              </td>
                              <td className="px-5 py-3 text-slate-500 text-xs max-w-xs truncate">
                                {h.notes || '—'}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleStartEditHour(h)}
                                    className="px-2.5 py-1 text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition shadow-2xs flex items-center gap-1"
                                    title="Edit Hour Log"
                                  >
                                    <span>✏️ Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHourLog(h.id)}
                                    className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title="Delete Log"
                                  >
                                    <span>🗑️</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: ASSIGNMENTS & TASKS ── */}
              {activeTab === 'assignments' && (
                <div className="max-w-4xl space-y-6">
                  {/* Inline Assign Task Form */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Assign {selectedVolunteer.name} to a Project Task</h4>
                    <form onSubmit={handleSubmitAssignTask} className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <SearchSelect
                          options={availableTasks.map(t => ({ value: t.id, label: t.title }))}
                          value={assignTaskId ? parseInt(assignTaskId) : null}
                          onChange={val => setAssignTaskId(val || '')}
                          placeholder="Select a task to assign..."
                        />
                      </div>
                      <button type="submit" disabled={submittingAssign || !assignTaskId} className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 h-[40px]">
                        {submittingAssign ? 'Assigning...' : 'Assign Task'}
                      </button>
                    </form>
                  </div>

                  {/* Active Assignments Table */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">Assigned Tasks ({assignmentsList.length})</h4>
                    {loadingAssignments ? (
                      <div className="p-8 text-center text-xs text-slate-500">Loading task assignments...</div>
                    ) : assignmentsList.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        No active task assignments found for this volunteer.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                            <tr>
                              <th className="px-5 py-3">Task Title</th>
                              <th className="px-5 py-3">Assigned Date</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {assignmentsList.map(a => (
                              <tr key={a.id || a.taskId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-900 text-xs">
                                  {a.taskTitle || a.title || 'Assigned Project Task'}
                                </td>
                                <td className="px-5 py-3 text-slate-500 text-xs">
                                  {new Date(a.assignedAt || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                    {a.status || 'Active'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => handleUnassignTask(a.taskId)}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition border border-rose-200"
                                  >
                                    Unassign
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* ── CREATE NEW VOLUNTEER MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Add New Volunteer</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateVolunteer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input required type="text" value={newVolunteerData.name} onChange={e => setNewVolunteerData({...newVolunteerData, name: e.target.value})} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" value={newVolunteerData.email} onChange={e => setNewVolunteerData({...newVolunteerData, email: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input type="text" value={newVolunteerData.phoneNumber} onChange={e => setNewVolunteerData({...newVolunteerData, phoneNumber: e.target.value})} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Skills</label>
                <input type="text" placeholder="e.g. driving, translation" value={newVolunteerData.skills} onChange={e => setNewVolunteerData({...newVolunteerData, skills: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Background Check Status</label>
                <select value={newVolunteerData.backgroundCheckStatus} onChange={e => setNewVolunteerData({...newVolunteerData, backgroundCheckStatus: e.target.value})} className={inputClass}>
                  <option value="Pending">Pending</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="NotRequired">Not Required</option>
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-brand-500 py-2 text-xs font-semibold text-white hover:bg-brand-600">Save Volunteer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT LOG HOURS MODAL ── */}
      {editingHourLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Logged Service Hours</h3>
              <button onClick={() => setEditingHourLog(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveEditHour} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Hours Logged</label>
                <input
                  required
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={editHoursForm.hours}
                  onChange={(e) => setEditHoursForm({ ...editHoursForm, hours: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date of Service</label>
                <input
                  required
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={editHoursForm.date}
                  onChange={(e) => setEditHoursForm({ ...editHoursForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Notes / Activity Summary</label>
                <textarea
                  rows={3}
                  value={editHoursForm.notes}
                  onChange={(e) => setEditHoursForm({ ...editHoursForm, notes: e.target.value })}
                  placeholder="Describe activities completed during these service hours..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHourLog(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingHours}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {updatingHours ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
