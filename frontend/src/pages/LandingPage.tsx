import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import {
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Bot,
  Building2,
  CalendarClock,
  ChevronRight,
  Hammer,
  PhoneCall,
  PhoneMissed,
  ShieldCheck,
  Smile,
  Stethoscope,
  Store,
  Zap,
} from 'lucide-react';

const benefits = [
  {
    icon: PhoneMissed,
    title: 'Zéro appel perdu',
    text: 'Receptio répond 24h/24, même pendant les réunions, les congés ou les périodes de pointe.',
  },
  {
    icon: AudioLines,
    title: 'Synthèse claire, pas de verbatim',
    text: 'Chaque appel est reformulé, priorisé et transmis avec le contexte nécessaire pour agir rapidement.',
  },
  {
    icon: BadgeCheck,
    title: 'Image professionnelle constante',
    text: "Votre entreprise décroche toujours avec le bon ton, même quand vous n'êtes pas disponible.",
  },
  {
    icon: CalendarClock,
    title: 'Plus de rendez-vous captés',
    text: 'Les demandes de rappel et les prises de RDV sont détectées et transmises sans délai.',
  },
  {
    icon: ShieldCheck,
    title: 'Simple à configurer',
    text: 'Aucune compétence technique requise. Votre Receptio est opérationnel en quelques minutes.',
  },
  {
    icon: Zap,
    title: 'Réponse immédiate',
    text: "L'appelant est pris en charge à la première sonnerie. Pas d'attente, pas de frustration.",
  },
];

const steps = [
  {
    number: '01',
    title: 'Un appel arrive',
    text: "Votre client appelle. Receptio décroche immédiatement et l'accueille avec votre nom et votre ton.",
  },
  {
    number: '02',
    title: 'La demande est comprise',
    text: "Receptio écoute, pose les bonnes questions et comprend l'objet de l'appel : urgence, RDV, information…",
  },
  {
    number: '03',
    title: 'Vous recevez la synthèse',
    text: 'En quelques secondes, une note claire arrive dans votre espace : qui a appelé, pourquoi, que faire.',
  },
  {
    number: '04',
    title: 'Vous rappelez quand vous voulez',
    text: 'Avec le contexte complet, le rappel prend 30 secondes. Plus de confusion, plus de temps perdu.',
  },
];

const caseStudies = [
  {
    quote:
      '"Avant, je ratais 3 à 4 appels par jour. Maintenant tout passe, et je rappelle au bon moment."',
    role: 'Artisan électricien',
    stat: '+40 %',
    statLabel: 'de rappels transformés en devis',
  },
  {
    quote:
      '"Nos patients se sentent mieux accueillis. Même en dehors des heures d\'ouverture."',
    role: 'Cabinet médical — 3 praticiens',
    stat: '0',
    statLabel: 'appel perdu depuis l\'activation',
  },
  {
    quote:
      '"J\'avais peur que ça sonne faux. Mes clients ne voient pas la différence — en mieux."',
    role: 'Agence immobilière locale',
    stat: '< 1 min',
    statLabel: 'pour traiter chaque appel entrant',
  },
];

const sectors = [
  {
    icon: Hammer,
    title: 'Artisans & TPE',
    text: 'Ne perdez plus une opportunité en chantier. Chaque appel est capté et synthétisé.',
  },
  {
    icon: Stethoscope,
    title: 'Professions de santé',
    text: 'Vos patients sont bien accueillis hors consultation, sans secrétariat supplémentaire.',
  },
  {
    icon: Building2,
    title: 'PME de services',
    text: "Gérez les pics d'appels sans augmenter vos effectifs ni votre stress.",
  },
  {
    icon: Store,
    title: 'Commerces & boutiques',
    text: 'Restez disponibles pendant les heures de rush ou après fermeture.',
  },
  {
    icon: Smile,
    title: 'Professions libérales',
    text: 'Avocats, comptables, consultants : votre image est soignée à chaque appel.',
  },
  {
    icon: Bot,
    title: 'Startups & scale-ups',
    text: "Scalez votre accueil téléphonique sans embaucher, dès le premier jour d'activité.",
  },
];

