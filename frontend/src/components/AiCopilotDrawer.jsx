import React, { useState, useEffect, useRef } from 'react';
import { showErrorToast, showSuccessToast } from '../utils/toastHelper';

export default function AiCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'delegate'
  
  // Personas & Delegate state
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('Admin');
  const [isAgentMode, setIsAgentMode] = useState(false);
  
  // Chat state for General Assistant
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Hello. I am your Orbit Operations Assistant. You can ask me any question about your projects, tasks, budgets, team workflows, or system architecture.',
      timestamp: new Date()
    }
  ]);

  // Chat state for Role Stand-In
  const [delegateMessages, setDelegateMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Stand-in ready. Select a role (Owner, Admin, Manager, Finance, Coordinator, Member, Viewer) to run tasks or monitor workflows.',
      actions: [],
      timestamp: new Date()
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(1);
  const messagesEndRef = useRef(null);

  // Load organizations and personas
  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const orgRes = await fetch(`${import.meta.env.VITE_API_URL}/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (orgRes.ok) {
          const orgs = await orgRes.json();
          setOrganizations(orgs);
          if (orgs.length > 0) {
            const stored = localStorage.getItem('selectedOrganizationId');
            const targetOrg = stored && orgs.find(o => o.id === parseInt(stored));
            const activeId = targetOrg ? targetOrg.id : orgs[0].id;
            setSelectedOrgId(activeId);
            fetchPersonas(activeId);
            fetchDelegateStatus(activeId);
            fetchHandoffReport(activeId);
          }
        }
      } catch (e) {
        console.error('Failed to initialize assistant', e);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (isOpen && organizations.length > 0) {
      const stored = localStorage.getItem('selectedOrganizationId');
      const activeId = stored && organizations.some(o => o.id === parseInt(stored))
        ? parseInt(stored)
        : selectedOrgId;
      if (activeId !== selectedOrgId) {
        setSelectedOrgId(activeId);
      }
      fetchPersonas(activeId);
      fetchDelegateStatus(activeId);
      fetchHandoffReport(activeId);
    }
  }, [isOpen]);

  const fetchPersonas = async (orgId) => {
    const token = localStorage.getItem('token');
    if (!token || !orgId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/personas?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
      }
    } catch (e) {
      console.error('Failed to fetch personas', e);
    }
  };

  // Policy & Handoff State
  const [maxAutoApprovalAmount, setMaxAutoApprovalAmount] = useState(100);
  const [autoReplyMessage, setAutoReplyMessage] = useState('');
  const [autoApproveReceipts, setAutoApproveReceipts] = useState(true);
  const [autoTriage, setAutoTriage] = useState(true);
  const [showPolicySettings, setShowPolicySettings] = useState(false);
  const [handoffData, setHandoffData] = useState(null);
  const [showHandoffBanner, setShowHandoffBanner] = useState(false);

  const fetchDelegateStatus = async (orgId) => {
    const token = localStorage.getItem('token');
    if (!token || !orgId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/delegate-status?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsAgentMode(Boolean(data.isAgentModeActive));
        if (data.rolePersona) setSelectedPersona(data.rolePersona);
        if (data.maxAutoApprovalAmount != null) setMaxAutoApprovalAmount(data.maxAutoApprovalAmount);
        if (data.autoReplyMessage != null) setAutoReplyMessage(data.autoReplyMessage);
        if (data.autoApproveVerifiedReceipts != null) setAutoApproveReceipts(data.autoApproveVerifiedReceipts);
        if (data.autoTriageTasks != null) setAutoTriage(data.autoTriageTasks);
      }
    } catch (e) {
      console.error('Failed to fetch delegate status', e);
    }
  };

  const fetchHandoffReport = async (orgId) => {
    const token = localStorage.getItem('token');
    if (!token || !orgId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/delegate-handoff?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHandoffData(data);
        if (data.totalUnacknowledged > 0) {
          setShowHandoffBanner(true);
        }
      }
    } catch (e) {
      console.error('Failed to fetch handoff report', e);
    }
  };

  const handleAcknowledgeHandoff = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/delegate-handoff/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ organizationId: selectedOrgId })
      });
      if (res.ok) {
        setShowHandoffBanner(false);
        setHandoffData(null);
        showSuccessToast('Stand-in actions acknowledged.');
      }
    } catch (e) {
      showErrorToast('Failed to acknowledge actions');
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, delegateMessages, isLoading, activeTab]);

  const handleToggleAgentMode = async () => {
    const nextState = !isAgentMode;
    setIsAgentMode(nextState);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/delegate-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          rolePersona: selectedPersona,
          isAgentModeActive: nextState,
          maxAutoApprovalAmount: parseFloat(maxAutoApprovalAmount) || 100,
          autoReplyMessage,
          autoApproveVerifiedReceipts: autoApproveReceipts,
          autoTriageTasks: autoTriage
        })
      });
      if (res.ok) {
        const data = await res.json();
        showSuccessToast(data.message);
        if (!nextState) {
          fetchHandoffReport(selectedOrgId);
        }
      }
    } catch (e) {
      showErrorToast('Failed to update delegate status');
    }
  };

  const handleSavePolicy = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/delegate-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          rolePersona: selectedPersona,
          isAgentModeActive: isAgentMode,
          maxAutoApprovalAmount: parseFloat(maxAutoApprovalAmount) || 100,
          autoReplyMessage,
          autoApproveVerifiedReceipts: autoApproveReceipts,
          autoTriageTasks: autoTriage
        })
      });
      if (res.ok) {
        showSuccessToast('Delegation guardrails policy saved.');
        setShowPolicySettings(false);
      }
    } catch (e) {
      showErrorToast('Failed to save policy');
    }
  };

  const handleSendMessage = async (promptToSend) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    if (activeTab === 'chat') {
      setChatMessages((prev) => [...prev, userMessage]);
    } else {
      setDelegateMessages((prev) => [...prev, userMessage]);
    }

    setInputPrompt('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const currentHistory = (activeTab === 'chat' ? chatMessages : delegateMessages).map((m) => ({
        role: m.role,
        content: m.text
      }));

      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          mode: activeTab,
          rolePersona: selectedPersona,
          prompt: text,
          history: currentHistory
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          text: data.responseText,
          actions: data.executedActions || [],
          persona: data.rolePersona,
          timestamp: new Date()
        };

        if (activeTab === 'chat') {
          setChatMessages((prev) => [...prev, assistantMessage]);
        } else {
          setDelegateMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        const errText = await res.text();
        showErrorToast(`Service response: ${errText || 'Request failed'}`);
      }
    } catch (e) {
      showErrorToast(`Network error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generalPrompts = [
    'System Overview',
    'Logframe & MEL Guide',
    'Budget & $500 Receipt Rule',
    'Role Permissions Matrix'
  ];

  const rolePrompts = {
    Owner: [
      'Org Overview',
      'Portfolio Status',
      'Audit Logs',
      'Financial Summary'
    ],
    Admin: [
      'Org Overview',
      'Invite Member',
      'Active Projects',
      'Security Audit'
    ],
    Manager: [
      'Create Task',
      'Milestones',
      'Risk Logs',
      'Pending Tasks'
    ],
    FinanceOfficer: [
      'Budget Summary',
      'Pending Expenses',
      'Category Spend',
      'Funding Status'
    ],
    Finance: [
      'Budget Summary',
      'Pending Expenses',
      'Category Spend',
      'Funding Status'
    ],
    Coordinator: [
      'Volunteers',
      'Assign Task',
      'Dependencies',
      'Field Schedule'
    ],
    Member: [
      'My Tasks',
      'Deadlines',
      'Submit Note',
      'Project Updates'
    ],
    Viewer: [
      'Project Status',
      'Read-Only Briefing',
      'Reports Overview'
    ]
  };

  const activeQuickPrompts = activeTab === 'chat'
    ? generalPrompts
    : (rolePrompts[selectedPersona] || ['Summary Briefing', 'Active Projects', 'Pending Tasks']);

  const activeMessages = activeTab === 'chat' ? chatMessages : delegateMessages;

  return (
    <>
      {/* Clean Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="orbit-assistant-launcher"
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-3 rounded-full bg-slate-900 px-4 py-3 text-white shadow-xl transition-all duration-200 hover:bg-slate-800 hover:shadow-2xl active:scale-95 border border-slate-700"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-sm">
            O
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-white">
              {activeTab === 'chat' ? 'Assistant' : (selectedPersona === 'FinanceOfficer' ? 'Finance' : selectedPersona)}
            </p>
            <p className="text-[10px] text-slate-400">
              {isAgentMode ? 'Auto Active' : 'Ready'}
            </p>
          </div>
        </button>
      </div>

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs transition-opacity">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200">
              
              {/* Drawer Header */}
              <div className="bg-slate-900 p-5 text-white border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-sm">
                      O
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-tight text-white">Orbit Operations</h2>
                      <p className="text-xs text-slate-400">Operations Assistant & Stand-In</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Clean Mode Navigation Tabs */}
                <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      activeTab === 'chat'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Assistant
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('delegate')}
                    className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      activeTab === 'delegate'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Stand-In
                  </button>
                </div>

                {/* Sub-Header for Stand-In Tab */}
                {activeTab === 'delegate' && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role:</label>
                      <select
                        value={selectedPersona}
                        onChange={(e) => setSelectedPersona(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {personas.map((p) => (
                          <option key={p.displayTitle} value={p.roleName === 'Member' && p.isCustomRole ? p.displayTitle : p.roleName}>
                            {p.displayTitle}
                          </option>
                        ))}
                        {personas.length === 0 && (
                          <>
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="FinanceOfficer">Finance</option>
                            <option value="Coordinator">Coordinator</option>
                            <option value="Member">Member</option>
                            <option value="Viewer">Viewer</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Mode Toggle Switch */}
                    <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">
                          {isAgentMode ? 'Stand-In Active' : 'Manual Mode'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAgentMode}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isAgentMode ? 'bg-indigo-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isAgentMode ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Policy Configuration Toggle */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowPolicySettings(!showPolicySettings)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer flex items-center gap-1"
                      >
                        ⚙️ {showPolicySettings ? 'Hide Rules' : 'Stand-In Rules'}
                      </button>
                      <span className="text-slate-400 text-[10px]">
                        Cap: ${maxAutoApprovalAmount}
                      </span>
                    </div>

                    {showPolicySettings && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs text-slate-300">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Max Auto-Approval Limit ($):
                          </label>
                          <input
                            type="number"
                            value={maxAutoApprovalAmount}
                            onChange={(e) => setMaxAutoApprovalAmount(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="autoApproveReceiptsCheck"
                            checked={autoApproveReceipts}
                            onChange={(e) => setAutoApproveReceipts(e.target.checked)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="autoApproveReceiptsCheck" className="text-[11px] text-slate-300 cursor-pointer">
                            Auto-approve verified expenses under limit
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="autoTriageCheck"
                            checked={autoTriage}
                            onChange={(e) => setAutoTriage(e.target.checked)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="autoTriageCheck" className="text-[11px] text-slate-300 cursor-pointer">
                            Auto-triage urgent impending tasks
                          </label>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Away Auto-Reply Note:
                          </label>
                          <input
                            type="text"
                            value={autoReplyMessage}
                            onChange={(e) => setAutoReplyMessage(e.target.value)}
                            placeholder="e.g. In field operations; AI delegate active."
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSavePolicy}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 rounded font-semibold transition cursor-pointer"
                        >
                          Save Policy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {/* While You Were Away Handoff Card */}
                {showHandoffBanner && handoffData && handoffData.totalUnacknowledged > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-slate-900 shadow-xs mb-2">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📋</span>
                        <div>
                          <p className="text-xs font-bold text-indigo-950">While Away (Summary)</p>
                          <p className="text-[10px] text-indigo-700">
                            Stand-in completed {handoffData.totalUnacknowledged} item(s)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAcknowledgeHandoff}
                        className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        Acknowledge All
                      </button>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {handoffData.actions.map((act) => (
                        <div key={act.id} className="bg-white p-1.5 rounded border border-indigo-100 text-[11px]">
                          <p className="font-semibold text-slate-800">{act.summary}</p>
                          <span className="text-[9px] text-slate-400">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.actionType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-600">
                          <span>{activeTab === 'chat' ? 'Assistant' : (msg.persona === 'FinanceOfficer' ? 'Finance' : (msg.persona || (selectedPersona === 'FinanceOfficer' ? 'Finance' : selectedPersona)))}</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                      {/* Executed Action Badges (Delegate Mode) */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                            Action Executed:
                          </p>
                          {msg.actions.map((act, i) => (
                            <div key={i} className="bg-slate-50 text-slate-800 border border-slate-200 p-2 rounded-lg text-[11px]">
                              <p className="font-semibold">{act.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[9px] text-slate-400 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200 max-w-[70%]">
                    <span className="font-semibold text-indigo-600">
                      {activeTab === 'chat' ? 'Assistant' : `${selectedPersona} Delegate`}
                    </span> is processing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="bg-white px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
                {activeQuickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="shrink-0 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition border border-slate-200 cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <div className="p-4 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder={
                      activeTab === 'chat'
                        ? 'Ask a question or request an analysis...'
                        : `Command ${selectedPersona} delegate or request an action...`
                    }
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
                  >
                    ➤
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
