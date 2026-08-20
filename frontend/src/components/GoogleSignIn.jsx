import { useEffect, useState } from 'react';

const BACKEND_BASE = `${import.meta.env.VITE_API_URL}/auth`;
const BACKEND_REDIRECT_URI = `${import.meta.env.VITE_API_URL}/auth/google-callback`;

// Allow an explicit client id via Vite env for environments where backend fetch may fail
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function buildGoogleAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',

    access_type: 'online',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default function GoogleSignIn({ buttonText = 'Continue with Google', buttonClassName = '' }) {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    async function init() {
      try {
        if (ENV_CLIENT_ID) {
          setClientId(ENV_CLIENT_ID);
        } else {
          // Try fetching from backend — silently give up if unavailable or unconfigured
          try {
            const resp = await fetch(`${BACKEND_BASE}/google-client-id`, { cache: 'no-store' });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.clientId) {
                setClientId(data.clientId);
              }
            }
            // If not ok (e.g. 404 = not configured), we simply don't set clientId
          } catch {
            // Backend unreachable or not configured — silently skip Google Sign-In
          }
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // If no client ID available, button will still render but clicking it will show an error.
  if (loading) return null;

  const handleRedirect = () => {
    if (!clientId) {
      return;
    }
    window.location.href = buildGoogleAuthUrl(clientId, BACKEND_REDIRECT_URI);
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      onClick={handleRedirect}
      disabled={loading || !clientId}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {loading ? 'Loading...' : buttonText}
    </button>
  );
}
