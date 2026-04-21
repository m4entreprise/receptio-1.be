import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, RefreshCw, User, Cpu } from 'lucide-react';

type Step = 'idle' | 'ringing' | 'answered' | 'processing' | 'summary';

interface Message {
  id: number;
  speaker: 'receptio' | 'caller';
  text: string;
}

function WaveformBars({ active }: { active: boolean }) {
  const [bars, setBars] = useState(() => Array.from({ length: 24 }, () => 0.15));

  useEffect(() => {
    if (!active) {
      setBars(Array.from({ length: 24 }, () => 0.06));
      return;
    }
    let t = 0;
    const iv = setInterval(() => {
      t += 0.12;
      setBars(Array.from({ length: 24 }, (_, i) => {
        const v = Math.sin(t + i * 0.45) * 0.28 + 0.35;
        return Math.max(0.06, Math.min(0.95, v + Math.sin(t * 1.7 + i * 0.8) * 0.12));
      }));
    }, 50);
    return () => clearInterval(iv);
  }, [active]);

  return (
    <div className="flex items-center gap-0.5 h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full transition-all duration-75"
          style={{
            height: `${h * 100}%`,
            background: active ? `rgba(199,96,29,${0.4 + h * 0.6})` : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </div>
  );
}

function TypeWriter({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const iRef = useRef(0);

  useEffect(() => {
    iRef.current = 0;
    setDisplayed('');
    const iv = setInterval(() => {
      iRef.current++;
      setDisplayed(text.slice(0, iRef.current));
      if (iRef.current >= text.length) {
        clearInterval(iv);
        setTimeout(onDone, 400);
      }
    }, 28);
    return () => clearInterval(iv);
  }, [text]);

  return <span>{displayed}<span className="animate-pulse">▌</span></span>;
}

export default function LiveDemo() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgIdx, setMsgIdx] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef = useRef<HTMLDivElement>(null);

  const script = [
    { speaker: 'receptio' as const, textKey: 'demo.receptio_line1' },
    { speaker: 'receptio' as const, textKey: 'demo.receptio_line2' },
    { speaker: 'caller' as const, textKey: 'demo.caller_line1' },
    { speaker: 'receptio' as const, textKey: 'demo.receptio_line3' },
    { speaker: 'caller' as const, textKey: 'demo.caller_line2' },
    { speaker: 'receptio' as const, textKey: 'demo.receptio_line4' },
  ];

  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  const startSim = () => {
    setStep('ringing');
    setMessages([]);
    setMsgIdx(0);
    setDuration(0);
    setTimeout(() => {
      setStep('answered');
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      addNextMessage(0);
    }, 2000);
  };

  const addNextMessage = (idx: number) => {
    if (idx >= script.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => setStep('processing'), 600);
      setTimeout(() => setStep('summary'), 2200);
      return;
    }
    setIsTyping(true);
    const delay = script[idx].speaker === 'caller' ? 1200 : 600;
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: idx, speaker: script[idx].speaker, text: t(script[idx].textKey) },
      ]);
      setMsgIdx(idx + 1);
    }, delay);
  };

  const handleTypeDone = () => {
    const next = msgIdx;
    if (next < script.length) {
      addNextMessage(next);
    }
  };

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('idle');
    setMessages([]);
    setMsgIdx(0);
    setDuration(0);
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const statusLabel = {
    idle: '',
    ringing: t('demo.status_ringing'),
    answered: t('demo.status_answered'),
    processing: t('demo.status_processing'),
    summary: t('demo.status_summary'),
  }[step];

  return (
    <section id="demo" className="py-28 lg:py-36 bg-[#0D1822]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C7601D]/30 bg-[#C7601D]/8 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C7601D] animate-pulse" />
              <span className="text-xs font-mono tracking-widest text-[#C7601D]/80 uppercase">{t('demo.badge')}</span>
            </div>
            <h2 className="font-title font-black text-white leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
              {t('demo.title')}<br />
              <span className="text-white/40">{t('demo.title2')}</span>
            </h2>
            <p className="font-body text-white/45 text-lg leading-relaxed mb-8">{t('demo.subtitle')}</p>

            {step === 'idle' && (
              <motion.button
                onClick={startSim}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 px-7 py-4 rounded-2xl bg-[#C7601D] text-white font-body font-semibold text-base hover:bg-[#b5551a] transition-colors hover:shadow-[0_0_32px_rgba(199,96,29,0.4)]"
              >
                <Phone size={18} />
                {t('demo.play')}
              </motion.button>
            )}
            {step !== 'idle' && step !== 'summary' && (
              <button
                onClick={reset}
                className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors font-body text-sm"
              >
                <PhoneOff size={14} />
                Arrêter
              </button>
            )}
            {step === 'summary' && (
              <button
                onClick={reset}
                className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors font-body text-sm"
              >
                <RefreshCw size={14} />
                {t('demo.reset')}
              </button>
            )}
          </motion.div>

          {/* Right: phone UI */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative bg-[#111c27] rounded-3xl border border-white/8 overflow-hidden shadow-2xl">
              {/* Phone header */}
              <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    step === 'answered' ? 'bg-[#C7601D]/20' : 'bg-white/6'
                  }`}>
                    <Phone size={14} strokeWidth={1.8} className={step === 'answered' ? 'text-[#C7601D]' : 'text-white/40'} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-body font-medium">{t('demo.caller')}</p>
                    <p className="text-white/35 text-xs font-mono">{step !== 'idle' ? '+32 4XX XXX XX' : '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  {step === 'ringing' && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="text-xs font-mono text-[#C7601D]"
                    >
                      {statusLabel}
                    </motion.span>
                  )}
                  {step === 'answered' && (
                    <span className="text-xs font-mono text-green-400">{formatTime(duration)}</span>
                  )}
                  {step === 'processing' && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 0.7 }}
                      className="text-xs font-mono text-white/40"
                    >
                      {statusLabel}
                    </motion.span>
                  )}
                  {step === 'summary' && (
                    <span className="text-xs font-mono text-green-400">{statusLabel}</span>
                  )}
                </div>
              </div>

              {/* Waveform */}
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-[#C7601D]/15 flex items-center justify-center">
                    <Cpu size={11} className="text-[#C7601D]" />
                  </div>
                  <span className="text-xs font-mono text-white/30">Receptio AI</span>
                </div>
                <WaveformBars active={step === 'answered'} />
              </div>

              {/* Transcript */}
              <div ref={msgRef} className="p-5 space-y-3 min-h-[200px] max-h-[220px] overflow-y-auto scrollbar-none">
                <p className="text-xs font-mono text-white/20 uppercase tracking-widest mb-4">{t('demo.transcript_label')}</p>

                <AnimatePresence>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: msg.speaker === 'receptio' ? -12 : 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-start gap-2.5 ${msg.speaker === 'caller' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        msg.speaker === 'receptio' ? 'bg-[#C7601D]/20' : 'bg-white/8'
                      }`}>
                        {msg.speaker === 'receptio'
                          ? <Cpu size={11} className="text-[#C7601D]" />
                          : <User size={11} className="text-white/40" />
                        }
                      </div>
                      <div className={`rounded-xl px-3.5 py-2.5 max-w-[80%] ${
                        msg.speaker === 'receptio'
                          ? 'bg-[#C7601D]/12 border border-[#C7601D]/15'
                          : 'bg-white/6 border border-white/8'
                      }`}>
                        <p className="text-xs font-body text-white/75 leading-relaxed">
                          {idx === messages.length - 1 ? (
                            <TypeWriter text={msg.text} onDone={handleTypeDone} />
                          ) : msg.text}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center">
                        <User size={11} className="text-white/30" />
                      </div>
                      <div className="flex gap-1 px-3 py-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-white/30"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {step === 'idle' && (
                  <p className="text-xs font-body text-white/20 italic">{t('demo.play')} →</p>
                )}
              </div>

              {/* Summary */}
              <AnimatePresence>
                {step === 'summary' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/8 px-5 py-4 bg-[#0D1822]/80"
                  >
                    <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">{t('demo.summary_label')}</p>
                    <p className="text-xs font-body text-white/65 leading-relaxed">{t('demo.summary_content')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
