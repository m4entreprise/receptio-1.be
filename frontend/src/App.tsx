import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SuperAuthProvider } from './contexts/SuperAuthContext';
import LandingPage from './pages/LandingPage';
import PrivateRoute from './components/PrivateRoute';
import PrivateAdminRoute from './components/admin/PrivateAdminRoute';

// Auth pages — small, loaded eagerly alongside landing
import Login from './pages/Login';
import Register from './pages/Register';
import AcceptInvitation from './pages/AcceptInvitation';

// Dashboard pages — lazy loaded (only when user is authenticated)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CallDetail = lazy(() => import('./pages/CallDetail'));
const CallQAReport = lazy(() => import('./pages/CallQAReport'));
const MonitoringBbis = lazy(() => import('./pages/MonitoringBbis'));
const SettingsAgentIA = lazy(() => import('./pages/SettingsAgentIA'));
const SettingsModelsIA = lazy(() => import('./pages/SettingsModelsIA'));
const SettingsOfferB = lazy(() => import('./pages/SettingsOfferB'));
const Staff = lazy(() => import('./pages/Staff'));
const OutboundCall = lazy(() => import('./pages/OutboundCall'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsQA = lazy(() => import('./pages/SettingsQA'));
const SettingsIntents = lazy(() => import('./pages/SettingsIntents'));
const SettingsTeamAccess = lazy(() => import('./pages/SettingsTeamAccess'));

// Static pages — lazy loaded
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Cookies = lazy(() => import('./pages/Cookies'));
const Blog = lazy(() => import('./pages/Blog'));
const Changelog = lazy(() => import('./pages/Changelog'));
const About = lazy(() => import('./pages/About'));
const Careers = lazy(() => import('./pages/Careers'));

// Admin pages — lazy loaded
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminTenants = lazy(() => import('./pages/admin/AdminTenants'));
const AdminTenantDetail = lazy(() => import('./pages/admin/AdminTenantDetail'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const AdminPricing = lazy(() => import('./pages/admin/AdminPricing'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0B1520] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-[#C7601D]/30 border-t-[#C7601D] animate-spin" />
    </div>
  );
}

function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  const routerFuture = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  };

  return (
    <AuthProvider>
      <SuperAuthProvider>
        <Router future={routerFuture}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public routes ── */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />

              {/* ── Static pages ── */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/about" element={<About />} />
              <Route path="/careers" element={<Careers />} />

              {/* ── Tenant routes (lazy) ── */}
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/calls" element={<Navigate to="/dashboard" replace />} />
              <Route path="/calls/:id" element={<PrivateRoute><CallDetail /></PrivateRoute>} />
              <Route path="/calls/:id/qa" element={<PrivateRoute><CallQAReport /></PrivateRoute>} />
              <Route path="/staff" element={<PrivateRoute><Staff /></PrivateRoute>} />
              <Route path="/monitoring/bbis" element={<PrivateRoute><MonitoringBbis /></PrivateRoute>} />
              <Route path="/settings/agent-ia" element={<PrivateRoute><SettingsAgentIA /></PrivateRoute>} />
              <Route path="/settings/ai-models" element={<PrivateRoute><SettingsModelsIA /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsOfferB /></PrivateRoute>} />
              <Route path="/outbound" element={<PrivateRoute><OutboundCall /></PrivateRoute>} />
              <Route path="/outbound/:id" element={<PrivateRoute><OutboundCall /></PrivateRoute>} />
              <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
              <Route path="/settings/qa" element={<PrivateRoute><SettingsQA /></PrivateRoute>} />
              <Route path="/settings/intents" element={<PrivateRoute><SettingsIntents /></PrivateRoute>} />
              <Route path="/settings/team-access" element={<PrivateRoute><SettingsTeamAccess /></PrivateRoute>} />

              {/* ── Super Admin routes (lazy) ── */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/tenants" element={<PrivateAdminRoute><AdminTenants /></PrivateAdminRoute>} />
              <Route path="/admin/tenants/:id" element={<PrivateAdminRoute><AdminTenantDetail /></PrivateAdminRoute>} />
              <Route path="/admin/billing" element={<PrivateAdminRoute><AdminBilling /></PrivateAdminRoute>} />
              <Route path="/admin/pricing" element={<PrivateAdminRoute><AdminPricing /></PrivateAdminRoute>} />
              <Route path="/admin/logs" element={<PrivateAdminRoute><AdminLogs /></PrivateAdminRoute>} />
              <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </SuperAuthProvider>
    </AuthProvider>
  );
}

export default App;
