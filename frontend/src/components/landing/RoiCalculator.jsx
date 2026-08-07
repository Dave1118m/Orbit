import { useState } from 'react';
import { Calculator, Sparkles, TrendingUp, Clock, DollarSign, ArrowRight } from 'lucide-react';

export default function RoiCalculator() {
  const [projectsCount, setProjectsCount] = useState(12);
  const [teamSize, setTeamSize] = useState(45);
  const [annualBudget, setAnnualBudget] = useState(750000);

  // ROI Math calculations
  const hoursSavedPerWeek = Math.round(projectsCount * 2.8 + teamSize * 0.75);
  const annualSavingsDollars = Math.round((hoursSavedPerWeek * 52 * 35) + (annualBudget * 0.045));
  const reportingAcceleration = (2.5 + (projectsCount * 0.15)).toFixed(1);

  return (
    <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 md:p-10 text-white shadow-2xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-400" />
            <h3 className="text-xl font-extrabold text-white">Interactive Impact & ROI Calculator</h3>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Adjust the sliders below to estimate weekly time savings and financial efficiency gains with Orbit.
          </p>
        </div>
        <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
          Live Estimator
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
        {/* Sliders Input Column */}
        <div className="lg:col-span-6 space-y-6">
          {/* Slider 1: Projects */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex justify-between text-sm font-bold">
              <span className="text-slate-300">Active Projects Managed</span>
              <span className="font-mono text-indigo-400">{projectsCount} Projects</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={projectsCount}
              onChange={(e) => setProjectsCount(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>1 Project</span>
              <span>50 Projects</span>
            </div>
          </div>

          {/* Slider 2: Team Size */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex justify-between text-sm font-bold">
              <span className="text-slate-300">Team Members & Volunteers</span>
              <span className="font-mono text-indigo-400">{teamSize} Members</span>
            </div>
            <input
              type="range"
              min="5"
              max="300"
              value={teamSize}
              onChange={(e) => setTeamSize(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>5 Members</span>
              <span>300 Members</span>
            </div>
          </div>

          {/* Slider 3: Operating Budget */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex justify-between text-sm font-bold">
              <span className="text-slate-300">Annual Managed Budget ($)</span>
              <span className="font-mono text-indigo-400">${(annualBudget).toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="50000"
              max="5000000"
              step="50000"
              value={annualBudget}
              onChange={(e) => setAnnualBudget(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>$50,000</span>
              <span>$5,000,000</span>
            </div>
          </div>
        </div>

        {/* Calculated Results Display Column */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/60 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between border-b border-indigo-900/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Estimated Annual ROI</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>

            <div className="space-y-6">
              {/* Metric 1 */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/80 text-white shadow-lg">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white font-mono">{hoursSavedPerWeek} hrs / week</p>
                  <p className="text-xs text-slate-400">Team Admin Time Saved per Week</p>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/80 text-white shadow-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-400 font-mono">${annualSavingsDollars.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Estimated Cost & Audit Leakage Saved / Year</p>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600/80 text-white shadow-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-amber-300 font-mono">{reportingAcceleration}x Faster</p>
                  <p className="text-xs text-slate-400">Logframe & Donor Report Acceleration</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-indigo-900/60 text-center">
              <a
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 active:scale-95 shadow-lg"
              >
                <span>Start Saving Hours Today — Free Trial</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
