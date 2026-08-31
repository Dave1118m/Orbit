import React, { useState, useEffect, useRef } from 'react';
import { showErrorToast, showSuccessToast } from '../utils/toastHelper';

export default function AiCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' (General AI Assistant) or 'delegate' (Role Stand-In for Busy Users)
  
  // Personas & Delegate state
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('Admin');
  const [isAgentMode, setIsAgentMode] = useState(false);
  
  // Chat state for General Assistant
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: '👋 Hello! I am your **AI Assistant**. You can ask me anything about your projects, strategy, report drafting, or how any part of the Orbit system works.',
      timestamp: new Date()
    }
  ]);

  // Chat state for Role Delegate
  const [delegateMessages, setDelegateMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: '⚡ Welcome to the **Autonomous Role Delegate**. Select a role (Admin, Manager, Finance Officer, Coordinator, or Custom Role) and I will execute tasks, audit ledgers, or monitor deliverables while you are away.',
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
            setSelectedOrgId(orgs[0].id);
            fetchPersonas(orgs[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to initialize AI Copilot', e);
      }
    }
    init();
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
          mode: activeTab, // 'chat' or 'delegate'
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
          modelUsed: data.modelUsed,
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
        showErrorToast(`AI Service Error: ${errText || 'Request failed'}`);
      }
    } catch (e) {
      showErrorToast(`Network error communicating with AI: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generalPrompts = [
    '💡 How does Orbit work?',
    '📊 Explain Logframe & MEL indicators',
    '💰 Explain Budget & $500 threshold rule',
    '🛡️ Explain the 37-Point Permission Matrix'
  ];

  const delegatePrompts = {
    Admin: [
      '📊 Executive Organization Overview',
      '👥 Invite team member',
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

  const activeQuickPrompts = activeTab === 'chat'
    ? generalPrompts
    : (delegatePrompts[selectedPersona] || ['📊 Summary Briefing', '🚀 List active projects', '⚡ Create operational task']);

  const activeMessages = activeTab === 'chat' ? chatMessages : delegateMessages;

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="orbit-ai-launcher"
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-950 p-1.5 pr-5 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-indigo-500/25 active:scale-95 border border-indigo-500/30"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg shadow-inner">
            <span>{isAgentMode ? '🤖' : '✨'}</span>
            {isAgentMode && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              {isAgentMode ? '🤖 Auto-Delegate Active' : 'Orbit Assistant'}
            </p>
            <p className="text-xs font-extrabold text-white">
              {activeTab === 'chat' ? 'AI Chat Assistant' : `${selectedPersona} Delegate`}
            </p>
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-xl shadow-lg ring-2 ring-white/10">
                      {activeTab === 'chat' ? '✨' : '🤖'}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold tracking-tight text-white">Orbit Intelligence Hub</h2>
                      <p className="text-xs text-indigo-200/80">AI Assistant & Autonomous Role Delegates</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Main Mode Navigation Tabs (SEPARATE CHAT vs DELEGATE) */}
                <div className="mt-4 grid grid-cols-2 gap-2 bg-black/30 p-1 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                      activeTab === 'chat'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>💬</span>
                    <span>AI Chat Assistant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('delegate')}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                      activeTab === 'delegate'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🤖</span>
                    <span>Role Delegate (Busy)</span>
                  </button>
                </div>

                {/* Sub-Header for Autonomous Delegate Tab */}
                {activeTab === 'delegate' && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2.5 animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stand-In Role:</label>
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
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${isAgentMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
                        <span className="text-xs font-medium text-slate-200">
                          {isAgentMode ? '🤖 Auto-Delegate Mode Active' : '👤 Direct Control Mode'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAgentMode}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isAgentMode ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isAgentMode ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-indigo-600">
                          <span>{activeTab === 'chat' ? '✨ AI Assistant' : `🤖 ${msg.persona || selectedPersona} Delegate`}</span>
                          {msg.modelUsed && <span className="text-slate-400 font-normal">({msg.modelUsed})</span>}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                      {/* Executed Action Badges (Delegate Mode) */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                            <span>✓</span> Real Action Executed:
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
                    <span className="font-semibold text-indigo-600">
                      {activeTab === 'chat' ? 'AI Assistant' : `${selectedPersona} Delegate`}
                    </span> is generating response...
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
                    className="shrink-0 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 px-3 py-1.5 rounded-full transition border border-slate-200/60 cursor-pointer"
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
                        ? 'Ask me anything about Orbit, strategy, or tasks...'
                        : `Command ${selectedPersona} delegate or request an action...`
                    }
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
