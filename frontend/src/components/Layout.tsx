import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Phone, LayoutDashboard, Settings, LogOut, Gauge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userLabel = user?.email ?? 'Compte connecté';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/calls', icon: Phone, label: 'Appels' },
    { path: '/monitoring/bbis', icon: Gauge, label: 'Monitoring' },
    { path: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171821]">
      <div className="border-b border-black/5 bg-[#f7f4ee]/95 backdrop-blur-xl">
        <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111118] text-[#f4efe5] shadow-[0_16px_40px_rgba(17,17,24,0.16)]">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#7a7267]">Receptio</p>
                  <p className="truncate text-base font-semibold text-[#171821] sm:text-lg">Tableau de bord</p>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-sm font-medium text-[#171821] transition hover:bg-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 rounded-2xl border border-black/5 bg-white/70 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Compte actif</p>
                <p className="mt-1 truncate text-sm font-medium text-[#171821]">{userLabel}</p>
              </div>

              <div className="hidden flex-wrap gap-2 sm:flex">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === '/settings'
                    ? location.pathname.startsWith('/settings')
                    : location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#111118] text-white shadow-[0_14px_30px_rgba(17,17,24,0.18)]'
                          : 'border border-black/10 bg-white/70 text-[#4f4b45] hover:bg-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#fbf8f3]/95 px-3 py-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2 rounded-2xl border border-black/5 bg-white/80 p-2 shadow-[0_-12px_30px_rgba(17,17,24,0.08)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/settings'
              ? location.pathname.startsWith('/settings')
              : location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-[#111118] text-white'
                    : 'text-[#625d55] hover:bg-black/[0.04]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
