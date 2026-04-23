import { motion } from 'framer-motion';
import { Phone, Brain, Shield, Globe } from 'lucide-react';
import StaticPageLayout from '../components/landing/StaticPageLayout';

const VALUES = [
  {
    icon: <Phone size={20} />,
    color: '#C7601D',
    title: "L'humain d'abord",
    body: "L'IA doit amplifier l'humain, pas le remplacer. Chaque fonctionnalité de Receptio est pensée pour libérer du temps, pas pour déshumaniser la relation client.",
  },
  {
    icon: <Brain size={20} />,
    color: '#2D9D78',
    title: 'Simplicité radicale',
    body: "Les PME n'ont pas de DSI. Receptio s'installe en moins de 10 minutes, sans code, sans intégration complexe. La complexité est notre problème, pas le vôtre.",
  },
  {
    icon: <Shield size={20} />,
    color: '#344453',
    title: 'Confiance & transparence',
    body: "Vos données vous appartiennent. Nous ne les vendons pas, nous ne les utilisons pas pour entraîner des modèles sans votre consentement. Et nous hébergeons en Europe.",
  },
  {
    icon: <Globe size={20} />,
    color: '#E6A817',
    title: 'Accessibilité',
    body: 'Un réceptionniste IA performant ne devrait pas être réservé aux grandes entreprises. Receptio est conçu pour être abordable dès la première PME.',
  },
];

const TIMELINE = [
  {
    year: '2024',
    title: "L'idée naît",
    body: "Après avoir observé des dizaines de PME perdre des clients faute de réponse téléphonique, les fondateurs de Receptio décident de construire la solution qu'ils auraient voulu avoir.",
  },
  {
    year: 'T1 2025',
    title: 'Développement & premiers bêta-testeurs',
    body: 'Premiers prototypes avec Twilio et un modèle STT maison. 12 entreprises partenaires testent la v0 en conditions réelles : cabinets médicaux, garages, hôtels.',
  },
  {
    year: 'T3 2025',
    title: 'Migration vers Mistral & Gladia',
    body: 'Après des tests comparatifs approfondis, le stack IA est migré vers Mistral AI et Gladia. Résultat : latence divisée par 2, qualité de transcription en hausse de 35 %.',
  },
  {
    year: 'Nov. 2025',
    title: 'Lancement public v1.0',
    body: "Receptio.eu ouvre ses portes au public avec deux offres et un modèle modulaire. Premier millier d'appels traités dans les 72 heures suivant le lancement.",
  },
  {
    year: '2026',
    title: 'Expansion & nouvelles fonctionnalités',
    body: "Lancement du Super Admin Panel, des modules analytiques avancés, de la gestion d'équipe et du support trilingue FR/EN/NL. La feuille de route s'enrichit.",
  },
];

export default function About() {
  return (
    <StaticPageLayout
      badge="À propos"
      title="Receptio, le lien entre votre entreprise et le monde."
      subtitle="Nous croyons que chaque appel manqué est une opportunité perdue. Notre mission : s'assurer que plus aucune PME ne rate un client faute de réponse."
    >
      {/* Mission */}
      <section className="mb-16">
        <div className="bg-gradient-to-br from-white/5 to-white/2 border border-white/10 rounded-3xl p-8 lg:p-10">
          <p className="font-title font-bold text-white/80 text-xl lg:text-2xl leading-relaxed">
            "Nous avons construit Receptio parce que nous avons vu trop de petits entrepreneurs perdre
            des clients simplement parce qu'ils ne pouvaient pas répondre au téléphone. Le problème n'est
            pas le manque de volonté — c'est le manque de ressources."
          </p>
          <p className="font-body text-white/30 text-sm mt-6">— Les fondateurs de Receptio</p>
        </div>
      </section>

      {/* Values */}
      <section className="mb-16">
        <h2 className="font-title font-bold text-white text-2xl mb-8">Nos valeurs</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {VALUES.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/3 border border-white/8 rounded-3xl p-6"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: v.color + '18', color: v.color }}
              >
                {v.icon}
              </div>
              <h3 className="font-title font-bold text-white text-base mb-2">{v.title}</h3>
              <p className="font-body text-white/40 text-sm leading-relaxed">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-16">
        <h2 className="font-title font-bold text-white text-2xl mb-8">Notre histoire</h2>
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/8 hidden sm:block" />
          <div className="space-y-8">
            {TIMELINE.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="sm:pl-12 relative"
              >
                <div className="absolute left-0 top-1.5 w-[10px] h-[10px] rounded-full bg-[#C7601D] border-2 border-[#0B1520] hidden sm:block" />
                <div>
                  <span className="font-mono text-xs tracking-widest text-[#C7601D]/70 uppercase">
                    {item.year}
                  </span>
                  <h3 className="font-title font-bold text-white text-base mt-1 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="font-body text-white/40 text-sm leading-relaxed">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '10k+', label: 'Appels traités' },
            { value: '3', label: 'Langues supportées' },
            { value: '< 300ms', label: 'Latence transcription' },
            { value: '99.5%', label: 'SLA cible' },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white/3 border border-white/8 rounded-2xl p-5 text-center"
            >
              <p className="font-title font-black text-white text-2xl">{stat.value}</p>
              <p className="font-body text-white/30 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section>
        <div className="bg-white/2 border border-white/8 rounded-3xl p-8 text-center">
          <h2 className="font-title font-bold text-white text-xl mb-3">Une question ?</h2>
          <p className="font-body text-white/35 text-sm mb-5">
            {"L'équipe Receptio est disponible pour répondre à vos questions."}
          </p>
          <a
            href="mailto:hello@receptio.eu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-sm hover:bg-[#b5551a] transition-colors"
          >
            Nous contacter
          </a>
        </div>
      </section>
    </StaticPageLayout>
  );
}
