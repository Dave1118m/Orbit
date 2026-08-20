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
  FileCheck
} from 'lucide-react';

const FEATURES = [
  {
    id: 'hierarchy',
    icon: Building2,
    title: 'Workspace Scope & Role Hierarchy',
    subtitle: 'Strict multi-tier security built for non-profits and complex enterprise projects',
    color: 'from-blue-500 to-indigo-600',
    details: [
      { role: 'Owner', desc: 'Full system-wide administrative control, ownership transfer, and global billing.' },
      { role: 'Admin', desc: 'Organization management, member invitations, compliance & partner oversight.' },
      { role: 'Coordinator', desc: 'Full control across all projects within assigned Workspaces.' },
      { role: 'Manager', desc: 'Full project ownership, task assignment, and budget approval authority.' },
      { role: 'Finance Officer', desc: 'Expense sign-off, bank account ledger management, and financial audit reports.' },
      { role: 'Member & Viewer', desc: 'Task execution, issue logging, and read-only transparency for stakeholders.' }
    ],
    demoWidget: (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="font-bold text-slate-800 text-sm">Role Authorization Matrix</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">System Enforced</span>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between rounded-lg bg-indigo-50 p-2.5 border border-indigo-100">
            <span className="font-bold text-indigo-900">RoleName.Owner</span>
            <span className="rounded bg-indigo-600 px-2 py-0.5 font-semibold text-white">Full Permission (All Scopes)</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-200">
            <span className="font-medium text-slate-700">RoleName.Admin</span>
            <span className="text-slate-600">Org + Workspace Management</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-200">
            <span className="font-medium text-slate-700">RoleName.Manager</span>
            <span className="text-slate-600">Project Ownership & Expenses</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-200">
            <span className="font-medium text-slate-700">RoleName.FinanceOfficer</span>
            <span className="text-slate-600">Expense Approvals & Ledger</span>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800 text-sm">Clean Water Initiative — Logframe</span>
          <span className="text-xs font-semibold text-emerald-600">MEL Status: 88% On Track</span>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>Indicator: Beneficiaries with Clean Water Access</span>
              <span className="font-bold text-indigo-600">12,500 / 15,000 Target</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: '83%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>Output: Water Filtration Systems Deployed</span>
              <span className="font-bold text-indigo-600">45 / 50 Units</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: '90%' }}></div>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800 text-sm">Budget Health & Threshold Warnings</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Audit Active</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-lg bg-amber-50/70 p-2 border border-amber-200">
            <div>
              <p className="font-bold text-slate-800">Expense #E-804 ($1,250.00)</p>
              <p className="text-slate-500">Exceeds $500 threshold • Receipt Attached</p>
            </div>
            <span className="rounded bg-emerald-600 px-2 py-0.5 font-bold text-white">Approved</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 border border-slate-200">
            <div>
              <p className="font-bold text-slate-800">Project Budget: Education Fund</p>
              <p className="text-slate-500">$45,000 Allocated / $38,200 Spent</p>
            </div>
            <span className="font-mono font-bold text-slate-700">84.8% Used</span>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800 text-sm">Org Risk Matrix Summary</span>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">2 Critical</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-emerald-800">
            <p className="text-lg">14</p>
            <p className="text-[11px] font-medium">Low Severity</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-800">
            <p className="text-lg">6</p>
            <p className="text-[11px] font-medium">High Severity</p>
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
    <div className="py-12">
      {/* Section Title */}
      <div className="mb-12 text-center max-w-3xl mx-auto">
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-indigo-700">
          Built For Non-Profits & Enterprise Teams
        </span>
        <h2 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">
          Everything You Need to Run High-Impact Operations
        </h2>
        <p className="mt-3 text-base text-slate-600">
          From role-scoped permissions to multi-currency financial audits and volunteer portals.
        </p>
      </div>

      {/* Feature Tab Switches */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const isActive = f.id === activeTabId;
          return (
            <button
              key={f.id}
              onClick={() => setActiveTabId(f.id)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xl scale-105 ring-2 ring-slate-700'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{f.title}</span>
            </button>
          );
        })}
      </div>

      {/* Feature Showcase Grid */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 md:p-10 shadow-xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
          {/* Left Column Description */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className={`inline-block rounded-lg bg-gradient-to-r ${activeFeature.color} px-3 py-1 text-xs font-bold text-white shadow-md mb-2`}>
                Core Capabilities
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900">{activeFeature.title}</h3>
              <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">{activeFeature.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeFeature.details.map((d, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{d.role}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-normal">{d.desc}</p>
                </div>
              ))}
            </div>

            <a
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20"
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
