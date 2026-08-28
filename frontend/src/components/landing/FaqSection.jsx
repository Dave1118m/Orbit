import { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Lock, 
  DollarSign, 
  Layers, 
  Heart, 
  ArrowRight, 
  MoreHorizontal,
  ChevronRight,
  CheckCircle2,
  Coins
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    id: 'rbac',
    num: '01',
    category: 'Permissions',
    tag: 'RBAC • Security',
    question: 'How does OrbitDesk enforce system permissions and role access?',
    shortDesc: 'Role-based access control with 7-tier hierarchy',
    summary: 'OrbitDesk uses a strict multi-tier Role-Based Access Control (RBAC) model. Each user is assigned a role that determines exactly what they can see, edit, approve, or manage.',
    highlights: [
      { num: 1, role: 'Owner', desc: 'Full system-wide access including ownership transfer and global billing.' },
      { num: 2, role: 'Admin', desc: 'Organization management, member invitations, compliance & partner oversight.' },
      { num: 3, role: 'Coordinator', desc: 'Full control across all projects within assigned Workspaces.' },
      { num: 4, role: 'Manager & Finance', desc: 'Project deliverables, task delegation, and $500 audit sign-offs.' },
      { num: 5, role: 'Member & Viewer', desc: 'Task execution, evidence submission, and read-only transparency.' }
    ]
  },
  {
    id: 'mel',
    num: '02',
    category: 'MEL / Logframe',
    tag: 'MEL • Logframe',
    question: 'How do Logframes (MEL) and Indicator targets work in OrbitDesk?',
    shortDesc: 'Hierarchical Results Framework for donors & M&E officers',
    summary: 'OrbitDesk features a standardized Goal ➔ Outcome ➔ Output ➔ Activity results framework. Officers attach verification evidence, set target metrics, and track indicator velocity in real time.',
    highlights: [
      { num: 1, role: 'Goal & Impact', desc: 'High-level socio-economic transformational objectives with multi-year targets.' },
      { num: 2, role: 'Outcomes & Outputs', desc: 'Direct deliverable tracking mapped to actionable tasks and verification files.' },
      { num: 3, role: '1-Click Export', desc: 'Instant export of complete results frameworks formatted for institutional donors.' }
    ]
  },
  {
    id: 'audit',
    num: '03',
    category: 'Finance',
    tag: 'Finance • Audit',
    question: 'What is the $500 expense threshold audit rule?',
    shortDesc: 'Automated compliance checkpoint for high-value disbursements',
    summary: 'To eliminate audit compliance flags and ensure strict financial integrity, OrbitDesk enforces an automatic rule requiring receipt attachments for any expense equal to or exceeding $500.',
    highlights: [
      { num: 1, role: 'Threshold Trigger', desc: 'Any expense ≥ $500 is flagged automatically with a mandatory receipt requirement.' },
      { num: 2, role: 'Evidence Attachment', desc: 'Finance Officers cannot approve expenses without a verified attached invoice.' },
      { num: 3, role: 'Tamper-Proof Ledger', desc: 'All approval timestamps and approver identities are recorded in the audit trail.' }
    ]
  },
  {
    id: 'volunteers',
    num: '04',
    category: 'Volunteers',
    tag: 'Volunteers • Portal',
    question: 'How does the Public Volunteer recruitment portal work?',
    shortDesc: 'Direct applicant onboarding with background check screening',
    summary: 'OrbitDesk provides a dedicated public portal for volunteer recruitment. Coordinators screen applicants through vetting stages and assign approved volunteers directly to project tasks.',
    highlights: [
      { num: 1, role: 'Public Application', desc: 'Candidates submit skills, availability, and emergency contact details.' },
      { num: 2, role: 'Vetting Pipeline', desc: 'Coordinators mark status as Passed, Pending, or Failed background checks.' },
      { num: 3, role: 'Direct Task Dispatch', desc: 'Approved volunteers receive direct task assignments on active projects.' }
    ]
  },
  {
    id: 'currency',
    num: '05',
    category: 'Currency',
    tag: 'Currency • Multi-Currency',
    question: 'How does the Dual-Currency USD/ETB conversion work?',
    shortDesc: 'Real-time exchange conversion across ledgers and budgets',
    summary: 'OrbitDesk operates with a native dual-currency engine in USD ($) and ETB (Br). Real-time exchange rates seamlessly convert budget allocations, expense disbursements, and donor reports.',
    highlights: [
      { num: 1, role: 'Org-Level Engine', desc: 'Organizations configure primary and secondary operational currencies.' },
      { num: 2, role: 'Disbursement Sync', desc: 'Expenses entered in local ETB currency auto-convert to USD for donor sheets.' },
      { num: 3, role: 'Variance Audit', desc: 'Exchange rate fluctuations are logged to maintain perfect ledger parity.' }
    ]
  },
  {
    id: 'donors',
    num: '06',
    category: 'MEL / Logframe',
    tag: 'Reports • Donors',
    question: 'Can OrbitDesk integrate with institutional donor reporting requirements?',
    shortDesc: '1-click exportable PDF, Excel, and CSV statements',
    summary: 'Yes. OrbitDesk is purpose-built for non-profits and international development consortia, providing pre-formatted reports matching major institutional donor guidelines.',
    highlights: [
      { num: 1, role: '1-Click Exports', desc: 'Instant export of PDF, Excel, and CSV formats ready for stakeholder review.' },
      { num: 2, role: 'Financial Audits', desc: 'GAAP-compliant burn rate statements, ledger registers, and receipts packages.' },
      { num: 3, role: 'Stakeholder View', desc: 'Read-only stakeholder links allowing external observers to monitor live progress.' }
    ]
  }
];

