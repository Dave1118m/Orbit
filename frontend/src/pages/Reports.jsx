import React, { useState } from 'react';
import TaskTeamAnalytics from '../components/reports/TaskTeamAnalytics';
import FinancialDashboard from '../components/reports/FinancialDashboard';
import FinancialReports from '../components/reports/FinancialReports';
import ExportCapabilities from '../components/reports/ExportCapabilities';
import ScheduledReports from '../components/reports/ScheduledReports';
import {
  BarChart3, DollarSign, Download, Clock, Filter, FileText
} from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('operational');
  const [finSubTab, setFinSubTab] = useState('dashboard');
  const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('orbit_selected_currency') || 'USD');

  const handleCurrencyChange = (curr) => {
    setSelectedCurrency(curr);
    localStorage.setItem('orbit_selected_currency', curr);
  };

  const tabs = [
    {
      id: 'operational',
      label: 'Report Analysis & Team Performance',
      icon: BarChart3,
    },
    {
      id: 'financial',
      label: 'NGO Financial Reports & Analytics',
      icon: DollarSign,
    },
    {
      id: 'export',
      label: 'Export Capabilities Hub',
      icon: Download,
    },
    {
      id: 'scheduled',
      label: 'Scheduled Reports',
      icon: Clock,
    },
  ];

  return (
    <div className="min-h-full bg-slate-50 flex flex-col font-sans pb-12">
      {/* Sleek Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-6 shadow-xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BarChart3 className="w-64 h-64 text-indigo-300 animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto space-y-5 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Reports & Institutional Analytics
              </h1>
            </div>

            {/* Quick Actions & Currency Selector */}
            <div className="flex items-center gap-3 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-indigo-200 font-bold px-2">
                <Filter className="w-3.5 h-3.5" />
                <span>Base:</span>
              </div>
              <select
                value={selectedCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="USD">USD ($)</option>
                <option value="ETB">ETB (Br)</option>
              </select>

              <button
                onClick={() => setActiveTab('export')}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/30 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Quick Export</span>
              </button>
            </div>
          </div>

          {/* Clean 4-Column Navigation Tabs - All 4 visible without scrolling */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-white/10">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 text-center ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xl shadow-indigo-950/50 scale-[1.01]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Animated Content Container */}
      <div className="max-w-7xl mx-auto px-6 pt-8 w-full flex-1">
        <div className="transition-all duration-300">
          {activeTab === 'operational' && <TaskTeamAnalytics />}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs w-fit">
                <button
                  onClick={() => setFinSubTab('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
                    finSubTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Financial Analytics & Dashboard
                </button>
                <button
                  onClick={() => setFinSubTab('statements')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
                    finSubTab === 'statements'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Statement of Activities & Grant Audit
                </button>
              </div>

              {finSubTab === 'dashboard' ? (
                <FinancialDashboard selectedCurrency={selectedCurrency} />
              ) : (
                <FinancialReports selectedCurrency={selectedCurrency} />
              )}
            </div>
          )}
          {activeTab === 'export' && <ExportCapabilities selectedCurrency={selectedCurrency} />}
          {activeTab === 'scheduled' && <ScheduledReports />}
        </div>
      </div>
    </div>
  );
}
