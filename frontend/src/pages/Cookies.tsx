import StaticPageLayout from '../components/landing/StaticPageLayout';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="font-title font-bold text-white text-xl mb-4 pb-3 border-b border-white/8">
        {title}
      </h2>
      <div className="font-body text-white/50 text-base leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

interface CookieRow {
  name: string;
  purpose: string;
  duration: string;
  type: string;
}

function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8 mt-4">
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-white/8 bg-white/3">
            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-widest">
              Cookie
            </th>
            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-widest">
              Finalité
            </th>
            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-widest">
              Durée
            </th>
            <th className="text-left px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-widest">
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3 font-mono text-[#C7601D] text-xs">{row.name}</td>
              <td className="px-4 py-3 text-white/40">{row.purpose}</td>
              <td className="px-4 py-3 text-white/35 whitespace-nowrap">{row.duration}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-white/5 text-white/35">
                  {row.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cookies() {
  return (
    <StaticPageLayout
      badge="Légal"
      title="Politique de cookies"
      subtitle="Quels cookies nous utilisons et pourquoi."
      lastUpdated="Avril 2026"
    >
      <Section title="1. Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone, tablette)
          lors de votre visite sur un site web. Il permet au site de mémoriser certaines informations sur
          votre session et vos préférences.
        </p>
      </Section>

      <Section title="2. Cookies essentiels">
        <p>
          Ces cookies sont nécessaires au fonctionnement de la plateforme. Ils ne peuvent pas être
          désactivés sans altérer l'expérience de connexion et de navigation.
        </p>
        <CookieTable
          rows={[
            {
              name: 'receptio_token',
              purpose: 'Authentification de session',
              duration: '7 jours',
              type: 'Essentiel',
            },
            {
              name: 'receptio_csrf',
              purpose: 'Protection CSRF',
              duration: 'Session',
              type: 'Essentiel',
            },
            {
              name: 'i18nextLng',
              purpose: 'Mémorisation de la langue choisie',
              duration: '1 an',
              type: 'Fonctionnel',
            },
          ]}
        />
      </Section>

      <Section title="3. Cookies analytiques">
        <p>
          Ces cookies nous permettent de comprendre comment les visiteurs utilisent la plateforme afin
          d'améliorer les performances et l'expérience utilisateur. Toutes les données sont anonymisées.
        </p>
        <CookieTable
          rows={[
            {
              name: '_plausible',
              purpose: 'Analyse des visites (Plausible Analytics — sans suivi individuel)',
              duration: 'Session',
              type: 'Analytique',
            },
          ]}
        />
      </Section>

      <Section title="4. Cookies tiers">
        <p>
          Certains services tiers peuvent déposer leurs propres cookies lors de l'utilisation de la
          plateforme. Nous utilisons Stripe pour les paiements ; leurs cookies sont soumis à la{' '}
          <a
            href="https://stripe.com/fr/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C7601D] hover:underline"
          >
            politique de confidentialité de Stripe
          </a>
          .
        </p>
      </Section>

      <Section title="5. Gérer vos préférences">
        <p>
          Vous pouvez à tout moment modifier vos préférences en matière de cookies via les paramètres de
          votre navigateur. La plupart des navigateurs vous permettent de bloquer ou de supprimer les
          cookies. Notez que la désactivation des cookies essentiels peut affecter votre accès au service.
        </p>
        <p>
          Pour plus d'informations sur la gestion des cookies :{' '}
          <a
            href="https://www.allaboutcookies.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C7601D] hover:underline"
          >
            allaboutcookies.org
          </a>
          .
        </p>
      </Section>

      <Section title="6. Contact">
        <p>
          Pour toute question relative à notre utilisation des cookies, contactez-nous à{' '}
          <a href="mailto:privacy@receptio.eu" className="text-[#C7601D] hover:underline">
            privacy@receptio.eu
          </a>
          .
        </p>
      </Section>
    </StaticPageLayout>
  );
}
