import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Building2, Eye, EyeOff, PhoneCall, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const inputClass =
  'block w-full rounded-xl border border-[#344453]/15 bg-white px-4 py-3 text-sm text-[#141F28] placeholder-[#344453]/30 shadow-sm transition focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10';

const labelClass = 'block text-sm font-medium text-[#344453]';

export default function Register() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    companyName: '',
    companyPhone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || "Une erreur s'est produite. Vérifiez vos informations.");
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
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/30 bg-[#2D9D78]/10 px-4 py-2 text-sm font-medium text-[#4ec9a0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2D9D78]" />
            14 jours gratuits · Sans carte bancaire
          </div>
          <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
            Votre réceptionniste<br />
            <span className="text-[#C7601D]">opérationnel en 5 min.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-8 text-white/55">
            Créez votre compte, configurez votre accueil, et testez gratuitement sur vos vrais appels.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { step: '01', label: 'Créez votre compte' },
              { step: '02', label: 'Configurez votre accueil' },
              { step: '03', label: 'Activez votre numéro Receptio' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-medium text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
                  {s.step}
                </span>
                <span className="text-sm text-white/65">{s.label}</span>
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
            <PhoneCall className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold text-[#344453]" style={{ fontFamily: "var(--font-title)" }}>Receptio</span>
        </Link>

        <div className="w-full max-w-sm">

          {/* Progress */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${step >= 1 ? 'bg-[#344453] text-white' : 'bg-[#344453]/10 text-[#344453]/40'}`}>
                <User className="h-3.5 w-3.5" />
              </div>
              <span className={`text-xs font-medium transition ${step === 1 ? 'text-[#344453]' : 'text-[#344453]/40'}`}>
                Votre compte
              </span>
            </div>
            <div className="h-px flex-1 bg-[#344453]/12" />
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${step >= 2 ? 'bg-[#344453] text-white' : 'bg-[#344453]/10 text-[#344453]/40'}`}>
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <span className={`text-xs font-medium transition ${step === 2 ? 'text-[#344453]' : 'text-[#344453]/40'}`}>
                Votre entreprise
              </span>
            </div>
          </div>

          {/* Titre */}
          <div className="mb-8">
            {step === 1 ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                  Créer un compte.
                </h1>
                <p className="mt-2 text-sm text-[#344453]/60">
                  14 jours gratuits, sans carte bancaire requise.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                  Votre entreprise.
                </h1>
                <p className="mt-2 text-sm text-[#344453]/60">
                  Ces informations personnalisent l'accueil téléphonique.
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3">
              <span className="mt-0.5 text-[#D94052]">⚠</span>
              <p className="text-sm text-[#D94052]">{error}</p>
            </div>
          )}

          {/* Étape 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className={labelClass}>Prénom</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Marie"
                    className={`mt-2 ${inputClass}`}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>Nom</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Dupont"
                    className={`mt-2 ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>Adresse email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="vous@entreprise.com"
                  className={`mt-2 ${inputClass}`}
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Mot de passe * <span className="font-normal text-[#344453]/40">(min. 8 caractères)</span>
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`${inputClass} pr-11`}
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
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#344453] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(52,68,83,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#2a3642]"
              >
                Continuer
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </form>
          )}

          {/* Étape 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="companyName" className={labelClass}>Nom de l'entreprise *</label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  autoComplete="organization"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Mon Entreprise SPRL"
                  className={`mt-2 ${inputClass}`}
                />
              </div>

              <div>
                <label htmlFor="companyPhone" className={labelClass}>
                  Téléphone entreprise <span className="font-normal text-[#344453]/40">(optionnel)</span>
                </label>
                <input
                  id="companyPhone"
                  name="companyPhone"
                  type="tel"
                  autoComplete="tel"
                  value={formData.companyPhone}
                  onChange={handleChange}
                  placeholder="+32 470 12 34 56"
                  className={`mt-2 ${inputClass}`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-full border border-[#344453]/15 bg-white px-6 py-3.5 text-sm font-semibold text-[#344453] transition duration-200 hover:bg-[#344453]/5"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#C7601D] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(199,96,29,0.32)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Création…
                    </>
                  ) : (
                    <>
                      Créer mon compte
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-[#344453]/55">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-[#C7601D] transition hover:text-[#b35519]">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
