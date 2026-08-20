import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn';
import { parseApiResponse } from '../utils/toastHelper';

export default function Login() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const resetEmail = searchParams.get('email');
  
  const [view, setView] = useState((resetToken && resetEmail) ? 'resetPassword' : 'login');

  const [email, setEmail] = useState(resetEmail || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (view === 'login') {
      const errorParam = searchParams.get('error');
      const msgParam = searchParams.get('message');
      if (errorParam === 'user_not_found') {
        setMessage('User not found.');
        setStatus('error');
      } else if (errorParam === 'email_confirm_failed') {
        setMessage('Failed to confirm email.');
        setStatus('error');
      } else if (msgParam === 'email_confirmed') {
        setMessage('Email confirmed successfully! You can now log in.');
        setStatus('success');
      }
    }
  }, [searchParams, view]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('loading');
    setShowResend(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const text = await parseApiResponse(res);
        setMessage(text || 'Login failed');
        setStatus('error');
        if (text === 'Email not confirmed') {
          setShowResend(true);
        }
        return;
      }

      const data = await res.json();
      const token = data.token;
      if (token) {
        localStorage.setItem('token', token);
        setMessage('Login successful. Redirecting...');
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 750);
      } else {
        setMessage('No token returned');
        setStatus('error');
      }
    } catch (err) {
      setMessage('Network error: ' + err.message);
      setStatus('error');
    }
  };

  const handleResend = async () => {
    setMessage('');
    setStatus('loading');
    setShowResend(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const text = await parseApiResponse(res);
        setMessage(text || 'Failed to resend confirmation email');
        setStatus('error');
        setShowResend(true);
        return;
      }

      setMessage('Confirmation email resent. Please check your inbox.');
      setStatus('success');
    } catch (err) {
      setMessage('Network error: ' + err.message);
      setStatus('error');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('loading');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const text = await parseApiResponse(res);
        setMessage(text || 'Failed to process request');
        setStatus('error');
        return;
      }

      setMessage('Password reset link sent to your email.');
      setStatus('success');
    } catch (err) {
      setMessage('Network error: ' + err.message);
      setStatus('error');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      setStatus('error');
      return;
    }
    setMessage('');
    setStatus('loading');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, newPassword })
      });

      if (!res.ok) {
        const text = await parseApiResponse(res);
        try {
          const errors = JSON.parse(text);
          if (Array.isArray(errors)) {
            setMessage(errors.join(', '));
          } else {
            setMessage(text || 'Failed to reset password.');
          }
        } catch {
          setMessage(text || 'Failed to reset password.');
        }
        setStatus('error');
        return;
      }

      setMessage('Password has been successfully reset! Redirecting to login...');
      setStatus('success');
      setTimeout(() => {
        setView('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMessage('');
      }, 2000);
    } catch (err) {
      setMessage('Network error: ' + err.message);
      setStatus('error');
    }
  };

  const clearFormMessages = () => {
    setMessage('');
    setStatus('');
    setShowResend(false);
  };

  return (
    <main className="min-h-screen px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8 bg-slate-50">
      <section className="flex min-h-screen w-full overflow-hidden">
        <div className="hidden w-1/2 flex-col justify-center bg-transparent px-10 py-12 lg:flex">
          <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white px-10 py-12 shadow-sm">
            <div className="absolute left-8 top-10 h-24 w-24 rounded-full bg-violet-500/20 blur-3xl animate-float-1" />
            <div className="absolute right-10 top-16 h-28 w-28 rounded-full bg-indigo-500/20 blur-3xl animate-float-2" />
            <div className="absolute left-6 top-1/2 h-20 w-20 rounded-full bg-cyan-500/20 blur-3xl animate-float-3" />
            <div className="absolute right-16 bottom-16 h-16 w-16 rounded-full bg-purple-500/20 blur-3xl animate-float-4" />

            <div className="relative mx-auto flex h-72 w-72 items-center justify-center">
              {/* Outer Orbit Circle */}
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/60 brand-orbit-ring orbit-slow shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                <span className="brand-orbit-dot brand-orbit-dot-outer bg-violet-500 text-violet-400" />
              </div>

              {/* Middle Orbit Circle */}
              <div className="absolute inset-[36px] rounded-full border-2 border-indigo-500/70 brand-orbit-ring orbit-medium shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                <span className="brand-orbit-dot brand-orbit-dot-middle bg-indigo-500 text-indigo-400" />
              </div>

              {/* Inner Orbit Circle */}
              <div className="absolute inset-[72px] rounded-full border-2 border-cyan-400/80 brand-orbit-ring orbit-fast shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <span className="brand-orbit-dot brand-orbit-dot-inner bg-cyan-400 text-cyan-300" />
              </div>

              {/* Center Orbit Logo */}
              <div className="relative z-10 flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 shadow-[0_12px_40px_rgba(99,102,241,0.4)]">
                <div className="relative flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white/10 backdrop-blur-xs">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span className="absolute h-8 w-8 rounded-full border border-white/30" />
                </div>
              </div>
            </div>

            <h2 className="mt-10 text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">OrbitDesk</h2>
            <p className="mt-4 max-w-xs text-center text-sm leading-6 text-slate-500 font-medium">
              Project management that moves at the speed of your team.
            </p>

            <div className="mt-10 grid gap-3">
              <div className="rounded-full border border-violet-200 bg-white/80 px-4 py-3 shadow-xs">
                <p className="text-sm font-semibold text-slate-800">⚡ Real-time collaboration</p>
              </div>
              <div className="rounded-full border border-indigo-200 bg-white/80 px-4 py-3 shadow-xs">
                <p className="text-sm font-semibold text-slate-800">📊 Visual project tracking</p>
              </div>
              <div className="rounded-full border border-cyan-200 bg-white/80 px-4 py-3 shadow-xs">
                <p className="text-sm font-semibold text-slate-800">🔒 Enterprise-grade security</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="absolute -right-16 top-6 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -left-16 bottom-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col justify-center">
            <div className="animate-fade-up rounded-[1.25rem] border border-slate-200 bg-white px-6 py-7 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:px-8 sm:py-10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-indigo-600">Sign in</p>
                  <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
                </div>
                <div className="inline-flex overflow-hidden rounded-full bg-slate-100 p-1 text-sm border border-slate-200">
                  <Link
                    to="/login"
                    className="rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-5 py-2 text-white font-bold shadow-xs"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-full px-5 py-2 text-slate-600 transition hover:bg-slate-50 font-medium"
                  >
                    Create Account
                  </Link>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-500 font-medium">
                Use your email or a social account to access your workspace.
              </p>

              {view === 'login' && (
                <>
                  <div className="mt-6 grid gap-3">
                    <GoogleSignIn
                      buttonText="Continue with Google"
                      buttonClassName="w-full"
                    />
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                    <div className="relative mx-auto w-fit bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.35em] font-jetbrains text-slate-400">
                      or continue with email
                    </div>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700">Email address</label>
                      <div className="relative">
                        <span className="input-icon"></span>
                        <input
                          type="email"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                          placeholder=""
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700">Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            clearFormMessages();
                            setView('forgotPassword');
                          }}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <span className="input-icon"></span>
                        <input
                          type="password"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                          placeholder=""
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-indigo-500/25 transition duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none"
                    >
                      {status === 'loading' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processing...
                        </span>
                      ) : (
                        'Sign In to OrbitDesk →'
                      )}
                    </button>
                  </form>

                  <div className="mt-4 h-1.5 grid grid-cols-4 overflow-hidden rounded-full">
                    <span className="block bg-violet-600" />
                    <span className="block bg-indigo-600" />
                    <span className="block bg-cyan-500" />
                    <span className="block bg-indigo-500" />
                  </div>

                  <p className="mt-6 text-sm text-slate-500">
                    New to OrbitDesk?{' '}
                    <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-800">
                      Create an account
                    </Link>
                  </p>

                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-slate-600 flex items-center justify-between gap-2">
                    <span>🤝 <strong>Want to volunteer?</strong> Apply with an NGO</span>
                    <Link to="/apply-volunteer" className="shrink-0 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition">
                      Apply Here &rarr;
                    </Link>
                  </div>
                </>
              )}

              {view === 'forgotPassword' && (
                <>
                  <div className="grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
                      <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-600">Account recovery</p>
                      <h2 className="mt-3 text-2xl font-semibold text-slate-900">Reset password</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        We will email you a secure link to get back into your account.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleForgotSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700">Email address</label>
                      <div className="relative">
                        <span className="input-icon"></span>
                        <input
                          type="email"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                          placeholder="alex@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5"
                    >
                      {status === 'loading' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Sending...
                        </span>
                      ) : (
                        'Send reset link'
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-sm text-slate-500">
                    <button
                      type="button"
                      onClick={() => {
                        clearFormMessages();
                        setView('login');
                      }}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none"
                    >
                      Back to sign in
                    </button>
                  </p>
                </>
              )}

              {view === 'resetPassword' && (
                <>
                  <div className="grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
                      <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-600">Account recovery</p>
                      <h2 className="mt-3 text-2xl font-semibold text-slate-900">Create a new password</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        For <span className="font-medium text-slate-900">{email || 'your account'}</span>
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleResetSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700">New password</label>
                      <div className="relative">
                        <span className="input-icon"></span>
                        <input
                          type="password"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                          placeholder=""
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-700">Confirm password</label>
                      <div className="relative">
                        <span className="input-icon"></span>
                        <input
                          type="password"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                          placeholder=""
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Resetting...
                        </span>
                      ) : (
                        'Reset password'
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-sm text-slate-500">
                    <button
                      type="button"
                      onClick={() => {
                        clearFormMessages();
                        setView('login');
                        navigate('/login');
                      }}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none"
                    >
                      Back to sign in
                    </button>
                  </p>
                </>
              )}

              {message && (
                <div className={`rounded-3xl border px-4 py-3 text-sm font-medium ${status === 'success' ? 'border-emerald-500/20 bg-emerald-50 text-emerald-800' : 'border-rose-500/20 bg-rose-50 text-rose-800'}`}>
                  {message}
                  {showResend && (
                    <button
                      onClick={handleResend}
                      className="ml-3 font-bold text-rose-700 hover:underline focus:outline-none"
                    >
                      Resend email
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
