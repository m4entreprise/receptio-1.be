import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  Bot,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock3,
  Globe,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const signalNotes = [
  '24/7 sans standard figé',
  'transcription utile, pas brute',
  'priorisation calme des urgences',
];

const relayCards = [
  {
    title: 'Le bruit devient lisible',
    text: 'Receptio retire la friction du premier contact et transforme une interruption en matière exploitable.',
    accent: 'linear-gradient(90deg, rgba(103, 232, 249, 0.26), transparent)',
  },
  {
    title: 'Votre image reste nette',
    text: 'Même quand personne ne peut décrocher, la marque donne une impression posée, disponible et sérieuse.',
    accent: 'linear-gradient(90deg, rgba(216, 180, 254, 0.24), transparent)',
  },
  {
    title: 'L’équipe reprend avec contexte',
    text: 'Nom, intention, urgence, fenêtre de rappel: tout arrive sous une forme immédiatement actionnable.',
    accent: 'linear-gradient(90deg, rgba(252, 211, 77, 0.22), transparent)',
  },
];

const transcriptMoments = [
  {
    label: '08:14',
    title: 'Appel entrant / prospect chaud',
    text: 'Demande de devis, besoin de rappel avant midi, ton pressé mais qualifié.',
    icon: PhoneCall,
  },
  {
    label: '11:32',
    title: 'Reformulation / synthèse',
    text: 'Le message brut devient une note claire qui peut être reprise en quelques secondes.',
    icon: AudioLines,
  },
  {
    label: '16:06',
    title: 'Transmission / bonne personne',
    text: 'La demande est redirigée vers la bonne équipe avec le bon niveau d’urgence.',
    icon: Bot,
  },
];

