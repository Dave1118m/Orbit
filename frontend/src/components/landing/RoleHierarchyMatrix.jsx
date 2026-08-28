import { useState } from 'react';
import { 
  Crown, 
  ShieldCheck, 
  Building2, 
  Target, 
  Briefcase, 
  DollarSign, 
  Users, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2, 
  Lock, 
  Key, 
  Sparkles,
  ArrowRight,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Check,
  X
} from 'lucide-react';

const HIERARCHY_ROLES = [
  {
    id: 'owner',
    level: 'L0',
    title: 'Owner',
    scope: 'Global System Scope',
    shortDesc: 'Full system-wide administrative control, ownership transfer, and global billing.',
    icon: Crown,
    theme: {
      border: 'border-violet-500/50 hover:border-violet-400',
      activeBorder: 'border-violet-400 ring-2 ring-violet-500/40 shadow-[0_0_30px_rgba(139,92,246,0.3)]',
      bg: 'bg-[#150f29]/95',
      iconBox: 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]',
      badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      accentText: 'text-violet-300'
    },
    permissions: [
      'Transfer organization ownership and master system credentials',
      'Manage global subscriptions, seat licenses, and enterprise billing',
      'Create, archive, and delete any Organization or Workspace',
      'Override financial approvals and configure global audit policies'
    ],
    governanceRule: 'Unrestricted root-level authority across all multi-tenant boundaries.'
  },
  {
    id: 'admin',
    level: 'L1',
    title: 'Admin',
    scope: 'Organization Scope',
    shortDesc: 'Organization management, member invitations, compliance & partner oversight.',
    icon: Building2,
    theme: {
      border: 'border-blue-500/50 hover:border-blue-400',
      activeBorder: 'border-blue-400 ring-2 ring-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      bg: 'bg-[#0c1830]/95',
      iconBox: 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      accentText: 'text-blue-300'
    },
    permissions: [
      'Invite and manage organization members, coordinators, and managers',
      'Create and configure new Workspaces within the organization',
      'Access org-wide compliance, risk registers, and MEL aggregation',
      'Configure currency engines (USD/ETB) and tax/fiscal settings'
    ],
    governanceRule: 'Full administrative rights excluding global billing ownership transfer.'
  },
  {
    id: 'coordinator',
    level: 'L2',
    title: 'Coordinator',
    scope: 'Workspace Scope',
    shortDesc: 'Full control across all projects within assigned Workspaces.',
    icon: Target,
    theme: {
      border: 'border-emerald-500/50 hover:border-emerald-400',
      activeBorder: 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]',
      bg: 'bg-[#092018]/95',
      iconBox: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      accentText: 'text-emerald-300'
    },
    permissions: [
      'Create, schedule, and oversee all Projects in assigned Workspaces',
      'Screen volunteer applications (Passed, Pending, Failed background checks)',
      'Assign project managers and dispatch team capacities',
      'Monitor workspace-level MEL indicator trees and deliverables'
    ],
    governanceRule: 'Governs cross-project resource dispatch and volunteer vetting.'
  },
  {
    id: 'manager',
    level: 'L3',
    title: 'Manager',
    scope: 'Project Scope',
    shortDesc: 'Full project ownership, task assignment, and budget approval authority.',
    icon: Briefcase,
    theme: {
      border: 'border-amber-500/50 hover:border-amber-400',
      activeBorder: 'border-amber-400 ring-2 ring-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]',
      bg: 'bg-[#221808]/95',
      iconBox: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      accentText: 'text-amber-300'
    },
    permissions: [
      'Manage Kanban board pipelines, sprint milestones, and tasks',
      'Assign tasks to team members and approved public volunteers',
      'Submit project budget lines and expense reimbursement requests',
      'Update baseline vs target values for MEL indicator logs'
    ],
    governanceRule: 'Operational control over assigned projects, timelines, and verifications.'
  },
  {
    id: 'finance',
    level: 'L3',
    title: 'Finance Officer',
    scope: 'Financial Scope',
    shortDesc: 'Expense sign-off, bank account ledger management, and financial audit reports.',
    icon: DollarSign,
    theme: {
      border: 'border-orange-500/50 hover:border-orange-400',
      activeBorder: 'border-orange-400 ring-2 ring-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.3)]',
      bg: 'bg-[#241308]/95',
      iconBox: 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.3)]',
      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      accentText: 'text-orange-300'
    },
    permissions: [
      'Approve or reject project expenses with invoice verification',
      'Enforce $500 receipt attachment threshold compliance rules',
      'Manage bank accounts, deposits, and multi-currency conversions (USD/ETB)',
      'Generate donor financial statements and GAAP audit balance sheets'
    ],
    governanceRule: 'Automated audit rule: Any expense ≥ $500 strictly requires verified receipts.'
  },
  {
    id: 'member',
    level: 'L4',
    title: 'Member',
    scope: 'Execution Scope',
    shortDesc: 'Task execution, deliverable submission, and evidence attachment for indicators.',
    icon: Users,
    theme: {
      border: 'border-cyan-500/50 hover:border-cyan-400',
      activeBorder: 'border-cyan-400 ring-2 ring-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.3)]',
      bg: 'bg-[#081b24]/95',
      iconBox: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      accentText: 'text-cyan-300'
    },
    permissions: [
      'Execute assigned Kanban tasks and move cards across columns',
      'Upload deliverable files, inspection notes, and field photos',
      'Submit expense claims with attached invoices for reimbursement',
      'Log time records and report blocker issues to Project Managers'
    ],
    governanceRule: 'Can only edit assigned tasks; zero administrative or budget modification access.'
  },
  {
    id: 'viewer',
    level: 'L4',
    title: 'Viewer',
    scope: 'Read-Only Scope',
    shortDesc: 'Read-only transparency for donors, board members, and public stakeholders.',
    icon: Eye,
    theme: {
      border: 'border-slate-500/50 hover:border-slate-400',
      activeBorder: 'border-slate-300 ring-2 ring-slate-400/40 shadow-[0_0_30px_rgba(148,163,184,0.3)]',
      bg: 'bg-[#121620]/95',
      iconBox: 'bg-slate-500/20 text-slate-300 border border-slate-500/40 shadow-[0_0_15px_rgba(148,163,184,0.3)]',
      badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      accentText: 'text-slate-300'
    },
    permissions: [
      'Read-only access to project milestones, timelines, and Gantt charts',
      'View verified MEL indicator performance trees and target metrics',
      'Access approved donor financial summary sheets and audit summaries',
      'Export read-only progress summaries for external board review'
    ],
    governanceRule: 'Strict read-only isolation preserving stakeholder audit transparency.'
  }
];

