export default function Reports() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Reports</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Data insights</h1>
            <p className="mt-1 text-sm text-slate-500">Generate reports for project and financial performance.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-brand-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">12</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Project progress</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-emerald-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">4</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Task trends</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-amber-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">1</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Budget summary</p>
          </div>
        </div>
      </div>
    </div>
  );
}
