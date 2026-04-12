import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Phone, LayoutDashboard, Settings, LogOut, Gauge, Users, PhoneOutgoing, BarChart2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userLabel = user?.email ?? 'Compte connecté';
  const [unacknowledgedAlertCount, setUnacknowledgedAlertCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      try {
        const { data } = await axios.get('/api/qa/alerts?acknowledged=false', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!active) return;
        setUnacknowledgedAlertCount(Number(data.unacknowledgedCount || (data.alerts || []).length || 0));
      } catch {
        if (!active) return;
        setUnacknowledgedAlertCount(0);
      }
    };

    void loadAlerts();
    const intervalId = window.setInterval(() => { void loadAlerts(); }, 60000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/calls', icon: Phone, label: 'Appels' },
    { path: '/outbound', icon: PhoneOutgoing, label: 'Sortant' },
    { path: '/staff', icon: Users, label: 'Équipe' },
    { path: '/monitoring/bbis', icon: Gauge, label: 'Monitoring' },
    { path: '/analytics', icon: BarChart2, label: 'Analytics', badge: unacknowledgedAlertCount },
    { path: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#141F28]" style={{ fontFamily: "var(--font-body)" }}>
      <div className="border-b border-[#344453]/10 bg-[#F8F9FB]/95 backdrop-blur-xl">
        <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#344453] text-white shadow-[0_8px_24px_rgba(52,68,83,0.28)]">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#344453]/50" style={{ fontFamily: "var(--font-mono)" }}>Receptio</p>
                  <p className="truncate text-base font-semibold text-[#141F28] sm:text-lg" style={{ fontFamily: "var(--font-title)" }}>Tableau de bord</p>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#344453]/15 bg-white px-3 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 rounded-2xl border border-[#344453]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Compte actif</p>
                <p className="mt-1 truncate text-sm font-medium text-[#141F28]">{userLabel}</p>
              </div>

              <div className="hidden flex-wrap gap-2 sm:flex">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === '/settings'
                    ? location.pathname.startsWith('/settings')
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#344453] text-white shadow-[0_8px_20px_rgba(52,68,83,0.22)]'
                          : 'border border-[#344453]/15 bg-white text-[#344453]/70 hover:bg-[#344453]/5'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {(item as { badge?: number }).badge && (item as { badge?: number }).badge! > 0 && (
                        <span className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-[#D94052] text-white'}`}>
                          {(item as { badge?: number }).badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-8 lg:px-8" style={{ fontFamily: "var(--font-body)" }}>
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#344453]/10 bg-[#F8F9FB]/95 px-3 py-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-7 gap-1 rounded-2xl border border-[#344453]/10 bg-white p-2 shadow-[0_-8px_24px_rgba(52,68,83,0.08)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/settings'
              ? location.pathname.startsWith('/settings')
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-[#344453] text-white'
                    : 'text-[#344453]/60 hover:bg-[#344453]/[0.06]'
                }`}
              >
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  {(item as { badge?: number }).badge && (item as { badge?: number }).badge! > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[#D94052] px-1 py-0.5 text-[9px] font-semibold text-white">
                      {(item as { badge?: number }).badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