const plans = [
  {
    name: 'Essentiel',
    price: '29',
    period: '/ mois',
    description: 'Pour les indépendants et petites structures.',
    features: [
      "Jusqu'à 100 appels / mois",
      'Synthèse par appel',
      'Notifications par email',
      'Accueil personnalisé',
    ],
    cta: "Commencer l'essai gratuit",
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '79',
    period: '/ mois',
    description: 'Pour les PME et les équipes en croissance.',
    features: [
      'Appels illimités',
      "Détection d'urgence",
      'Intégration agenda',
      'Support prioritaire',
      'Tableau de bord avancé',
    ],
    cta: "Commencer l'essai gratuit",
    highlighted: true,
  },
  {
    name: 'Sur mesure',
    price: null,
    period: '',
    description: 'Pour les structures complexes ou multi-sites.',
    features: [
      'Déploiement personnalisé',
      'Plusieurs lignes',
      'SLA garanti',
      'Accompagnement dédié',
    ],
    cta: 'Nous contacter',
    highlighted: false,
  },
];

export default function LandingPage() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    );

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#F8F9FB] text-[#1a2733]" style={{ fontFamily: "var(--font-body)" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 border-b border-[#344453]/10 bg-[#F8F9FB]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#344453] text-white shadow-[0_8px_24px_rgba(52,68,83,0.28)]">
              <PhoneCall className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-[#344453]" style={{ fontFamily: "var(--font-title)" }}>
              Receptio
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#344453]/70 md:flex">
            <a href="#benefices" className="transition hover:text-[#344453]">Bénéfices</a>
            <a href="#fonctionnement" className="transition hover:text-[#344453]">Comment ça marche</a>
            <a href="#metiers" className="transition hover:text-[#344453]">Métiers</a>
            <a href="#tarifs" className="transition hover:text-[#344453]">Tarifs</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden rounded-full border border-[#344453]/20 px-4 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5 sm:inline-flex"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(199,96,29,0.32)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b35519]"
            >
              Essai gratuit
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main id="top">

        {/* ── HERO ── */}
        <section className="relative overflow-hidden border-b border-[#344453]/10 bg-[#141F28]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_0%,rgba(199,96,29,0.18),transparent_55%),radial-gradient(ellipse_at_80%_60%,rgba(52,68,83,0.5),transparent_60%)]" />

          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
            <div className="relative z-10">
              <div
                className="animate-reveal-up inline-flex items-center gap-2 rounded-full border border-[#C7601D]/30 bg-[#C7601D]/10 px-4 py-2 text-sm font-medium text-[#f0a070]"
                style={{ animationDelay: '80ms' }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C7601D] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C7601D]" />
                </span>
                Disponible 24h/24 — 7j/7
              </div>

              <h1
                className="animate-reveal-up mt-7 text-5xl font-extrabold leading-[1.06] tracking-tight text-white md:text-6xl lg:text-[64px]"
                style={{ fontFamily: "var(--font-title)", animationDelay: '160ms' }}
              >
                Ne ratez plus<br />
                <span className="text-[#C7601D]">aucun appel.</span>
              </h1>

              <p
                className="animate-reveal-up mt-7 max-w-xl text-lg leading-8 text-white/70"
                style={{ animationDelay: '240ms' }}
              >
                Receptio répond à votre place, comprend la demande et vous transmet une synthèse claire — pour que vous puissiez rappeler au bon moment, sans rien manquer.
              </p>

              <div
                className="animate-reveal-up mt-10 flex flex-col gap-4 sm:flex-row"
                style={{ animationDelay: '320ms' }}
              >
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-7 py-4 text-base font-semibold text-white shadow-[0_8px_28px_rgba(199,96,29,0.36)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#b35519]"
                >
                  Commencer l'essai gratuit
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#tarifs"
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-base font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07]"
                >
                  Voir les tarifs
                  <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>

              <div
                className="animate-reveal-up mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-8 text-sm text-white/50"
                style={{ animationDelay: '400ms' }}
              >
                <span>✓ Sans engagement</span>
                <span>✓ Aucune compétence technique</span>
                <span>✓ Opérationnel en 5 minutes</span>
              </div>
            </div>

            <div className="animate-reveal-up relative z-10" style={{ animationDelay: '280ms' }}>
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                    Appel en cours
                  </p>
                  <div className="flex items-center gap-2 rounded-full border border-[#2D9D78]/30 bg-[#2D9D78]/15 px-3 py-1 text-xs font-medium text-[#4ec9a0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2D9D78]" />
                    En ligne
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl bg-white/[0.07] p-4">
                    <p className="text-xs text-white/40">Appelant — 09:42</p>
                    <p className="mt-2 text-sm leading-6 text-white/90">
                      "Bonjour, je voudrais prendre un rendez-vous pour cette semaine si possible. C'est assez urgent."
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#C7601D]/15 p-4">
                    <p className="text-xs text-[#C7601D]/70">Receptio — Synthèse</p>
                    <p className="mt-2 text-sm leading-6 text-white/90">
                      Demande de RDV urgent cette semaine. À rappeler en priorité.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
                      Transmis en
                    </p>
                    <p className="mt-1 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-mono)" }}>
                      00:47
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BÉNÉFICES ── */}
        <section id="benefices" className="border-b border-[#344453]/10 bg-[#F8F9FB]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                Pourquoi Receptio
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#141F28] md:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
                Votre téléphone travaille.<br />Vous aussi, mais autrement.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#344453]/65">
                Fini les appels manqués, les messages confus et les opportunités perdues. Receptio s'occupe du premier contact pour que vous puissiez vous concentrer sur l'essentiel.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    data-reveal
                    key={b.title}
                    className="reveal-on-scroll interactive-panel rounded-2xl border border-[#344453]/10 bg-white p-6 shadow-[0_2px_12px_rgba(52,68,83,0.06)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#344453]/8 text-[#344453]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                      {b.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[#344453]/65">{b.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FONCTIONNEMENT ── */}
        <section id="fonctionnement" className="border-b border-[#344453]/10 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                Comment ça marche
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#141F28] md:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
                Simple à brancher,<br />efficace dès le premier appel.
              </h2>
            </div>

            <div className="mt-14 grid gap-8 lg:grid-cols-4">
              {steps.map((step, i) => (
                <div data-reveal key={step.number} className="reveal-on-scroll relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-8 top-7 hidden h-px w-[calc(100%+2rem)] bg-[#344453]/10 lg:block" />
                  )}
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#344453]/15 bg-white shadow-[0_4px_16px_rgba(52,68,83,0.08)]">
                    <span className="text-sm font-medium text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#344453]/65">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAS CONCRETS ── */}
        <section className="border-b border-[#344453]/10 bg-[#141F28]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                Ils l'utilisent au quotidien
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
                Des résultats concrets,<br />pas des promesses.
              </h2>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {caseStudies.map((c) => (
                <div
                  data-reveal
                  key={c.role}
                  className="reveal-on-scroll interactive-panel flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm"
                >
                  <p className="text-base leading-8 text-white/80 italic">{c.quote}</p>
                  <div className="mt-8 border-t border-white/10 pt-6">
                    <p className="text-sm font-medium text-white/50">{c.role}</p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-3xl font-medium text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                        {c.stat}
                      </span>
                      <span className="mb-1 text-sm text-white/50">{c.statLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CAS MÉTIERS ── */}
        <section id="metiers" className="border-b border-[#344453]/10 bg-[#F8F9FB]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                Cas métiers
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#141F28] md:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
                Fait pour votre activité,<br />quelle que soit votre taille.
              </h2>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sectors.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    data-reveal
                    key={s.title}
                    className="reveal-on-scroll interactive-panel group rounded-2xl border border-[#344453]/10 bg-white p-6 shadow-[0_2px_12px_rgba(52,68,83,0.06)] transition hover:border-[#C7601D]/30"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C7601D]/8 text-[#C7601D] transition group-hover:bg-[#C7601D]/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[#344453]/65">{s.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── TARIFS ── */}
        <section id="tarifs" className="border-b border-[#344453]/10 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-[#C7601D]" style={{ fontFamily: "var(--font-mono)" }}>
                Tarifs
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#141F28] md:text-5xl" style={{ fontFamily: "var(--font-title)" }}>
                14 jours d'essai gratuit,<br />sans carte bancaire.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#344453]/65">
                Testez Receptio sur vos vrais appels. Aucun engagement. Résiliation en un clic.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  data-reveal
                  key={plan.name}
                  className={`reveal-on-scroll interactive-panel flex flex-col rounded-2xl border p-7 ${
                    plan.highlighted
                      ? 'border-[#C7601D]/40 bg-[#141F28] shadow-[0_16px_48px_rgba(199,96,29,0.2)]'
                      : 'border-[#344453]/10 bg-[#F8F9FB]'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="mb-5 inline-flex self-start rounded-full bg-[#C7601D]/15 px-3 py-1 text-xs font-medium text-[#C7601D]">
                      Le plus choisi
                    </div>
                  )}
                  <p
                    className={`text-xl font-semibold ${plan.highlighted ? 'text-white' : 'text-[#141F28]'}`}
                    style={{ fontFamily: "var(--font-title)" }}
                  >
                    {plan.name}
                  </p>
                  <p className={`mt-2 text-sm ${plan.highlighted ? 'text-white/55' : 'text-[#344453]/55'}`}>
                    {plan.description}
                  </p>
                  <div className="mt-6 flex items-end gap-1">
                    {plan.price ? (
                      <>
                        <span
                          className={`text-4xl font-medium ${plan.highlighted ? 'text-white' : 'text-[#141F28]'}`}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {plan.price}€
                        </span>
                        <span className={`mb-1 text-sm ${plan.highlighted ? 'text-white/40' : 'text-[#344453]/40'}`}>
                          {plan.period}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`text-2xl font-semibold ${plan.highlighted ? 'text-white' : 'text-[#141F28]'}`}
                        style={{ fontFamily: "var(--font-title)" }}
                      >
                        Sur devis
                      </span>
                    )}
                  </div>
                  <ul className="mt-7 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-2 text-sm ${plan.highlighted ? 'text-white/75' : 'text-[#344453]/75'}`}
                      >
                        <span className="mt-0.5 text-[#2D9D78]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/register"
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 ${
                      plan.highlighted
                        ? 'bg-[#C7601D] text-white shadow-[0_6px_20px_rgba(199,96,29,0.36)] hover:bg-[#b35519]'
                        : 'border border-[#344453]/20 bg-white text-[#344453] hover:bg-[#344453]/5'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="bg-[#344453]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div data-reveal className="reveal-on-scroll grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <h2
                  className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl"
                  style={{ fontFamily: "var(--font-title)" }}
                >
                  Chaque appel manqué<br />est une opportunité perdue.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
                  Rejoignez les entrepreneurs qui font confiance à Receptio pour ne plus jamais rater un client, un RDV ou une urgence.
                </p>
              </div>
              <div className="flex flex-col gap-4 lg:items-start">
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-8 py-4 text-base font-semibold text-white shadow-[0_8px_28px_rgba(199,96,29,0.38)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#b35519]"
                >
                  Commencer l'essai gratuit
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07]"
                >
                  Déjà client ? Connexion
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <p className="mt-2 text-sm text-white/40">
                  14 jours gratuits · Sans carte bancaire · Résiliation instantanée
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-[#344453]/10 bg-[#F8F9FB]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[#344453]/45 sm:flex-row lg:px-8">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#344453] text-white">
                <PhoneCall className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-[#344453]/70" style={{ fontFamily: "var(--font-title)" }}>
                Receptio
              </span>
            </div>
            <p>© {new Date().getFullYear()} Receptio — Ne ratez plus aucun appel.</p>
            <nav className="flex gap-5">
              <a href="#benefices" className="transition hover:text-[#344453]">Bénéfices</a>
              <a href="#tarifs" className="transition hover:text-[#344453]">Tarifs</a>
              <Link to="/login" className="transition hover:text-[#344453]">Connexion</Link>
            </nav>
          </div>
        </footer>

      </main>
    </div>
  );
}
