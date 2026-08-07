import React, { useState } from 'react';
import {
  Calendar, Clock, Mail, CheckCircle2, Play, Pause, Trash2, Plus,
  FileSpreadsheet, FileText, Send, ShieldCheck, AlertCircle, RefreshCw
} from 'lucide-react';

export default function ScheduledReports() {
  const [schedules, setSchedules] = useState([
    {
      id: 1,
      name: 'Weekly NGO Statement of Activities',
      reportType: 'Statement of Functional Expenses',
      frequency: 'Weekly',
      cron: '0 8 * * MON',
      recipients: ['finance-head@ngo.org', 'director@ngo.org'],
      format: 'PDF',
      isActive: true,
      lastRun: '2026-07-20 08:00 AM',
      nextRun: '2026-07-27 08:00 AM',
    },
    {
      id: 2,
      name: 'Monthly Grant Allocation & Donor Audit',
      reportType: 'Grant Allocation & Donor Report',
      frequency: 'Monthly',
      cron: '0 9 1 * *',
      recipients: ['grants-compliance@ngo.org'],
      format: 'CSV',
      isActive: true,
      lastRun: '2026-07-01 09:00 AM',
      nextRun: '2026-08-01 09:00 AM',
    },
    {
      id: 3,
      name: 'Daily General Ledger Audit Log',
      reportType: 'Financial Transaction Audit Ledger',
      frequency: 'Daily',
      cron: '0 18 * * *',
      recipients: ['auditor@ngo.org'],
      format: 'CSV',
      isActive: false,
      lastRun: '2026-07-25 06:00 PM',
      nextRun: 'Paused',
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    reportType: 'Statement of Functional Expenses',
    frequency: 'Weekly',
    format: 'PDF',
    recipients: '',
  });

  const [triggeringId, setTriggeringId] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState(null);

  const toggleStatus = (id) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive, nextRun: !s.isActive ? '2026-07-27 08:00 AM' : 'Paused' } : s
      )
    );
  };

  const deleteSchedule = (id) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRunNow = (id, name) => {
    setTriggeringId(id);
    setTimeout(() => {
      setTriggeringId(null);
      setNotificationMessage(`Successfully triggered automated export for "${name}". Email dispatched to recipients.`);
      setTimeout(() => setNotificationMessage(null), 4000);
    }, 1000);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newSchedule.name) return;

    const created = {
      id: Date.now(),
      name: newSchedule.name,
      reportType: newSchedule.reportType,
      frequency: newSchedule.frequency,
      cron: newSchedule.frequency === 'Daily' ? '0 8 * * *' : '0 8 * * MON',
      recipients: newSchedule.recipients.split(',').map((r) => r.trim()).filter(Boolean),
      format: newSchedule.format,
      isActive: true,
      lastRun: 'Never',
      nextRun: 'Tomorrow 08:00 AM',
    };

    setSchedules([created, ...schedules]);
    setShowModal(false);
    setNewSchedule({ name: '', reportType: 'Statement of Functional Expenses', frequency: 'Weekly', format: 'PDF', recipients: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {notificationMessage && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-slideDown">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
              Automated Compliance Cron Engine
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Scheduled Reports & Automated Email Dispatch</h2>
          <p className="text-xs text-slate-500 mt-0.5">Configure recurring financial and operational reports delivered automatically to donor contacts & auditors</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Report</span>
        </button>
      </div>

      {/* Active Schedules List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Active Scheduled Dispatch Jobs ({schedules.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className={`rounded-2xl border p-5 transition flex flex-col justify-between space-y-4 ${
                sch.isActive ? 'bg-white border-slate-200 shadow-sm hover:border-indigo-300' : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    sch.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}>
                    {sch.isActive ? 'Active Schedule' : 'Paused'}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {sch.format} Format
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{sch.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{sch.reportType}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Frequency:</span>
                    <span className="font-bold text-slate-800">{sch.frequency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Next Execution:</span>
                    <span className="font-semibold text-indigo-600">{sch.nextRun}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Recipients:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[140px]">{sch.recipients.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleRunNow(sch.id, sch.name)}
                  disabled={triggeringId === sch.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {triggeringId === sch.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{triggeringId === sch.id ? 'Dispatching...' : 'Run Now'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(sch.id)}
                    className={`p-1.5 rounded-lg border transition ${
                      sch.isActive ? 'text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                    title={sch.isActive ? 'Pause Schedule' : 'Activate Schedule'}
                  >
                    {sch.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteSchedule(sch.id)}
                    className="p-1.5 rounded-lg text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
                    title="Delete Schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for New Scheduled Report */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900">Schedule Automated Report</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Schedule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Executive Financial Summary"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Report Template</label>
                <select
                  value={newSchedule.reportType}
                  onChange={(e) => setNewSchedule({ ...newSchedule, reportType: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                >
                  <option value="Statement of Functional Expenses">Statement of Functional Expenses</option>
                  <option value="Grant Allocation & Donor Report">Grant Allocation & Donor Report</option>
                  <option value="Financial Transaction Audit Ledger">Financial Transaction Audit Ledger</option>
                  <option value="Operational Task & Team Performance">Operational Task & Team Performance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={newSchedule.frequency}
                    onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Format</label>
                  <select
                    value={newSchedule.format}
                    onChange={(e) => setNewSchedule({ ...newSchedule, format: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="CSV">CSV Spreadsheet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Emails (comma-separated)</label>
                <input
                  type="text"
                  required
                  placeholder="auditor@ngo.org, director@ngo.org"
                  value={newSchedule.recipients}
                  onChange={(e) => setNewSchedule({ ...newSchedule, recipients: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-600/20"
                >
                  Save & Activate Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
