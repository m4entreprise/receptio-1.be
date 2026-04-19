import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SuperAuthProvider } from './contexts/SuperAuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Calls from './pages/Calls';
import CallDetail from './pages/CallDetail';
import CallQAReport from './pages/CallQAReport';
import MonitoringBbis from './pages/MonitoringBbis';
import SettingsAgentIA from './pages/SettingsAgentIA';
import SettingsModelsIA from './pages/SettingsModelsIA';
import SettingsOfferB from './pages/SettingsOfferB';
import Staff from './pages/Staff';
import OutboundCall from './pages/OutboundCall';
import Analytics from './pages/Analytics';
import SettingsQA from './pages/SettingsQA';
import SettingsIntents from './pages/SettingsIntents';
import PrivateRoute from './components/PrivateRoute';
import PrivateAdminRoute from './components/admin/PrivateAdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminTenants from './pages/admin/AdminTenants';
import AdminTenantDetail from './pages/admin/AdminTenantDetail';
import AdminBilling from './pages/admin/AdminBilling';
import AdminPricing from './pages/admin/AdminPricing';
import AdminLogs from './pages/admin/AdminLogs';

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
          <Routes>
            {/* ── Tenant routes ── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/calls" element={<PrivateRoute><Calls /></PrivateRoute>} />
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

            {/* ── Super Admin routes ── */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/tenants" element={<PrivateAdminRoute><AdminTenants /></PrivateAdminRoute>} />
            <Route path="/admin/tenants/:id" element={<PrivateAdminRoute><AdminTenantDetail /></PrivateAdminRoute>} />
            <Route path="/admin/billing" element={<PrivateAdminRoute><AdminBilling /></PrivateAdminRoute>} />
            <Route path="/admin/pricing" element={<PrivateAdminRoute><AdminPricing /></PrivateAdminRoute>} />
            <Route path="/admin/logs" element={<PrivateAdminRoute><AdminLogs /></PrivateAdminRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SuperAuthProvider>
    </AuthProvider>
  );
}

export default App;
