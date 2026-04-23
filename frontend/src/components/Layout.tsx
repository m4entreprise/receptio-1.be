import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Phone, LayoutDashboard, Settings, LogOut, Users, PhoneOutgoing, BarChart2 } from 'lucide-react';
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
    return () => { active = false; window.clearInterval(intervalId); };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const hasSettingsAccess = (
    user?.permissions?.settingsManage ||
    user?.permissions?.knowledgeBaseManage ||
    user?.permissions?.intentsManage ||
    user?.permissions?.qaManage ||
    user?.permissions?.memberManage ||
    user?.role === 'owner' ||
    user?.role === 'admin'
  );

  const mainNav = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Opérations', visible: true },
    { path: '/outbound', icon: PhoneOutgoing, label: 'Sortant', visible: user?.permissions?.outboundRead ?? true },
    { path: '/staff', icon: Users, label: 'Équipe', visible: user?.permissions?.staffManage ?? true },
    { path: '/analytics', icon: BarChart2, label: 'Analytics', badge: unacknowledgedAlertCount, visible: user?.permissions?.analyticsRead ?? true },
  ].filter((item) => item.visible !== false);

  const isActive = (path: string) =>
    path === '/settings'
      ? location.pathname.startsWith('/settings')
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-[#344453] text-white'
        : 'text-[#344453]/60 hover:bg-[#344453]/8 hover:text-[#344453]'
    }`;

  const allMobileItems = [
    ...mainNav,
    ...(hasSettingsAccess ? [{ path: '/settings', icon: Settings, label: 'Paramètres', visible: true }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] text-[#141F28]" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-56 lg:border-r lg:border-[#344453]/10 lg:bg-white lg:z-20">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#344453]/8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#344453] text-white shadow-[0_4px_12px_rgba(52,68,83,0.25)]">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Receptio</p>
            <p className="text-sm font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Dashboard</p>
          </div>
        </div>

        {/* Nav principale */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className={navLinkClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {(item as { badge?: number }).badge! > 0 && (
                  <span className={`ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-[#D94052] text-white'}`}>
                    {(item as { badge?: number }).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: paramètres + user */}
        <div className="border-t border-[#344453]/8 px-3 py-3 space-y-0.5">
          {hasSettingsAccess && (
            <Link to="/settings" className={navLinkClass(isActive('/settings'))}>
              <Settings className="h-4 w-4 shrink-0" />
              <span>Paramètres</span>
            </Link>
          )}
          <div className="flex items-center gap-2 px-3 py-2 mt-1">
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs text-[#344453]/45">{userLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="shrink-0 rounded-lg p-1.5 text-[#344453]/35 hover:bg-[#344453]/8 hover:text-[#344453] transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 lg:ml-56 min-w-0">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between border-b border-[#344453]/10 bg-white/95 backdrop-blur-xl px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#344453] text-white">
              <Phone className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Receptio</span>
          </Link>
          <button onClick={handleLogout} className="p-2 rounded-xl text-[#344453]/50 hover:bg-[#344453]/8 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8" style={{ fontFamily: 'var(--font-body)' }}>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#344453]/10 bg-[#F8F9FB]/95 px-3 py-3 backdrop-blur-xl lg:hidden">
        <div
          className="mx-auto grid max-w-md gap-1 rounded-2xl border border-[#344453]/10 bg-white p-2 shadow-[0_-8px_24px_rgba(52,68,83,0.08)]"
          style={{ gridTemplateColumns: `repeat(${allMobileItems.length}, 1fr)` }}
        >
          {allMobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors ${
                  active ? 'bg-[#344453] text-white' : 'text-[#344453]/60 hover:bg-[#344453]/[0.06]'
                }`}
              >
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  {(item as { badge?: number }).badge! > 0 && (
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
