import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, CornerDownLeft, X,
  ExternalLink, Play, Clock, ArrowRight, ShieldCheck, FileText, CheckCircle2
} from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../utils/toastHelper';

function MarkdownContent({ text, onNavigate }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-slate-900 mt-2 mb-0.5">
              <InlineFormatted text={trimmed.replace('#### ', '')} onNavigate={onNavigate} />
            </h4>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xs sm:text-sm font-bold text-indigo-950 mt-2 mb-1 border-b border-slate-100 pb-0.5">
              <InlineFormatted text={trimmed.replace('### ', '')} onNavigate={onNavigate} />
            </h3>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-indigo-500 font-bold select-none text-[11px]">•</span>
              <span className="flex-1">
                <InlineFormatted text={trimmed.substring(2)} onNavigate={onNavigate} />
              </span>
            </div>
          );
        }
        return (
          <p key={idx}>
            <InlineFormatted text={line} onNavigate={onNavigate} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormatted({ text, onNavigate }) {
  if (!text) return null;
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const label = linkMatch[1];
          const url = linkMatch[2];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(url)}
              className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 font-semibold underline decoration-indigo-300 underline-offset-2 transition cursor-pointer"
            >
              {label}
            </button>
          );
        }

        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <strong key={i} className="font-bold text-slate-900">
              {boldMatch[1]}
            </strong>
          );
        }

        const codeMatch = part.match(/^`([^`]+)`$/);
        if (codeMatch) {
          return (
            <code key={i} className="font-mono text-[11px] bg-slate-100 text-indigo-700 px-1 py-0.5 rounded">
              {codeMatch[1]}
            </code>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function AiCopilotDrawer() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'delegate'
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  
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

  // Global Keyboard Shortcut: Ctrl + K or Cmd + K (Pillar 3)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          proposedAction: data.proposedAction || null,
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



  const handleExecuteAction = async (msgId, proposedAction) => {
    setIsExecutingAction(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/execute-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          actionType: proposedAction.actionType,
          parameters: proposedAction.parameters
        })
      });

      if (res.ok) {
        const data = await res.json();
        showSuccessToast(data.message || 'Action executed successfully!');
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, proposedAction: { ...m.proposedAction, resolved: true, executedResult: data.message } }
              : m
          )
        );
        setDelegateMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, proposedAction: { ...m.proposedAction, resolved: true, executedResult: data.message } }
              : m
          )
        );
      } else {
        const err = await res.text();
        showErrorToast(`Execution error: ${err}`);
      }
    } catch (err) {
      showErrorToast(`Execution error: ${err.message}`);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleDismissAction = (msgId) => {
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, proposedAction: { ...m.proposedAction, dismissed: true } } : m
      )
    );
    setDelegateMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, proposedAction: { ...m.proposedAction, dismissed: true } } : m
      )
    );
  };

  const activeMessages = activeTab === 'chat' ? chatMessages : delegateMessages;

  return (
    <>
      {/* Sleek Floating Launcher Pill with Sparkles and Keyboard Hint */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="orbit-assistant-launcher"
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-2.5 rounded-full bg-slate-900/95 hover:bg-slate-900 px-4 py-2.5 text-white shadow-xl hover:shadow-indigo-500/20 hover:shadow-2xl transition-all duration-200 active:scale-95 border border-slate-700/80 backdrop-blur-md cursor-pointer"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-white">Orbit AI</span>
            <kbd className="hidden sm:inline-block text-[9px] font-mono font-semibold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
              Ctrl K
            </kbd>
          </div>
        </button>
      </div>

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200">
              
              {/* Drawer Header */}
              <div className="bg-slate-900 p-5 text-white border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-bold text-white shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold tracking-tight text-white">Orbit AI Copilot</h2>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                          {activeTab === 'chat' ? 'Assistant' : `${selectedPersona} Stand-In`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Executive Writing, Deep Search & Actions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
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
                      className={`max-w-[92%] sm:max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] font-bold text-indigo-900">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>{activeTab === 'chat' ? 'Orbit Assistant' : (msg.persona || selectedPersona)}</span>
                        </div>
                      )}

                      {/* Content with Markdown & Clickable Deep Links (Pillar 2) */}
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <MarkdownContent
                          text={msg.text}
                          onNavigate={(path) => {
                            setIsOpen(false);
                            navigate(path);
                          }}
                        />
                      )}

                      {/* Interactive Proposed Action Card (Pillar 3) */}
                      {msg.proposedAction && !msg.proposedAction.dismissed && (
                        <div className="mt-3 p-3 rounded-xl bg-indigo-50/90 border border-indigo-200 text-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              Proposed Action
                            </span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-medium">
                              Confirmation Required
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{msg.proposedAction.title}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">{msg.proposedAction.summary}</p>
                          </div>

                          {!msg.proposedAction.resolved ? (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleExecuteAction(msg.id, msg.proposedAction)}
                                disabled={isExecutingAction}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                                Confirm & Create
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismissAction(msg.id)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{msg.proposedAction.executedResult || 'Action executed successfully!'}</span>
                            </div>
                          )}
                        </div>
                      )}

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
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    <span className="font-semibold text-indigo-600">
                      {activeTab === 'chat' ? 'Orbit Assistant' : `${selectedPersona} Delegate`}
                    </span> is analyzing...
                  </div>
                )}
                <div ref={messagesEndRef} />
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
                        ? 'Ask anything, draft donor briefs, query expenses...'
                        : `Command ${selectedPersona} delegate or request an action...`
                    }
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    <CornerDownLeft className="w-4 h-4" />
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
