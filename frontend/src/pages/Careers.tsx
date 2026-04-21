import { motion } from 'framer-motion';
import { MapPin, Clock, ArrowRight } from 'lucide-react';
import StaticPageLayout from '../components/landing/StaticPageLayout';

interface Job {
  title: string;
  team: string;
  location: string;
  type: string;
  description: string;
  tags: string[];
}

const JOBS: Job[] = [
  {
    title: "Ingénieur(e) Full-Stack",
    team: 'Produit',
    location: 'Remote (Europe)',
    type: 'CDI',
    description:
      "Vous travaillerez sur l'ensemble du stack : React/TypeScript côté frontend, Express/Node.js côté backend, avec un focus sur la performance et la fiabilité des flux temps réel (WebSocket, streaming audio).",
    tags: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'WebSocket'],
  },
  {
    title: 'ML Engineer – Speech & NLP',
    team: 'IA',
    location: 'Remote (Europe)',
    type: 'CDI',
    description:
      "Vous serez responsable de l'amélioration continue de notre pipeline IA : intégration de nouveaux modèles STT/TTS, fine-tuning des prompts Mistral, évaluation de la qualité des transcriptions et résumés.",
    tags: ['Python', 'Mistral', 'Gladia', 'LLM', 'Audio Processing'],
  },
  {
    title: 'Customer Success Manager',
    team: 'Commercial',
    location: 'Paris ou Remote',
    type: 'CDI',
    description:
      "En charge de l'onboarding et du suivi des clients PME, vous serez leur interlocuteur principal. Vous collecterez les retours terrain pour alimenter la roadmap produit.",
    tags: ['SaaS', 'PME', 'Onboarding', 'CRM'],
  },
];

const PERKS = [
  { emoji: '🌍', title: 'Remote-first', body: "Travaillez depuis n'importe où en Europe." },
  { emoji: '📈', title: 'Équité', body: "BSPCE pour tous les membres de l'équipe." },
  { emoji: '🧪', title: 'Ownership', body: 'Chacun possède sa zone de responsabilité.' },
  { emoji: '⚡', title: 'Vitesse', body: 'On ship vite, on itère encore plus vite.' },
  { emoji: '📚', title: 'Formation', body: 'Budget formation annuel de 2 000 € par personne.' },
  { emoji: '🤝', title: 'Transparence', body: 'Salaires, finances, roadmap : tout est partagé.' },
];

function JobCard({ job, index }: { job: Job; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group bg-white/3 hover:bg-white/5 border border-white/8 hover:border-white/15 rounded-3xl p-7 transition-all duration-300"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-title font-bold text-white text-lg group-hover:text-white/90 transition-colors">
            {job.title}
          </h3>
          <p className="font-mono text-xs text-[#C7601D]/70 tracking-widest uppercase mt-0.5">
            {job.team}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 text-white/30 text-xs font-body">
            <MapPin size={11} />
            {job.location}
          </div>
          <div className="flex items-center gap-1.5 text-white/30 text-xs font-body">
            <Clock size={11} />
            {job.type}
          </div>
        </div>
      </div>

      <p className="font-body text-white/40 text-sm leading-relaxed mb-5">{job.description}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {job.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-white/5 text-white/35"
            >
              {tag}
            </span>
          ))}
        </div>
        <a
          href={`mailto:jobs@receptio.eu?subject=Candidature — ${job.title}`}
          className="flex items-center gap-1.5 text-[#C7601D] text-sm font-body font-medium hover:gap-2.5 transition-all"
        >
          Postuler
          <ArrowRight size={13} />
        </a>
      </div>
    </motion.div>
  );
}

export default function Careers() {
  return (
    <StaticPageLayout
      badge="Carrières"
      title="Rejoignez Receptio."
      subtitle="Nous construisons l'avenir de la réception téléphonique pour les PME européennes. Si vous voulez avoir un impact concret et rapide, vous êtes au bon endroit."
    >
      {/* Perks */}
      <section className="mb-14">
        <h2 className="font-title font-bold text-white text-xl mb-6">Pourquoi nous rejoindre ?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {PERKS.map((perk, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/3 border border-white/8 rounded-2xl p-5"
            >
              <div className="text-2xl mb-2">{perk.emoji}</div>
              <h3 className="font-title font-semibold text-white text-sm mb-1">{perk.title}</h3>
              <p className="font-body text-white/35 text-xs leading-relaxed">{perk.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Open positions */}
      <section className="mb-14">
        <h2 className="font-title font-bold text-white text-xl mb-6">
          Postes ouverts{' '}
          <span className="font-mono text-sm text-white/25 ml-2">{JOBS.length} positions</span>
        </h2>
        <div className="space-y-5">
          {JOBS.map((job, i) => (
            <JobCard key={i} job={job} index={i} />
          ))}
        </div>
      </section>

      {/* Spontaneous */}
      <section>
        <div className="bg-gradient-to-br from-[#C7601D]/10 to-transparent border border-[#C7601D]/20 rounded-3xl p-8">
          <h2 className="font-title font-bold text-white text-xl mb-3">
            Vous ne voyez pas votre profil ?
          </h2>
          <p className="font-body text-white/40 text-sm leading-relaxed mb-5">
            Nous sommes toujours à la recherche de personnes exceptionnelles. Envoyez-nous une
            candidature spontanée en décrivant ce que vous apporteriez à l'équipe.
          </p>
          <a
            href="mailto:jobs@receptio.eu?subject=Candidature spontanée"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-sm hover:bg-[#b5551a] transition-colors"
          >
            Candidature spontanée
            <ArrowRight size={14} />
          </a>
        </div>
      </section>
    </StaticPageLayout>
  );
}
