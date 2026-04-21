import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export default function Testimonials() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const items = [1, 2, 3, 4].map((n) => ({
    quote: t(`testimonials.t${n}_quote`),
    author: t(`testimonials.t${n}_author`),
    role: t(`testimonials.t${n}_role`),
    company: t(`testimonials.t${n}_company`),
    initial: t(`testimonials.t${n}_author`).split(' ').map((w: string) => w[0]).join('').slice(0, 2),
  }));

  const PALETTE = ['#344453', '#C7601D', '#2D9D78', '#344453'];

  return (
    <section className="py-28 lg:py-36 bg-white overflow-hidden">
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
            <span className="text-xs font-mono tracking-widest text-[#344453]/60 uppercase">{t('testimonials.badge')}</span>
          </div>
          <h2 className="font-title font-black text-[#0B1520] leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            {t('testimonials.title')}<br />
            <span className="text-[#344453]">{t('testimonials.title2')}</span>
          </h2>
        </motion.div>
      </div>

      {/* Drag-to-scroll carousel */}
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ right: 0, left: -(items.length * 380 - (typeof window !== 'undefined' ? window.innerWidth : 1200) + 64) }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
        className="flex gap-6 pl-4 sm:pl-6 lg:pl-8 cursor-grab active:cursor-grabbing select-none"
        style={{ width: 'max-content' }}
        whileTap={{ cursor: 'grabbing' }}
      >
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-80 sm:w-[360px] flex-shrink-0 bg-[#F8F9FB] rounded-3xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
          >
            {/* Quote mark */}
            <div className="mb-5">
              <Quote size={28} strokeWidth={1.5} style={{ color: PALETTE[i % PALETTE.length] + '40' }} />
            </div>
            <p className="font-body text-gray-700 text-base leading-relaxed mb-8">
              &ldquo;{item.quote}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] + '18' }}
              >
                <span className="font-mono font-bold text-sm" style={{ color: PALETTE[i % PALETTE.length] }}>
                  {item.initial}
                </span>
              </div>
              <div>
                <p className="font-title font-semibold text-[#0B1520] text-sm">{item.author}</p>
                <p className="font-body text-gray-400 text-xs">{item.role} · {item.company}</p>
              </div>
            </div>
          </motion.div>
        ))}
        {/* Spacer */}
        <div className="w-8 flex-shrink-0" />
      </motion.div>

      {/* Drag hint */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <p className="text-xs font-body text-gray-300 flex items-center gap-2">
          <span>←</span> Faites glisser pour voir plus <span>→</span>
        </p>
      </div>
    </section>
  );
}
