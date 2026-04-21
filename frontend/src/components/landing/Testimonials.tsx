import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const PALETTE = ['#344453', '#C7601D', '#2D9D78', '#344453'];
const CARD_GAP = 24;

export default function Testimonials() {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [leftConstraint, setLeftConstraint] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const items = [1, 2, 3, 4].map((n) => ({
    quote: t(`testimonials.t${n}_quote`),
    author: t(`testimonials.t${n}_author`),
    role: t(`testimonials.t${n}_role`),
    company: t(`testimonials.t${n}_company`),
    initial: t(`testimonials.t${n}_author`)
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2),
  }));

  // Compute real drag constraints from DOM measurements
  useEffect(() => {
    const compute = () => {
      const wrapper = wrapperRef.current;
      const track = trackRef.current;
      if (!wrapper || !track) return;
      const overflow = track.scrollWidth - wrapper.clientWidth;
      setLeftConstraint(-Math.max(0, overflow));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="py-28 lg:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#344453]/15 bg-[#344453]/5 mb-5">
            <Quote size={12} strokeWidth={1.8} className="text-[#344453]/60" />
            <span className="text-xs font-mono tracking-widest text-[#344453]/60 uppercase">
              {t('testimonials.badge')}
            </span>
          </div>
          <h2
            className="font-title font-black text-[#0B1520] leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}
          >
            {t('testimonials.title')}
            <br />
            <span className="text-[#344453]">{t('testimonials.title2')}</span>
          </h2>
        </motion.div>
      </div>

      {/* Overflow wrapper — clips the draggable track */}
      <div ref={wrapperRef} className="overflow-hidden">
        <motion.div
          ref={trackRef}
          drag="x"
          dragConstraints={{ left: leftConstraint, right: 0 }}
          dragElastic={0.08}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 40 }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setTimeout(() => setIsDragging(false), 80)}
          className="flex pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-8 select-none"
          style={{ gap: CARD_GAP, width: 'max-content', cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="w-80 sm:w-[360px] flex-shrink-0 bg-[#F8F9FB] rounded-3xl p-8 border border-gray-100"
              style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            >
              {/* Quote icon */}
              <div className="mb-5">
                <Quote
                  size={28}
                  strokeWidth={1.5}
                  style={{ color: PALETTE[i % PALETTE.length] + '40' }}
                />
              </div>

              <p className="font-body text-gray-700 text-base leading-relaxed mb-8">
                &ldquo;{item.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] + '18' }}
                >
                  <span
                    className="font-mono font-bold text-sm"
                    style={{ color: PALETTE[i % PALETTE.length] }}
                  >
                    {item.initial}
                  </span>
                </div>
                <div>
                  <p className="font-title font-semibold text-[#0B1520] text-sm">{item.author}</p>
                  <p className="font-body text-gray-400 text-xs">
                    {item.role} · {item.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Drag hint */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex items-center gap-3">
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-200" />
          ))}
        </div>
        <p className="text-xs font-body text-gray-300">Faites glisser pour voir plus</p>
      </div>
    </section>
  );
}
