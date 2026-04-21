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

export default function TrustBar() {
  const { t } = useTranslation();

  const stats = [
    { raw: t('trust.stat1_value'), label: t('trust.stat1_label'), numeric: 98.7, suffix: '%', isSpecial: true },
    { raw: t('trust.stat2_value'), label: t('trust.stat2_label'), numeric: null, isSpecial: false },
    { raw: t('trust.stat3_value'), label: t('trust.stat3_label'), numeric: 340, suffix: '%', prefix: '+', isSpecial: true },
    { raw: t('trust.stat4_value'), label: t('trust.stat4_label'), numeric: 47, suffix: '', isSpecial: true },
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
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="py-8 px-6 lg:px-10 text-center lg:text-left"
            >
              <div className="font-title font-black text-3xl lg:text-4xl text-[#344453] tracking-tight leading-none mb-1.5">
                {stat.isSpecial && stat.numeric ? (
                  <Counter target={stat.numeric} prefix={stat.prefix} suffix={stat.suffix} />
                ) : (
                  <span>{stat.raw}</span>
                )}
              </div>
              <p className="text-sm font-body text-gray-500 tracking-wide">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
