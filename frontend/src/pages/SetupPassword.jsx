import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL;

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or expired invitation link. Missing token.');
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid invitation link. Missing token.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/setup-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          password: formData.password,
          fullName: formData.fullName
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setSuccess(true);
        
        setTimeout(() => {
          navigate(data.redirectUrl || '/dashboard');
        }, 2000);
      } else {
        setError(data.message || data || 'Failed to set up password.');
      }
    } catch (err) {
      setError('Network connection error. Please try again.');
      console.error('Password setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl space-y-6">
          <div className="h-20 w-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-4xl border border-emerald-500/30 shadow-inner">
            ✓
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Account Setup Complete!</h2>
            <p className="text-slate-400 text-sm">
              Your credentials have been configured. Launching your OrbitDesk dashboard...
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 animate-pulse rounded-full w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-brand-500 selection:text-white">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex justify-between items-center py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-500/30">
            O
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">OrbitDesk</span>
            <span className="text-xs text-slate-400 block -mt-1">Credential Setup Portal</span>
          </div>
        </div>
        <Link to="/login" className="text-xs font-semibold text-slate-400 hover:text-white transition">
          Back to Login &rarr;
        </Link>
      </header>

      {/* Form Card */}
      <main className="max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <span className="inline-block px-3 py-1 bg-brand-500/20 text-brand-400 rounded-full text-xs font-semibold">
              Invitation Activation
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Set Up Your Account</h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Create your account credentials to join your organization and access project workflows.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Create Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Activating Account...' : 'Complete Setup & Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 pt-2">
            By setting up your account, you agree to OrbitDesk's security policies and terms of service.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-600 py-4">
        &copy; {new Date().getFullYear()} OrbitDesk Project Governance Platform. All rights reserved.
      </footer>
    </div>
  );
}
