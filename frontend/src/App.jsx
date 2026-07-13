import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Teams from './pages/Teams';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import DashboardLayout from './components/DashboardLayout';

function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('https://localhost:7065/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend unavailable');
        }
        return response.json();
      })
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">OrbitDesk MVP</p>
        <h1>Project management for NGOs</h1>
        <p>
          This starter app connects the React frontend to an ASP.NET Core API and is ready for the next implementation phase.
        </p>

        <div className="cta-buttons">
          <Link className="button" to="/register">Register</Link>
          <Link className="button button-secondary" to="/login">Login</Link>
        </div>

        {health ? (
          <div className="status-box">
            <strong>Status:</strong> {health.status}
            <br />
            <strong>App:</strong> {health.app}
          </div>
        ) : (
          <div className="status-box">
            {error ? `Connection error: ${error}` : 'Loading API health check...'}
          </div>
        )}
      </section>
    </main>
  );
}

function AuthLayout({ children }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </main>
  );
}

function RequireAuth({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const queryToken = queryParams.get('token');

  // If a token arrives in the URL (e.g. from Google OAuth redirect), persist it
  // and immediately strip it from the URL so it's never leaked in browser history.
  if (queryToken) {
    localStorage.setItem('token', queryToken);
    queryParams.delete('token');
    const cleanSearch = queryParams.toString();
    const cleanPath = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    return <Navigate to={cleanPath} replace />;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function Content() {
  const location = useLocation();
  const showNav = location.pathname === '/';

  return (
    <>
      {showNav && (
        <nav className="topbar bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-slate-100">
            <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              <span>OrbitDesk</span>
            </div>
            <div className="flex items-center gap-3">
              <Link className="rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm hover:border-slate-400 hover:text-white" to="/">Home</Link>
              <Link className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400" to="/register">Register</Link>
              <Link className="rounded-full border border-slate-600 px-4 py-2 text-sm hover:border-slate-400" to="/login">Login</Link>
            </div>
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout><Dashboard /></DashboardLayout></RequireAuth>} />
        <Route path="/organizations" element={<RequireAuth><DashboardLayout><Organizations /></DashboardLayout></RequireAuth>} />
        <Route path="/projects" element={<RequireAuth><DashboardLayout><Projects /></DashboardLayout></RequireAuth>} />
        <Route path="/tasks" element={<RequireAuth><DashboardLayout><Tasks /></DashboardLayout></RequireAuth>} />
        <Route path="/teams" element={<RequireAuth><DashboardLayout><Teams /></DashboardLayout></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><DashboardLayout><Notifications /></DashboardLayout></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><DashboardLayout><Reports /></DashboardLayout></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><DashboardLayout><Settings /></DashboardLayout></RequireAuth>} />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <Register />
            </AuthLayout>
          }
        />
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route path="/org-invite/accept" element={<AcceptInvite />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Content />
    </BrowserRouter>
  );
}

export default App;
