import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useSuperAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin/tenants');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141F28] shadow-lg">
            <PhoneCall className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Receptio Admin
            </h1>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#344453]/50">
              <ShieldCheck className="h-3.5 w-3.5" />
              Accès super administrateur
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#344453]/10 bg-white p-8 shadow-sm">
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
              <span className="mt-0.5">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#344453] mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@receptio.eu"
                className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] placeholder-[#344453]/30 focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#344453] mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-3 pr-11 text-sm text-[#141F28] placeholder-[#344453]/30 focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#344453]/35 hover:text-[#344453]/70"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#141F28] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#344453] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connexion…
                </>
              ) : (
                <>
                  Accéder au panneau
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
