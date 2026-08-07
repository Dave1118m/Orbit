import React, { useState } from 'react';
import SearchSelect from '../SearchSelect';

export default function VolunteerForm({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(
    initialData || { name: '', email: '', phoneNumber: '', skills: '', availability: '', backgroundCheckStatus: 'Pending', userId: '' }
  );
  
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      userId: formData.userId ? parseInt(formData.userId, 10) : null
    });
  };

  const statusOptions = [
    { value: 'Pending', label: 'Pending Review' },
    { value: 'Passed', label: 'Passed / Verified' },
    { value: 'Failed', label: 'Failed' },
    { value: 'NotRequired', label: 'Not Required' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">{initialData ? 'Edit Volunteer' : 'Add Volunteer'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="volunteer-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none shadow-sm" placeholder="Full name" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none shadow-sm" placeholder="Email" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone</label>
                <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none shadow-sm" placeholder="Phone" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Skills</label>
              <input type="text" name="skills" value={formData.skills} onChange={handleChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none shadow-sm" placeholder="Skills (comma separated)" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Availability</label>
              <input type="text" name="availability" value={formData.availability} onChange={handleChange} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none shadow-sm" placeholder="Availability schedule" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Background Check Status</label>
              <SearchSelect
                options={statusOptions}
                value={formData.backgroundCheckStatus}
                onChange={val => handleChange({ target: { name: 'backgroundCheckStatus', value: val || 'Pending' } })}
                placeholder="Select status..."
                isClearable={false}
              />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl">Cancel</button>
          <button type="submit" form="volunteer-form" className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-sm transition">
            {initialData ? 'Save Changes' : 'Save Volunteer'}
          </button>
        </div>
      </div>
    </div>
  );
}
