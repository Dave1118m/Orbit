import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Register from './pages/Register';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Teams from './pages/Teams';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Finance from './pages/Finance';
import LogframeView from './pages/LogframeView';
import Volunteers from './pages/Volunteers';
import VolunteerPublicApply from './pages/VolunteerPublicApply';
import Landing from './pages/Landing';
import DashboardLayout from './components/DashboardLayout';
import { UserProvider } from './contexts/UserContext';
import { TranslationProvider } from './contexts/TranslationContext';

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-full">
        <div className="mb-6 mx-auto max-w-md flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
            ← Back to Orbit Landing Page
          </Link>
        </div>
        {children}
      </div>
    </div>
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

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout><Dashboard /></DashboardLayout></RequireAuth>} />
        <Route path="/organizations" element={<Navigate to="/settings" replace />} />
        <Route path="/projects" element={<RequireAuth><DashboardLayout><Projects /></DashboardLayout></RequireAuth>} />
        <Route path="/projects/:projectId/logframe" element={<RequireAuth><LogframeView /></RequireAuth>} />
        <Route path="/tasks" element={<RequireAuth><DashboardLayout><Tasks /></DashboardLayout></RequireAuth>} />
        <Route path="/teams" element={<RequireAuth><DashboardLayout><Teams /></DashboardLayout></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><DashboardLayout><Notifications /></DashboardLayout></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><DashboardLayout><Reports /></DashboardLayout></RequireAuth>} />
        <Route path="/finance" element={<RequireAuth><DashboardLayout><Finance /></DashboardLayout></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><DashboardLayout><Settings /></DashboardLayout></RequireAuth>} />
        <Route path="/volunteers" element={<RequireAuth><DashboardLayout><Volunteers /></DashboardLayout></RequireAuth>} />
        <Route path="/apply-volunteer" element={<VolunteerPublicApply />} />
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
        <Route path="/setup-password" element={<SetupPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <TranslationProvider>
      <UserProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Toaster />
          <Content />
        </BrowserRouter>
      </UserProvider>
    </TranslationProvider>
  );
}

export default App;
