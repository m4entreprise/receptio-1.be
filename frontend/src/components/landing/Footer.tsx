import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGS = ['FR', 'EN', 'NL'] as const;

interface FooterLink {
  label: string;
  href?: string;
  to?: string;
}

export default function Footer() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.toUpperCase().slice(0, 2) || 'FR';

  const cols: { title: string; links: FooterLink[] }[] = [
    {
      title: t('footer.product'),
      links: [
        { label: t('footer.features'), href: '#features' },
        { label: t('footer.pricing'), href: '#pricing' },
        { label: t('footer.demo'), href: '#demo' },
        { label: t('footer.changelog'), to: '/changelog' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.about'), to: '/about' },
        { label: t('footer.story'), href: '#story' },
        { label: t('footer.blog'), to: '/blog' },
        { label: t('footer.careers'), to: '/careers' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacy'), to: '/privacy' },
        { label: t('footer.terms'), to: '/terms' },
        { label: t('footer.cookies'), to: '/cookies' },
      ],
    },
  ];

  return (
    <footer className="bg-[#060E16] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-16 grid grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-0 mb-4">
              <span className="font-title font-black text-xl text-white">receptio</span>
              <span className="font-title font-black text-2xl text-[#C7601D] leading-none -mt-0.5">.</span>
            </Link>
            <p className="font-body text-white/30 text-sm leading-relaxed max-w-[220px]">
              {t('footer.tagline')}
            </p>
            <a
              href={`mailto:${t('footer.email')}`}
              className="inline-block mt-4 font-body text-sm text-white/25 hover:text-white/50 transition-colors"
            >
              {t('footer.email')}
            </a>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <p className="font-title font-semibold text-white/50 text-xs uppercase tracking-widest mb-4">
                {col.title}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="font-body text-sm text-white/25 hover:text-white/60 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="font-body text-sm text-white/25 hover:text-white/60 transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-white/18">
            © {new Date().getFullYear()} Receptio. {t('footer.rights')} · {t('footer.made_in')}
          </p>

          {/* Language switcher */}
          <div className="flex items-center gap-1.5">
            <Globe size={12} strokeWidth={1.8} className="text-white/20" />
            <div className="flex gap-1">
              {LANGS.map((lang) => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang.toLowerCase())}
                  className={`px-2.5 py-1 text-xs font-mono tracking-widest rounded-md transition-colors ${
                    currentLang === lang
                      ? 'text-[#C7601D] bg-[#C7601D]/10'
                      : 'text-white/20 hover:text-white/50 hover:bg-white/5'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
