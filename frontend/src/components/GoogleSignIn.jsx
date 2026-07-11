import { useEffect, useState } from 'react';

const BACKEND_BASE = 'https://localhost:7065/api/v1/auth';
const BACKEND_REDIRECT_URI = 'https://localhost:7065/api/v1/auth/google-callback';

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
        const resp = await fetch(`${BACKEND_BASE}/google-client-id`);
        if (!resp.ok) {
          throw new Error('Unable to load Google client ID');
        }

        const data = await resp.json();
        if (!data?.clientId) {
          throw new Error('Google client ID was not returned');
        }

        setClientId(data.clientId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Google auth failed';
        setError(message);
        onError?.(message);
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
