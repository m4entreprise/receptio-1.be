import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shuffle, Mic, Mail, MessageSquare, CalendarDays,
  Leaf, GitBranch, BarChart2, TrendingUp,
  Sparkles, PhoneCall, Clock, X
} from 'lucide-react';

const moduleList = [
  { key: 'smart_routing', Icon: Shuffle },
  { key: 'recording', Icon: Mic },
  { key: 'email_summary', Icon: Mail },
  { key: 'sms_summary', Icon: MessageSquare },
  { key: 'appointments', Icon: CalendarDays },
  { key: 'green', Icon: Leaf },
  { key: 'manual_routing', Icon: GitBranch },
  { key: 'analytics_global', Icon: BarChart2 },
  { key: 'analytics_micro', Icon: TrendingUp },
];

function ModuleCard({ moduleKey, Icon }: { moduleKey: string; Icon: React.ElementType }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-full flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-[#344453]/20 hover:bg-white transition-all duration-200 group text-left"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-[#344453]/20 transition-colors">
          <Icon size={16} strokeWidth={1.8} className="text-[#344453]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-title font-semibold text-sm text-[#0B1520]">
            {t(`features.module_${moduleKey}`)}
          </p>
          <p className="font-body text-xs text-gray-400 mt-0.5 line-clamp-1">
            {t(`features.module_${moduleKey}_desc`)}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl p-4"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#344453]/8 flex items-center justify-center flex-shrink-0">
                <Icon size={15} strokeWidth={1.8} className="text-[#344453]" />
              </div>
              <div>
                <p className="font-title font-bold text-sm text-[#0B1520] mb-1">
                  {t(`features.module_${moduleKey}`)}
                </p>
                <p className="font-body text-xs text-gray-500 leading-relaxed">
                  {t(`features.module_${moduleKey}_desc`)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="ml-auto flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-28 lg:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C7601D]/20 bg-[#C7601D]/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C7601D]" />
            <span className="text-xs font-mono tracking-widest text-[#C7601D]/80 uppercase">{t('features.badge')}</span>
          </div>
          <h2 className="font-title font-black text-[#0B1520] leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            {t('features.title')}<br />
            <span className="text-[#344453]">{t('features.title2')}</span>
          </h2>
          <p className="font-body text-gray-500 text-lg leading-relaxed">{t('features.subtitle')}</p>
        </motion.div>

        {/* Core offers */}
        <div className="grid lg:grid-cols-2 gap-6 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border border-[#344453]/15 bg-gradient-to-br from-[#344453]/5 to-transparent p-8 group hover:border-[#344453]/30 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#344453]/10 flex items-center justify-center">
                <PhoneCall size={22} strokeWidth={1.8} className="text-[#344453]" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono tracking-wide bg-green-50 text-green-600 border border-green-100">
                {t('features.core_a_badge')}
              </span>
            </div>
            <h3 className="font-title font-bold text-[#0B1520] text-xl mb-2">{t('features.core_a_name')}</h3>
            <p className="font-body text-gray-500 text-sm leading-relaxed">{t('features.core_a_desc')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative rounded-3xl border border-[#C7601D]/20 bg-gradient-to-br from-[#C7601D]/5 to-transparent p-8 group hover:border-[#C7601D]/35 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#C7601D]/10 flex items-center justify-center">
                <Sparkles size={22} strokeWidth={1.8} className="text-[#C7601D]" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono tracking-wide bg-orange-50 text-[#C7601D] border border-[#C7601D]/15">
                {t('features.core_b_badge')}
              </span>
            </div>
            <h3 className="font-title font-bold text-[#0B1520] text-xl mb-2">{t('features.core_b_name')}</h3>
            <p className="font-body text-gray-500 text-sm leading-relaxed">{t('features.core_b_desc')}</p>
          </motion.div>
        </div>

        {/* Modules grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Clock size={16} strokeWidth={1.8} className="text-gray-400" />
            <h3 className="font-title font-semibold text-[#0B1520] text-lg">{t('features.modules_title')}</h3>
            <span className="h-px flex-1 bg-gray-100" />
          </div>
          <p className="font-body text-gray-400 text-sm mb-8">{t('features.modules_hint')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moduleList.map(({ key, Icon }) => (
              <ModuleCard key={key} moduleKey={key} Icon={Icon} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
