import { useState } from 'react';
import { Link } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('loading');
    try {
      const res = await fetch('https://localhost:7065/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }));
        setMessage(err.error || 'Registration failed');
        setStatus('error');
        return;
      }

      setMessage('Registered successfully. Check your email to confirm your account.');
      setStatus('success');
    } catch (err) {
      setMessage('Network error: ' + err.message);
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_45%,#f7f8ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
        <div className="hidden w-[46%] flex-col justify-between bg-slate-950 p-10 text-slate-100 lg:flex">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-medium text-slate-200">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> OrbitDesk
            </div>
            <h1 className="mt-8 text-4xl font-semibold leading-tight">Bring your team together in one beautiful workspace.</h1>
            <p className="mt-4 max-w-md text-base text-slate-400">
              Plan projects, track work, and keep every stakeholder aligned from one shared dashboard.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Why teams love it</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• Simple onboarding for every project</li>
              <li>• Fast collaboration with comments and tasks</li>
              <li>• Clean reporting for leaders and admins</li>
            </ul>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
            <div className="text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-500">Join OrbitDesk</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Create your account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                Start managing projects and keeping your team connected in just a few clicks.
              </p>
            </div>

            <div className="mt-8 grid gap-4">
              <GoogleSignIn
                buttonText="Continue with Google"
                onError={(errorText) => {
                  setStatus('error');
                  setMessage(errorText);
                }}
              />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
              <div className="relative mx-auto w-fit bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                or sign up with email
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Email address</label>
                <input
                  type="email"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              >
                {status === 'loading' ? 'Registering...' : 'Create account'}
              </button>
            </form>

            {message && (
              <div className={`mt-4 rounded-3xl border px-4 py-3 text-sm ${status === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800' : 'border-rose-500/20 bg-rose-500/10 text-rose-800'}`}>
                {message}
              </div>
            )}

            <p className="mt-6 text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