// All 37 Permissions — Titles Only (Clean, compact format)
const ALL_37_PERMISSIONS = [
  // Organization (7 actions)
  { id: 'OrganizationManage', title: 'Organization Manage', category: 'Organization' },
  { id: 'OrganizationView', title: 'Organization View', category: 'Organization' },
  { id: 'OrganizationInvite', title: 'Organization Invite', category: 'Organization' },
  { id: 'OrganizationTransferOwnership', title: 'Organization Transfer Ownership', category: 'Organization' },
  { id: 'OrganizationRestore', title: 'Organization Restore', category: 'Organization' },
  { id: 'OrganizationManagePartners', title: 'Organization Manage Partners', category: 'Organization' },
  { id: 'OrganizationManageCompliance', title: 'Organization Manage Compliance', category: 'Organization' },

  // Workspace (4 actions)
  { id: 'WorkspaceCreate', title: 'Workspace Create', category: 'Workspace' },
  { id: 'WorkspaceEdit', title: 'Workspace Edit', category: 'Workspace' },
  { id: 'WorkspaceDelete', title: 'Workspace Delete', category: 'Workspace' },
  { id: 'WorkspaceView', title: 'Workspace View', category: 'Workspace' },

  // Project (6 actions)
  { id: 'ProjectCreate', title: 'Project Create', category: 'Project' },
  { id: 'ProjectEdit', title: 'Project Edit', category: 'Project' },
  { id: 'ProjectDelete', title: 'Project Delete', category: 'Project' },
  { id: 'ProjectView', title: 'Project View', category: 'Project' },
  { id: 'ProjectAssignTeam', title: 'Project Assign Team', category: 'Project' },
  { id: 'ProjectPostpone', title: 'Project Postpone', category: 'Project' },

  // Team (6 actions)
  { id: 'TeamCreate', title: 'Team Create', category: 'Team' },
  { id: 'TeamEdit', title: 'Team Edit', category: 'Team' },
  { id: 'TeamDelete', title: 'Team Delete', category: 'Team' },
  { id: 'TeamManageMembers', title: 'Team Manage Members', category: 'Team' },
  { id: 'TeamAssignProject', title: 'Team Assign Project', category: 'Team' },
  { id: 'TeamView', title: 'Team View', category: 'Team' },

  // Tasks (4 actions)
  { id: 'TaskCreate', title: 'Task Create', category: 'Tasks' },
  { id: 'TaskEdit', title: 'Task Edit', category: 'Tasks' },
  { id: 'TaskDelete', title: 'Task Delete', category: 'Tasks' },
  { id: 'TaskView', title: 'Task View', category: 'Tasks' },

  // Finance (2 actions)
  { id: 'ExpenseApprove', title: 'Expense Approve', category: 'Finance' },
  { id: 'BudgetEdit', title: 'Budget Edit', category: 'Finance' },

  // Users (2 actions)
  { id: 'UserManage', title: 'User Manage', category: 'Users' },
  { id: 'UserInvite', title: 'User Invite', category: 'Users' },

  // Reports (1 action)
  { id: 'ViewReports', title: 'View Reports', category: 'Reports' },

  // Volunteers (2 actions)
  { id: 'VolunteerManage', title: 'Volunteer Manage', category: 'Volunteers' },
  { id: 'VolunteerView', title: 'Volunteer View', category: 'Volunteers' },

  // Risk & Issues (3 actions)
  { id: 'RiskLogView', title: 'Risk Log View', category: 'Risk & Issues' },
  { id: 'RiskLogEdit', title: 'Risk Log Edit', category: 'Risk & Issues' },
  { id: 'IssueCreate', title: 'Issue Create', category: 'Risk & Issues' }
];

