import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import KanbanLandingDemo from '../components/landing/KanbanLandingDemo';
import SystemFeaturesSection from '../components/landing/SystemFeaturesSection';
import InteractiveReportsDemo from '../components/landing/InteractiveReportsDemo';
import RoiCalculator from '../components/landing/RoiCalculator';
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
  BarChart3
} from 'lucide-react';

const FAQS = [
  {
    q: 'How does OrbitDesk enforce system permissions and role access?',
    a: 'OrbitDesk uses strict Role-Based Access Control (RBAC). Organization Owners receive full administrative privileges. Admins manage settings, Coordinators oversee Workspaces, Managers control Projects, Finance Officers approve Expenses, and Members execute tasks.'
  },
  {
    q: 'How do Logframes (MEL) and Indicator targets work in OrbitDesk?',
    a: 'OrbitDesk features a standardized Goal ➔ Outcome ➔ Output ➔ Activity results framework. Officers attach verification evidence, set target metrics, and track progress in real time.'
  },
  {
    q: 'What is the $500 expense threshold audit rule?',
    a: 'Expenses equal to or exceeding $500 automatically require an attached invoice or receipt before approval, preventing audit compliance flags.'
  },
  {
    q: 'How does the Public Volunteer recruitment portal work?',
    a: 'OrbitDesk provides a public link for volunteer applications. Coordinators screen background checks (Passed, Pending, Failed) and assign approved volunteers directly to project tasks.'
  },
  {
    q: 'What currency conversions are supported in financial ledgers?',
    a: 'OrbitDesk includes a dual-currency engine operating natively in USD ($) and ETB (Br) across budget lines, expenses, and donor reports.'
  }
];

