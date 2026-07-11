import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_BASE = 'https://localhost:7065/api/v1/auth';

export default function GoogleCallback() {
  const [message, setMessage] = useState('Verifying Google sign-in...');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setMessage(`Google login error: ${error}`);
      return;
    }

    if (!code) {
      setMessage('No authorization code was returned by Google.');
      return;
    }

    async function exchangeCode() {
      try {
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const resp = await fetch(`${BACKEND_BASE}/google-callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || 'Google callback verification failed');
        }

        const data = await resp.json();
        if (!data?.token) {
          throw new Error('No token returned from backend.');
        }

        localStorage.setItem('token', data.token);
        setMessage('Login successful. Redirecting...');
        setTimeout(() => navigate('/'), 800);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Google callback failed';
        setMessage(message);
      }
    }

    exchangeCode();
  }, [navigate]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-10">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold">Google sign-in callback</h1>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </section>
    </main>
  );
}