// Exact Default System Role Permission Mapping from Program.cs Seed
const DEFAULT_ROLE_PERMISSIONS = {
  owner: ALL_37_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
  admin: ALL_37_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: p.id !== 'OrganizationTransferOwnership' }), {}),
  coordinator: {
    OrganizationView: true,
    WorkspaceCreate: true, WorkspaceEdit: true, WorkspaceDelete: true, WorkspaceView: true,
    ProjectCreate: true, ProjectEdit: true, ProjectDelete: true, ProjectView: true, ProjectAssignTeam: true, ProjectPostpone: true,
    TeamCreate: true, TeamEdit: true, TeamDelete: true, TeamManageMembers: true, TeamAssignProject: true, TeamView: true,
    TaskCreate: true, TaskEdit: true, TaskDelete: true, TaskView: true,
    BudgetEdit: true,
    ViewReports: true,
    VolunteerManage: true, VolunteerView: true,
    RiskLogView: true, RiskLogEdit: true, IssueCreate: true
  },
  manager: {
    OrganizationView: true, WorkspaceView: true,
    ProjectCreate: true, ProjectEdit: true, ProjectView: true, ProjectAssignTeam: true, ProjectPostpone: true,
    TeamView: true,
    TaskCreate: true, TaskEdit: true, TaskView: true,
    ExpenseApprove: true, BudgetEdit: true,
    ViewReports: true,
    VolunteerView: true,
    RiskLogView: true, RiskLogEdit: true, IssueCreate: true
  },
  finance: {
    OrganizationView: true, WorkspaceView: true, ProjectView: true, TeamView: true, TaskView: true,
    ExpenseApprove: true, BudgetEdit: true,
    ViewReports: true,
    VolunteerView: true,
    RiskLogView: true
  },
  member: {
    OrganizationView: true, WorkspaceView: true, ProjectView: true, TeamView: true,
    TaskCreate: true, TaskEdit: true, TaskView: true,
    VolunteerView: true,
    RiskLogView: true, IssueCreate: true
  },
  viewer: {
    OrganizationView: true, WorkspaceView: true, ProjectView: true, TeamView: true, TaskView: true,
    ViewReports: true,
    VolunteerView: true,
    RiskLogView: true
  }
};

const CATEGORIES = [
  'All (37)',
  'Organization',
  'Workspace',
  'Project',
  'Team',
  'Tasks',
  'Finance',
  'Users',
  'Reports',
  'Volunteers',
  'Risk & Issues'
];