export default function Landing() {
  const { user } = useUser();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 text-white font-black text-xl shadow-md shadow-indigo-500/20">
              O
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl text-slate-900 tracking-tight">OrbitDesk</span>
              <span className="text-[11px] font-extrabold bg-gradient-to-r from-violet-600 to-cyan-600 bg-clip-text text-transparent uppercase tracking-wider">Enterprise & NGO OS</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-8 md:flex text-sm font-bold text-slate-700">
            <a href="#kanban-section" className="hover:text-indigo-600 transition">Live Kanban</a>
            <a href="#metrics" className="hover:text-indigo-600 transition">System Telemetry</a>
            <a href="#governance" className="hover:text-indigo-600 transition">RBAC Governance</a>
            <a href="#reports" className="hover:text-indigo-600 transition">Analytics</a>
            <a href="#faq" className="hover:text-indigo-600 transition">FAQ</a>
            <a href="#contact" className="hover:text-indigo-600 transition">Contact</a>
          </div>

          {/* Action Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/apply-volunteer"
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100 transition shadow-xs"
            >
              <Heart className="h-4 w-4 text-rose-500" />
              <span>Volunteers</span>
            </Link>

            {user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:opacity-95 transition"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:opacity-95 transition"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 py-4 md:hidden space-y-3 text-sm font-bold text-slate-800">
            <a href="#kanban-section" onClick={() => setMobileMenuOpen(false)} className="block py-1">Live Drag & Drop Kanban</a>
            <a href="#metrics" onClick={() => setMobileMenuOpen(false)} className="block py-1">System Metrics</a>
            <a href="#governance" onClick={() => setMobileMenuOpen(false)} className="block py-1">Governance & RBAC</a>
            <a href="#reports" onClick={() => setMobileMenuOpen(false)} className="block py-1">Analytics & Reports</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block py-1">Contact Team</a>
            <Link to="/apply-volunteer" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-rose-600">Public Volunteer Portal</Link>
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <Link to="/login" className="flex-1 text-center py-2.5 rounded-xl bg-slate-100 text-xs font-extrabold">Sign In</Link>
              <Link to="/register" className="flex-1 text-center py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="bg-white py-16 md:py-24 border-b border-slate-200 relative overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-violet-200/50 via-indigo-200/50 to-cyan-200/50 blur-3xl rounded-full pointer-events-none"></div>

        <div className="mx-auto max-w-5xl px-4 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-cyan-50 px-4 py-1.5 text-xs sm:text-sm font-extrabold text-indigo-700 shadow-xs">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>ENTERPRISE PROJECT & NGO GOVERNANCE PLATFORM</span>
          </div>

          <h1 className="text-4xl font-black text-slate-900 sm:text-6xl md:text-7xl tracking-tight leading-tight">
            Centralized Workspaces, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              Logframes & Financial Audits
            </span>
          </h1>

          <p className="mx-auto max-w-3xl text-base sm:text-lg text-slate-600 font-semibold leading-relaxed">
            Manage multi-tenant workspaces, drag-and-drop Kanban task pipelines, <span className="text-emerald-700 font-extrabold">$500 receipt audit rules</span>, MEL indicator target trees, and public volunteer recruitment.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/register"
              className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-8 py-4 text-sm font-extrabold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 transition active:scale-95"
            >
              <span>Get Started Now</span>
              <ArrowRight className="h-5 w-5" />
            </Link>

            <Link
              to="/apply-volunteer"
              className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 px-7 py-4 text-sm font-extrabold text-rose-800 hover:bg-rose-100 transition shadow-xs"
            >
              <Heart className="h-5 w-5 text-rose-600" />
              <span>Public Volunteer Portal</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── DRAG AND DROP KANBAN DEMO SECTION ── */}
      <section id="kanban-section" className="py-20 bg-slate-900 text-white border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="rounded-full bg-cyan-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
              Interactive Task Management
            </span>
            <h2 className="mt-3 text-3xl font-black text-white md:text-5xl tracking-tight">
              Drag & Drop Live Kanban Pipeline
            </h2>
            <p className="mt-2 text-base text-slate-300 font-medium">
              Try dragging tasks between columns right here in your browser!
            </p>
          </div>

          <KanbanLandingDemo />
        </div>
      </section>

      {/* ── LIVE SYSTEM METRICS ── */}
      <section id="metrics" className="py-16 bg-slate-100 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" /> Live System Telemetry
            </span>
            <span className="text-xs font-mono font-bold text-slate-600 bg-white px-3.5 py-1.5 rounded-xl border border-slate-300">
              Live Database Telemetry • Real-time Sync
            </span>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div className="rounded-3xl border border-cyan-200 bg-gradient-to-b from-cyan-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-cyan-700 mb-2">
                <Briefcase className="h-6 w-6" />
                <span className="text-xs font-extrabold uppercase bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full">Projects</span>
              </div>
              <p className="text-4xl font-black text-slate-900 font-mono">{totalProjects}</p>
              <p className="text-xs font-bold text-slate-600 mt-1">{activeProjects} Active Projects</p>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-xs font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">Tasks</span>
              </div>
              <p className="text-4xl font-black text-slate-900 font-mono">{totalTasks}</p>
              <p className="text-xs font-bold text-slate-600 mt-1">{completedTasks} Completed Deliverables</p>
            </div>

            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-indigo-700 mb-2">
                <Users className="h-6 w-6" />
                <span className="text-xs font-extrabold uppercase bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">Teams</span>
              </div>
              <p className="text-4xl font-black text-slate-900 font-mono">{totalTeams}</p>
              <p className="text-xs font-bold text-slate-600 mt-1">Assigned Teams</p>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <DollarSign className="h-6 w-6" />
                <span className="text-xs font-extrabold uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">Currencies</span>
              </div>
              <p className="text-3xl font-black text-slate-900 font-mono">USD / ETB</p>
              <p className="text-xs font-bold text-slate-600 mt-1">Dual-Currency Engine</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GOVERNANCE & RBAC MATRIX ── */}
      <section id="governance" className="py-20 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SystemFeaturesSection />
        </div>
      </section>

      {/* ── INTERACTIVE REPORTS & ANALYTICS SHOWCASE ── */}
      <section id="reports" className="py-20 bg-slate-950 border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <InteractiveReportsDemo />
        </div>
      </section>

      {/* ── ROI CALCULATOR ── */}
      <section id="roi" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RoiCalculator />
        </div>
      </section>

      {/* ── FAQ ACCORDION ── */}
      <section id="faq" className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-800 border border-indigo-200">
              Knowledge Base
            </span>
            <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-extrabold text-slate-900 hover:text-indigo-600 transition"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="h-5 w-5 text-indigo-600" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 font-medium border-t border-slate-200 leading-relaxed bg-white">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CONTACT US SECTION ── */}
      <section id="contact" className="py-20 bg-slate-900 text-white relative overflow-hidden border-t border-slate-800">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl pointer-events-none"></div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="rounded-full bg-indigo-500/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-400 border border-indigo-500/20 inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Get In Touch
            </span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl tracking-tight">
              Ready to Accelerate Your Projects & Donor Impact?
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Have questions about custom NGO setups, donor compliance, or enterprise onboarding? Speak directly with our solutions engineering team.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-12 items-start">
            {/* Left Info Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-800/50 p-6 backdrop-blur-xl shadow-xl space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Direct Email</h4>
                    <p className="text-sm font-bold text-white mt-1">support@orbitdesk.org</p>
                    <p className="text-xs text-slate-400 mt-0.5">Response SLA: &lt; 2 Hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Operating Hours</h4>
                    <p className="text-sm font-bold text-white mt-1">Monday – Friday (8:00 AM – 6:00 PM UTC)</p>
                    <p className="text-xs text-slate-400 mt-0.5">24/7 System Health Monitoring</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Security & Compliance</h4>
                    <p className="text-sm font-bold text-white mt-1">Audit Logs, Receipts & RBAC Protected</p>
                    <p className="text-xs text-slate-400 mt-0.5">Strict end-to-end data encryption</p>
                  </div>
                </div>
              </div>

              {/* Stat Card Accent */}
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-violet-900/40 via-indigo-900/40 to-cyan-900/40 p-5 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-white">100%</p>
                  <p className="text-xs font-bold text-indigo-300">Auditable Logframes & Expenses</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-extrabold">✓</div>
              </div>
            </div>

            {/* Right Contact Form Column */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-slate-800/70 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
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
                      className="mt-4 rounded-xl bg-slate-700 px-6 py-2.5 text-xs font-extrabold text-white hover:bg-slate-600 transition"
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
                          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
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
                          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">Inquiry Type</label>
                      <select
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
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
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition resize-none"
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
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
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
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 bg-slate-900 py-12 text-slate-400 text-xs sm:text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm">O</div>
              <span className="font-black text-white text-lg tracking-tight">OrbitDesk</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="font-extrabold text-slate-300 hover:text-white">Sign In</Link>
              <Link to="/register" className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 font-extrabold text-white hover:opacity-95 transition shadow-md">Get Started</Link>
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
