import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ArrowRight, Play, ChevronDown } from 'lucide-react';
import WebGLBackground from './WebGLBackground';

interface HeroProps {
  isAuthenticated: boolean;
}

const WAVEFORM_BARS = 40;

function WaveformViz() {
  const [bars, setBars] = useState(() => Array.from({ length: WAVEFORM_BARS }, () => 0.1));

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t += 0.08;
      setBars(Array.from({ length: WAVEFORM_BARS }, (_, i) => {
        const base = Math.sin(t + i * 0.35) * 0.3 + 0.35;
        const noise = Math.sin(t * 2.1 + i * 0.7) * 0.15;
        const spike = Math.sin(t * 0.5 + i * 0.12) * 0.2;
        return Math.max(0.04, Math.min(1, base + noise + spike));
      }));
    }, 40);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-[3px] h-12">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-75"
          style={{
            height: `${h * 100}%`,
            background: i % 7 === 0
              ? '#C7601D'
              : `rgba(255,255,255,${0.15 + h * 0.55})`,
          }}
        />
      ))}
    </div>
  );
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const lineVariant: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: 'easeOut' as const },
  },
};

export default function Hero({ isAuthenticated }: HeroProps) {
  const { t } = useTranslation();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 22 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 16);
      mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 10);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0B1520]"
    >
      <WebGLBackground />

      {/* Radial glow overlay */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B1520] pointer-events-none" />

      {/* Content */}
      <motion.div
        style={{ x: springX, y: springY }}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#C7601D]/30 bg-[#C7601D]/8 mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#C7601D] animate-pulse" />
          <span className="text-xs font-mono tracking-widest text-[#C7601D]/90 uppercase">
            {t('hero.badge')}
          </span>
        </motion.div>

        {/* Title */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="mb-8"
        >
          <motion.h1
            variants={lineVariant}
            className="font-title text-white/55 font-light leading-none tracking-tight"
            style={{ fontSize: 'clamp(2.4rem, 6.5vw, 5.5rem)' }}
          >
            {t('hero.line1')}
          </motion.h1>
          <motion.h1
            variants={lineVariant}
            className="font-title text-white font-black leading-none tracking-tight"
            style={{ fontSize: 'clamp(2.8rem, 8vw, 6.8rem)' }}
          >
            {t('hero.line2')}
          </motion.h1>
          <motion.h1
            variants={lineVariant}
            className="font-title leading-none tracking-tight font-light"
            style={{
              fontSize: 'clamp(2.4rem, 6.5vw, 5.5rem)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.55) 0%, #C7601D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('hero.line3')}
          </motion.h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/45 font-body text-lg lg:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
        >
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="group flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-base transition-all duration-300 hover:bg-[#b5551a] hover:shadow-[0_0_32px_rgba(199,96,29,0.5)] hover:scale-[1.02]"
            >
              {t('nav.dashboard')}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="group flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-base transition-all duration-300 hover:bg-[#b5551a] hover:shadow-[0_0_32px_rgba(199,96,29,0.5)] hover:scale-[1.02]"
              >
                {t('hero.cta_primary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#demo"
                className="group flex items-center gap-2.5 px-7 py-3.5 rounded-2xl border border-white/15 text-white/75 font-body font-medium text-base transition-all duration-300 hover:border-white/30 hover:text-white hover:bg-white/5 backdrop-blur-sm"
              >
                <Play size={14} className="text-[#C7601D]" />
                {t('hero.cta_secondary')}
              </a>
            </>
          )}
        </motion.div>

        {/* Waveform */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 1 }}
          className="flex justify-center"
        >
          <div className="relative px-6 py-4 rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B1520] border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C7601D] animate-pulse" />
              <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Live</span>
            </div>
            <WaveformViz />
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
      >
        <span className="text-xs font-mono text-white/25 tracking-widest uppercase">{t('hero.scroll')}</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <ChevronDown size={16} className="text-white/25" />
        </motion.div>
      </motion.div>
    </section>
  );
}
