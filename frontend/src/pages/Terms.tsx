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

export default function Terms() {
  return (
    <StaticPageLayout
      badge="Légal"
      title="Conditions d'utilisation"
      subtitle="Les règles qui régissent l'utilisation de la plateforme Receptio."
      lastUpdated="Avril 2026"
    >
      <Section title="1. Objet et acceptation">
        <p>
          Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation de la
          plateforme Receptio, éditée par Receptio SAS. En créant un compte ou en utilisant le service,
          vous acceptez l'intégralité de ces conditions.
        </p>
      </Section>

      <Section title="2. Description du service">
        <p>
          Receptio est une plateforme SaaS de réceptionniste téléphonique assistée par intelligence
          artificielle. Elle permet aux entreprises de gérer leurs appels entrants et sortants, de
          transcrire les conversations et d'en extraire des résumés exploitables.
        </p>
        <p>
          Le service est proposé selon deux offres : <strong className="text-white/70">Offre A</strong>{' '}
          (répondeur intelligent standard) et{' '}
          <strong className="text-white/70">Offre B</strong> (répondeur IA complet avec Mistral et
          Gladia), complétées par des modules optionnels.
        </p>
      </Section>

      <Section title="3. Inscription et compte">
        <p>
          Pour accéder au service, vous devez créer un compte en fournissant des informations exactes et
          à jour. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les
          activités effectuées depuis votre compte.
        </p>
        <p>
          Receptio se réserve le droit de suspendre ou de supprimer tout compte en cas de violation des
          présentes CGU, d'activité frauduleuse ou abusive.
        </p>
      </Section>

      <Section title="4. Facturation et paiement">
        <p>
          L'abonnement est facturé mensuellement ou annuellement selon l'offre choisie. Le paiement est
          traité de façon sécurisée via Stripe. Les prix sont indiqués hors taxes (HT) ; la TVA
          applicable sera ajoutée selon votre localisation.
        </p>
        <p>
          En cas de non-paiement, l'accès au service peut être suspendu après un délai de 15 jours
          suivant l'échéance. Aucun remboursement n'est accordé pour les périodes déjà écoulées, sauf
          obligation légale.
        </p>
      </Section>

      <Section title="5. Utilisation acceptable">
        <p>Vous vous engagez à ne pas utiliser le service pour :</p>
        <ul className="list-disc pl-6 space-y-2 text-white/45">
          <li>Effectuer ou faciliter des communications non sollicitées (spam, phishing).</li>
          <li>
            Enregistrer des appels sans informer les interlocuteurs conformément à la législation
            applicable.
          </li>
          <li>Porter atteinte aux droits de tiers ou à la législation en vigueur.</li>
          <li>Tenter de contourner les mesures de sécurité de la plateforme.</li>
          <li>Revendre ou redistribuer l'accès au service sans autorisation.</li>
        </ul>
      </Section>

      <Section title="6. Propriété intellectuelle">
        <p>
          La plateforme Receptio, ses algorithmes, interfaces, marques et contenus sont la propriété
          exclusive de Receptio SAS. Toute reproduction, modification ou exploitation non autorisée est
          interdite.
        </p>
        <p>
          Les données générées par votre utilisation du service (transcriptions, résumés) vous
          appartiennent. Vous accordez à Receptio une licence limitée pour les traiter dans le seul but
          de fournir le service.
        </p>
      </Section>

      <Section title="7. Limitation de responsabilité">
        <p>
          Receptio fournit le service "en l'état". Nous ne garantissons pas une disponibilité
          ininterrompue (objectif SLA 99,5 % hors maintenance planifiée). Notre responsabilité est
          limitée au montant des sommes payées au cours des 3 derniers mois précédant l'incident.
        </p>
        <p>
          Nous ne sommes pas responsables des pertes indirectes, manques à gagner, ou dommages résultant
          d'une indisponibilité du service.
        </p>
      </Section>

      <Section title="8. Résiliation">
        <p>
          Vous pouvez résilier votre abonnement à tout moment depuis les paramètres de votre compte. La
          résiliation prend effet à la fin de la période d'abonnement en cours. Receptio peut résilier
          le contrat immédiatement en cas de violation grave des CGU.
        </p>
      </Section>

      <Section title="9. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit français. En cas de litige, les parties s'engagent
          à rechercher une solution amiable avant tout recours judiciaire. À défaut, le tribunal
          compétent sera celui du ressort du siège social de Receptio SAS.
        </p>
      </Section>
    </StaticPageLayout>
  );
}
