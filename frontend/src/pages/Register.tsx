import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Eye, EyeOff, PhoneCall,
  User, Building2, Clock, Sparkles,
  Activity, BookOpen, Home, Wrench, Coffee, ShoppingBag, Briefcase, HelpCircle,
  Minus, Plus, Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = 1 | 2 | 3 | 4;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  companyPhone: string;
  sector: string;
  companySize: string;
  openDays: string[];
  openFrom: string;
  openUntil: string;
  agentCount: number;
  offer: 'a' | 'b';
}

const SECTORS = [
  { key: 'medical', label: 'Médical / Santé', Icon: Activity },
  { key: 'legal', label: 'Juridique', Icon: BookOpen },
  { key: 'realestate', label: 'Immobilier', Icon: Home },
  { key: 'construction', label: 'Artisanat / BTP', Icon: Wrench },
  { key: 'hospitality', label: 'Hôtellerie / Rest.', Icon: Coffee },
  { key: 'retail', label: 'Commerce', Icon: ShoppingBag },
  { key: 'services', label: 'Services B2B', Icon: Briefcase },
  { key: 'other', label: 'Autre', Icon: HelpCircle },
] as const;

const SIZES = [
  { key: 'solo', label: 'Indépendant', sub: '1 pers.' },
  { key: 'small', label: 'Petite équipe', sub: '2 – 10' },
  { key: 'medium', label: 'PME', sub: '11 – 50' },
  { key: 'large', label: 'Grande structure', sub: '50+' },
] as const;

const DAYS = [
  { key: 'mon', label: 'L' },
  { key: 'tue', label: 'M' },
  { key: 'wed', label: 'M' },
  { key: 'thu', label: 'J' },
  { key: 'fri', label: 'V' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'D' },
] as const;

const STEPS = [
  { num: 1 as Step, label: 'Compte', Icon: User },
  { num: 2 as Step, label: 'Entreprise', Icon: Building2 },
  { num: 3 as Step, label: 'Organisation', Icon: Clock },
  { num: 4 as Step, label: 'Offre', Icon: Sparkles },
];

const OFFER_FEATURES = {
  a: [
    'Décroché automatique 24h/24',
    "Message d'accueil personnalisé",
    'Transfert vers vos collaborateurs',
    'Messagerie vocale intelligente',
    'Tableau de bord basique',
  ],
  b: [
    'Tout du Réceptionniste Intelligent',
    'Compréhension naturelle du langage',
    'Réponses contextuelles intelligentes',
    'Apprentissage continu',
    'Intégrations CRM avancées',
  ],
};

const inp = 'block w-full rounded-xl border border-[#344453]/15 bg-white px-4 py-3 text-sm text-[#141F28] placeholder-[#344453]/30 shadow-sm transition focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10';
const lbl = 'block text-xs font-semibold text-[#344453]/70 uppercase tracking-wide mb-2';

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

