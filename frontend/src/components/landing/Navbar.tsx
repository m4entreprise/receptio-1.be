import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LANGS = ['FR', 'EN', 'NL'] as const;

interface NavbarProps {
  isAuthenticated: boolean;
}

export default function Navbar({ isAuthenticated }: NavbarProps) {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const lastY = useRef(0);
  const langRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.toUpperCase().slice(0, 2) as typeof LANGS[number] || 'FR';

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      setHidden(y > lastY.current && y > 120);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang.toLowerCase());
    setLangOpen(false);
  };

  const links = [
    { href: '#features', label: t('nav.features') },
    { href: '#pricing', label: t('nav.pricing') },
    { href: '#demo', label: t('nav.demo') },
    { href: '#story', label: t('nav.story') },
  ];

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: hidden ? -80 : 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0B1520]/85 backdrop-blur-xl border-b border-white/5 shadow-2xl'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Wordmark */}
          <Link to="/" className="flex items-center gap-0 group select-none">
            <span className="font-title font-black text-xl tracking-tight text-white group-hover:text-white/90 transition-colors">
              receptio
            </span>
            <span className="font-title font-black text-2xl text-[#C7601D] leading-none -mt-0.5">.</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {links.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm text-white/60 hover:text-white transition-colors duration-200 font-body tracking-wide"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Language switcher */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors font-body"
              >
                <Globe size={13} strokeWidth={1.8} />
                <span className="font-mono text-xs tracking-widest">{currentLang}</span>
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 bg-[#1a2a36] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[80px]"
                  >
                    {LANGS.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => switchLang(lang)}
                        className={`block w-full text-left px-4 py-2.5 text-xs font-mono tracking-widest transition-colors ${
                          currentLang === lang
                            ? 'text-[#C7601D] bg-[#C7601D]/10'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Auth actions */}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 text-sm font-body font-medium rounded-xl bg-[#C7601D] text-white hover:bg-[#b5551a] transition-colors"
              >
                {t('nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-white/60 hover:text-white transition-colors font-body"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-body font-medium rounded-xl bg-[#C7601D] text-white hover:bg-[#b5551a] transition-all duration-200 hover:shadow-[0_0_20px_rgba(199,96,29,0.4)]"
                >
                  {t('nav.start')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden text-white/70 hover:text-white transition-colors p-1"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden bg-[#0B1520]/95 backdrop-blur-xl border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-6 flex flex-col gap-4">
              {links.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="text-white/70 hover:text-white transition-colors font-body text-base"
                >
                  {label}
                </a>
              ))}
              <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  {LANGS.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => switchLang(lang)}
                      className={`text-xs font-mono tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
                        currentLang === lang
                          ? 'bg-[#C7601D]/20 text-[#C7601D]'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="w-full text-center px-4 py-3 text-sm font-body font-medium rounded-xl bg-[#C7601D] text-white"
                  >
                    {t('nav.dashboard')}
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="text-white/60 font-body text-sm">
                      {t('nav.login')}
                    </Link>
                    <Link
                      to="/register"
                      className="w-full text-center px-4 py-3 text-sm font-body font-medium rounded-xl bg-[#C7601D] text-white"
                    >
                      {t('nav.start')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
