import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingDown } from 'lucide-react';

const HOURLY_RATE = 35;
const RECEPTIO_COST = 49;
const WORKING_DAYS = 22;

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
  const [calls, setCalls] = useState(30);
  const [duration, setDuration] = useState(7);
  const [employees, setEmployees] = useState(3);

  const { current, savings, annual } = useMemo(() => {
    const monthlyMinutes = calls * WORKING_DAYS * duration;
    const current = Math.round((monthlyMinutes / 60) * HOURLY_RATE * employees);
    const savings = Math.max(0, current - RECEPTIO_COST);
    return { current, savings, annual: savings * 12 };
  }, [calls, duration, employees]);

  const fmt = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  return (
    <section id="roi" className="py-28 lg:py-36 bg-[#0D1822]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: sliders */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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

            <div className="space-y-8">
              <Slider label={t('roi.q1_label')} value={calls} min={1} max={200} step={1} unit="/j" onChange={setCalls} />
              <Slider label={t('roi.q2_label')} value={duration} min={1} max={30} step={1} unit={t('roi.q2_unit')} onChange={setDuration} />
              <Slider label={t('roi.q3_label')} value={employees} min={1} max={50} step={1} unit="pers." onChange={setEmployees} />
            </div>
          </motion.div>

          {/* Right: result */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
                  transition={{ duration: 0.4 }}
                  className="font-title font-black text-white leading-none"
                  style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
                >
                  {fmt(savings)}
                  <span className="text-lg font-body font-normal text-white/30 ml-2">/mois</span>
                </motion.p>
                <p className="font-body text-white/30 text-xs mt-2">{t('roi.result_subtitle')}</p>
              </div>

              {/* Breakdown */}
              <div className="px-8 py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_current')}</span>
                  <motion.span key={current} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-white/70 text-sm">
                    {fmt(current)}
                  </motion.span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/45">{t('roi.result_with')}</span>
                  <span className="font-mono text-white/70 text-sm">{fmt(RECEPTIO_COST)}</span>
                </div>
                <div className="h-px bg-white/8" />
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-white/80">{t('roi.result_savings')}</span>
                  <motion.span key={savings} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono font-bold text-[#C7601D]">
                    {fmt(savings)}
                  </motion.span>
                </div>
                <p className="font-body text-xs text-white/25">
                  {t('roi.result_annual', { amount: annual.toLocaleString('fr-FR') })}
                </p>
              </div>

              {/* ROI bar */}
              <div className="px-8 pb-6">
                <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#344453] to-[#C7601D]"
                    animate={{ width: current > RECEPTIO_COST ? `${Math.min(100, (savings / current) * 100)}%` : '0%' }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-white/20 mt-1.5">
                  <span>0%</span>
                  <span>Réduction des coûts</span>
                  <span>100%</span>
                </div>
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
