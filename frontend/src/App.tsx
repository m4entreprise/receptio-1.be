import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Calls from './pages/Calls';
import CallDetail from './pages/CallDetail';
import CallQAReport from './pages/CallQAReport';
import MonitoringBbis from './pages/MonitoringBbis';
import SettingsAgentIA from './pages/SettingsAgentIA';
import SettingsOfferB from './pages/SettingsOfferB';
import Staff from './pages/Staff';
import OutboundCall from './pages/OutboundCall';
import Analytics from './pages/Analytics';
import SettingsQA from './pages/SettingsQA';
import SettingsIntents from './pages/SettingsIntents';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  const routerFuture = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  };

  return (
    <AuthProvider>
      <Router future={routerFuture}>
        <Routes>
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
          <Route path="/settings" element={<PrivateRoute><SettingsOfferB /></PrivateRoute>} />
          <Route path="/outbound" element={<PrivateRoute><OutboundCall /></PrivateRoute>} />
          <Route path="/outbound/:id" element={<PrivateRoute><OutboundCall /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/settings/qa" element={<PrivateRoute><SettingsQA /></PrivateRoute>} />
          <Route path="/settings/intents" element={<PrivateRoute><SettingsIntents /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
