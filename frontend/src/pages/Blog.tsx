import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import StaticPageLayout from '../components/landing/StaticPageLayout';

interface Post {
  slug: string;
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  featured?: boolean;
}

const POSTS: Post[] = [
  {
    slug: 'ia-receptionniste-pme',
    tag: 'Guide',
    tagColor: '#2D9D78',
    title: 'Pourquoi les PME adoptent un réceptionniste IA en 2026',
    excerpt:
      "Les appels manqués coûtent en moyenne 15 % du chiffre d'affaires aux petites entreprises. Découvrez comment l'IA transforme la gestion des appels sans remplacer l'humain.",
    author: 'Équipe Receptio',
    date: 'Avril 2026',
    readTime: '6 min',
    featured: true,
  },
  {
    slug: 'transcription-temps-reel',
    tag: 'Produit',
    tagColor: '#C7601D',
    title: 'La transcription en temps réel : comment ça marche chez Receptio',
    excerpt:
      "De Twilio Media Streams à Gladia, en passant par notre pipeline de post-traitement Mistral, voici l'architecture qui permet une transcription fidèle en moins de 300 ms.",
    author: 'Équipe Technique',
    date: 'Mars 2026',
    readTime: '8 min',
  },
  {
    slug: 'calculer-roi-receptionniste',
    tag: 'Business',
    tagColor: '#344453',
    title: "Comment calculer le ROI d'un réceptionniste IA pour votre activité",
    excerpt:
      "Charges patronales, coût de formation, arrêts maladie, appels hors horaires… Le vrai coût d'un réceptionniste humain est souvent sous-estimé. Notre méthode de calcul.",
    author: 'Équipe Receptio',
    date: 'Février 2026',
    readTime: '5 min',
  },
  {
    slug: 'offre-modules-receptio',
    tag: 'Produit',
    tagColor: '#C7601D',
    title: 'Modules Receptio : construisez votre stack sur-mesure',
    excerpt:
      "Routage intelligent, résumés SMS, prise de rendez-vous… Découvrez comment composer votre abonnement module par module selon vos besoins réels.",
    author: 'Équipe Produit',
    date: 'Janvier 2026',
    readTime: '4 min',
  },
  {
    slug: 'rgpd-enregistrements-appels',
    tag: 'Légal',
    tagColor: '#E6A817',
    title: "Enregistrement d'appels et RGPD : ce que vous devez savoir",
    excerpt:
      "Obligations d'information, durées de conservation, droits des appelants… Un guide pratique pour utiliser les enregistrements d'appels en conformité avec le RGPD.",
    author: 'Équipe Receptio',
    date: 'Décembre 2025',
    readTime: '7 min',
  },
  {
    slug: 'secteurs-receptio',
    tag: 'Use Cases',
    tagColor: '#2D9D78',
    title: 'Receptio dans 5 secteurs : cabinet médical, garage, hôtel, artisan, agence',
    excerpt:
      "Chaque secteur a ses contraintes. Voici comment Receptio s'adapte concrètement aux flux d'appels d'un cabinet médical de 3 praticiens, d'un garage automobile…",
    author: 'Équipe Receptio',
    date: 'Novembre 2025',
    readTime: '10 min',
  },
];

function PostCard({ post, index }: { post: Post; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group bg-white/3 hover:bg-white/5 border border-white/8 hover:border-white/15 rounded-3xl p-7 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <span
          className="px-3 py-1 rounded-full text-xs font-mono tracking-widest"
          style={{ background: post.tagColor + '18', color: post.tagColor }}
        >
          {post.tag}
        </span>
        <div className="flex items-center gap-1.5 text-white/20 text-xs font-mono">
          <Clock size={11} />
          {post.readTime}
        </div>
      </div>

      <h3 className="font-title font-bold text-white text-lg leading-snug mb-3 group-hover:text-white/90 transition-colors">
        {post.title}
      </h3>
      <p className="font-body text-white/35 text-sm leading-relaxed mb-5 line-clamp-3">
        {post.excerpt}
      </p>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-white/40 text-xs">{post.author}</p>
          <p className="font-mono text-white/20 text-xs">{post.date}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[#C7601D] text-xs font-body font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Lire
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </motion.article>
  );
}

export default function Blog() {
  const [featured, ...rest] = POSTS;

  return (
    <StaticPageLayout
      badge="Blog"
      title="Ressources & Insights"
      subtitle="Guides pratiques, coulisses produit et bonnes pratiques pour tirer le meilleur de votre réceptionniste IA."
    >
      {/* Featured post */}
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="group bg-gradient-to-br from-white/5 to-white/2 border border-white/10 hover:border-white/20 rounded-3xl p-8 mb-10 transition-all duration-300 cursor-pointer"
      >
        <div className="flex items-center gap-3 mb-5">
          <span
            className="px-3 py-1 rounded-full text-xs font-mono tracking-widest"
            style={{ background: featured.tagColor + '18', color: featured.tagColor }}
          >
            {featured.tag}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono tracking-widest bg-[#C7601D]/15 text-[#C7601D]">
            À la une
          </span>
        </div>
        <h2 className="font-title font-black text-white text-2xl lg:text-3xl leading-tight mb-4 group-hover:text-white/90 transition-colors">
          {featured.title}
        </h2>
        <p className="font-body text-white/40 leading-relaxed mb-6 max-w-2xl">{featured.excerpt}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="font-body text-white/35 text-sm">{featured.author} · {featured.date}</p>
            <div className="flex items-center gap-1.5 text-white/20 text-xs font-mono">
              <Clock size={11} />
              {featured.readTime}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[#C7601D] text-sm font-body font-medium">
            {"Lire l'article"}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </motion.article>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 gap-5">
        {rest.map((post, i) => (
          <PostCard key={post.slug} post={post} index={i} />
        ))}
      </div>

      {/* Coming soon */}
      <div className="mt-16 text-center py-12 border border-white/6 rounded-3xl bg-white/2">
        <p className="font-mono text-xs tracking-widest text-white/20 uppercase mb-2">À venir</p>
        <p className="font-title font-semibold text-white/30 text-lg">
          Plus d'articles en cours de rédaction
        </p>
        <p className="font-body text-white/20 text-sm mt-2">
          {"Inscrivez-vous pour être notifié : "}
          <a href="mailto:hello@receptio.eu" className="text-[#C7601D]/60 hover:text-[#C7601D] transition-colors">
            hello@receptio.eu
          </a>
        </p>
      </div>
    </StaticPageLayout>
  );
}
