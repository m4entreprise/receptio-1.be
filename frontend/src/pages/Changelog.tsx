import { motion } from 'framer-motion';
import { CheckCircle2, Zap, Wrench, Sparkles } from 'lucide-react';
import StaticPageLayout from '../components/landing/StaticPageLayout';

type ChangeType = 'new' | 'improved' | 'fixed' | 'infra';

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  tag?: string;
  tagColor?: string;
  description?: string;
  changes: Change[];
}

const RELEASES: Release[] = [
  {
    version: '1.4.0',
    date: 'Avril 2026',
    tag: 'Majeure',
    tagColor: '#C7601D',
    description: "Système de gestion d'équipe et contrôle d'accès par rôles.",
    changes: [
      { type: 'new', text: 'Invitations membres avec rôles : Admin, Manager, Viewer.' },
      { type: 'new', text: "Tableau de bord des accès équipe avec historique des invitations." },
      { type: 'new', text: "Contrainte d'unicité d'email insensible à la casse." },
      { type: 'improved', text: 'Routing des invitations via hash URL pour compatibilité production.' },
      { type: 'fixed', text: "Correction du redirect après acceptation d'invitation." },
    ],
  },
  {
    version: '1.3.0',
    date: 'Mars 2026',
    tag: 'Majeure',
    tagColor: '#C7601D',
    description: 'Panneau Super Admin avec gestion multitenant et facturation.',
    changes: [
      { type: 'new', text: 'Super Admin Panel accessible sur /admin/*.' },
      { type: 'new', text: 'Impersonation de tenants avec audit log complet.' },
      { type: 'new', text: 'Interface de gestion de la facturation et des offres.' },
      { type: 'new', text: "Logs d'activité système en temps réel." },
      { type: 'infra', text: 'JWT super admin séparé avec secret distinct.' },
    ],
  },
  {
    version: '1.2.0',
    date: 'Février 2026',
    tag: 'Mineure',
    tagColor: '#344453',
    description: 'Module appels sortants et simulateur ROI.',
    changes: [
      { type: 'new', text: 'Appels sortants avec suivi du transcript en temps réel.' },
      { type: 'new', text: "Simulateur ROI interactif sur la page d'accueil." },
      { type: 'new', text: 'Module analytiques globaux et micro-analytiques.' },
      { type: 'improved', text: 'Interface de configuration du QA et des intents.' },
      { type: 'fixed', text: 'Stabilisation du streaming WebSocket Twilio Media Streams.' },
    ],
  },
  {
    version: '1.1.0',
    date: 'Janvier 2026',
    tag: 'Mineure',
    tagColor: '#344453',
    description: 'Migration vers Mistral AI et Gladia pour STT/TTS.',
    changes: [
      { type: 'new', text: 'Intégration Mistral AI pour LLM, TTS et STT (Offre B).' },
      { type: 'new', text: 'Intégration Gladia pour transcription streaming temps réel.' },
      { type: 'infra', text: "Suppression d'OpenAI et Deepgram du stack." },
      { type: 'improved', text: 'Réduction de la latence de transcription de ~40 %.' },
      { type: 'improved', text: 'Qualité des résumés auto-générés améliorée.' },
    ],
  },
  {
    version: '1.0.0',
    date: 'Novembre 2025',
    tag: 'Lancement',
    tagColor: '#2D9D78',
    description: 'Première version publique de Receptio.',
    changes: [
      { type: 'new', text: 'Offre A : répondeur téléphonique intelligent.' },
      { type: 'new', text: 'Offre B : répondeur IA avec transcription et résumés.' },
      { type: 'new', text: 'Dashboard : appels, staff, paramètres, monitoring.' },
      { type: 'new', text: 'Authentification JWT multi-tenant.' },
      { type: 'new', text: 'Support Twilio pour la téléphonie (webhooks + Media Streams).' },
    ],
  },
];

const TYPE_CONFIG: Record<ChangeType, { icon: React.ReactNode; label: string; color: string }> = {
  new: {
    icon: <Sparkles size={12} />,
    label: 'Nouveau',
    color: '#2D9D78',
  },
  improved: {
    icon: <Zap size={12} />,
    label: 'Amélioré',
    color: '#C7601D',
  },
  fixed: {
    icon: <CheckCircle2 size={12} />,
    label: 'Corrigé',
    color: '#344453',
  },
  infra: {
    icon: <Wrench size={12} />,
    label: 'Infra',
    color: '#E6A817',
  },
};

function ChangeItem({ change }: { change: Change }) {
  const cfg = TYPE_CONFIG[change.type];
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono shrink-0"
        style={{ background: cfg.color + '18', color: cfg.color }}
      >
        {cfg.icon}
        {cfg.label}
      </span>
      <span className="font-body text-white/45 text-sm leading-relaxed">{change.text}</span>
    </li>
  );
}

export default function Changelog() {
  return (
    <StaticPageLayout
      badge="Changelog"
      title="Historique des versions"
      subtitle="Toutes les nouveautés, améliorations et corrections, version par version."
    >
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/8 hidden sm:block" />

        <div className="space-y-12">
          {RELEASES.map((release, i) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="sm:pl-10 relative"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[#0B1520] hidden sm:block"
                style={{ background: release.tagColor || '#344453' }}
              />

              <div className="bg-white/3 border border-white/8 rounded-3xl p-7">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-mono text-white font-bold text-lg">v{release.version}</span>
                  {release.tag && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-mono tracking-widest"
                      style={{
                        background: (release.tagColor || '#344453') + '18',
                        color: release.tagColor || '#344453',
                      }}
                    >
                      {release.tag}
                    </span>
                  )}
                  <span className="font-mono text-xs text-white/25 tracking-widest ml-auto">
                    {release.date}
                  </span>
                </div>

                {release.description && (
                  <p className="font-body text-white/40 text-sm mb-5">{release.description}</p>
                )}

                <ul className="space-y-3">
                  {release.changes.map((change, j) => (
                    <ChangeItem key={j} change={change} />
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </StaticPageLayout>
  );
}
