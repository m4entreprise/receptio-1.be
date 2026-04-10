import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, PhoneCall } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Identifiants incorrects. Vérifiez votre email et mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]" style={{ fontFamily: "var(--font-body)" }}>

      {/* ── PANEL GAUCHE — brand ── */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-[#141F28] p-12 lg:flex xl:p-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_10%,rgba(199,96,29,0.22),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(52,68,83,0.6),transparent_55%)]" />

        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C7601D] text-white shadow-[0_6px_20px_rgba(199,96,29,0.38)]">
            <PhoneCall className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold text-white" style={{ fontFamily: "var(--font-title)" }}>Receptio</span>
        </Link>

        <div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
            Ne ratez plus<br />
            <span className="text-[#C7601D]">aucun appel.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-8 text-white/55">
            Votre réceptionniste IA répond, comprend et vous transmet l'essentiel — 24h/24.
          </p>

          <div className="mt-10 space-y-3">
            {['Disponible 24h/24, 7j/7', 'Synthèse claire à chaque appel', 'Opérationnel en 5 minutes'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2D9D78]/20 text-[#2D9D78] text-xs">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
          © {new Date().getFullYear()} Receptio
        </p>
      </div>

      {/* ── PANEL DROIT — formulaire ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16 xl:px-24">

        {/* Logo mobile */}
        <Link to="/" className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#344453] text-white">
            <PhoneCall className="h-4.5 w-4.5" />
          </div>
          <span className="text-lg font-semibold text-[#344453]" style={{ fontFamily: "var(--font-title)" }}>Receptio</span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
              Bon retour.
            </h1>
            <p className="mt-2 text-sm text-[#344453]/60">
              Connectez-vous pour accéder à votre espace.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3">
              <span className="mt-0.5 text-[#D94052]">⚠</span>
              <p className="text-sm text-[#D94052]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#344453]">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                className="mt-2 block w-full rounded-xl border border-[#344453]/15 bg-white px-4 py-3 text-sm text-[#141F28] placeholder-[#344453]/30 shadow-sm transition focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#344453]">
                Mot de passe
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-[#344453]/15 bg-white px-4 py-3 pr-11 text-sm text-[#141F28] placeholder-[#344453]/30 shadow-sm transition focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#344453]/35 transition hover:text-[#344453]/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#C7601D] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(199,96,29,0.32)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#344453]/55">
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-medium text-[#C7601D] transition hover:text-[#b35519]">
              Commencer l'essai gratuit
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
