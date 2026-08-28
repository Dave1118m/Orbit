import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import KanbanLandingDemo from '../components/landing/KanbanLandingDemo';
import SystemFeaturesSection from '../components/landing/SystemFeaturesSection';
import RoleHierarchyMatrix from '../components/landing/RoleHierarchyMatrix';
import InteractiveReportsDemo from '../components/landing/InteractiveReportsDemo';
import RoiCalculator from '../components/landing/RoiCalculator';
import FaqSection from '../components/landing/FaqSection';
import DotBackground from '../components/landing/DotBackground';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Kanban, 
  DollarSign, 
  ChevronDown, 
  ChevronUp,
  Menu,
  X,
  Heart,
  ExternalLink,
  Target,
  Briefcase,
  Activity,
  Award,
  Mail,
  Phone,
  MapPin,
  Send,
  MessageSquare,
  Clock,
  BarChart3,
  Share2
} from 'lucide-react';

// ── SOCIAL MEDIA & COMMUNITY CHANNELS CONFIGURATION ──
// Update your handles and direct URLs below:
export const SOCIAL_CHANNELS = [
  {
    id: 'telegram',
    name: 'Telegram',
    handle: '@orbitdesk',
    url: 'https://t.me/orbitdesk', // <--- Configure Telegram URL here
    desc: 'Live Community & Support Chat',
    brandColor: 'text-sky-400',
    borderHover: 'hover:border-sky-400/50 hover:bg-sky-500/10',
    icon: (props) => (
      <svg className={props.className || "h-5 w-5"} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
      </svg>
    )
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    handle: '@orbitdesk',
    url: 'https://tiktok.com/@orbitdesk', // <--- Configure TikTok URL here
    desc: 'Feature Demos & Quick Highlights',
    brandColor: 'text-pink-400',
    borderHover: 'hover:border-pink-400/50 hover:bg-pink-500/10',
    icon: (props) => (
      <svg className={props.className || "h-5 w-5"} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.29 0 .57.04.84.11V9.37a6.33 6.33 0 00-.84-.06 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.16 8.16 0 004.77 1.52V6.82a4.84 4.84 0 01-1-.13z"/>
      </svg>
    )
  },
  {
    id: 'youtube',
    name: 'YouTube',
    handle: '@OrbitDeskOfficial',
    url: 'https://youtube.com/@OrbitDeskOfficial', // <--- Configure YouTube URL here
    desc: 'NGO Tutorials & Masterclasses',
    brandColor: 'text-rose-500',
    borderHover: 'hover:border-rose-500/50 hover:bg-rose-500/10',
    icon: (props) => (
      <svg className={props.className || "h-5 w-5"} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    handle: 'OrbitDesk Enterprise',
    url: 'https://linkedin.com/company/orbitdesk', // <--- Configure LinkedIn URL here
    desc: 'Consortium & Enterprise Partnerships',
    brandColor: 'text-blue-400',
    borderHover: 'hover:border-blue-400/50 hover:bg-blue-500/10',
    icon: (props) => (
      <svg className={props.className || "h-5 w-5"} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    )
  }
];

export default function Landing() {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live System Telemetry State
  const [telemetry, setTelemetry] = useState({
    totalProjects: 14,
    activeProjects: 9,
    totalTasks: 48,
    completedTasks: 32,
    totalTeams: 6
  });

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: 'Demo Request', message: '' });
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState('');

  const API_BASE = import.meta.env.VITE_API_URL;

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.name || !contactForm.message) {
      setContactError('Please fill in your name, email, and message.');
      return;
    }
    setContactSending(true);
    setContactError('');

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (res.ok) {
        setSubmittedEmail(contactForm.email);
        setContactSubmitted(true);
        setContactForm({ name: '', email: '', subject: 'Demo Request', message: '' });
      } else {
        const errData = await res.json().catch(() => ({}));
        setContactError(errData.message || 'Failed to send inquiry. Please try again.');
      }
    } catch (err) {
      setContactError('Network error connecting to API server.');
    } finally {
      setContactSending(false);
    }
  };

  useEffect(() => {
    async function fetchLiveSystemMetrics() {
      try {
        const res = await fetch(`${API_BASE}/analytics/public-telemetry`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
        }
      } catch (err) {
        console.log('Landing telemetry fetch notice:', err);
      }
    }
    fetchLiveSystemMetrics();
  }, []);

  const totalProjects = telemetry.totalProjects || 14;
  const activeProjects = telemetry.activeProjects || 9;
  const totalTasks = telemetry.totalTasks || 48;
  const completedTasks = telemetry.completedTasks || 32;
  const totalTeams = telemetry.totalTeams || 6;

  return (
    <div className="min-h-screen bg-[#08090a] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── TOP NAVBAR ── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#08090a]/85 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16 sm:h-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 text-white font-black shadow-lg shadow-indigo-500/25">
              O
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">Orbit<span className="text-cyan-400">Desk</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs sm:text-sm font-bold text-slate-300">
            <a href="#kanban-section" className="hover:text-white transition-colors">Kanban</a>
            <a href="#metrics" className="hover:text-white transition-colors">Telemetry</a>
            <a href="#governance" className="hover:text-white transition-colors">RBAC Matrix</a>
            <a href="#reports" className="hover:text-white transition-colors">Analytics</a>
            <a href="#roi" className="hover:text-white transition-colors">ROI Calculator</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                to="/projects"
                className="rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-5 py-2 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.08] bg-[#08090a] px-4 pt-2 pb-6 space-y-3">
            <a href="#kanban-section" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">Kanban Board</a>
            <a href="#metrics" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">System Telemetry</a>
            <a href="#governance" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">RBAC Matrix</a>
            <a href="#reports" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">Analytics & MEL</a>
            <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">ROI Calculator</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">FAQ</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-300">Contact Us</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" className="text-center rounded-xl border border-white/[0.1] bg-white/[0.04] py-2.5 text-sm font-bold text-white">Sign In</Link>
              <Link to="/register" className="text-center rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white">Get Started Free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO SECTION (Linear / Plane Obsidian & Light Cones) ── */}
      <DotBackground
        variant="hero"
        density="normal"
        mask="radial"
        showGlow={true}
        interactive={true}
        className="py-24 md:py-32 bg-[#08090a] border-b border-white/[0.08] relative"
      >
        <div className="mx-auto max-w-5xl px-4 text-center space-y-8 relative z-10">
          {/* Shimmering Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs sm:text-sm font-extrabold text-indigo-300 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
            <span className="tracking-wide uppercase">ENTERPRISE PROJECT & NGO GOVERNANCE PLATFORM</span>
          </div>

          {/* Holographic Headline */}
          <h1 className="text-5xl font-black text-white sm:text-7xl md:text-8xl tracking-tight leading-[1.08]">
            Centralized Workspaces, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-white via-indigo-200 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm">
              Logframes & Financial Audits
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-base sm:text-xl text-slate-300 font-normal leading-relaxed">
            Manage multi-tenant workspaces, drag-and-drop Kanban task pipelines, <span className="text-emerald-400 font-extrabold">$500 receipt audit rules</span>, MEL indicator target trees, and public volunteer recruitment.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-8 py-4 text-sm font-extrabold text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Get Started Now</span>
              <ArrowRight className="h-5 w-5" />
            </Link>

            <Link
              to="/apply-volunteer"
              className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-7 py-4 text-sm font-extrabold text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xs backdrop-blur-md"
            >
              <Heart className="h-5 w-5 text-rose-400" />
              <span>Public Volunteer Portal</span>
            </Link>
          </div>

          {/* Sleek Feature Tags Pill Banner */}
          <div className="pt-6">
            <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-8 rounded-2xl border border-white/[0.08] bg-slate-900/60 px-6 py-3.5 shadow-2xl backdrop-blur-xl text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2 text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
                <span>Live Drag & Drop Kanban</span>
              </span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="flex items-center gap-2 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                <span>Dual USD / ETB Engine</span>
              </span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="flex items-center gap-2 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span>$500 Receipt Audit Gate</span>
              </span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="flex items-center gap-2 text-violet-400">
                <span className="h-2 w-2 rounded-full bg-violet-400"></span>
                <span>MEL Results Tree</span>
              </span>
            </div>
          </div>
        </div>
      </DotBackground>

      {/* ── DRAG AND DROP KANBAN DEMO SECTION ── */}
      <DotBackground
        variant="dark"
        density="normal"
        mask="radial"
        showGlow={true}
        interactive={true}
        className="py-24 bg-[#08090a] text-white border-b border-white/[0.08]"
      >
        <div id="kanban-section" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300 border border-cyan-500/20 backdrop-blur-md">
              Interactive Task Management
            </span>
            <h2 className="mt-4 text-3xl font-black text-white md:text-5xl tracking-tight">
              Drag & Drop Live Kanban Pipeline
            </h2>
            <p className="mt-3 text-base text-slate-400 font-medium">
              Try dragging tasks between columns right here in your browser!
            </p>
          </div>

          <KanbanLandingDemo />
        </div>
      </DotBackground>

      {/* ── LIVE SYSTEM METRICS (Linear-Style Bento Grid) ── */}
      <DotBackground
        variant="dark"
        density="spacious"
        mask="radial"
        showGlow={true}
        interactive={false}
        className="py-24 bg-[#0d1117] border-b border-white/[0.08]"
      >
        <div id="metrics" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" /> Live System Telemetry
            </span>
            <span className="text-xs font-mono font-bold text-slate-300 bg-white/[0.05] px-4 py-1.5 rounded-xl border border-white/[0.1] shadow-xs backdrop-blur-md flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Database Telemetry • Real-time Sync
            </span>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div className="glass-obsidian-card p-6 sm:p-7 rounded-3xl transition-all duration-300 hover:border-cyan-500/40">
              <div className="flex items-center justify-between text-cyan-400 mb-3">
                <Briefcase className="h-6 w-6" />
                <span className="text-[11px] font-extrabold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">Projects</span>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-white font-mono">{totalProjects}</p>
              <p className="text-xs font-bold text-slate-400 mt-2">{activeProjects} Active Projects</p>
            </div>

            <div className="glass-obsidian-card p-6 sm:p-7 rounded-3xl transition-all duration-300 hover:border-emerald-500/40">
              <div className="flex items-center justify-between text-emerald-400 mb-3">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-[11px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">Tasks</span>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-white font-mono">{totalTasks}</p>
              <p className="text-xs font-bold text-slate-400 mt-2">{completedTasks} Completed Deliverables</p>
            </div>

            <div className="glass-obsidian-card p-6 sm:p-7 rounded-3xl transition-all duration-300 hover:border-indigo-500/40">
              <div className="flex items-center justify-between text-indigo-400 mb-3">
                <Users className="h-6 w-6" />
                <span className="text-[11px] font-extrabold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">Teams</span>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-white font-mono">{totalTeams}</p>
              <p className="text-xs font-bold text-slate-400 mt-2">Assigned Teams</p>
            </div>

            <div className="glass-obsidian-card p-6 sm:p-7 rounded-3xl transition-all duration-300 hover:border-amber-500/40">
              <div className="flex items-center justify-between text-amber-400 mb-3">
                <DollarSign className="h-6 w-6" />
                <span className="text-[11px] font-extrabold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full">Currencies</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-white font-mono">USD / ETB</p>
              <p className="text-xs font-bold text-slate-400 mt-2">Dual-Currency Engine</p>
            </div>
          </div>
        </div>
      </DotBackground>

      {/* ── GOVERNANCE & RBAC MATRIX (Figma Exact Role Hierarchy & Matrix) ── */}
      <DotBackground
        variant="dark"
        density="normal"
        mask="center"
        showGlow={true}
        interactive={false}
        className="py-24 bg-[#08090a] border-b border-white/[0.08]"
      >
        <div id="governance" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RoleHierarchyMatrix />
        </div>
      </DotBackground>

      {/* ── INTERACTIVE REPORTS & ANALYTICS SHOWCASE (Figma Exact) ── */}
      <DotBackground
        variant="dark"
        density="dense"
        mask="radial"
        showGlow={true}
        interactive={true}
        className="py-24 bg-[#0d1117] border-b border-white/[0.08]"
      >
        <div id="reports" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300 border border-cyan-500/20 backdrop-blur-md">
              Real-Time Intelligence & Analytics
            </span>
            <h2 className="mt-4 text-3xl font-black text-white md:text-5xl tracking-tight">
              Institutional Reports & MEL Tracking
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 font-medium">
              Real-time donor dashboards, GAAP audit balance sheets, and automated logframe tracking.
            </p>
          </div>
          <InteractiveReportsDemo />
        </div>
      </DotBackground>

      {/* ── ROI CALCULATOR ── */}
      <DotBackground
        variant="dark"
        density="spacious"
        mask="radial"
        showGlow={true}
        interactive={false}
        className="py-24 bg-[#08090a] border-b border-white/[0.08]"
      >
        <div id="roi" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RoiCalculator />
        </div>
      </DotBackground>

      {/* ── FREQUENTLY ASKED QUESTIONS SECTION (Figma Exact Master-Detail) ── */}
      <DotBackground
        variant="dark"
        density="spacious"
        mask="radial"
        showGlow={false}
        interactive={false}
        className="py-24 bg-[#0d1117] border-b border-white/[0.08]"
      >
        <div id="faq" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FaqSection />
        </div>
      </DotBackground>

      {/* ── CONTACT US & COMMUNITY CHANNELS SECTION ── */}
      <DotBackground
        variant="dark"
        density="normal"
        mask="linear-y"
        showGlow={true}
        interactive={true}
        className="py-24 bg-[#08090a] text-white relative overflow-hidden border-t border-white/[0.08]"
      >
        <div id="contact" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="rounded-full bg-indigo-500/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-400 border border-indigo-500/20 inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Get In Touch & Connect
            </span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-5xl tracking-tight">
              Ready to Accelerate Your Projects & Donor Impact?
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Have questions about custom NGO setups, donor compliance, or enterprise onboarding? Speak directly with our team or join our community channels.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Column: Direct Contact & Social Media Channels */}
            <div className="lg:col-span-5 space-y-6">
              {/* Direct Info Card */}
              <div className="glass-obsidian-card p-6 rounded-3xl space-y-5">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Direct Email</h4>
                    <p className="text-sm font-bold text-white mt-0.5">support@orbitdesk.org</p>
                    <p className="text-[11px] text-slate-400">Response SLA: &lt; 2 Hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Operating Hours</h4>
                    <p className="text-sm font-bold text-white mt-0.5">Monday – Friday (8:00 AM – 6:00 PM UTC)</p>
                    <p className="text-[11px] text-slate-400">24/7 Server Health Monitoring</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Security & Compliance</h4>
                    <p className="text-sm font-bold text-white mt-0.5">Audit Logs & $500 Gate Protected</p>
                    <p className="text-[11px] text-slate-400">Strict end-to-end data encryption</p>
                  </div>
                </div>
              </div>

              {/* ── DEDICATED SOCIAL & COMMUNITY CARD ── */}
              <div className="glass-obsidian-card p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Join Our Community & Channels</h4>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    Official Links
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SOCIAL_CHANNELS.map((social) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group flex items-center justify-between p-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all duration-200 ${social.borderHover}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 ${social.brandColor} group-hover:scale-110 transition-transform`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors truncate">
                              {social.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {social.handle}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-white shrink-0 ml-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Contact Form Column */}
            <div className="lg:col-span-7">
              <div className="glass-obsidian-card p-6 sm:p-8 rounded-3xl">
                {contactSubmitted ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Message Sent Successfully!</h3>
                    <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                      Thank you for reaching out to OrbitDesk! Our solutions team has received your message and will respond to <span className="font-bold text-white">{submittedEmail}</span> shortly.
                    </p>
                    <button
                      onClick={() => setContactSubmitted(false)}
                      className="mt-4 rounded-xl bg-white/[0.08] px-6 py-2.5 text-xs font-extrabold text-white hover:bg-white/[0.15] transition"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Your Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sarah Jenkins"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="w-full rounded-xl border border-white/[0.1] bg-[#08090a]/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">Work Email *</label>
                        <input
                          type="email"
                          required
                          placeholder="sarah@organization.org"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full rounded-xl border border-white/[0.1] bg-[#08090a]/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">Inquiry Type</label>
                      <select
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full rounded-xl border border-white/[0.1] bg-[#08090a]/80 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                      >
                        <option value="Demo Request">Request Live Platform Demo</option>
                        <option value="Custom NGO Setup">Custom NGO / Organization Setup</option>
                        <option value="Donor Integration">Donor & Grant Tracking Setup</option>
                        <option value="Technical Support">Technical & Security Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">Message / Details</label>
                      <textarea
                        rows={4}
                        placeholder="Tell us about your organization size, projects, or specific requirements..."
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full rounded-xl border border-white/[0.1] bg-[#08090a]/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition resize-none"
                      ></textarea>
                    </div>

                    {contactError && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
                        {contactError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={contactSending}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
                    >
                      {contactSending ? (
                        <span>Sending Request...</span>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Send Message to Team</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </DotBackground>

      {/* ── FOOTER (Linear Obsidian Dark & Social Channel Strip) ── */}
      <footer className="border-t border-white/[0.08] bg-[#060708] py-12 text-slate-400 text-xs sm:text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm shadow-md">O</div>
              <span className="font-black text-white text-lg tracking-tight">OrbitDesk</span>
            </div>

            {/* Social Icons Row in Footer */}
            <div className="flex items-center gap-3">
              {SOCIAL_CHANNELS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/[0.2] hover:bg-white/[0.08] transition-all"
                    title={social.name}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="font-extrabold text-slate-300 hover:text-white transition-colors">Sign In</Link>
              <Link to="/register" className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 font-extrabold text-white hover:opacity-95 transition-all shadow-md shadow-indigo-500/20">Get Started</Link>
            </div>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-between gap-4 text-slate-400">
            <p>© {new Date().getFullYear()} OrbitDesk. All rights reserved.</p>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All API Services Connected & Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
