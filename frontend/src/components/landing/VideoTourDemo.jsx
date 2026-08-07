import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  ChevronLeft,
  ChevronRight,
  Layers, 
  BarChart3, 
  Kanban, 
  DollarSign, 
  Users, 
  Sparkles,
  CheckCircle,
  Clock,
  Building2,
  Bell,
  Settings as SettingsIcon,
  X
} from 'lucide-react';

const REAL_SCREENSHOT_CHAPTERS = [
  {
    id: 'dashboard',
    title: '1. Executive Dashboard',
    subtitle: 'System-wide overview, active workspaces, and real-time activity stream.',
    src: '/screenshots/dashboard.png',
    badge: 'Executive View',
    icon: BarChart3,
    highlights: ['Multi-organization stats', 'SignalR live updates', 'Active workspace feeds']
  },
  {
    id: 'projects',
    title: '2. Project Workspace Board',
    subtitle: 'Manage project portfolios, status states, and assigned team members.',
    src: '/screenshots/projects.png',
    badge: 'Portfolio Hub',
    icon: Layers,
    highlights: ['Project status tracking', 'Workspace scoping', 'Logframe launcher']
  },
  {
    id: 'tasks',
    title: '3. Kanban Task Pipelines',
    subtitle: 'Interactive task board with priority badges and deadline countdowns.',
    src: '/screenshots/tasks.png',
    badge: 'Real-Time Sync',
    icon: Kanban,
    highlights: ['Drag-and-drop workflow', 'Task assignees', 'Priority tagging']
  },
  {
    id: 'teams',
    title: '4. Team Roster & Roles',
    subtitle: 'Granular role assignments (Owner, Admin, Manager, Coordinator).',
    src: '/screenshots/teams.png',
    badge: 'RBAC Security',
    icon: Users,
    highlights: ['Member role scopes', 'Workspace assignment', 'Security policies']
  },
  {
    id: 'finance',
    title: '5. Finance & Multi-Level Budgets',
    subtitle: 'Bank account transaction ledger, donor funds, and $500 receipt rules.',
    src: '/screenshots/finance.png',
    badge: 'Audit Compliant',
    icon: DollarSign,
    highlights: ['$500 Receipt threshold flag', 'Bank account ledger', 'Donor contribution tracking']
  },
  {
    id: 'reports',
    title: '6. Reports & Analytics',
    subtitle: 'Chart.js metrics for financial execution and Logframe indicator progress.',
    src: '/screenshots/reports.png',
    badge: 'Donor-Ready MEL',
    icon: BarChart3,
    highlights: ['Budget vs Actual charts', 'MEL target trajectories', '1-Click PDF exports']
  },
  {
    id: 'volunteers',
    title: '7. Volunteer Applications',
    subtitle: 'Public recruitment funnel, background check verification, and skill matching.',
    src: '/screenshots/volunteers.png',
    badge: 'Public Portal',
    icon: Users,
    highlights: ['Public application portal', 'Background check statuses', 'Skill matrix']
  },
  {
    id: 'organizations',
    title: '8. Organization Governance',
    subtitle: 'Multi-organization hierarchy, partners, compliance, and ownership transfer.',
    src: '/screenshots/organizations.png',
    badge: 'Governance Hub',
    icon: Building2,
    highlights: ['Multi-org management', 'Partner compliance', 'Ownership transfer']
  }
];

export default function VideoTourDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const currentChapter = REAL_SCREENSHOT_CHAPTERS[activeIdx];

  // Auto-play timer for screenshot video slideshow animation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveIdx((current) => (current + 1) % REAL_SCREENSHOT_CHAPTERS.length);
          return 0;
        }
        return prev + 2.5;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleSelectChapter = (index) => {
    setActiveIdx(index);
    setProgress(0);
    setIsPlaying(true);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % REAL_SCREENSHOT_CHAPTERS.length);
    setProgress(0);
  };

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + REAL_SCREENSHOT_CHAPTERS.length) % REAL_SCREENSHOT_CHAPTERS.length);
    setProgress(0);
  };

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl md:p-8">
      {/* Background Ambient Lighting Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-600/20 blur-3xl"></div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-ping"></span>
            <h3 className="text-xl font-extrabold tracking-tight text-white">Live System Video Showcase</h3>
            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/30">
              Actual System Interface Capture
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real high-definition screenshots of Orbit's actual frontend pages in an animated video slideshow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
            <span>{isMuted ? 'Muted' : 'Audio On'}</span>
          </button>
        </div>
      </div>

      {/* Chapter Thumbnails Strip */}
      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-2">
        {REAL_SCREENSHOT_CHAPTERS.map((ch, idx) => {
          const Icon = ch.icon;
          const isActive = idx === activeIdx;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelectChapter(idx)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-600/30 scale-105 ring-2 ring-cyan-400/50'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{ch.title}</span>
            </button>
          );
        })}
      </div>

      {/* Video Screen Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
          
          {/* Animated Real Page Screenshot Frame with Pan & Zoom */}
          <div className="relative h-full w-full overflow-hidden">
            <img
              key={currentChapter.id}
              src={currentChapter.src}
              alt={currentChapter.title}
              className="h-full w-full object-cover object-top transition-transform duration-1000 ease-out scale-105 hover:scale-100"
            />

            {/* Dark Gradient Overlay for Control Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none"></div>

            {/* Real Page Details Badge Overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
              <div className="flex items-center gap-2 rounded-xl bg-slate-950/85 px-3.5 py-2 text-xs font-bold text-white border border-slate-800 backdrop-blur-md shadow-lg">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{currentChapter.title}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/40 backdrop-blur-md">
                  {currentChapter.badge}
                </span>
                <button
                  onClick={() => setFullscreenImage(currentChapter)}
                  className="pointer-events-auto rounded-xl bg-slate-950/85 p-2 text-slate-300 hover:text-white border border-slate-800 backdrop-blur-md transition hover:scale-105"
                  title="Expand to Fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Left & Right Navigation Arrows */}
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-white border border-slate-800 backdrop-blur-md transition hover:bg-slate-900 hover:scale-110 z-20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-white border border-slate-800 backdrop-blur-md transition hover:bg-slate-900 hover:scale-110 z-20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Central Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="group absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] hover:bg-black/25 transition z-10"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600/90 text-white shadow-2xl group-hover:scale-110 group-hover:bg-cyan-500 transition duration-300 ring-4 ring-cyan-400/40">
                {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
              </div>
            </button>
          </div>

          {/* Bottom Player Progress & Information Scrubber */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-md z-30">
            <div className="relative mb-2.5 h-1.5 w-full cursor-pointer rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400 transition-all duration-150"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-cyan-400">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="flex items-center gap-1 font-mono text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Page {activeIdx + 1} of {REAL_SCREENSHOT_CHAPTERS.length}</span>
                </div>
                <span className="hidden sm:inline-block font-semibold text-slate-200">• {currentChapter.subtitle}</span>
              </div>

              <div className="flex items-center gap-2">
                {currentChapter.highlights.map((hl, i) => (
                  <span key={i} className="hidden md:inline-flex items-center gap-1 text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                    <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
                    <span>{hl}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Screenshot Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-up">
          <div className="relative w-full max-w-6xl rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">{fullscreenImage.title}</span>
                <span className="text-xs text-slate-400">• High-Res Interface Inspection</span>
              </div>
              <button
                onClick={() => setFullscreenImage(null)}
                className="rounded-lg bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[80vh] rounded-xl border border-slate-800">
              <img src={fullscreenImage.src} alt={fullscreenImage.title} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