const audiences = [
  {
    number: '01',
    title: 'Cabinets et métiers de confiance',
    text: 'Là où la première impression doit déjà refléter du sérieux, de la précision et de la disponibilité.',
  },
  {
    number: '02',
    title: 'PME de services à rythme dense',
    text: 'Là où chaque appel compte, mais où l’équipe ne peut pas vivre en interruption permanente.',
  },
  {
    number: '03',
    title: 'Structures locales à image premium',
    text: 'Là où la proximité doit rester chaleureuse sans paraître artisanale ou improvisée.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#07070b] text-stone-100">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(255,196,94,0.16),transparent_18%),radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.18),transparent_18%),radial-gradient(circle_at_82%_62%,rgba(168,85,247,0.16),transparent_22%),linear-gradient(180deg,#0a0a0f_0%,#09090d_52%,#050507_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[100vh] bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:120px_100%] opacity-30" />
      <div className="absolute inset-y-0 left-[8%] -z-10 w-px bg-white/[0.08]" />
      <div className="absolute inset-y-0 right-[12%] -z-10 w-px bg-white/[0.05]" />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07070b]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-amber-200">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[0.25em] text-white">RECEPTIO</p>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500">presence relay system</p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-stone-300 md:flex">
            <a href="#signal" className="transition hover:text-white">Signal</a>
            <a href="#relais" className="transition hover:text-white">Relais</a>
            <a href="#pour-qui" className="transition hover:text-white">Cibles</a>
            <a href="#cta" className="transition hover:text-white">Entrer</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden rounded-full border border-white/[0.12] px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-white/[0.05] sm:inline-flex"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#f3efe6] px-5 py-2.5 text-sm font-semibold text-[#121218] transition hover:bg-white"
            >
              Ouvrir Receptio
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative flex min-h-[calc(100vh-81px)] items-center border-b border-white/[0.08]">
          <div className="absolute left-0 top-8 hidden text-[22vw] font-semibold leading-none tracking-[-0.08em] text-white/[0.03] lg:block">
            RECEPTIO
          </div>

          <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/[0.18] bg-amber-200/[0.07] px-4 py-2 text-sm text-amber-100">
                <Sparkles className="h-4 w-4" />
                Pas un standard. Une présence.
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[140px_1fr] lg:gap-8">
                <div className="hidden lg:block">
                  <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Rôle</p>
                  <p className="mt-3 text-sm leading-7 text-stone-400">
                    capter
                    <br />
                    clarifier
                    <br />
                    relayer
                  </p>
                </div>

                <div>
                  <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-[#f6f3ee] md:text-7xl">
                    Receptio donne à votre numéro la même tenue que votre entreprise.
                  </h1>

                  <p className="mt-8 max-w-2xl text-lg leading-8 text-stone-300 md:text-xl">
                    Quand le téléphone sonne, tout se joue en quelques secondes. Receptio transforme ce moment instable en un accueil net, une lecture calme de la demande, puis un relais propre vers votre équipe.
                  </p>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f3efe6] px-6 py-3.5 text-sm font-semibold text-[#121218] transition hover:bg-white"
                >
                  Créer mon espace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#signal"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.14] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.05]"
                >
                  Lire le système
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-12 grid gap-3 sm:grid-cols-3">
                {signalNotes.map((note) => (
                  <div key={note} className="border-t border-white/[0.14] pt-4 text-sm uppercase tracking-[0.18em] text-stone-300">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 lg:pl-8">
              <div className="absolute -left-6 top-12 h-24 w-24 rounded-full bg-cyan-300/[0.16] blur-3xl" />
              <div className="absolute right-0 top-1/3 h-28 w-28 rounded-full bg-violet-300/[0.15] blur-3xl" />

              <div className="grid gap-4">
                <div className="rotate-[-2deg] border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Canal entrant</p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">Le téléphone n’interrompt plus. Il informe.</h2>
                    </div>
                    <div className="rounded-full border border-emerald-300/[0.24] bg-emerald-300/[0.10] px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-200">
                      Live
                    </div>
                  </div>
                </div>

                <div className="ml-0 border border-white/[0.1] bg-[#0f1016] p-5 sm:ml-12">
                  <div className="flex items-center justify-between text-sm text-stone-400">
                    <span>appel qualifié / 09:42</span>
                    <CalendarClock className="h-4 w-4 text-amber-200" />
                  </div>
                  <p className="mt-5 max-w-sm text-lg font-medium leading-8 text-stone-100">
                    “Bonjour, j’ai besoin d’un rappel aujourd’hui. C’est une demande urgente, mais je préfère parler à la bonne personne.”
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-white/[0.1] bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Sortie système</p>
                    <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">&lt; 1 min</p>
                    <p className="mt-3 text-sm leading-7 text-stone-400">
                      pour transmettre une synthèse courte, utile et déjà hiérarchisée.
                    </p>
                  </div>
                  <div className="border border-white/[0.1] bg-[#15121a] p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Effet marque</p>
                    <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">stable</p>
                    <p className="mt-3 text-sm leading-7 text-stone-400">
                      même pendant les absences, les pics ou les journées de terrain.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="signal" className="border-b border-white/[0.08]">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Le problème</p>
              <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#f6f3ee] md:text-5xl">
                Beaucoup d’entreprises traitent encore les appels comme un bruit à subir.
              </h2>
            </div>

            <div className="space-y-6 text-lg leading-8 text-stone-300">
              <p>
                Une landing SaaS classique promet souvent de “ne rien manquer”. Ce n’est pas assez. Receptio ne vend pas seulement de la disponibilité. Receptio vend une sensation plus rare: la continuité.
              </p>
              <p>
                L’appelant n’entre pas dans une machine. Il entre dans un dispositif de présence qui écoute, structure et relaye avec une politesse presque architecturale. C’est ce décalage-là qui rend l’expérience mémorable.
              </p>
            </div>
          </div>
        </section>

        <section id="relais" className="border-b border-white/[0.08] bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Le relais</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#f6f3ee] md:text-5xl">
                  Une suite de gestes précis, pas une cascade de widgets.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-8 text-stone-400">
                La page s’organise comme une salle de transit élégante: chaque bloc prend une information confuse, lui donne une forme, puis l’emmène plus loin.
              </p>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {relayCards.map((card) => (
                <div key={card.title} className="relative overflow-hidden border border-white/[0.1] bg-[#0b0c11] p-6">
                  <div className="absolute inset-x-0 top-0 h-px" style={{ backgroundImage: card.accent }} />
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{card.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-400">{card.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border border-white/[0.1] bg-[#090a0e] p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Table de lecture</p>
                  <ShieldCheck className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="mt-8 grid gap-5 md:grid-cols-3">
                  {transcriptMoments.map((moment) => {
                    const Icon = moment.icon;

                    return (
                      <div key={moment.label} className="border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.24em] text-stone-500">{moment.label}</span>
                          <Icon className="h-4 w-4 text-amber-200" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">{moment.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-stone-400">{moment.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col justify-between border border-white/[0.1] bg-[#131019] p-6 md:p-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Pourquoi ça change tout</p>
                  <p className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">
                    Votre équipe récupère enfin des appels déjà pensés.
                  </p>
                  <p className="mt-6 text-base leading-8 text-stone-400">
                    Pas une notification de plus. Pas un verbatim brut. Une matière déjà clarifiée, prête à être reprise au bon moment par la bonne personne.
                  </p>
                </div>

                <div className="mt-10 flex items-center gap-3 border-t border-white/[0.08] pt-6 text-sm text-stone-400">
                  <Clock3 className="h-4 w-4 text-cyan-200" />
                  synthèse courte, priorisation immédiate, reprise sans perte de contexte
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pour-qui" className="border-b border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Pour qui</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#f6f3ee] md:text-5xl">
                  Pour les structures qui veulent paraître aussi composées qu’elles opèrent.
                </h2>
                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm text-stone-200">
                  <Building2 className="h-4 w-4 text-amber-200" />
                  cabinets, PME de services, entreprises locales à image exigeante
                </div>
              </div>

              <div className="space-y-6">
                {audiences.map((audience) => (
                  <div key={audience.number} className="grid gap-5 border-t border-white/[0.1] pt-6 md:grid-cols-[84px_1fr]">
                    <p className="text-4xl font-semibold tracking-[-0.05em] text-stone-600">{audience.number}</p>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{audience.title}</h3>
                      <p className="mt-3 max-w-2xl text-base leading-8 text-stone-400">{audience.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="relative">
          <div className="absolute inset-x-0 bottom-0 top-1/3 -z-10 bg-[linear-gradient(180deg,transparent_0%,rgba(255,245,230,0.08)_100%)]" />
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
            <div className="grid gap-10 border border-white/[0.1] bg-[#f1ece1] p-8 text-[#14141a] md:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-[#6f6658]">
                  <Globe className="h-4 w-4" />
                  receptio.be
                </p>
                <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.05em] md:text-5xl">
                  Si votre téléphone fait partie de votre image, il mérite mieux qu’une simple boîte de réception vocale.
                </h2>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4d463d]">
                  Donnez à vos appels entrants une présence claire, une lecture juste et un relais digne de votre niveau d’exigence.
                </p>
              </div>

              <div className="flex flex-col gap-4 lg:items-start">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111118] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Ouvrir mon espace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1f2028]/20 px-6 py-3.5 text-sm font-semibold text-[#171821] transition hover:bg-black/[0.04]"
                >
                  Accéder au dashboard
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
