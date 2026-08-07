import { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { ShieldCheck, ChevronDown, Check, Sparkles, RefreshCw } from 'lucide-react';

const ROLES = [
  { id: 'Owner', label: 'Owner', icon: '👑', color: 'bg-amber-500/10 text-amber-700 border-amber-300 hover:bg-amber-500/20', badge: 'bg-amber-500' },
  { id: 'Admin', label: 'Admin', icon: '🛡️', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-300 hover:bg-indigo-500/20', badge: 'bg-indigo-500' },
  { id: 'Coordinator', label: 'Coordinator', icon: '👔', color: 'bg-blue-500/10 text-blue-700 border-blue-300 hover:bg-blue-500/20', badge: 'bg-blue-500' },
  { id: 'Manager', label: 'Manager', icon: '📁', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20', badge: 'bg-emerald-500' },
  { id: 'FinanceOfficer', label: 'Finance Officer', icon: '💰', color: 'bg-teal-500/10 text-teal-700 border-teal-300 hover:bg-teal-500/20', badge: 'bg-teal-500' },
  { id: 'Member', label: 'Member', icon: '👷', color: 'bg-purple-500/10 text-purple-700 border-purple-300 hover:bg-purple-500/20', badge: 'bg-purple-500' },
  { id: 'Viewer', label: 'Viewer', icon: '🔍', color: 'bg-slate-500/10 text-slate-700 border-slate-300 hover:bg-slate-500/20', badge: 'bg-slate-500' }
];

export default function RoleSwitcherBar() {
  const { getPrimaryRole, switchPersona } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const currentRole = getPrimaryRole() || 'Owner';
  const activeRoleObj = ROLES.find(r => r.id === currentRole) || ROLES[0];

  const handleSelectRole = async (roleId) => {
    if (roleId === currentRole || isSwitching) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    setIsOpen(false);

    const res = await switchPersona(roleId);
    setIsSwitching(false);

    if (res.success) {
      const selected = ROLES.find(r => r.id === roleId);
      setToastMessage(`Switched to ${selected?.label || roleId}`);
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      alert(`Failed to switch role: ${res.error}`);
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xl border border-slate-700 text-xs animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Switcher Button - Compact & Clean */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition shadow-xs ${activeRoleObj.color} focus:outline-none`}
      >
        <span className="flex h-1.5 w-1.5 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeRoleObj.badge} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${activeRoleObj.badge}`}></span>
        </span>

        {isSwitching ? (
          <span className="inline-flex items-center gap-1 text-slate-600 font-normal">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Switching...
          </span>
        ) : (
          <>
            <span>{activeRoleObj.icon} {activeRoleObj.label}</span>
            <ChevronDown className="w-3 h-3 text-slate-500 opacity-80" />
          </>
        )}
      </button>

      {/* Compact Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white p-1.5 shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              Select Role
            </span>
          </div>

          <div className="space-y-0.5">
            {ROLES.map((role) => {
              const isSelected = role.id === currentRole;
              return (
                <button
                  key={role.id}
                  onClick={() => handleSelectRole(role.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{role.icon}</span>
                    <span>{role.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
