import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Zap, Shuffle, Mic, Mail, MessageSquare,
  CalendarDays, Leaf, GitBranch, BarChart2, TrendingUp,
  Info, PhoneIncoming, PhoneOutgoing
} from 'lucide-react';

const MODULE_LIST = [
  { id: 'smart_routing', Icon: Shuffle },
  { id: 'recording', Icon: Mic },
  { id: 'email_summary', Icon: Mail },
  { id: 'sms_summary', Icon: MessageSquare },
  { id: 'appointments', Icon: CalendarDays },
  { id: 'green', Icon: Leaf },
  { id: 'manual_routing', Icon: GitBranch },
  { id: 'analytics_global', Icon: BarChart2 },
  { id: 'analytics_micro', Icon: TrendingUp },
];

const INBOUND_COST = 0.10;
const OUTBOUND_COST_PER_MIN = 0.20;

function VariableCostEstimator() {
  const { t } = useTranslation();
  const [inboundCalls, setInboundCalls] = useState(100);
  const [outboundCalls, setOutboundCalls] = useState(30);
  const [avgDuration, setAvgDuration] = useState(5);

  const { inboundTotal, outboundTotal, total } = useMemo(() => {
    const inboundTotal = inboundCalls * INBOUND_COST;
    const outboundTotal = outboundCalls * avgDuration * OUTBOUND_COST_PER_MIN;
    return { inboundTotal, outboundTotal, total: inboundTotal + outboundTotal };
  }, [inboundCalls, outboundCalls, avgDuration]);

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mt-8 p-6 rounded-2xl bg-[#F8F9FB] border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Info size={14} className="text-[#344453]/60" />
        <h4 className="font-title font-semibold text-sm text-[#0B1520]">{t('pricing.variable_title')}</h4>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        {/* Appels entrants */}
        <div>
          <label className="flex items-center gap-1.5 font-body text-xs text-gray-500 mb-2">
            <PhoneIncoming size={12} className="text-[#344453]" />
            {t('pricing.inbound_calls_label')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={10000}
              value={inboundCalls}
              onChange={(e) => setInboundCalls(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-mono text-sm text-[#0B1520] focus:outline-none focus:border-[#344453]/40"
            />
          </div>
          <p className="font-mono text-xs text-gray-400 mt-1">× {INBOUND_COST.toFixed(2)}€/appel</p>
        </div>

        {/* Appels sortants */}
        <div>
          <label className="flex items-center gap-1.5 font-body text-xs text-gray-500 mb-2">
            <PhoneOutgoing size={12} className="text-[#C7601D]" />
            {t('pricing.outbound_calls_label')}
          </label>
          <input
            type="number"
            min={0}
            max={10000}
            value={outboundCalls}
            onChange={(e) => setOutboundCalls(Math.max(0, Number(e.target.value)))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-mono text-sm text-[#0B1520] focus:outline-none focus:border-[#344453]/40"
          />
          <p className="font-mono text-xs text-gray-400 mt-1">× {OUTBOUND_COST_PER_MIN.toFixed(2)}€/min</p>
        </div>

        {/* Durée moyenne */}
        <div>
          <label className="font-body text-xs text-gray-500 mb-2 block">{t('pricing.avg_duration_label')}</label>
          <input
            type="number"
            min={1}
            max={60}
            value={avgDuration}
            onChange={(e) => setAvgDuration(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-mono text-sm text-[#0B1520] focus:outline-none focus:border-[#344453]/40"
          />
          <p className="font-mono text-xs text-gray-400 mt-1">minutes</p>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-body text-xs text-gray-400 mb-0.5">{t('pricing.inbound_total')}</p>
          <p className="font-mono font-semibold text-sm text-[#344453]">{fmt(inboundTotal)}</p>
        </div>
        <div>
          <p className="font-body text-xs text-gray-400 mb-0.5">{t('pricing.outbound_total')}</p>
          <p className="font-mono font-semibold text-sm text-[#C7601D]">{fmt(outboundTotal)}</p>
        </div>
        <div>
          <p className="font-body text-xs text-gray-400 mb-0.5">{t('pricing.variable_total')}</p>
          <p className="font-mono font-bold text-base text-[#0B1520]">{fmt(total)}</p>
        </div>
      </div>

      <p className="font-body text-xs text-gray-400 mt-3 text-center">{t('pricing.variable_note')}</p>
    </div>
  );
}

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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
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
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
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
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative bg-gradient-to-br from-[#0B1520] to-[#1a2a38] rounded-3xl border border-white/10 p-8 overflow-hidden"
          >
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 text-xs font-mono rounded-full bg-[#C7601D]/15 text-[#C7601D] border border-[#C7601D]/20">
                {t('pricing.coming_soon')}
              </span>
            </div>
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

        {/* Coûts variables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl border border-gray-200 p-8 mb-6"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#344453]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Info size={14} strokeWidth={1.8} className="text-[#344453]" />
            </div>
            <div>
              <h3 className="font-title font-bold text-[#0B1520] text-lg">{t('pricing.variable_section_title')}</h3>
              <p className="font-body text-gray-400 text-sm mt-1">{t('pricing.variable_section_subtitle')}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#344453]/4 border border-[#344453]/10">
              <PhoneIncoming size={16} className="text-[#344453] flex-shrink-0" />
              <div>
                <p className="font-body text-xs text-gray-500">{t('pricing.inbound_rate_label')}</p>
                <p className="font-mono font-bold text-[#344453] text-lg">{INBOUND_COST.toFixed(2)}€ <span className="text-sm font-normal text-gray-400">{t('pricing.per_call')}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#C7601D]/4 border border-[#C7601D]/10">
              <PhoneOutgoing size={16} className="text-[#C7601D] flex-shrink-0" />
              <div>
                <p className="font-body text-xs text-gray-500">{t('pricing.outbound_rate_label')}</p>
                <p className="font-mono font-bold text-[#C7601D] text-lg">{OUTBOUND_COST_PER_MIN.toFixed(2)}€ <span className="text-sm font-normal text-gray-400">{t('pricing.per_minute')}</span></p>
              </div>
            </div>
          </div>

          <VariableCostEstimator />
        </motion.div>

        {/* Modules picker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
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
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_LIST.map(({ id, Icon }) => {
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
                    <p className={`font-body text-xs leading-snug mt-0.5 line-clamp-1 ${active ? 'text-[#C7601D]/80' : 'text-gray-400'}`}>
                      {t(`features.module_${id}_desc`)}
                    </p>
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
                  {t('pricing.from')} 49€<span className="text-sm font-body font-normal text-gray-400">/mois</span>
                </p>
                <p className="font-body text-xs text-gray-400 mt-0.5">{t('pricing.modules_price_note')}</p>
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
