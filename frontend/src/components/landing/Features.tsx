import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Shuffle, Mic, Mail, MessageSquare, CalendarDays,
  Leaf, GitBranch, BarChart2, TrendingUp,
  Sparkles, PhoneCall, Clock
} from 'lucide-react';

const moduleList = [
  { key: 'smart_routing', Icon: Shuffle, price: 9 },
  { key: 'recording', Icon: Mic, price: 9 },
  { key: 'email_summary', Icon: Mail, price: 12 },
  { key: 'sms_summary', Icon: MessageSquare, price: 12 },
  { key: 'appointments', Icon: CalendarDays, price: 19 },
  { key: 'green', Icon: Leaf, price: 9 },
  { key: 'manual_routing', Icon: GitBranch, price: 9 },
  { key: 'analytics_global', Icon: BarChart2, price: 15 },
  { key: 'analytics_micro', Icon: TrendingUp, price: 29 },
];

export default function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-28 lg:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
          {/* Core A */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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

          {/* Core B */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#C7601D]/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </motion.div>
        </div>

        {/* Modules grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Clock size={16} strokeWidth={1.8} className="text-gray-400" />
            <h3 className="font-title font-semibold text-[#0B1520] text-lg">{t('features.modules_title')}</h3>
            <span className="h-px flex-1 bg-gray-100" />
          </div>
          <p className="font-body text-gray-400 text-sm mb-8">{t('features.modules_subtitle')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moduleList.map(({ key, Icon, price }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-[#344453]/20 hover:bg-white transition-all duration-250 group"
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-[#344453]/20 transition-colors">
                  <Icon size={16} strokeWidth={1.8} className="text-[#344453]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-title font-semibold text-sm text-[#0B1520] truncate">
                      {t(`features.module_${key}`)}
                    </p>
                    <span className="font-mono text-xs text-[#C7601D] flex-shrink-0">+{price}€</span>
                  </div>
                  <p className="font-body text-xs text-gray-400 leading-relaxed line-clamp-2">
                    {t(`features.module_${key}_desc`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
