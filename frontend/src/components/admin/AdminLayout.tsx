import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, CreditCard, LogOut, PhoneCall, History } from 'lucide-react';
import { useSuperAuth } from '../../contexts/SuperAuthContext';
import clsx from 'clsx';

const nav = [
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/billing', label: 'Facturation', icon: CreditCard },
  { to: '/admin/logs', label: 'Audit', icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useSuperAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      <aside className="flex w-60 flex-col bg-[#141F28] text-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C7601D]">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none" style={{ fontFamily: 'var(--font-title)' }}>Receptio</p>
            <p className="text-[10px] text-white/40 mt-0.5">Super Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/6 hover:text-white'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/8 px-4 py-4">
          <p className="text-xs text-white/40 truncate mb-3">{admin?.email}</p>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/55 hover:bg-white/6 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