export default function Register() {
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', password: '',
    companyName: '', companyPhone: '',
    sector: '', companySize: '',
    openDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    openFrom: '08:00', openUntil: '18:00',
    agentCount: 1,
    offer: 'a',
  });

  const navigate = useNavigate();
  const { register } = useAuth();

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const toggleDay = (day: string) =>
    setForm(prev => ({
      ...prev,
      openDays: prev.openDays.includes(day)
        ? prev.openDays.filter(d => d !== day)
        : [...prev.openDays, day],
    }));

  const goTo = (target: Step) => {
    setDir(target > step ? 1 : -1);
    setStep(target);
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!form.email) return 'Email requis.';
      if (!/\S+@\S+\.\S+/.test(form.email)) return 'Email invalide.';
      if (form.password.length < 8) return 'Mot de passe : 8 caractères minimum.';
    }
    if (step === 2) {
      if (!form.companyName.trim()) return "Nom de l’entreprise requis.";
    }
    if (step === 3) {
      if (form.openDays.length === 0) return "Sélectionnez au moins un jour d'ouverture.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    goTo((step + 1) as Step);
  };

  const back = () => {
    setError('');
    goTo((step - 1) as Step);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        companyName: form.companyName,
        companyPhone: form.companyPhone || undefined,
        onboarding: {
          sector: form.sector || undefined,
          companySize: form.companySize || undefined,
          openDays: form.openDays,
          openFrom: form.openFrom,
          openUntil: form.openUntil,
          agentCount: form.agentCount,
          offer: form.offer,
        },
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Une erreur est survenue. Vérifiez vos informations.');
    } finally {
      setLoading(false);
    }
  };

  const leftContent = [
    {
      title: 'Votre réceptionniste',
      accent: 'opérationnel en 5 min.',
      body: '14 jours gratuits, aucune carte bancaire requise.',
      items: [
        { n: '01', t: 'Créez votre compte' },
        { n: '02', t: 'Configurez votre accueil' },
        { n: '03', t: 'Activez votre numéro Receptio' },
      ],
    },
    {
      title: "On s'adapte",
      accent: 'à votre métier.',
      body: "Messages, routing et résumés calibrés pour votre secteur d'activité.",
      items: [
        { n: '🏥', t: 'Secteurs médicaux, juridiques, BTP…' },
        { n: '🔀', t: 'Routing intelligent par compétences' },
        { n: '📝', t: 'Résumés adaptés à votre vocabulaire' },
      ],
    },
    {
      title: 'Disponible 24h/24,',
      accent: 'même quand vous dormez.',
      body: 'Configurez vos horaires et votre équipe en quelques secondes.',
      items: [
        { n: '🌙', t: 'Accueil personnalisé hors horaires' },
        { n: '👥', t: 'Dispatch vers les bons agents' },
        { n: '📊', t: 'KPIs par collaborateur' },
      ],
    },
    {
      title: 'Deux niveaux',
      accent: "d'intelligence.",
      body: "Du répondeur classique à l'IA conversationnelle — choisissez selon vos besoins.",
      items: [
        { n: '49€', t: 'Réceptionniste Intelligent / mois' },
        { n: '99€', t: 'Réceptionniste IA / mois' },
        { n: '✓', t: 'Essai 14 jours, sans engagement' },
      ],
    },
  ][step - 1];

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Left panel ── */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#141F28] p-12 lg:flex xl:p-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_10%,rgba(199,96,29,0.22),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(52,68,83,0.6),transparent_55%)]" />

        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C7601D] text-white shadow-[0_6px_20px_rgba(199,96,29,0.38)]">
            <PhoneCall className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-title)' }}>Receptio</span>
        </Link>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/30 bg-[#2D9D78]/10 px-4 py-2 text-sm font-medium text-[#4ec9a0] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2D9D78]" />
              Étape {step} sur 4
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl mb-2" style={{ fontFamily: 'var(--font-title)' }}>
              {leftContent.title}<br />
              <span className="text-[#C7601D]">{leftContent.accent}</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/50 mb-8">{leftContent.body}</p>
            <div className="space-y-4">
              {leftContent.items.map((item) => (
                <div key={item.n} className="flex items-center gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-medium text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.n}
                  </span>
                  <span className="text-sm text-white/65">{item.t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-xs text-white/25" style={{ fontFamily: 'var(--font-mono)' }}>
          © {new Date().getFullYear()} Receptio
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20 overflow-hidden">

        {/* Mobile logo */}
        <Link to="/" className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#344453] text-white">
            <PhoneCall className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold text-[#344453]" style={{ fontFamily: 'var(--font-title)' }}>Receptio</span>
        </Link>

        <div className="w-full max-w-[420px]">

          {/* Step indicator */}
          <div className="mb-10 flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                    step > s.num
                      ? 'bg-[#2D9D78] text-white'
                      : step === s.num
                        ? 'bg-[#344453] text-white ring-4 ring-[#344453]/15'
                        : 'bg-[#344453]/10 text-[#344453]/30'
                  }`}>
                    {step > s.num ? <Check className="h-3.5 w-3.5" /> : <s.Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                    step === s.num ? 'text-[#344453]' : 'text-[#344453]/30'
                  }`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 transition-all duration-500 ${step > s.num ? 'bg-[#2D9D78]/50' : 'bg-[#344453]/10'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3">
              <span className="mt-0.5 text-[#D94052]">⚠</span>
              <p className="text-sm text-[#D94052]">{error}</p>
            </div>
          )}

          {/* Step content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >

              {/* ── Step 1: Compte ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                      Créer un compte.
                    </h1>
                    <p className="mt-1.5 text-sm text-[#344453]/55">14 jours gratuits, sans carte bancaire.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Prénom</label>
                      <input
                        type="text"
                        autoComplete="given-name"
                        value={form.firstName}
                        onChange={e => set('firstName', e.target.value)}
                        placeholder="Marie"
                        className={inp}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Nom</label>
                      <input
                        type="text"
                        autoComplete="family-name"
                        value={form.lastName}
                        onChange={e => set('lastName', e.target.value)}
                        placeholder="Dupont"
                        className={inp}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Email *</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="vous@entreprise.com"
                      className={inp}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Mot de passe * <span className="font-normal normal-case text-[#344453]/35">(min. 8 caractères)</span></label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="••••••••"
                        className={`${inp} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#344453]/35 hover:text-[#344453]/70 transition"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={next}
                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#344453] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(52,68,83,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#2a3642]"
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}

              {/* ── Step 2: Entreprise ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                      Votre entreprise.
                    </h1>
                    <p className="mt-1.5 text-sm text-[#344453]/55">Ces informations personnalisent l'accueil téléphonique.</p>
                  </div>

                  <div>
                    <label className={lbl}>Nom de l'entreprise *</label>
                    <input
                      type="text"
                      required
                      autoComplete="organization"
                      value={form.companyName}
                      onChange={e => set('companyName', e.target.value)}
                      placeholder="Cabinet Dupont & Associés"
                      className={inp}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Téléphone <span className="font-normal normal-case text-[#344453]/35">(optionnel)</span></label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={form.companyPhone}
                      onChange={e => set('companyPhone', e.target.value)}
                      placeholder="+32 470 12 34 56"
                      className={inp}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Secteur d'activité</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SECTORS.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set('sector', form.sector === key ? '' : key)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm transition-all duration-150 ${
                            form.sector === key
                              ? 'border-[#344453]/50 bg-[#344453]/8 text-[#344453] font-medium'
                              : 'border-[#344453]/10 bg-white text-[#344453]/60 hover:border-[#344453]/25 hover:bg-[#344453]/4'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Taille de l'entreprise</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SIZES.map(({ key, label, sub }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set('companySize', form.companySize === key ? '' : key)}
                          className={`px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                            form.companySize === key
                              ? 'border-[#344453]/50 bg-[#344453]/8'
                              : 'border-[#344453]/10 bg-white hover:border-[#344453]/25 hover:bg-[#344453]/4'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${form.companySize === key ? 'text-[#344453]' : 'text-[#141F28]'}`}>{label}</p>
                          <p className="text-[11px] text-[#344453]/45">{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={back} className="flex items-center gap-1.5 rounded-full border border-[#344453]/15 bg-white px-5 py-3.5 text-sm font-semibold text-[#344453] transition hover:bg-[#344453]/5">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button onClick={next} className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#344453] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(52,68,83,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2a3642]">
                      Continuer
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Organisation ── */}
              {step === 3 && (
                <div className="space-y-7">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                      Votre organisation.
                    </h1>
                    <p className="mt-1.5 text-sm text-[#344453]/55">Configurez vos disponibilités et votre équipe.</p>
                  </div>

                  <div>
                    <label className={lbl}>Jours d'ouverture</label>
                    <div className="flex gap-2">
                      {DAYS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleDay(key)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all duration-150 ${
                            form.openDays.includes(key)
                              ? 'bg-[#344453] text-white shadow-sm'
                              : 'bg-[#344453]/8 text-[#344453]/40 hover:bg-[#344453]/15'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Horaires d'ouverture</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={form.openFrom}
                        onChange={e => set('openFrom', e.target.value)}
                        className={`${inp} flex-1`}
                      />
                      <span className="text-sm text-[#344453]/40 font-mono">→</span>
                      <input
                        type="time"
                        value={form.openUntil}
                        onChange={e => set('openUntil', e.target.value)}
                        className={`${inp} flex-1`}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#344453]/35">En dehors de ces horaires, Receptio gère les appels automatiquement.</p>
                  </div>

                  <div>
                    <label className={lbl}>Agents qui prennent les appels</label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => set('agentCount', Math.max(1, form.agentCount - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#344453]/15 bg-white text-[#344453]/60 transition hover:bg-[#344453]/5 hover:border-[#344453]/30"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center">
                        <span className="text-3xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>{form.agentCount}</span>
                        <p className="text-xs text-[#344453]/40 mt-0.5">{form.agentCount === 1 ? 'collaborateur' : 'collaborateurs'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => set('agentCount', Math.min(50, form.agentCount + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#344453]/15 bg-white text-[#344453]/60 transition hover:bg-[#344453]/5 hover:border-[#344453]/30"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[#344453]/35">Vous pourrez ajouter leurs profils dans le tableau de bord.</p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={back} className="flex items-center gap-1.5 rounded-full border border-[#344453]/15 bg-white px-5 py-3.5 text-sm font-semibold text-[#344453] transition hover:bg-[#344453]/5">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button onClick={next} className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#344453] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(52,68,83,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2a3642]">
                      Continuer
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 4: Offre ── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                      Votre offre.
                    </h1>
                    <p className="mt-1.5 text-sm text-[#344453]/55">Changeable à tout moment depuis votre tableau de bord.</p>
                  </div>

                  <div className="space-y-3">
                    {/* Offer A */}
                    <button
                      type="button"
                      onClick={() => set('offer', 'a')}
                      className={`w-full rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                        form.offer === 'a'
                          ? 'border-[#344453] bg-[#344453]/5'
                          : 'border-[#344453]/12 bg-white hover:border-[#344453]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs font-mono text-[#344453]/50 uppercase tracking-widest mb-1">Réceptionniste Intelligent</p>
                          <p className="text-2xl font-black text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                            49€<span className="text-sm font-normal text-[#344453]/50">/mois</span>
                          </p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          form.offer === 'a' ? 'border-[#344453] bg-[#344453]' : 'border-[#344453]/25'
                        }`}>
                          {form.offer === 'a' && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {OFFER_FEATURES.a.map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#344453]/30 shrink-0" />
                            <span className="text-xs text-[#344453]/60">{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>

                    {/* Offer B */}
                    <button
                      type="button"
                      onClick={() => set('offer', 'b')}
                      className={`w-full rounded-2xl border-2 p-5 text-left transition-all duration-200 relative ${
                        form.offer === 'b'
                          ? 'border-[#C7601D] bg-[#C7601D]/5'
                          : 'border-[#C7601D]/15 bg-white hover:border-[#C7601D]/35'
                      }`}
                    >
                      <div className="absolute -top-2.5 left-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#C7601D] text-white text-[10px] font-bold tracking-wide uppercase">
                          Recommandé
                        </span>
                      </div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs font-mono text-[#C7601D]/60 uppercase tracking-widest mb-1">Réceptionniste IA</p>
                          <p className="text-2xl font-black text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                            99€<span className="text-sm font-normal text-[#344453]/50">/mois</span>
                          </p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          form.offer === 'b' ? 'border-[#C7601D] bg-[#C7601D]' : 'border-[#C7601D]/25'
                        }`}>
                          {form.offer === 'b' && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {OFFER_FEATURES.b.map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#C7601D]/40 shrink-0" />
                            <span className="text-xs text-[#344453]/60">{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3">
                      <span className="mt-0.5 text-[#D94052]">⚠</span>
                      <p className="text-sm text-[#D94052]">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={back} className="flex items-center gap-1.5 rounded-full border border-[#344453]/15 bg-white px-5 py-3.5 text-sm font-semibold text-[#344453] transition hover:bg-[#344453]/5">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#C7601D] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(199,96,29,0.32)] transition hover:-translate-y-0.5 hover:bg-[#b35519] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Création en cours…
                        </>
                      ) : (
                        <>
                          Démarrer mon essai gratuit
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-center text-xs text-[#344453]/40 pt-1">
                    Aucune carte bancaire requise · Résiliable à tout moment
                  </p>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

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
