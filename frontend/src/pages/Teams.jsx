export default function Teams() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-500 font-semibold">Team</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Team roster</h1>
            <p className="mt-1 text-sm text-slate-500">See roles, capacity, and assignments for your collaborators.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">18</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Members</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-emerald-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">12</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Assignments</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-amber-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">85%</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Capacity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
