import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { PhoneIncoming, Zap, GitBranch, Bell } from 'lucide-react';

const icons = [PhoneIncoming, Zap, GitBranch, Bell];

export default function HowItWorks() {
  const { t } = useTranslation();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const steps = [1, 2, 3, 4].map((n) => ({
    num: t(`how.step${n}_num`),
    title: t(`how.step${n}_title`),
    desc: t(`how.step${n}_desc`),
    Icon: icons[n - 1],
  }));

  return (
    <section id="how" className="py-28 lg:py-36 bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#344453]/15 bg-[#344453]/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#344453]" />
            <span className="text-xs font-mono tracking-widest text-[#344453]/70 uppercase">{t('how.badge')}</span>
          </div>
          <h2 className="font-title font-black text-[#0B1520] leading-tight mb-3" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            {t('how.title')}<br />
            <span className="text-[#344453]">{t('how.title2')}</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div ref={ref} className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-0 right-0 h-px bg-[#344453]/10" />
          <motion.div
            className="hidden lg:block absolute top-10 left-0 h-px bg-[#C7601D]"
            initial={{ width: '0%' }}
            animate={inView ? { width: '100%' } : { width: '0%' }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-6 relative">
            {steps.map(({ num, title, desc, Icon }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col"
              >
                {/* Step indicator */}
                <div className="flex items-center gap-4 lg:flex-col lg:items-start mb-5">
                  <div className="relative z-10 flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                      <Icon size={24} strokeWidth={1.8} className="text-[#344453]" />
                    </div>
                    {/* Orange dot connector */}
                    <div className="hidden lg:block absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#C7601D]" />
                  </div>
                </div>

                <span className="font-mono text-[#C7601D] text-sm font-medium tracking-wider mb-2">{num}</span>
                <h3 className="font-title font-bold text-[#0B1520] text-lg mb-2.5">{title}</h3>
                <p className="font-body text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
