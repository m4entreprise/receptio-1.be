import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';

function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

function EULogo() {
  return (
    <svg viewBox="0 0 100 68" width="48" height="32" aria-label="Drapeau européen" className="inline-block">
      <rect width="100" height="68" fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const cx = 50 + 22 * Math.sin(angle);
        const cy = 34 - 22 * Math.cos(angle);
        return (
          <polygon
            key={i}
            points="0,-5 1.18,-3.63 2.75,-4.76 1.90,-2.94 3.80,-2.94 2.20,-1.76 2.75,0.32 1.18,-0.85 0,1 -1.18,-0.85 -2.75,0.32 -2.20,-1.76 -3.80,-2.94 -1.90,-2.94 -1.18,-3.63"
            fill="#FFCC00"
            transform={`translate(${cx},${cy}) scale(1.1)`}
          />
        );
      })}
    </svg>
  );
}

export default function TrustBar() {
  const { t } = useTranslation();

  const stats = [
    { raw: t('trust.stat1_value'), label: t('trust.stat1_label'), numeric: 98.7, suffix: '%', isSpecial: true, isCounter: true },
    { raw: t('trust.stat2_value'), label: t('trust.stat2_label'), numeric: null, isSpecial: false, isCounter: false },
    { raw: t('trust.stat3_value'), label: t('trust.stat3_label'), numeric: 340, suffix: '%', prefix: '+', isSpecial: true, isCounter: true },
    { raw: null, label: t('trust.stat4_label'), numeric: null, isSpecial: false, isCounter: false, isRgpd: true },
  ];

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="py-8 px-6 lg:px-10 text-center lg:text-left"
            >
              {stat.isRgpd ? (
                <div className="flex flex-col items-center lg:items-start gap-2">
                  <EULogo />
                  <p className="text-sm font-body text-gray-500 tracking-wide">{stat.label}</p>
                </div>
              ) : (
                <>
                  <div className="font-title font-black text-3xl lg:text-4xl text-[#344453] tracking-tight leading-none mb-1.5">
                    {stat.isCounter && stat.numeric ? (
                      <Counter target={stat.numeric} prefix={(stat as { prefix?: string }).prefix} suffix={(stat as { suffix?: string }).suffix} />
                    ) : (
                      <span>{stat.raw}</span>
                    )}
                  </div>
                  <p className="text-sm font-body text-gray-500 tracking-wide">{stat.label}</p>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