const CATEGORIES = [
  { id: 'All', label: 'All Topics', icon: Sparkles },
  { id: 'Permissions', label: 'Permissions', icon: Lock },
  { id: 'Finance', label: 'Finance', icon: DollarSign },
  { id: 'MEL / Logframe', label: 'MEL / Logframe', icon: Layers },
  { id: 'Volunteers', label: 'Volunteers', icon: Heart },
  { id: 'Currency', label: 'Currency', icon: Coins }
];

export default function FaqSection() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaqId, setSelectedFaqId] = useState('rbac');

  // Filter items by category and search term
  const filteredFaqs = FAQ_ITEMS.filter((faq) => {
    const matchesCat = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch = 
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Ensure an active FAQ is always selected if filtered
  const activeFaq = FAQ_ITEMS.find((f) => f.id === selectedFaqId) || filteredFaqs[0] || FAQ_ITEMS[0];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10">
      {/* ── Section Title as in Figma ── */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Frequently Asked <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">Questions</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-400 font-medium max-w-2xl mx-auto">
          Everything you need to know about OrbitDesk — permissions, finance, MEL tracking, and more.
        </p>

        {/* ── Search Bar Input ── */}
        <div className="pt-4 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/[0.1] bg-[#090d16]/90 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 shadow-xl backdrop-blur-xl focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Master-Detail 2-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Question List (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-3">
          {filteredFaqs.map((faq) => {
            const isSelected = activeFaq.id === faq.id;
            return (
              <div
                key={faq.id}
                onClick={() => setSelectedFaqId(faq.id)}
                className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-200 backdrop-blur-xl ${
                  isSelected
                    ? 'border-cyan-500/40 bg-[#0c1830]/90 shadow-[0_0_25px_rgba(6,182,212,0.15)] scale-[1.01]'
                    : 'border-white/[0.06] bg-[#090d16]/70 hover:border-white/[0.12] hover:bg-[#090d16]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Number Badge */}
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-mono font-black border transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-white/[0.04] text-slate-400 border-white/[0.08] group-hover:text-white'
                  }`}>
                    {faq.num}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {faq.tag}
                    </p>
                    <h3 className="text-xs sm:text-sm font-bold text-white leading-snug mt-0.5">
                      {faq.question}
                    </h3>
                    {isSelected && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        {faq.shortDesc}
                      </p>
                    )}
                  </div>

                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'}`} />
                </div>
              </div>
            );
          })}

          {filteredFaqs.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs rounded-2xl border border-dashed border-white/[0.08]">
              No questions found matching "{searchQuery}".
            </div>
          )}
        </div>

        {/* ── Right Column: Deep-Dive Detail Reader (7 Cols) ── */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-white/[0.08] bg-[#090d16]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            {/* Detail Top Bar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-mono font-bold text-cyan-300 border border-cyan-500/20">
                {activeFaq.tag}
              </span>
              <div className="flex items-center gap-1 text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              </div>
            </div>

            {/* Question Title */}
            <div>
              <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                {activeFaq.question}
              </h3>
            </div>

            {/* Primary Summary Box */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/80 p-4 sm:p-5 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal shadow-inner">
              {activeFaq.summary}
            </div>

            {/* Structured Highlights Breakdown List */}
            <div className="space-y-2.5 pt-1">
              {activeFaq.highlights.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-black/40 p-3 text-xs transition hover:border-white/[0.1]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/20 text-[10px] font-mono font-black text-cyan-300 shrink-0 mt-0.5 border border-cyan-500/30">
                    {item.num}
                  </span>
                  <div className="leading-snug">
                    <span className="font-black text-white mr-1.5">{item.role}:</span>
                    <span className="text-slate-300 font-normal">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