export default function RoleHierarchyMatrix() {
  const [activeTab, setActiveTab] = useState('hierarchy'); // 'hierarchy' | 'matrix' | 'cards'
  const [expandedRoleId, setExpandedRoleId] = useState(null);

  // Local-only interactive demo state (does not affect system settings)
  const [demoMatrixState, setDemoMatrixState] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [selectedCategory, setSelectedCategory] = useState('All (37)');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleRoleExpand = (id) => {
    setExpandedRoleId(prev => prev === id ? null : id);
  };

  // Toggle switch on/off locally for preview without modifying backend settings
  const handleToggleDemoPermission = (roleId, permId) => {
    if (roleId === 'owner') return; // Owner permissions are protected full access
    setDemoMatrixState(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permId]: !prev[roleId]?.[permId]
      }
    }));
  };

  const handleResetDemoDefaults = () => {
    setDemoMatrixState(DEFAULT_ROLE_PERMISSIONS);
  };

  // Filtered permissions list
  const filteredPermissions = ALL_37_PERMISSIONS.filter(p => {
    const matchesCat = selectedCategory === 'All (37)' || p.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const owner = HIERARCHY_ROLES.find(r => r.id === 'owner');
  const admin = HIERARCHY_ROLES.find(r => r.id === 'admin');
  const coordinator = HIERARCHY_ROLES.find(r => r.id === 'coordinator');
  const manager = HIERARCHY_ROLES.find(r => r.id === 'manager');
  const finance = HIERARCHY_ROLES.find(r => r.id === 'finance');
  const member = HIERARCHY_ROLES.find(r => r.id === 'member');
  const viewer = HIERARCHY_ROLES.find(r => r.id === 'viewer');

  // Render a Square Card (Equal size on all sides) with smooth expansion
  const renderSquareRoleCard = (role) => {
    const isExpanded = expandedRoleId === role.id;
    const Icon = role.icon;
    const theme = role.theme;

    if (isExpanded) {
      // Expanded Detailed Mode
      return (
        <div
          key={role.id}
          onClick={() => toggleRoleExpand(role.id)}
          className={`group cursor-pointer rounded-3xl border p-5 transition-all duration-300 backdrop-blur-xl ${theme.bg} ${theme.activeBorder} w-full max-w-xl mx-auto space-y-4`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${theme.iconBox}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white tracking-tight">{role.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-black border ${theme.badge}`}>
                    {role.level}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">{role.scope}</p>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]"
            >
              <span>Close</span>
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            {role.shortDesc}
          </p>

          {/* Permissions Checklist */}
          <div className="space-y-2">
            <span className={`text-xs font-extrabold flex items-center gap-1.5 ${theme.accentText}`}>
              <Key className="h-3.5 w-3.5" />
              <span>Authorized System Privileges:</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {role.permissions.map((perm, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-xl bg-black/40 p-2.5 border border-white/[0.06] text-xs">
                  <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${theme.accentText}`} />
                  <span className="text-slate-300 leading-snug text-[11px]">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Governance Rule */}
          <div className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 text-xs flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <p className="text-slate-400 text-[11px] leading-relaxed">
              <span className="font-bold text-slate-200">Governance Rule:</span> {role.governanceRule}
            </p>
          </div>
        </div>
      );
    }

    // Default Square Card Mode (Equal Width & Height: w-40 h-40 or w-44 h-44)
    return (
      <div
        key={role.id}
        onClick={() => toggleRoleExpand(role.id)}
        className={`group cursor-pointer rounded-3xl border transition-all duration-300 backdrop-blur-xl ${theme.bg} ${theme.border} hover:scale-105 hover:shadow-xl w-40 h-40 sm:w-44 sm:h-44 flex flex-col items-center justify-between p-4 text-center mx-auto`}
      >
        {/* Top Level Badge */}
        <div className="w-full flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${theme.badge}`}>
            {role.level}
          </span>
          <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors flex items-center gap-0.5">
            <span>View</span>
            <ChevronDown className="h-3 w-3" />
          </span>
        </div>

        {/* Center Glowing Icon Box */}
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${theme.iconBox}`}>
          <Icon className="h-6 w-6" />
        </div>

        {/* Bottom Role Title */}
        <div>
          <h3 className="text-base font-black text-white tracking-tight group-hover:text-indigo-200 transition-colors">
            {role.title}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
            {role.scope}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* ── Section Title as Figma ── */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Role <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Authorization</span> Matrix
        </h2>
        <p className="mt-3 text-sm sm:text-base text-slate-400 font-medium">
          Strict multi-tier security built for non-profits and complex enterprise projects
        </p>

        {/* ── Tab Switchers matching Figma ── */}
        <div className="mt-8 inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#0d1117]/90 p-1.5 shadow-xl backdrop-blur-xl">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 ${
              activeTab === 'hierarchy'
                ? 'bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 ${
              activeTab === 'matrix'
                ? 'bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Permission Matrix
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 ${
              activeTab === 'cards'
                ? 'bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Role Cards
          </button>
        </div>
      </div>

      {/* ── 1. HIERARCHY TREE VIEW (Square Equal-Sized Cards) ── */}
      {activeTab === 'hierarchy' && (
        <div className="relative max-w-3xl mx-auto space-y-3 pt-2">
          {/* Level 0: Owner */}
          <div className="flex flex-col items-center">
            {renderSquareRoleCard(owner)}
            <div className="h-6 w-0.5 border-l-2 border-dashed border-violet-500/40 my-1.5" />
          </div>

          {/* Level 1: Admin */}
          <div className="flex flex-col items-center">
            {renderSquareRoleCard(admin)}
            <div className="h-6 w-0.5 border-l-2 border-dashed border-blue-500/40 my-1.5" />
          </div>

          {/* Level 2: Coordinator */}
          <div className="flex flex-col items-center">
            {renderSquareRoleCard(coordinator)}
            <div className="h-6 w-0.5 border-l-2 border-dashed border-emerald-500/40 my-1.5" />
          </div>

          {/* Level 3: Manager & Finance Officer (Split Branch) */}
          <div className="flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-6 w-full max-w-lg">
              {renderSquareRoleCard(manager)}
              {renderSquareRoleCard(finance)}
            </div>
            <div className="h-6 w-0.5 border-l-2 border-dashed border-amber-500/40 my-1.5" />
          </div>

          {/* Level 4: Member & Viewer (Split Branch) */}
          <div className="flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-6 w-full max-w-lg">
              {renderSquareRoleCard(member)}
              {renderSquareRoleCard(viewer)}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. PERMISSION MATRIX (7 ROLES × 37 ACTIONS — CLEAN TITLES & DEMO SWITCHES) ── */}
      {activeTab === 'matrix' && (
        <div className="glass-obsidian-card rounded-3xl p-5 sm:p-7 shadow-2xl border border-white/[0.08] max-w-7xl mx-auto space-y-5">
          {/* Top Controls Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-xl font-black text-white">Dynamic ABAC Security Matrix</h3>
                <span className="rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/20">
                  7 Roles • 37 Actions
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Interactive preview of OrbitDesk's permission matrix governing system endpoints.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              {/* Search Box */}
              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter 37 actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-black/40 pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Reset Defaults Button */}
              <button
                type="button"
                onClick={handleResetDemoDefaults}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/[0.08] transition"
                title="Reset to default seed permissions"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 7 Roles x 37 Actions Table with Titles Only & Demo Switch Toggles */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08090a]/80 shadow-inner max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-20 bg-[#0d1117] border-b border-white/[0.1] text-slate-300 shadow-md">
                <tr>
                  <th className="py-3.5 px-4 font-black uppercase text-[11px] tracking-wider text-slate-400 w-64">
                    Action Name ({filteredPermissions.length})
                  </th>
                  {HIERARCHY_ROLES.map((role) => (
                    <th key={role.id} className="py-3.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-extrabold text-white text-xs">{role.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${role.theme.badge}`}>
                          {role.level}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-slate-300">
                {filteredPermissions.map((perm) => (
                  <tr key={perm.id} className="hover:bg-white/[0.03] transition-colors">
                    {/* Action Title Only */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{perm.title}</span>
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-white/[0.07]">
                          {perm.category}
                        </span>
                      </div>
                    </td>

                    {/* 7 Role Interactive Demo Switch Toggles */}
                    {HIERARCHY_ROLES.map((role) => {
                      const isOwnerRole = role.id === 'owner';
                      const isGranted = isOwnerRole ? true : !!demoMatrixState[role.id]?.[perm.id];

                      return (
                        <td key={role.id} className="py-2.5 px-3 text-center align-middle">
                          {isOwnerRole ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-300 border border-violet-500/30" title="Owner permissions are system-protected full access.">
                              <Lock className="h-3 w-3 text-violet-400" />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={isGranted}
                                onChange={() => handleToggleDemoPermission(role.id, perm.id)}
                              />
                              <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                            </label>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {filteredPermissions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                      No matching actions found for "{searchQuery}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Live Matrix Legend & Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span>Active Switch = Action Authorized</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-slate-700" />
                <span>Inactive = Access Denied</span>
              </span>
            </div>
            <span className="text-slate-400 text-[11px]">
              🔒 Superuser protection active for <span className="text-violet-300 font-bold">Owner (L0)</span>
            </span>
          </div>
        </div>
      )}

      {/* ── 3. ROLE CARDS BENTO GRID VIEW ── */}
      {activeTab === 'cards' && (
        <div className="flex flex-wrap items-center justify-center gap-5 max-w-5xl mx-auto">
          {HIERARCHY_ROLES.map((role) => (
            <div key={role.id}>
              {renderSquareRoleCard(role)}
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <div className="mt-12 text-center">
        <a
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all"
        >
          <span>Configure RBAC in OrbitDesk</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
