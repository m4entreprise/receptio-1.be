import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Zap, Shuffle, Mic, Mail, MessageSquare,
  CalendarDays, Leaf, GitBranch, BarChart2, TrendingUp
} from 'lucide-react';

const MODULE_LIST = [
  { id: 'smart_routing', Icon: Shuffle, price: 9 },
  { id: 'recording', Icon: Mic, price: 9 },
  { id: 'email_summary', Icon: Mail, price: 12 },
  { id: 'sms_summary', Icon: MessageSquare, price: 12 },
  { id: 'appointments', Icon: CalendarDays, price: 19 },
  { id: 'green', Icon: Leaf, price: 9 },
  { id: 'manual_routing', Icon: GitBranch, price: 9 },
  { id: 'analytics_global', Icon: BarChart2, price: 15 },
  { id: 'analytics_micro', Icon: TrendingUp, price: 29 },
];

export default function Pricing() {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const modulesTotal = MODULE_LIST.filter((m) => selected.has(m.id)).reduce((acc, m) => acc + m.price, 0);
  const coreAPrice = annual ? Number(t('pricing.core_a_price_annual')) : Number(t('pricing.core_a_price'));
  const coreBPrice = annual ? Number(t('pricing.core_b_price_annual')) : Number(t('pricing.core_b_price'));
  const period = annual ? t('pricing.per_year') : t('pricing.per_month');

  const featA = [1, 2, 3, 4, 5].map((n) => t(`pricing.core_a_feat${n}`));
  const featB = [1, 2, 3, 4, 5].map((n) => t(`pricing.core_b_feat${n}`));

  return (
    <section id="pricing" className="py-28 lg:py-36 bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-5"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#344453]/15 bg-[#344453]/5 mb-5">
            <Zap size={12} strokeWidth={1.8} className="text-[#344453]/60" />
            <span className="text-xs font-mono tracking-widest text-[#344453]/60 uppercase">{t('pricing.badge')}</span>
          </div>
          <h2 className="font-title font-black text-[#0B1520] leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            {t('pricing.title')}<br />
            <span className="text-[#344453]">{t('pricing.title2')}</span>
          </h2>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center gap-4 mb-14"
        >
          <button
            onClick={() => setAnnual(false)}
            className={`font-body text-sm font-medium transition-colors ${!annual ? 'text-[#0B1520]' : 'text-gray-400'}`}
          >
            {t('pricing.monthly')}
          </button>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-[#C7601D]' : 'bg-gray-200'}`}
          >
            <motion.div
              animate={{ x: annual ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`font-body text-sm font-medium transition-colors flex items-center gap-2 ${annual ? 'text-[#0B1520]' : 'text-gray-400'}`}
          >
            {t('pricing.annual')}
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-[#C7601D]/10 text-[#C7601D]">
              {t('pricing.annual_save')}
            </span>
          </button>
        </motion.div>

        {/* Core cards */}
        <div className="grid lg:grid-cols-2 gap-6 mb-14">
          {/* Core A */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-3xl border border-gray-200 p-8 hover:border-[#344453]/30 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="font-title font-bold text-[#0B1520] text-lg mb-1">{t('pricing.core_a_name')}</p>
                <div className="flex items-end gap-1.5">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={coreAPrice}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="font-title font-black text-[#0B1520] text-4xl"
                    >
                      {coreAPrice}€
                    </motion.span>
                  </AnimatePresence>
                  <span className="font-body text-gray-400 text-sm mb-1.5">{period}</span>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-mono rounded-full bg-green-50 text-green-600 border border-green-100">
                {t('features.core_a_badge')}
              </span>
            </div>
            <ul className="space-y-3 mb-8">
              {featA.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-body text-gray-600">
                  <Check size={14} strokeWidth={2.5} className="text-[#344453] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="block w-full text-center py-3 rounded-2xl bg-[#344453] text-white font-body font-semibold text-sm hover:bg-[#2a3844] transition-colors"
            >
              {t('pricing.cta_start')}
            </Link>
          </motion.div>

          {/* Core B */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="relative bg-gradient-to-br from-[#0B1520] to-[#1a2a38] rounded-3xl border border-white/10 p-8 overflow-hidden"
          >
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 text-xs font-mono rounded-full bg-[#C7601D]/15 text-[#C7601D] border border-[#C7601D]/20">
                {t('pricing.coming_soon')}
              </span>
            </div>
            {/* Glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#C7601D]/10 blur-3xl pointer-events-none" />

            <div className="relative mb-6">
              <p className="font-title font-bold text-white text-lg mb-1">{t('pricing.core_b_name')}</p>
              <div className="flex items-end gap-1.5">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={coreBPrice}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="font-title font-black text-white text-4xl"
                  >
                    {coreBPrice}€
                  </motion.span>
                </AnimatePresence>
                <span className="font-body text-white/40 text-sm mb-1.5">{period}</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 relative">
              {featB.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-body text-white/60">
                  <Check size={14} strokeWidth={2.5} className="text-[#C7601D] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button className="relative w-full py-3 rounded-2xl bg-white/8 border border-white/12 text-white/50 font-body font-semibold text-sm cursor-default">
              {t('pricing.cta_notify')}
            </button>
          </motion.div>
        </div>

        {/* Modules picker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-3xl border border-gray-200 p-8"
        >
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <h3 className="font-title font-bold text-[#0B1520] text-lg">{t('pricing.modules_title')}</h3>
              <p className="font-body text-gray-400 text-sm mt-1">{t('pricing.modules_subtitle')}</p>
            </div>
            {selected.size > 0 && (
              <div className="text-right">
                <p className="font-body text-xs text-gray-400">{selected.size} {t('pricing.modules_selected')}</p>
                <p className="font-mono font-bold text-[#C7601D] text-xl">+{modulesTotal}€<span className="text-sm font-body font-normal text-gray-400">/mois</span></p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_LIST.map(({ id, Icon, price }) => {
              const active = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                    active
                      ? 'border-[#C7601D]/40 bg-[#C7601D]/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    active ? 'bg-[#C7601D]/15' : 'bg-gray-100'
                  }`}>
                    <Icon size={14} strokeWidth={1.8} className={active ? 'text-[#C7601D]' : 'text-gray-500'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-title font-semibold text-xs truncate ${active ? 'text-[#0B1520]' : 'text-gray-600'}`}>
                      {t(`features.module_${id}`)}
                    </p>
                    <p className={`font-mono text-xs ${active ? 'text-[#C7601D]' : 'text-gray-400'}`}>+{price}€/mois</p>
                  </div>
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    active ? 'bg-[#C7601D] border-[#C7601D]' : 'border-gray-200'
                  }`}>
                    {active && <Check size={9} strokeWidth={3} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between"
            >
              <div>
                <p className="font-body text-xs text-gray-400">{t('pricing.total')}</p>
                <p className="font-mono font-black text-[#0B1520] text-2xl">
                  {49 + modulesTotal}€<span className="text-sm font-body font-normal text-gray-400">/mois</span>
                </p>
              </div>
              <Link
                to="/register"
                className="px-6 py-2.5 rounded-xl bg-[#C7601D] text-white font-body font-semibold text-sm hover:bg-[#b5551a] transition-colors"
              >
                {t('pricing.cta_start')}
              </Link>
            </motion.div>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-8 font-body text-sm text-gray-400 hover:text-[#344453] transition-colors cursor-pointer"
        >
          {t('pricing.contact_cta')}
        </motion.p>
      </div>
    </section>
  );
}
