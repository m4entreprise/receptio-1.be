import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Hash } from 'lucide-react';

interface FinalCTAProps {
  isAuthenticated: boolean;
}

export default function FinalCTA({ isAuthenticated }: FinalCTAProps) {
  const { t } = useTranslation();

  return (
    <section className="py-28 lg:py-40 bg-[#0B1520] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow-center pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#C7601D]/6 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#344453]/15 blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Decorative hash */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center">
              <Hash size={20} strokeWidth={1.5} className="text-white/20" />
            </div>
          </div>

          <h2 className="font-title font-black text-white leading-tight mb-5" style={{ fontSize: 'clamp(2.2rem, 5vw, 4.5rem)' }}>
            {t('cta.title')}<br />
            <span style={{
              background: 'linear-gradient(90deg, #ffffff 0%, #C7601D 70%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {t('cta.title2')}
            </span>
          </h2>

          <p className="font-body text-white/40 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            {t('cta.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-base transition-all hover:bg-[#b5551a] hover:shadow-[0_0_40px_rgba(199,96,29,0.5)] hover:scale-[1.02]"
              >
                {t('nav.dashboard')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-base transition-all hover:bg-[#b5551a] hover:shadow-[0_0_40px_rgba(199,96,29,0.5)] hover:scale-[1.02]"
                >
                  {t('cta.primary')}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#pricing"
                  className="px-8 py-4 rounded-2xl border border-white/12 text-white/60 font-body font-medium text-base transition-all hover:border-white/25 hover:text-white hover:bg-white/5"
                >
                  {t('cta.secondary')}
                </a>
              </>
            )}
          </div>
          <p className="text-xs font-body text-white/20">{t('cta.note')}</p>
        </motion.div>
      </div>
    </section>
  );
}
