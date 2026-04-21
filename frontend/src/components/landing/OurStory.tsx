import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Lightbulb, Code2, Rocket, TrendingUp } from 'lucide-react';

const icons = [Lightbulb, Code2, Rocket, TrendingUp];

export default function OurStory() {
  const { t } = useTranslation();
  const lineRef = useRef(null);
  const inView = useInView(lineRef, { once: true, margin: '-100px' });

  const milestones = [1, 2, 3, 4].map((n, i) => ({
    year: t(`story.year${n}`),
    title: t(`story.year${n}_title`),
    desc: t(`story.year${n}_desc`),
    Icon: icons[i],
  }));

  return (
    <section id="story" className="py-28 lg:py-36 bg-[#0D1822] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/4 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <span className="text-xs font-mono tracking-widest text-white/40 uppercase">{t('story.badge')}</span>
          </div>
          <h2 className="font-title font-black text-white leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            {t('story.title')}<br />
            <span className="text-white/35">{t('story.title2')}</span>
          </h2>
          <p className="font-body text-white/40 text-lg leading-relaxed">{t('story.intro')}</p>
        </motion.div>

        {/* Timeline */}
        <div ref={lineRef} className="relative">
          {/* Vertical line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-white/8 -translate-x-1/2" />
          <motion.div
            className="hidden lg:block absolute left-1/2 top-0 w-px bg-gradient-to-b from-[#C7601D] to-transparent -translate-x-1/2"
            initial={{ height: 0 }}
            animate={inView ? { height: '100%' } : { height: 0 }}
            transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="space-y-16 lg:space-y-0">
            {milestones.map(({ year, title, desc, Icon }, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative lg:grid lg:grid-cols-2 lg:gap-16 lg:mb-20 ${isLeft ? '' : 'lg:direction-rtl'}`}
                >
                  {/* Center dot (desktop) */}
                  <div className="hidden lg:flex absolute left-1/2 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0D1822] border-2 border-[#C7601D] z-10 items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C7601D]" />
                  </div>

                  {/* Content */}
                  {isLeft ? (
                    <>
                      <div className="lg:text-right">
                        <div className={`inline-flex items-center gap-3 mb-4 ${isLeft ? 'lg:flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                            <Icon size={18} strokeWidth={1.8} className="text-white/50" />
                          </div>
                          <span className="font-mono font-bold text-[#C7601D] text-2xl">{year}</span>
                        </div>
                        <h3 className="font-title font-bold text-white text-xl mb-3">{title}</h3>
                        <p className="font-body text-white/40 text-sm leading-relaxed">{desc}</p>
                      </div>
                      <div />
                    </>
                  ) : (
                    <>
                      <div />
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="font-mono font-bold text-[#C7601D] text-2xl">{year}</span>
                          <div className="w-10 h-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
                            <Icon size={18} strokeWidth={1.8} className="text-white/50" />
                          </div>
                        </div>
                        <h3 className="font-title font-bold text-white text-xl mb-3">{title}</h3>
                        <p className="font-body text-white/40 text-sm leading-relaxed">{desc}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
