import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingDown } from 'lucide-react';

// Coût employé dédié à la réception des appels
// Salaire brut mensuel moyen : 4 500€ → coût employeur ~6 300€/mois (charges ~40%)
const GROSS_SALARY = 4500;
const EMPLOYER_COST_FACTOR = 1.4;
const EMPLOYEE_MONTHLY_COST = Math.round(GROSS_SALARY * EMPLOYER_COST_FACTOR);
const WORKING_HOURS_PER_MONTH = 151.67; // 35h/semaine

const OFFERS = [
  { id: 'a', price: 49, label: 'Réceptionniste Intelligent — 49€/mois' },
  { id: 'b', price: 99, label: 'Réceptionniste IA — 99€/mois' },
] as const;

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-body text-sm text-white/60">{label}</label>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/6 border border-white/10">
          <span className="font-mono font-bold text-white text-base">{value}</span>
          <span className="font-mono text-white/35 text-xs">{unit}</span>
        </div>
      </div>
      <div className="relative h-1.5 bg-white/8 rounded-full">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#344453] to-[#C7601D] transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#C7601D] shadow-lg pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-xs font-mono text-white/20">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

export default function ROISimulator() {
  const { t } = useTranslation();
  const [callsPerDay, setCallsPerDay] = useState(30);
  const [avgDuration, setAvgDuration] = useState(7);
  const [offer, setOffer] = useState<'a' | 'b'>('a');

  const receptioCost = OFFERS.find((o) => o.id === offer)!.price;

  const { hoursPerMonth, fteNeeded, employeeCost, savings, annualSavings } = useMemo(() => {
    const WORKING_DAYS = 22;
    const monthlyMinutes = callsPerDay * WORKING_DAYS * avgDuration;
    const hoursPerMonth = monthlyMinutes / 60;
    // Fraction d'ETP consacré aux appels
    const fteNeeded = Math.min(1, hoursPerMonth / WORKING_HOURS_PER_MONTH);
    const employeeCost = Math.round(fteNeeded * EMPLOYEE_MONTHLY_COST);
    const savings = Math.max(0, employeeCost - receptioCost);
    return {
      hoursPerMonth: Math.round(hoursPerMonth * 10) / 10,
      fteNeeded: Math.round(fteNeeded * 100) / 100,
      employeeCost,
      savings,
      annualSavings: savings * 12,
    };
  }, [callsPerDay, avgDuration, receptioCost]);

  const fmt = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <section id="roi" className="py-28 lg:py-36 bg-[#0D1822]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: sliders + offer choice */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C7601D]/30 bg-[#C7601D]/8 mb-6">
              <TrendingDown size={13} className="text-[#C7601D]" />
              <span className="text-xs font-mono tracking-widest text-[#C7601D]/80 uppercase">{t('roi.badge')}</span>
            </div>
            <h2 className="font-title font-black text-white leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
              {t('roi.title')}<br />
              <span className="text-white/40">{t('roi.title2')}</span>
            </h2>
            <p className="font-body text-white/40 text-base mb-10">{t('roi.subtitle')}</p>

            <div className="space-y-8 mb-10">
              <Slider
                label={t('roi.q1_label')}
                value={callsPerDay}
                min={1} max={200} step={1} unit="/j"
                onChange={setCallsPerDay}
              />
              <Slider
                label={t('roi.q2_label')}
                value={avgDuration}
                min={1} max={30} step={1} unit={t('roi.q2_unit')}
                onChange={setAvgDuration}
              />
            </div>

            {/* Offer selector */}
            <div>
              <p className="font-body text-sm text-white/50 mb-3">{t('roi.offer_label')}</p>
              <div className="grid grid-cols-2 gap-3">
                {OFFERS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOffer(o.id)}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
                      offer === o.id
                        ? 'border-[#C7601D]/50 bg-[#C7601D]/10'
                        : 'border-white/8 bg-white/3 hover:border-white/15'
                    }`}
                  >
                    <p className={`font-mono font-bold text-xl mb-0.5 ${offer === o.id ? 'text-[#C7601D]' : 'text-white/60'}`}>
                      {o.price}€
                    </p>
                    <p className="font-body text-xs text-white/35">/mois</p>
                    <p className={`font-title font-semibold text-xs mt-2 ${offer === o.id ? 'text-white/90' : 'text-white/40'}`}>
                      {o.id === 'a' ? t('roi.offer_a_name') : t('roi.offer_b_name')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: result */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-24"
          >
            <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
              {/* Result header */}
              <div className="px-8 pt-8 pb-6 border-b border-white/6">
                <p className="font-body text-white/40 text-sm mb-2">{t('roi.result_title')}</p>
                <motion.p
                  key={savings}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-title font-black text-white leading-none"
                  style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
                >
                  {fmt(savings)}
                  <span className="text-lg font-body font-normal text-white/30 ml-2">/mois</span>
                </motion.p>
                <p className="font-body text-white/30 text-xs mt-2">{t('roi.result_subtitle')}</p>
              </div>

              {/* Breakdown */}
              <div className="px-8 py-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_hours')}</span>
                  <span className="font-mono text-white/70 text-sm">{hoursPerMonth}h/mois</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_fte')}</span>
                  <span className="font-mono text-white/70 text-sm">{Math.round(fteNeeded * 100)}% d'un ETP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_current')}</span>
                  <motion.span key={employeeCost} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-white/70 text-sm">
                    {fmt(employeeCost)}/mois
                  </motion.span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_with')}</span>
                  <span className="font-mono text-white/70 text-sm">{fmt(receptioCost)}/mois</span>
                </div>
                <div className="h-px bg-white/8" />
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-white/80">{t('roi.result_savings')}</span>
                  <motion.span key={savings} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono font-bold text-[#C7601D]">
                    {fmt(savings)}
                  </motion.span>
                </div>
                <p className="font-body text-xs text-white/25">
                  {t('roi.result_annual', { amount: annualSavings.toLocaleString('fr-FR') })}
                </p>
              </div>

              {/* ROI bar */}
              <div className="px-8 pb-6">
                <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#344453] to-[#C7601D]"
                    animate={{ width: employeeCost > receptioCost ? `${Math.min(100, (savings / employeeCost) * 100)}%` : '0%' }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-white/20 mt-1.5">
                  <span>0%</span>
                  <span>{t('roi.cost_reduction')}</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Assumption note */}
              <div className="px-8 pb-4">
                <p className="font-body text-xs text-white/20 text-center">
                  {t('roi.assumption', { salary: GROSS_SALARY.toLocaleString('fr-FR'), employer: EMPLOYEE_MONTHLY_COST.toLocaleString('fr-FR') })}
                </p>
              </div>

              {/* CTA */}
              <div className="px-8 pb-8">
                <Link
                  to="/register"
                  className="group flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-sm transition-all hover:bg-[#b5551a] hover:shadow-[0_0_24px_rgba(199,96,29,0.4)]"
                >
                  {t('roi.result_cta')}
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="text-center text-xs font-body text-white/20 mt-3">{t('roi.disclaimer')}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
