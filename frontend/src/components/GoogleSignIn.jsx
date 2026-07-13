import { useEffect, useState } from 'react';

const BACKEND_BASE = 'https://localhost:7065/api/v1/auth';
const BACKEND_REDIRECT_URI = 'https://localhost:7065/api/v1/auth/google-callback';

// Allow an explicit client id via Vite env for environments where backend fetch may fail
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function buildGoogleAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default function GoogleSignIn({ onError, buttonText = 'Continue with Google' }) {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        if (ENV_CLIENT_ID) {
          setClientId(ENV_CLIENT_ID);
        } else {
          // try fetching from backend with a couple retries
          let lastErr = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const resp = await fetch(`${BACKEND_BASE}/google-client-id`, { cache: 'no-store' });
              if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Status ${resp.status}: ${txt}`);
              }
              const data = await resp.json();
              if (!data?.clientId) throw new Error('Google client ID was not returned');
              setClientId(data.clientId);
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err instanceof Error ? err.message : String(err);
              console.warn('google-client-id fetch attempt', attempt, lastErr);
              await new Promise(r => setTimeout(r, 300));
            }
          }
          if (lastErr) throw new Error(lastErr);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Google auth failed';
        setError(message);
        onError?.(message);
        console.error('GoogleSignIn init error:', message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [onError]);

  const handleRedirect = (redirectUri) => {
    if (!clientId) return;
    window.location.href = buildGoogleAuthUrl(clientId, redirectUri);
  };

  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => handleRedirect(BACKEND_REDIRECT_URI)}
        disabled={loading || !!error}
      >
        {loading ? 'Loading Google...' : buttonText}
      </button>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
