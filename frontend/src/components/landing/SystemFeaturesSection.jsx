import { useState } from 'react';
import { 
  Building2, 
  Layers, 
  DollarSign, 
  ShieldAlert, 
  Users, 
  Zap, 
  Check, 
  ArrowRight, 
  Award,
  BarChart,
  FileCheck,
  ShieldCheck,
  Cpu
} from 'lucide-react';

const FEATURES = [
  {
    id: 'hierarchy',
    icon: Building2,
    title: 'Workspace Scope & Dynamic Roles',
    subtitle: '7 Predefined System Roles plus custom organization-scoped roles with 37-point permission control',
    color: 'from-blue-500 to-indigo-600',
    details: [
      { role: 'Dynamic Custom Roles', desc: 'Create specialized roles (e.g. Field Operations, Logistics Officer) on demand.' },
      { role: '37-Point ABAC Matrix', desc: 'Granular checkbox matrix for real-time permission granting and revoking.' },
      { role: 'Owner & Admin Governance', desc: 'Organization management, member invitations, compliance & partner oversight.' },
      { role: 'Manager & Finance Control', desc: 'Project ownership, task scheduling, expense sign-off, and ledger audits.' }
    ],
    demoWidget: (
      <div className="glass-obsidian-card rounded-2xl p-5 shadow-2xl border border-white/[0.08]">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
          <span className="font-bold text-white text-sm">Role Authorization Matrix</span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">ABAC Enforced</span>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 p-2.5 border border-indigo-500/20">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-200">Field Operations Lead</span>
              <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">Custom</span>
            </div>
            <span className="rounded-lg bg-indigo-600 px-2 py-0.5 font-semibold text-white">14 Permissions</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/[0.06]">
            <span className="font-medium text-slate-200">Organization Owner</span>
            <span className="text-slate-400">Full Access (37/37)</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/[0.06]">
            <span className="font-medium text-slate-200">Project Manager</span>
            <span className="text-slate-400">Project Ownership (18/37)</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/[0.06]">
            <span className="font-medium text-slate-200">Finance Officer</span>
            <span className="text-slate-400">Expense Audits (10/37)</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'delegate',
    icon: Cpu,
    title: 'Autonomous Role Delegates',
    subtitle: 'Multi-persona stand-in automation that monitors operations and executes actions when leaders are unavailable',
    color: 'from-violet-500 to-purple-600',
    details: [
      { role: 'Multi-Persona Stand-Ins', desc: 'Instant switching between Admin, Manager, Finance, Coordinator, and Custom Role delegates.' },
      { role: 'Automated Tool Execution', desc: 'Directly creates project tasks, searches records, audits ledgers, and dispatches invites.' },
      { role: 'Dual-Mode Switch', desc: 'Seamlessly toggle between Human Control Mode and Autonomous Stand-In Mode.' },
      { role: 'Enterprise Audit Trail', desc: 'Every delegated action is cryptographically tracked in immutable Audit Logs.' }
    ],
    demoWidget: (
      <div className="glass-obsidian-card rounded-2xl p-5 shadow-2xl border border-white/[0.08]">
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <span className="font-bold text-white text-sm">Orbit Role Delegate</span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">Delegate Active</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="rounded-xl bg-indigo-500/10 p-2.5 border border-indigo-500/20">
            <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
              <span>⚡ Project Manager Stand-In</span>
              <span className="text-[10px] text-slate-400">Live Execution</span>
            </div>
            <p className="text-slate-300 text-[11px]">Task "Emergency Medical Supply Dispatch" created for Project #1 (water & solar).</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/[0.06]">
            <span className="text-slate-300">Financial Ledger Audit</span>
            <span className="text-emerald-400 font-bold">100% Balanced</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'logframe',
    icon: Layers,
    title: 'Logical Framework & MEL Engine',
    subtitle: 'Standardized Results Framework for Donors & M&E Officers',
    color: 'from-emerald-500 to-teal-600',
    details: [
      { role: 'Goal & Impact Level', desc: 'High-level socio-economic transformational objectives with multi-year targets.' },
      { role: 'Outcomes & Indicators', desc: 'Measurable change indicators tracking baseline vs target performance.' },
      { role: 'Outputs & Activities', desc: 'Direct deliverables mapped to actionable tasks and verification sources.' },
      { role: 'Donor Report Export', desc: 'Instant 1-click export of logframe tables for major institutional donors.' }
    ],
    demoWidget: (
      <div className="glass-obsidian-card rounded-2xl p-5 shadow-2xl border border-white/[0.08]">
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <span className="font-bold text-white text-sm">Clean Water Initiative — Logframe</span>
          <span className="text-xs font-semibold text-emerald-400">MEL Status: 88% On Track</span>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-slate-300 mb-1">
              <span>Indicator: Beneficiaries with Clean Water Access</span>
              <span className="font-bold text-indigo-400">12,500 / 15,000 Target</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '83%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between font-semibold text-slate-300 mb-1">
              <span>Output: Water Filtration Systems Deployed</span>
              <span className="font-bold text-indigo-400">45 / 50 Units</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: '90%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'finance',
    icon: DollarSign,
    title: 'Multi-Level Budget & Receipt Audit',
    subtitle: 'Transparent financial tracking from Organization level down to individual Tasks',
    color: 'from-amber-500 to-orange-600',
    details: [
      { role: 'Multi-Tier Budgets', desc: 'Set and enforce budgets at Org, Workspace, Project, or Task levels.' },
      { role: '$500 Threshold Alert', desc: 'Automatic flag requiring attachment receipts for high-value expenses.' },
      { role: 'Bank Account Ledger', desc: 'Chronological transaction register of donor deposits and project disbursements.' },
      { role: 'Dual-Currency Engine (USD & ETB)', desc: 'Real-time exchange conversion and dual reporting in USD and ETB.' }
    ],
    demoWidget: (
      <div className="glass-obsidian-card rounded-2xl p-5 shadow-2xl border border-white/[0.08]">
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <span className="font-bold text-white text-sm">Budget Health & Threshold Warnings</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/20">Audit Active</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20">
            <div>
              <p className="font-bold text-white">Expense #E-804 ($1,250.00)</p>
              <p className="text-slate-400 text-[11px]">Exceeds $500 threshold • Receipt Attached</p>
            </div>
            <span className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white">Approved</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/[0.06]">
            <div>
              <p className="font-bold text-white">Project Budget: Education Fund</p>
              <p className="text-slate-400 text-[11px]">$45,000 Allocated / $38,200 Spent</p>
            </div>
            <span className="font-mono font-bold text-indigo-400">84.8% Used</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'risk',
    icon: ShieldAlert,
    title: 'Risk & Issue Roll-Up Register',
    subtitle: '5x5 Likelihood vs. Impact matrix for executive leadership and donors',
    color: 'from-rose-500 to-pink-600',
    details: [
      { role: 'Heatmap Categorization', desc: 'Automatic severity ranking (Low, Medium, High, Critical) based on risk scores.' },
      { role: 'Issue Elevation', desc: 'Seamlessly escalate unresolved risks into active operational issues.' },
      { role: 'Org-Wide Rollup', desc: 'Exec summary showing open risks across all projects in one consolidated view.' }
    ],
    demoWidget: (
      <div className="glass-obsidian-card rounded-2xl p-5 shadow-2xl border border-white/[0.08]">
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2">
          <span className="font-bold text-white text-sm">Org Risk Matrix Summary</span>
          <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/20">2 Critical</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-center text-xs font-bold">
          <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-emerald-400">
            <p className="text-xl font-mono font-black">14</p>
            <p className="text-[11px] font-medium text-slate-300">Low Severity</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 text-amber-400">
            <p className="text-xl font-mono font-black">6</p>
            <p className="text-[11px] font-medium text-slate-300">High Severity</p>
          </div>
        </div>
      </div>
    )
  }
];

export default function SystemFeaturesSection() {
  const [activeTabId, setActiveTabId] = useState('hierarchy');
  const activeFeature = FEATURES.find(f => f.id === activeTabId) || FEATURES[0];

  return (
    <div className="py-8">
      {/* Section Title */}
      <div className="mb-12 text-center max-w-3xl mx-auto">
        <span className="rounded-full bg-indigo-500/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-300 border border-indigo-500/20 backdrop-blur-md">
          Built For Non-Profits & Enterprise Teams
        </span>
        <h2 className="mt-4 text-3xl font-black text-white md:text-5xl tracking-tight">
          Everything You Need to Run High-Impact Operations
        </h2>
        <p className="mt-3 text-base text-slate-400 font-medium">
          From dynamic role permissions to autonomous operations delegates and multi-currency audits.
        </p>
      </div>

      {/* Feature Tab Switches */}
      <div className="mb-10 flex flex-wrap justify-center gap-2.5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const isActive = f.id === activeTabId;
          return (
            <button
              key={f.id}
              onClick={() => setActiveTabId(f.id)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-xl shadow-indigo-500/25 scale-[1.03]'
                  : 'glass-obsidian text-slate-300 hover:text-white hover:border-white/[0.15]'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{f.title}</span>
            </button>
          );
        })}
      </div>

      {/* Feature Showcase Grid */}
      <div className="glass-obsidian-card rounded-3xl p-6 md:p-10 shadow-2xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          {/* Left Column Description */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className={`inline-block rounded-lg bg-gradient-to-r ${activeFeature.color} px-3 py-1 text-xs font-bold text-white shadow-md mb-2`}>
                Core Capabilities
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white">{activeFeature.title}</h3>
              <p className="mt-2 text-sm sm:text-base font-normal text-slate-300 leading-relaxed">{activeFeature.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeFeature.details.map((d, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.08] bg-[#08090a]/60 p-4 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-white mb-1.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>{d.role}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>

            <a
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-6 py-3 text-xs font-extrabold text-white transition hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 shadow-md"
            >
              <span>Explore Feature in App</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Right Column Widget Preview */}
          <div className="lg:col-span-5">
            {activeFeature.demoWidget}
          </div>
        </div>
      </div>
    </div>
  );
}
