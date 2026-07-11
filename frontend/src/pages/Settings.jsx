import { useEffect, useState } from 'react';
import Modal from '../components/Modal';

const API_URL = 'https://localhost:7065/api/v1/organizations';

export default function Settings() {
  const [organizations, setOrganizations] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [inviteData, setInviteData] = useState({
    email: '',
    preAssignedRoleName: 'Member'
  });

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

  useEffect(() => {
    fetchOrganizations();
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

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Settings</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Organizations</h1>
            <p className="mt-1 text-sm text-slate-500">Manage your NGOs, country offices, and legal entities.</p>
          </div>
        </div>

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
                    <td className="px-6 py-4 font-medium text-slate-900">{org.name}</td>
                    <td className="px-6 py-4 text-slate-600">{org.country || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{org.registrationNumber || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{org.memberCount ?? '-'} </td>
                    <td className="px-6 py-4 text-slate-600">
                      {org.hasCompliance ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Yes</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">No</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{org.budget ? `$${org.budget.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenInvite(org.id)}
                        className="mr-4 text-brand-500 hover:text-brand-600 font-medium"
                      >
                        Invite
                      </button>
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
      </div>


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
    </>
  );
}
