import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import SearchSelect from '../SearchSelect';
import { parseApiResponse, showErrorToast } from '../../utils/toastHelper';

export default function AssignVolunteerModal({ isOpen, onClose, taskId, onAssigned }) {
  const { user } = useUser();
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.organizationId) {
      fetchVolunteers();
    }
  }, [isOpen, user]);

  const fetchVolunteers = async () => {
    try {
      const orgId = localStorage.getItem('selectedOrganizationId');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/volunteers/${orgId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setVolunteers(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVolunteerId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/volunteers/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ volunteerId: parseInt(selectedVolunteerId, 10) })
      });
      if (!res.ok) {
        const text = await parseApiResponse(res);
        throw new Error(text);
      }
      onAssigned();
      onClose();
    } catch (err) {
      showErrorToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-medium text-slate-800">Assign Volunteer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Volunteer</label>
            <SearchSelect
              options={volunteers.map(v => ({ value: v.id, label: `${v.name} (${v.skills || 'No skills specified'})` }))}
              value={selectedVolunteerId ? parseInt(selectedVolunteerId) : null}
              onChange={val => setSelectedVolunteerId(val || '')}
              placeholder="Choose a volunteer..."
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-medium text-sm">Cancel</button>
            <button type="submit" disabled={loading || !selectedVolunteerId} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
