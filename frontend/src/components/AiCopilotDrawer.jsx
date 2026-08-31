import React, { useState, useEffect, useRef } from 'react';
import { showErrorToast, showSuccessToast } from '../utils/toastHelper';

export default function AiCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('Admin');
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: '👋 Welcome! I am your **Autonomous Role Delegate**. Switch to any role (Admin, Manager, Finance Officer, Coordinator, or Custom Roles) to monitor workflows, inspect real-time metrics, or delegate actions when you are away.',
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
    async function initCopilot() {
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
            setSelectedOrgId(orgs[0].id);
            fetchPersonas(orgs[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to initialize Role Delegate', e);
      }
    }
    initCopilot();
  }, []);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

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
          isAgentModeActive: nextState
        })
      });
      if (res.ok) {
        const data = await res.json();
        showSuccessToast(data.message);
      }
    } catch (e) {
      showErrorToast('Failed to sync delegate status');
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

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const historyPayload = messages.map((m) => ({
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
          rolePersona: selectedPersona,
          prompt: text,
          history: historyPayload
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
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errText = await res.text();
        showErrorToast(`Delegate Service: ${errText || 'Request failed'}`);
      }
    } catch (e) {
      showErrorToast(`Network error communicating with Delegate: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = {
    Admin: [
      '📊 Executive Organization Overview',
      '👥 Invite new team collaborator',
      '🚀 List active projects portfolio',
      '🔐 Audit active workspace sessions'
    ],
    Manager: [
      '⚡ Create task "Field Supply Verification"',
      '🚀 Project milestones and deadlines',
      '⚠️ List open risk logs & issues',
      '📋 Search pending tasks'
    ],
    FinanceOfficer: [
      '💰 Financial health & budget summary',
      '📑 Review pending expense claims',
      '📊 Category expenditure breakdown',
      '💳 Check funding status'
    ],
    Coordinator: [
      '🤝 List active volunteers & hours',
      '⚡ Dispatch volunteer task assignment',
      '📋 Check team task dependencies'
    ]
  };

  const activeQuickPrompts = quickPrompts[selectedPersona] || [
    '📊 Summary Briefing',
    '🚀 List active projects',
    '⚡ Create operational task'
  ];

  return (
    <>
      {/* Floating Role Delegate Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="orbit-role-delegate-launcher"
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-950 p-1.5 pr-5 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-indigo-500/25 active:scale-95 border border-indigo-500/30"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg shadow-inner">
            <span>⚡</span>
            {isAgentMode && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              {isAgentMode ? '⚡ Auto-Delegate Active' : 'Orbit Role Delegate'}
            </p>
            <p className="text-xs font-extrabold text-white">{selectedPersona} Stand-In</p>
          </div>
        </button>
      </div>

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Drawer Header */}
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-5 text-white border-b border-indigo-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl shadow-lg ring-2 ring-white/10">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-extrabold tracking-tight text-white">Orbit Role Delegate</h2>
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-400/20">
                          Autonomous Stand-In
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200/80">Multi-Persona Operations & Workflow Automation</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Persona Switcher & Mode Toggle Bar */}
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delegate Persona:</label>
                    <select
                      value={selectedPersona}
                      onChange={(e) => setSelectedPersona(e.target.value)}
                      className="rounded-xl border border-indigo-500/40 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {personas.map((p) => (
                        <option key={p.displayTitle} value={p.roleName === 'Member' && p.isCustomRole ? p.displayTitle : p.roleName}>
                          {p.icon} {p.displayTitle}
                        </option>
                      ))}
                      {personas.length === 0 && (
                        <>
                          <option value="Admin">🛡️ Administrator Delegate</option>
                          <option value="Manager">📊 Project Manager Delegate</option>
                          <option value="FinanceOfficer">💰 Finance Officer Delegate</option>
                          <option value="Coordinator">🤝 Program Coordinator Delegate</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Mode Toggle Switch */}
                  <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isAgentMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
                      <span className="text-xs font-medium text-slate-200">
                        {isAgentMode ? '⚡ Autonomous Delegate Active' : '👤 Direct Control Mode'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAgentMode}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isAgentMode ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isAgentMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                      }`}
                    >
                      {msg.persona && msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-indigo-600">
                          <span>⚡ {msg.persona} Stand-In</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                      {/* Executed Action Cards */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                            <span>✓</span> Action Executed:
                          </p>
                          {msg.actions.map((act, i) => (
                            <div key={i} className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-2 rounded-xl text-[11px]">
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
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-2xl border border-slate-200 max-w-[70%]">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
                    <span className="font-semibold text-indigo-600">{selectedPersona} Stand-In</span> is processing records & dispatching actions...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Pills */}
              <div className="bg-white px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
                {activeQuickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="shrink-0 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 px-3 py-1.5 rounded-full transition border border-slate-200/60 cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Box */}
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
                    placeholder={`Ask ${selectedPersona} delegate or command an action...`}
                    className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
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
