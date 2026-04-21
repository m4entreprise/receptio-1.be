import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from './Navbar';
import Footer from './Footer';

interface StaticPageLayoutProps {
  badge: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export default function StaticPageLayout({
  badge,
  title,
  subtitle,
  lastUpdated,
  children,
}: StaticPageLayoutProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-[#0B1520] min-h-screen overflow-x-hidden">
      <Navbar isAuthenticated={isAuthenticated} />

      {/* Hero header */}
      <div className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0B1520] pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm font-body mb-8 mr-6"
            >
              <ArrowLeft size={14} />
              Retour à l'accueil
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C7601D]/25 bg-[#C7601D]/8 mb-5">
              <span className="text-xs font-mono tracking-widest text-[#C7601D]/80 uppercase">
                {badge}
              </span>
            </div>

            <h1
              className="font-title font-black text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
            >
              {title}
            </h1>

            {subtitle && (
              <p className="font-body text-white/40 text-lg leading-relaxed max-w-2xl">
                {subtitle}
              </p>
            )}

            {lastUpdated && (
              <p className="mt-4 font-mono text-xs text-white/20 tracking-widest uppercase">
                Dernière mise à jour · {lastUpdated}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32"
      >
        {children}
      </motion.div>

      <Footer />
    </div>
  );
}
