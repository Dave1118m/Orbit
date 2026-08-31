import { useEffect, useState, useRef } from 'react';
import Modal from '../components/Modal';
import SearchSelect from '../components/SearchSelect';
import { parseApiResponse, showErrorToast } from '../utils/toastHelper';
import { COUNTRY_OPTIONS, validateRegistrationNumber } from '../utils/countryData';

const API_URL = `${import.meta.env.VITE_API_URL}/organizations`;

/**
 * Global Workspace & Organization Administration Settings page.
 * Manages organization metadata, member invitations, ownership transfers,
 * RBAC permission matrix grids, workspace management, API security, and partner relationships.
 */
export default function Settings() {
  const fileInputRef = useRef(null);
  const editOrgLogoInputRef = useRef(null);
  const tabsSectionRef = useRef(null);

  const [organizations, setOrganizations] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [isTabsRevealed, setIsTabsRevealed] = useState(false);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'invite' | 'transfer' | 'security' | 'permissions' | 'workspaces'

  // ── Workspace state ──
  const [workspaces, setWorkspaces] = useState([]);
  const [isWorkspaceCreateOpen, setIsWorkspaceCreateOpen] = useState(false);
  const [isWorkspaceEditOpen, setIsWorkspaceEditOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [wsFormData, setWsFormData] = useState({ name: '', description: '', visibility: 'Public', budgetCeiling: '', isArchived: false });
  const [wsEditData, setWsEditData] = useState({ name: '', description: '', visibility: 'Public', budgetCeiling: '', isArchived: false });

  // ── Activity Feed state ──
  const [activityFeed, setActivityFeed] = useState([]);

  const [inviteData, setInviteData] = useState({
    email: '',
    preAssignedRoleName: 'Member'
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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

  const [abacRoles, setAbacRoles] = useState([]);
  const [abacPermissions, setAbacPermissions] = useState([]);
  const [permissionAuditLogs, setPermissionAuditLogs] = useState([]);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [customRoleDescription, setCustomRoleDescription] = useState('');
  const [customRoleScope, setCustomRoleScope] = useState('Workspace');
  const [creatingCustomRole, setCreatingCustomRole] = useState(false);

  const [orgPartners, setOrgPartners] = useState([]);
  const [partnerOrgIdInput, setPartnerOrgIdInput] = useState('');
  const [partnerNotesInput, setPartnerNotesInput] = useState('');
  const [loadingPartners, setLoadingPartners] = useState(false);

  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // ── Contact Inquiries & Direct Reply state ──
  const [contactInquiries, setContactInquiries] = useState([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [replyingInquiryId, setReplyingInquiryId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchContactInquiries = async () => {
    try {
      setLoadingInquiries(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContactInquiries(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch contact inquiries', err);
    } finally {
      setLoadingInquiries(false);
    }
  };

  useEffect(() => {
    fetchContactInquiries();
  }, []);

  const handleResolveInquiry = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact/${id}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: 'Marked resolved by administrator.' })
      });
      if (res.ok) {
        fetchContactInquiries();
        showStatus('success', 'Inquiry marked as resolved!');
      }
    } catch (err) {
      showStatus('error', 'Failed to update inquiry status.');
    }
  };

  const handleSendReplyEmail = async (inquiryId) => {
    if (!replyText.trim()) return;
    try {
      setSendingReply(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact/${inquiryId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ replyMessage: replyText })
      });
      if (res.ok) {
        showStatus('success', 'Official email reply sent via SendGrid!');
        setReplyingInquiryId(null);
        setReplyText('');
        fetchContactInquiries();
      } else {
        const errData = await res.json().catch(() => ({}));
        showStatus('error', errData.message || 'Failed to send reply email.');
      }
    } catch (err) {
      showStatus('error', 'Error connecting to email service.');
    } finally {
      setSendingReply(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch organizations', err);
    }
  };

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
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
    if (!orgId) return;
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

  const fetchOrgPartners = async (orgId) => {
    if (!orgId) return;
    try {
      setLoadingPartners(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrgPartners(data.partners || []);
      }
    } catch (err) {
      console.error('Failed to fetch org partners', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleAddOrgPartner = async (e) => {
    e.preventDefault();
    if (!partnerOrgIdInput || !selectedOrgId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/organizations/${selectedOrgId}/partners`, {
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
        fetchOrgPartners(selectedOrgId);
        fetchOrganizations();
      } else {
        const errText = await parseApiResponse(res);
        showErrorToast(`Failed to link partner: ${errText}`);
      }
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  const handleUnlinkOrgPartner = async (partnerOrgId) => {
    if (!selectedOrgId || !window.confirm('Unlink this consortium partner?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/organizations/${selectedOrgId}/partners/${partnerOrgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrgPartners(selectedOrgId);
        fetchOrganizations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkspaces = async (orgId) => {
    if (!orgId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/workspaces?orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setWorkspaces(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          name: wsFormData.name,
          description: wsFormData.description || null,
          visibility: wsFormData.visibility,
          budgetCeiling: wsFormData.budgetCeiling ? parseFloat(wsFormData.budgetCeiling) : null,
          isArchived: wsFormData.isArchived,
        }),
      });
      if (res.ok) {
        setIsWorkspaceCreateOpen(false);
        setWsFormData({ name: '', description: '', visibility: 'Public', budgetCeiling: '', isArchived: false });
        fetchWorkspaces(selectedOrgId);
        showStatus('success', 'Workspace created successfully.');
      } else {
        showStatus('error', 'Failed to create workspace.');
      }
    } catch (err) { showStatus('error', 'Network error.'); }
  };

  const handleEditWorkspace = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/workspaces/${selectedWorkspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: wsEditData.name,
          description: wsEditData.description || null,
          visibility: wsEditData.visibility,
          budgetCeiling: wsEditData.budgetCeiling ? parseFloat(wsEditData.budgetCeiling) : null,
          isArchived: wsEditData.isArchived,
        }),
      });
      if (res.ok) {
        setIsWorkspaceEditOpen(false);
        setSelectedWorkspace(null);
        fetchWorkspaces(selectedOrgId);
        showStatus('success', 'Workspace updated successfully.');
      } else {
        showStatus('error', 'Failed to update workspace.');
      }
    } catch (err) { showStatus('error', 'Network error.'); }
  };

  const openEditWorkspace = (ws) => {
    setSelectedWorkspace(ws);
    setWsEditData({
      name: ws.name || '',
      description: ws.description || '',
      visibility: ws.visibility || 'Public',
      budgetCeiling: ws.budgetCeiling != null ? String(ws.budgetCeiling) : '',
      isArchived: ws.isArchived || false,
    });
    setIsWorkspaceEditOpen(true);
  };

  const handleCreateCustomRole = async (e) => {
    e.preventDefault();
    if (!customRoleTitle.trim()) {
      showStatus('error', 'Role title is required.');
      return;
    }
    setCreatingCustomRole(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/permissions/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: customRoleTitle.trim(),
          description: customRoleDescription.trim() || null,
          defaultScope: customRoleScope === 'Organization' ? 0 : (customRoleScope === 'Workspace' ? 1 : 2),
          organizationId: selectedOrgId
        })
      });
      if (res.ok) {
        showStatus('success', `Custom role "${customRoleTitle.trim()}" created successfully!`);
        setCustomRoleTitle('');
        setCustomRoleDescription('');
        setIsCreateRoleModalOpen(false);
        fetchAbacData();
      } else {
        const errText = await parseApiResponse(res);
        showStatus('error', errText || 'Failed to create custom role.');
      }
    } catch (err) {
      showStatus('error', 'Network error creating custom role.');
    } finally {
      setCreatingCustomRole(false);
    }
  };

  const handleDeleteCustomRole = async (roleId, roleTitle) => {
    if (!window.confirm(`Are you sure you want to delete the custom role "${roleTitle}"? This cannot be undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/permissions/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showStatus('success', `Custom role "${roleTitle}" deleted.`);
        fetchAbacData();
      } else {
        const errText = await parseApiResponse(res);
        showStatus('error', errText || 'Failed to delete role.');
      }
    } catch (err) {
      showStatus('error', 'Network error deleting custom role.');
    }
  };

  const fetchAbacData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const [permRes, roleRes, logRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/permissions`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/permissions/roles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/permissions/audit-log`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (permRes.ok && roleRes.ok) {
        setAbacPermissions(await permRes.json());
        setAbacRoles(await roleRes.json());
      }
      if (logRes.ok) {
        setPermissionAuditLogs(await logRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch ABAC data', err);
    }
  };

  const fetchActivityFeed = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/activity?limit=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setActivityFeed(await res.json());
    } catch (err) { console.error('Failed to fetch activity feed', err); }
  };

  const getPhotoSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('data:') || url.startsWith('https://')) {
      return url;
    }
    return `${import.meta.env.VITE_API_URL.replace('/api/v1', '')}${url}`;
  };

  const userRoleRaw = user?.roles?.[0]?.name || 'Owner';
  const roleDisplayNames = {
    Owner: 'Owner',
    Admin: 'Admin',
    Coordinator: 'Coordinator',
    Manager: 'Manager',
    FinanceOfficer: 'Finance Officer',
    Member: 'Member',
    Viewer: 'Viewer'
  };
  const roleDisplayName = roleDisplayNames[userRoleRaw] || userRoleRaw;

  useEffect(() => {
    fetchOrganizations();
    fetchUser();
    fetchAbacData();
    fetchActivityFeed();

    window.addEventListener('personaChanged', fetchUser);
    return () => window.removeEventListener('personaChanged', fetchUser);
  }, []);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0] || null;

  useEffect(() => {
    if (selectedOrg) {
      setEditOrgData({
        name: selectedOrg.name || '',
        description: selectedOrg.description || '',
        logoUrl: selectedOrg.logoUrl || '',
        country: selectedOrg.country || '',
        registrationNumber: selectedOrg.registrationNumber || '',
        budget: selectedOrg.budget?.toString() || ''
      });
      setEditOrgLogoPreview(selectedOrg.logoUrl || '');
      setEditOrgLogoFile(null);
      fetchOrgMembers(selectedOrg.id);
      fetchWorkspaces(selectedOrg.id);
    }
  }, [selectedOrgId, organizations]);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 5000);
  };

  const handleCardClick = (orgId, targetTab = 'edit') => {
    setSelectedOrgId(orgId);
    setActiveTab(targetTab);
    setIsTabsRevealed(true);
    setTimeout(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this organization?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        showStatus('success', 'Organization deleted successfully');
        fetchOrganizations();
        if (selectedOrgId === id) {
          const remaining = organizations.filter(o => o.id !== id);
          setSelectedOrgId(remaining.length > 0 ? remaining[0].id : null);
          if (remaining.length === 0) setIsTabsRevealed(false);
        }
      } else {
        showStatus('error', 'Failed to delete organization. Ensure you have Owner/Admin permissions.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error deleting organization');
    }
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

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleEditOrgSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) {
      showStatus('error', 'Please select an organization first.');
      return;
    }
    try {
      setIsSubmitting(true);
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
        showStatus('success', 'Organization updated successfully!');
        fetchOrganizations();
      } else {
        showStatus('error', 'Failed to update organization.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error updating organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) {
      showStatus('error', 'Please select an organization to invite members.');
      return;
    }
    try {
      setIsSubmitting(true);
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
        setInviteData({ email: '', preAssignedRoleName: 'Member' });
        showStatus('success', 'Invitation sent successfully!');
        fetchOrgMembers(selectedOrgId);
      } else {
        showStatus('error', 'Failed to send invitation. Ensure you have Admin or Owner permissions.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error sending invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedNewOwner) {
      showStatus('error', 'Please select a new owner from the list.');
      return;
    }
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/${selectedOrgId}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newOwnerUserId: selectedNewOwner.userId })
      });
      if (response.ok) {
        showStatus('success', 'Ownership transfer request sent successfully!');
        setSelectedNewOwner(null);
        fetchOrganizations();
      } else {
        const error = await parseApiResponse(response);
        showStatus('error', 'Failed to transfer ownership: ' + error);
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Failed to transfer ownership: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file || !user) return;
    try {
      setIsUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${user.id}/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        fetchUser();
        showStatus('success', 'Profile photo updated!');
      } else {
        showStatus('error', 'Failed to upload photo.');
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Error uploading photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const orgSelectOptions = organizations.map((org) => ({
    value: org.id,
    label: `${org.name}${org.country ? ` (${org.country})` : ''}`,
    org: org
  }));

  const roles = [
    { name: 'Admin', desc: 'Full organization management, member invitations, and settings.' },
    { name: 'Coordinator', desc: 'Coordinates activities, teams, and volunteers across projects.' },
    { name: 'Manager', desc: 'Manages assigned projects, task assignments, and budget allocations.' },
    { name: 'FinanceOfficer', desc: 'Financial tracking, expense reviews, and budget reporting.' },
    { name: 'Member', desc: 'Standard team contributor access to assigned projects and tasks.' },
    { name: 'Viewer', desc: 'Read-only access to organization information and reports.' }
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Toast Notification */}
      {statusMessage.text && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border backdrop-blur-md transition-all duration-300 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-900/20' 
            : 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-900/20'
        }`}>
          <span className="text-lg">{statusMessage.type === 'success' ? '✨' : '⚠️'}</span>
          <p className="text-sm font-medium">{statusMessage.text}</p>
        </div>
      )}

      {/* User Profile Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[#5A45FF]/20 blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/3 -bottom-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl ring-4 ring-white/10 shadow-2xl transition group-hover:ring-[#5A45FF]/60">
                {user?.photoUrl ? (
                  <img src={getPhotoSrc(user?.photoUrl)} alt={roleDisplayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5A45FF] to-indigo-700 text-3xl font-extrabold text-white">
                    {roleDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  <span className="text-[10px] font-medium tracking-wider uppercase text-white/90">
                    {isUploadingPhoto ? 'Uploading...' : 'Change'}
                  </span>
                </div>
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
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md border border-white/10">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Account
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{roleDisplayName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-right px-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Organizations</p>
              <p className="text-xl font-extrabold text-white">{organizations.length}</p>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="text-right px-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Current Org</p>
              <p className="text-sm font-semibold text-indigo-200 truncate max-w-[140px]">
                {selectedOrg?.name || 'None Selected'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Dashboard & React-Select Organization Switcher */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5A45FF]"></span>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5A45FF]">Organizations Overview</p>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">Your Organization Cards</h2>
            <p className="mt-1 text-sm text-slate-500">Click any KPI card to select current organization and reveal management tabs.</p>
          </div>

          {/* React Select dropdown showing current organization */}
          <div className="w-full md:w-80 flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#5A45FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Current Selected Organization:
            </label>
            <SearchSelect
              options={orgSelectOptions}
              value={selectedOrgId}
              onChange={(val) => {
                if (val) {
                  setSelectedOrgId(val);
                  setIsTabsRevealed(true);
                }
              }}
              placeholder="Search & select organization..."
              isClearable={false}
            />
          </div>
        </div>

        {/* Small KPI Cards Grid (NO inline buttons on the card body) */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {organizations.map((org) => {
            const isSelected = org.id === selectedOrgId;
            return (
              <div
                key={org.id}
                onClick={() => handleCardClick(org.id, 'edit')}
                className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-[#5A45FF] bg-gradient-to-b from-[#5A45FF]/[0.05] to-indigo-50/30 shadow-md ring-2 ring-[#5A45FF]/40 scale-[1.02]'
                    : 'border-slate-200/80 hover:border-[#5A45FF]/40 hover:shadow-sm hover:scale-[1.01] bg-white'
                }`}
              >
                {/* Delete button (small trash icon at top right) */}
                <button
                  onClick={(e) => handleDelete(e, org.id)}
                  title="Delete Organization"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <div className="flex items-center gap-3">
                  {org.logoUrl ? (
                    <img src={org.logoUrl} alt={org.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5A45FF]/15 to-indigo-100 text-lg font-bold text-[#5A45FF]">
                      {org.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="pr-4 overflow-hidden">
                    <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-[#5A45FF] transition-colors">{org.name}</h3>
                    <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                      📍 {org.country || 'Global'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    👥 {org.memberCount ?? 0} <span className="text-[10px] text-slate-400 font-normal">members</span>
                  </span>
                  {org.budget ? (
                    <span className="font-semibold text-[#5A45FF] bg-indigo-50 px-2 py-0.5 rounded-full text-[11px]">
                      ${org.budget.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No budget set</span>
                  )}
                </div>

                {/* Indicator bar when selected */}
                {isSelected && (
                  <div className="mt-2.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#5A45FF]">
                    <span>Revealed in Tabs below</span>
                    <span>↓</span>
                  </div>
                )}
              </div>
            );
          })}

          {organizations.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center">
              <p className="text-slate-500">No organizations found.</p>
            </div>
          )}
        </div>
      </div>

      {/* REVEALED INDEPENDENT TABS SECTION */}
      {isTabsRevealed && selectedOrg && (
        <div ref={tabsSectionRef} className="rounded-3xl border border-[#5A45FF]/30 bg-white p-6 sm:p-8 shadow-lg ring-1 ring-[#5A45FF]/20 animate-fade-up">
          {/* Header of Revealed Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div className="flex items-center gap-3">
              {selectedOrg.logoUrl ? (
                <img src={selectedOrg.logoUrl} alt={selectedOrg.name} className="h-10 w-10 rounded-xl object-cover ring-2 ring-[#5A45FF]/30" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#5A45FF] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {selectedOrg.name?.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedOrg.name}</h3>
                  <span className="rounded-full bg-[#5A45FF]/10 px-2.5 py-0.5 text-xs font-bold text-[#5A45FF]">
                    Active Selected
                  </span>
                </div>
                <p className="text-xs text-slate-500">Management tools for {selectedOrg.name}</p>
              </div>
            </div>

            <button
              onClick={() => setIsTabsRevealed(false)}
              className="self-start sm:self-auto text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-full transition flex items-center gap-1"
            >
              <span>✕</span> Close Tabs
            </button>
          </div>

          {/* Independent Tab Navigation Bar */}
          <div className="mt-6 flex border-b border-slate-200/80 pb-3 gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'edit'
                  ? 'bg-gradient-to-r from-[#5A45FF] to-indigo-600 text-white shadow-md shadow-[#5A45FF]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Details
            </button>

            <button
              onClick={() => setActiveTab('invite')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'invite'
                  ? 'bg-gradient-to-r from-[#5A45FF] to-indigo-600 text-white shadow-md shadow-[#5A45FF]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite Members
            </button>

            <button
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'transfer'
                  ? 'bg-gradient-to-r from-[#5A45FF] to-indigo-600 text-white shadow-md shadow-[#5A45FF]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transfer Ownership
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'security'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Session Control
            </button>

            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'permissions'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Permissions Matrix
            </button>

            <button
              onClick={() => setActiveTab('workspaces')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'workspaces'
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Workspaces
            </button>

            <button
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'partners'
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Consortium Partners ({orgPartners.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('inquiries');
                fetchContactInquiries();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                activeTab === 'inquiries'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Landing Inquiries
              {contactInquiries.filter(i => !i.isResolved).length > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-extrabold animate-pulse">
                  {contactInquiries.filter(i => !i.isResolved).length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: EDIT DETAILS */}
          {activeTab === 'edit' && (
            <div className="mt-6 max-w-3xl">
              <form onSubmit={handleEditOrgSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Organization Name *</label>
                  <input
                    required
                    value={editOrgData.name}
                    onChange={(e) => setEditOrgData({ ...editOrgData, name: e.target.value })}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Description</label>
                  <textarea
                    rows={3}
                    value={editOrgData.description}
                    onChange={(e) => setEditOrgData({ ...editOrgData, description: e.target.value })}
                    placeholder="Overview of mission and scope..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Country</label>
                    <SearchSelect
                      options={COUNTRY_OPTIONS}
                      value={editOrgData.country}
                      onChange={(countryVal) => setEditOrgData({ ...editOrgData, country: countryVal || '' })}
                      placeholder="Select country..."
                      isClearable={false}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Registration Number / TIN {editOrgData.country === 'Ethiopia' && <span className="text-indigo-600 font-semibold">(Ethiopia)</span>}
                    </label>
                    <input
                      value={editOrgData.registrationNumber}
                      onChange={(e) => setEditOrgData({ ...editOrgData, registrationNumber: e.target.value })}
                      placeholder={editOrgData.country === 'Ethiopia' ? 'e.g. CSO/3421 or AA/12345/2016' : 'Registration code'}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 transition"
                    />
                    {editOrgData.country === 'Ethiopia' && (
                      <p className="mt-1 text-[11px] text-slate-400">Accepted: CSO/NGO code, Trade License, or Reg ID</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Organization Logo</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex min-h-[110px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4 text-center transition hover:border-[#5A45FF]">
                      {editOrgLogoPreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={editOrgLogoPreview} alt="Logo preview" className="max-h-20 rounded-xl object-contain shadow-sm" />
                          <button
                            type="button"
                            onClick={() => {
                              setEditOrgLogoFile(null);
                              setEditOrgLogoPreview('');
                              setEditOrgData({ ...editOrgData, logoUrl: '' });
                            }}
                            className="text-xs text-rose-600 hover:underline font-semibold"
                          >
                            Remove Logo
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 text-slate-500">
                          <p className="text-xs">Drag & drop logo image here or browse</p>
                          <button
                            type="button"
                            onClick={() => editOrgLogoInputRef.current?.click()}
                            className="rounded-full bg-[#5A45FF] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 transition"
                          >
                            Select Image File
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
                </div>

                <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-gradient-to-r from-[#5A45FF] to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#5A45FF]/20 hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: INVITE MEMBERS */}
          {activeTab === 'invite' && (
            <div className="mt-6 max-w-3xl">
              <form onSubmit={handleInviteSubmit} className="flex flex-col gap-6">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Member Email *</label>
                  <input
                    required
                    type="email"
                    name="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    placeholder="colleague@organization.org"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#5A45FF] focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">Select Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roles.map((role) => {
                      const isSelected = inviteData.preAssignedRoleName === role.name;
                      return (
                        <div
                          key={role.name}
                          onClick={() => setInviteData({ ...inviteData, preAssignedRoleName: role.name })}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#5A45FF] bg-[#5A45FF]/10 ring-2 ring-[#5A45FF]/30 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-sm ${isSelected ? 'text-[#5A45FF]' : 'text-slate-900'}`}>{role.name}</span>
                            {isSelected && <span className="text-[#5A45FF]">✓</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-normal">{role.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-gradient-to-r from-[#5A45FF] to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#5A45FF]/20 hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>

              {/* Members Preview */}
              <div className="mt-8 border-t border-slate-200/60 pt-6">
                <h4 className="font-bold text-slate-900 text-sm mb-3">Current Organization Members ({orgMembers.length})</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {orgMembers.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#5A45FF]/10 text-[#5A45FF] font-bold text-xs flex items-center justify-center">
                          {m.userName?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{m.userName}</p>
                          <p className="text-[11px] text-slate-500">{m.email}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-[#5A45FF]">
                        {m.roleName || 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSFER OWNERSHIP */}
          {activeTab === 'transfer' && (
            <div className="mt-6 max-w-3xl">
              <form onSubmit={handleTransferOwnership} className="flex flex-col gap-6">
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-amber-900">
                  <div className="flex gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-bold text-sm text-amber-900">Important Ownership Transfer Notice</p>
                      <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                        Transferring ownership will grant complete administrative authority over this organization to the chosen member.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">Select New Owner *</label>
                  {orgMembers.filter(m => m.userId !== selectedOrg?.ownerId && !m.email?.toLowerCase().startsWith('demo.') && !m.userName?.toLowerCase().includes('demo')).length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-500 text-sm">
                      No other real members found in this organization to transfer ownership to. Invite real team members first.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {orgMembers
                        .filter(m => m.userId !== selectedOrg?.ownerId && !m.email?.toLowerCase().startsWith('demo.') && !m.userName?.toLowerCase().includes('demo'))
                        .map((member) => {
                          const isSelected = selectedNewOwner?.userId === member.userId;
                          return (
                            <label
                              key={member.userId}
                              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-[#5A45FF] bg-[#5A45FF]/10 ring-2 ring-[#5A45FF]/30 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <input
                                  type="radio"
                                  name="newOwner"
                                  checked={isSelected}
                                  onChange={() => setSelectedNewOwner(member)}
                                  className="text-[#5A45FF] focus:ring-[#5A45FF] h-4 w-4"
                                />
                                <div>
                                  <p className="font-bold text-sm text-slate-900">{member.userName}</p>
                                  <p className="text-xs text-slate-500">{member.email}</p>
                                </div>
                              </div>
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                                {member.roleName || 'Member'}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                  <button
                    type="submit"
                    disabled={!selectedNewOwner || isSubmitting}
                    className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Transferring...' : 'Transfer Ownership'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: SESSION SECURITY */}
          {activeTab === 'security' && (
            <div className="mt-6 max-w-3xl">
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-rose-900">
                  <div className="flex gap-3">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <p className="font-bold text-sm text-rose-900">Active Session Control</p>
                      <p className="text-xs text-rose-800/90 mt-1 leading-relaxed">
                        Instantly revoke access tokens for active users in this organization. The user will be instantly logged out on their next action and their active JWT token will be administratively blocked.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-3">Organization Users</h4>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {orgMembers.map((member) => {
                      const isSelf = user && member.userId === user.id;
                      return (
                        <div key={member.userId} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white">
                          <div className="flex items-center gap-3.5">
                            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                              {member.userName?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-sm text-slate-900">{member.userName}</p>
                                {isSelf && (
                                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                                    Current Active Session
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                          </div>
                          {isSelf ? (
                            <span className="text-xs font-semibold text-slate-400 italic">Self (Protected)</span>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token');
                                  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/revoke`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ userId: member.userId, tokenId: '*' })
                                  });
                                  if (res.ok) {
                                    showStatus('success', `All active sessions revoked for ${member.userName}`);
                                  } else {
                                    showStatus('error', 'Failed to revoke sessions.');
                                  }
                                } catch (e) {
                                  showStatus('error', 'Network error while attempting to revoke session.');
                                }
                              }}
                              className="rounded-full bg-rose-50 text-rose-600 px-4 py-1.5 text-xs font-semibold hover:bg-rose-100 hover:text-rose-700 transition"
                            >
                              Revoke Sessions
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PERMISSIONS MATRIX (ABAC) */}
          {activeTab === 'permissions' && (
            <div className="mt-6 max-w-5xl">
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl bg-teal-50 border border-teal-100 p-4 text-teal-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="text-xl">🔐</span>
                    <div>
                      <p className="font-bold text-sm text-teal-900">Attribute-Based Access Control & Custom Roles</p>
                      <p className="text-xs text-teal-800/90 mt-1 leading-relaxed">
                        Granularly assign dynamic permissions to organizational roles or add specialized custom roles with scoped permissions.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCreateRoleModalOpen(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <span>➕ Create Custom Role</span>
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-4 px-6 min-w-[200px]">Role</th>
                          {abacPermissions.map((perm) => (
                            <th key={perm.id} className="py-4 px-4 text-center">
                              <span className="inline-block bg-slate-100 px-2 py-1 rounded-lg text-xs font-mono">{perm.name}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {abacRoles.map((role) => (
                          <tr key={role.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-medium text-slate-900">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-900">{role.displayName || role.name}</span>
                                    {!role.isSystemRole && (
                                      <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                        Custom
                                      </span>
                                    )}
                                    {role.isSystemRole && (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                                        System
                                      </span>
                                    )}
                                  </div>
                                  {role.description && (
                                    <p className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">{role.description}</p>
                                  )}
                                </div>
                                {!role.isSystemRole && (
                                  <button
                                    onClick={() => handleDeleteCustomRole(role.id, role.displayName || role.name)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Delete custom role"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                            {abacPermissions.map((perm) => {
                              const isOwnerRole = role.name === 'Owner';
                              const hasPerm = isOwnerRole || role.permissions?.some(p => p.id === perm.id);
                              return (
                                <td key={perm.id} className="py-4 px-4 text-center">
                                  {isOwnerRole ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200" title="Owner permissions are system-protected superuser access and cannot be revoked.">
                                      🔒 Full Access
                                    </span>
                                  ) : (
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={hasPerm || false}
                                        onChange={async (e) => {
                                          const isGranted = e.target.checked;
                                          try {
                                            const token = localStorage.getItem('token');
                                            const res = await fetch(`${import.meta.env.VITE_API_URL}/permissions/assign`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                              body: JSON.stringify({ roleId: role.id, permissionId: perm.id, isGranted: isGranted })
                                            });
                                            if (res.ok) {
                                              showStatus('success', 'Permissions dynamically updated!');
                                              fetchAbacData();
                                            } else {
                                              const errText = await parseApiResponse(res);
                                              showStatus('error', errText || 'Failed to update permissions.');
                                            }
                                          } catch(err) {
                                            showStatus('error', 'Network error.');
                                          }
                                        }}
                                      />
                                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                                    </label>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {abacRoles.length === 0 && (
                          <tr><td colSpan={abacPermissions.length + 1} className="p-8 text-center text-slate-500">No roles or permissions configured yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Custom Role Creation Modal */}
                <Modal isOpen={isCreateRoleModalOpen} onClose={() => setIsCreateRoleModalOpen(false)} title="Create Dynamic Custom Role">
                  <form onSubmit={handleCreateCustomRole} className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Role Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Procurement Specialist, Field Officer"
                        value={customRoleTitle}
                        onChange={(e) => setCustomRoleTitle(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Default Scope</label>
                      <select
                        value={customRoleScope}
                        onChange={(e) => setCustomRoleScope(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs bg-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      >
                        <option value="Organization">Organization Scope (Full Organization Level)</option>
                        <option value="Workspace">Workspace Scope (Assigned Workspaces Only)</option>
                        <option value="Project">Project Scope (Assigned Projects Only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
                      <textarea
                        rows={3}
                        placeholder="Describe duties and operational boundaries for this custom role..."
                        value={customRoleDescription}
                        onChange={(e) => setCustomRoleDescription(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateRoleModalOpen(false)}
                        className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingCustomRole}
                        className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                      >
                        {creatingCustomRole ? 'Creating Role...' : 'Create Role'}
                      </button>
                    </div>
                  </form>
                </Modal>

                {/* PERMISSION AUDIT LOG SECTION */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        📜 Permission Change Audit Trail
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time enterprise audit log of all role permission modifications</p>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2.5 py-1 rounded-lg">
                      {permissionAuditLogs.length} events logged
                    </span>
                  </div>

                  {permissionAuditLogs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No permission modifications recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4">Timestamp</th>
                            <th className="py-2.5 px-4">Action</th>
                            <th className="py-2.5 px-4">Performed By</th>
                            <th className="py-2.5 px-4">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {permissionAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                  log.action === 'GrantPermission' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-800">
                                {log.performedBy}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                                {log.newValues || log.oldValues}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* TAB 6: WORKSPACES */}
          {activeTab === 'workspaces' && (
            <div className="mt-6 max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">🗂️ Workspaces</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage workspaces for {selectedOrg?.name}. Workspaces group projects and teams.</p>
                </div>
                <button
                  onClick={() => setIsWorkspaceCreateOpen(true)}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-violet-600 hover:to-purple-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Workspace
                </button>
              </div>

              {workspaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center">
                  <div className="text-3xl mb-2">🗂️</div>
                  <p className="text-sm font-semibold text-slate-600">No workspaces yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create your first workspace to start organizing projects.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workspaces.map(ws => (
                    <div key={ws.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-violet-300 transition">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold text-sm">
                          {ws.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{ws.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {ws.description || 'No description'} ·
                            {' '}{['Public', 'Private', 'Restricted'][ws.visibility] ?? 'Public'}
                            {ws.budgetCeiling ? ` · $${ws.budgetCeiling.toLocaleString()} ceiling` : ''}
                          </p>
                        </div>
                        {ws.isArchived && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Archived</span>
                        )}
                      </div>
                      <button
                        onClick={() => openEditWorkspace(ws)}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Workspace Modal */}
              <Modal isOpen={isWorkspaceCreateOpen} onClose={() => setIsWorkspaceCreateOpen(false)} title="New Workspace">
                <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                    <input required value={wsFormData.name} onChange={e => setWsFormData({...wsFormData, name: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="e.g. Kenya Programs" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                    <textarea rows={2} value={wsFormData.description} onChange={e => setWsFormData({...wsFormData, description: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" placeholder="Brief description..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Visibility</label>
                    <select value={wsFormData.visibility} onChange={e => setWsFormData({...wsFormData, visibility: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none">
                      <option value="Public">Public</option>
                      <option value="Private">Private</option>
                      <option value="Restricted">Restricted</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setIsWorkspaceCreateOpen(false)} className="rounded-full px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                    <button type="submit" className="rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:from-violet-600 transition shadow-sm">Create</button>
                  </div>
                </form>
              </Modal>

              {/* Edit Workspace Modal */}
              <Modal isOpen={isWorkspaceEditOpen} onClose={() => setIsWorkspaceEditOpen(false)} title="Edit Workspace">
                <form onSubmit={handleEditWorkspace} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                    <input required value={wsEditData.name} onChange={e => setWsEditData({...wsEditData, name: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                    <textarea rows={2} value={wsEditData.description} onChange={e => setWsEditData({...wsEditData, description: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Visibility</label>
                    <select value={wsEditData.visibility} onChange={e => setWsEditData({...wsEditData, visibility: e.target.value})}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none">
                      <option value="Public">Public</option>
                      <option value="Private">Private</option>
                      <option value="Restricted">Restricted</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="ws-archived" checked={wsEditData.isArchived} onChange={e => setWsEditData({...wsEditData, isArchived: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    <label htmlFor="ws-archived" className="text-sm font-medium text-slate-700">Archive this workspace</label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setIsWorkspaceEditOpen(false)} className="rounded-full px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                    <button type="submit" className="rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:from-violet-600 transition shadow-sm">Save Changes</button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* TAB 8: CONSORTIUM PARTNERS */}
          {activeTab === 'partners' && (
            <div className="mt-6 max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">🤝 Consortium Partnerships</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage inter-organization links and co-implementer partnerships for {selectedOrg?.name}.</p>
                </div>
              </div>

              <form onSubmit={handleAddOrgPartner} className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Link External Consortium Partner</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    required
                    value={partnerOrgIdInput}
                    onChange={(e) => setPartnerOrgIdInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 focus:border-[#5A45FF]"
                  >
                    <option value="">Select Partner Organization...</option>
                    {organizations
                      .filter(o => o.id !== selectedOrgId && !orgPartners.some(p => p.partnerOrgId === o.id))
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
                    placeholder="Partnership scope / notes..."
                    className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#5A45FF]/20 focus:border-[#5A45FF]"
                  />
                  <button
                    type="submit"
                    disabled={!partnerOrgIdInput}
                    className="rounded-xl bg-[#5A45FF] px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-600 transition shadow-xs disabled:opacity-50"
                  >
                    + Link Partner
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Linked Partner Network ({orgPartners.length})</h4>
                {loadingPartners ? (
                  <p className="text-xs text-slate-500 text-center py-6">Loading partners...</p>
                ) : orgPartners.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                    No active consortium partners linked yet to {selectedOrg?.name}. Select an organization above to link a partner.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orgPartners.map((p) => (
                      <div key={p.partnerOrgId} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition">
                        <div>
                          <h5 className="font-bold text-sm text-slate-900">{p.partnerName}</h5>
                          {p.notes && <p className="text-xs text-slate-600 mt-0.5">{p.notes}</p>}
                          <span className="text-[10px] text-slate-400">Linked: {new Date(p.linkedAt).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => handleUnlinkOrgPartner(p.partnerOrgId)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: LANDING INQUIRIES */}
          {activeTab === 'inquiries' && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">📩 Public Contact & Demo Inquiries</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time incoming messages submitted from the public Landing Page contact form.</p>
                </div>
                <button
                  onClick={fetchContactInquiries}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#5A45FF] hover:underline bg-indigo-50 px-3 py-1.5 rounded-full transition"
                >
                  🔄 Refresh List
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                {loadingInquiries ? (
                  <p className="text-xs text-slate-500 text-center py-8">Loading contact inquiries...</p>
                ) : contactInquiries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-500">
                    No public contact inquiries submitted yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contactInquiries.map((inquiry) => (
                      <div
                        key={inquiry.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition ${
                          inquiry.isResolved
                            ? 'bg-slate-50 border-slate-200 opacity-80'
                            : 'bg-white border-amber-200 shadow-sm ring-1 ring-amber-400/20'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              inquiry.isResolved ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inquiry.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-slate-900 text-sm">{inquiry.name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  inquiry.isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                                }`}>
                                  {inquiry.isResolved ? 'Resolved' : 'New / Pending'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{inquiry.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-medium mr-1">
                              {new Date(inquiry.createdAt).toLocaleString()}
                            </span>
                            <button
                              onClick={() => {
                                setReplyingInquiryId(replyingInquiryId === inquiry.id ? null : inquiry.id);
                                setReplyText(`Dear ${inquiry.name},\n\nThank you for reaching out to Orbit Platform regarding ${inquiry.subject}.\n\n`);
                              }}
                              className="rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-90 transition shadow-xs flex items-center gap-1"
                            >
                              <span>✉️ Reply Email</span>
                            </button>
                            {!inquiry.isResolved && (
                              <button
                                onClick={() => handleResolveInquiry(inquiry.id)}
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 transition shadow-xs"
                              >
                                ✓ Resolve
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3">
                          <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700 mb-2">
                            Topic: {inquiry.subject}
                          </span>
                          <p className="text-xs sm:text-sm text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 leading-relaxed whitespace-pre-wrap">
                            {inquiry.message}
                          </p>
                        </div>

                        {/* Display Sent Reply History */}
                        {inquiry.replyMessage && (
                          <div className="mt-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-extrabold text-emerald-900">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Official Email Reply Sent by {inquiry.repliedByUserName || 'Admin'}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-mono">
                                {inquiry.repliedAt ? new Date(inquiry.repliedAt).toLocaleString() : ''}
                              </span>
                            </div>
                            <p className="text-xs text-emerald-950 font-medium leading-relaxed bg-white/70 p-3 rounded-xl border border-emerald-200/50 whitespace-pre-wrap">
                              {inquiry.replyMessage}
                            </p>
                          </div>
                        )}

                        {/* Inline Compose Reply Editor */}
                        {replyingInquiryId === inquiry.id && (
                          <div className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-slate-50 p-4 space-y-3 shadow-md animate-fade-in">
                            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-indigo-900">Compose Direct Response</span>
                                <span className="text-[11px] font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">To: {inquiry.email}</span>
                              </div>
                              <button
                                onClick={() => setReplyingInquiryId(null)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                              >
                                ✕ Close
                              </button>
                            </div>

                            <textarea
                              rows={4}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed resize-none"
                            ></textarea>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-slate-500 font-medium">Dispatched via SendGrid Service</span>
                              <button
                                onClick={() => handleSendReplyEmail(inquiry.id)}
                                disabled={sendingReply || !replyText.trim()}
                                className="rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 px-5 py-2 text-xs font-extrabold text-white hover:opacity-95 transition shadow-md disabled:opacity-50 flex items-center gap-2"
                              >
                                {sendingReply ? 'Sending Email via SendGrid...' : '✉️ Send Official Reply Now'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Activity Feed Card ── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600">System Activity</p>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900 tracking-tight">Organization Activity Feed</h2>
            <p className="mt-0.5 text-sm text-slate-500">Real-time log of all system actions performed across your organization.</p>
          </div>
          <button
            onClick={fetchActivityFeed}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        {activityFeed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {activityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xs mt-0.5">
                  {(item.performedByUserName || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-slate-900">{item.performedByUserName || 'System'}</span>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      item.action === 'Create' ? 'bg-emerald-100 text-emerald-700' :
                      item.action === 'Delete' ? 'bg-rose-100 text-rose-700' :
                      item.action === 'Update' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{item.action}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{item.entity}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
