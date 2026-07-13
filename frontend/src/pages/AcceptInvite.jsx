import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Accepting your invitation...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link. No token found.');
      return;
    }

    const accept = async () => {
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) {
          // If not logged in, they need to log in first, then we can accept the token.
          // For now, redirect to login with a returnUrl or just show message.
          setStatus('error');
          setMessage('You must be logged in to accept an invitation.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        const res = await fetch(`https://localhost:7065/api/v1/organizations/invite/accept?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (res.ok) {
          setStatus('success');
          setMessage('Invitation accepted successfully! Redirecting to dashboard...');
          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          const errText = await res.text();
          setStatus('error');
          setMessage(`Failed to accept invitation: ${errText}`);
        }
      } catch (err) {
        setStatus('error');
        setMessage(`Error: ${err.message}`);
      }
    };

    accept();
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg border border-slate-200">
        <h2 className="mb-4 text-2xl font-bold text-slate-800">Organization Invitation</h2>
        <div className={`mb-4 text-lg ${status === 'error' ? 'text-red-600' : 'text-cyan-600'}`}>
          {message}
        </div>
        {status === 'processing' && (
          <div className="mx-auto mt-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        )}
      </div>
    </div>
  );
}
