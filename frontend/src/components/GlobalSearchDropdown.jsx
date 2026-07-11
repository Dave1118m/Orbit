import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://localhost:7065/api/v1/search';

const TYPE_ICONS = {
  Project: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Task: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  Donor: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Expense: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

const TYPE_COLORS = {
  Project: 'bg-violet-100 text-violet-600',
  Task: 'bg-blue-100 text-blue-600',
  Donor: 'bg-emerald-100 text-emerald-600',
  Expense: 'bg-orange-100 text-orange-600',
};

const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700',
  Planning: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-slate-100 text-slate-600',
  InProgress: 'bg-blue-100 text-blue-700',
  Done: 'bg-green-100 text-green-700',
  Blocked: 'bg-red-100 text-red-700',
  Approved: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  ToDo: 'bg-slate-100 text-slate-600',
  InReview: 'bg-purple-100 text-purple-700',
};

const TYPE_FILTERS = ['All', 'Project', 'Task', 'Donor', 'Expense'];

export default function GlobalSearchDropdown({ query, isOpen, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('All');
  const [savedSearches, setSavedSearches] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  // Fetch saved searches once on open
  useEffect(() => {
    if (isOpen) fetchSavedSearches();
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeType]);

  const doSearch = async (q) => {
    try {
      const token = localStorage.getItem('token');
      const typeParam = activeType !== 'All' ? `&type=${activeType.toLowerCase()}` : '';
      const resp = await fetch(`${API_URL}?q=${encodeURIComponent(q)}${typeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedSearches = async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setSavedSearches(await resp.json());
    } catch (err) { console.error(err); }
  };

  const handleSaveSearch = async () => {
    if (!saveLabel.trim() || !query) return;
    try {
      const token = localStorage.getItem('token');
      const queryJson = JSON.stringify({ q: query, type: activeType !== 'All' ? activeType.toLowerCase() : null });
      await fetch(`${API_URL}/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: saveLabel, queryJson }),
      });
      setSaveLabel('');
      setIsSaving(false);
      fetchSavedSearches();
    } catch (err) { console.error(err); }
  };

  const handleDeleteSaved = async (id, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/saved/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleResultClick = (result) => {
    navigate(result.url);
    onClose();
  };

  const handleSavedSearchClick = (saved) => {
    try {
      const params = JSON.parse(saved.queryJson);
      if (params.type) setActiveType(params.type.charAt(0).toUpperCase() + params.type.slice(1));
      // Trigger search will be handled by parent through onSavedSearchSelect
    } catch { /* ignore */ }
  };

  if (!isOpen) return null;

  const isEmpty = !loading && results.length === 0 && query && query.length >= 2;
  const showSaved = (!query || query.length < 2) && savedSearches.length > 0;

  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[520px] -translate-x-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {/* Type filter pills */}
      <div className="flex gap-1.5 border-b border-slate-100 px-4 py-3">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeType === t
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Searching…
          </div>
        )}

        {isEmpty && (
          <div className="py-10 text-center text-sm text-slate-500">
            <svg className="mx-auto mb-2 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            No results for "<span className="font-medium text-slate-700">{query}</span>"
          </div>
        )}

        {!loading && results.length > 0 && (
          <ul className="divide-y divide-slate-50 py-1">
            {results.map((r, idx) => (
              <li key={`${r.type}-${r.id}-${idx}`}>
                <button
                  onClick={() => handleResultClick(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition group"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TYPE_COLORS[r.type] || 'bg-slate-100 text-slate-500'}`}>
                    {TYPE_ICONS[r.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand-600 transition">{r.title}</p>
                    <p className="truncate text-xs text-slate-500">{r.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{r.type}</span>
                    {r.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {r.status}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Saved Searches (shown when no query) */}
        {showSaved && (
          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Saved Searches</p>
            <ul className="space-y-1">
              {savedSearches.map((s) => (
                <li key={s.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleSavedSearchClick(s)}
                    className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">{s.name}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSaved(s.id, e)}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No query hint */}
        {(!query || query.length < 2) && savedSearches.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-400">
            Type at least 2 characters to search…
          </div>
        )}
      </div>

      {/* Footer: save search */}
      {query && query.length >= 2 && results.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          {isSaving ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSearch(); if (e.key === 'Escape') setIsSaving(false); }}
                placeholder="Name this search…"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button onClick={handleSaveSearch} className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition">Save</button>
              <button onClick={() => setIsSaving(false)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save this search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
