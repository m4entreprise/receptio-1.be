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

export default function Privacy() {
  return (
    <StaticPageLayout
      badge="Légal"
      title="Politique de confidentialité"
      subtitle="Comment nous collectons, utilisons et protégeons vos données personnelles."
      lastUpdated="Avril 2026"
    >
      <Section title="1. Responsable du traitement">
        <p>
          Receptio SAS, société par actions simplifiée au capital de [MONTANT] €, immatriculée au RCS de
          [VILLE] sous le numéro [SIRET], dont le siège social est situé [ADRESSE], est responsable du
          traitement de vos données personnelles dans le cadre de l'utilisation de la plateforme
          receptio.eu.
        </p>
        <p>
          Pour toute question relative à vos données, vous pouvez nous contacter à :{' '}
          <a href="mailto:privacy@receptio.eu" className="text-[#C7601D] hover:underline">
            privacy@receptio.eu
          </a>
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons les catégories de données suivantes :</p>
        <ul className="list-disc pl-6 space-y-2 text-white/45">
          <li>
            <strong className="text-white/60">Données d'identification</strong> : nom, prénom, adresse
            e-mail, numéro de téléphone professionnel.
          </li>
          <li>
            <strong className="text-white/60">Données de facturation</strong> : adresse de facturation,
            informations de paiement (traitées par Stripe, non stockées chez nous).
          </li>
          <li>
            <strong className="text-white/60">Données d'usage</strong> : enregistrements d'appels,
            transcriptions, résumés générés par l'IA, journaux d'activité.
          </li>
          <li>
            <strong className="text-white/60">Données techniques</strong> : adresse IP, type de
            navigateur, pages visitées, durée des sessions.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalités du traitement">
        <p>Vos données sont utilisées pour :</p>
        <ul className="list-disc pl-6 space-y-2 text-white/45">
          <li>Fournir et améliorer les services de la plateforme Receptio.</li>
          <li>Gérer votre compte et traiter vos paiements.</li>
          <li>Vous envoyer des communications relatives à votre compte et au service.</li>
          <li>Assurer la sécurité et prévenir les fraudes.</li>
          <li>Respecter nos obligations légales et réglementaires.</li>
          <li>Améliorer les modèles d'IA (données anonymisées uniquement, avec votre consentement).</li>
        </ul>
      </Section>

      <Section title="4. Base légale du traitement">
        <p>
          Selon la nature des données et des finalités, le traitement repose sur : l'exécution du contrat
          (fourniture du service), notre intérêt légitime (sécurité, amélioration du service), votre
          consentement (communications marketing, amélioration IA), et nos obligations légales.
        </p>
      </Section>

      <Section title="5. Conservation des données">
        <p>
          Vos données sont conservées le temps nécessaire à la fourniture du service et au-delà dans les
          limites légales applicables :
        </p>
        <ul className="list-disc pl-6 space-y-2 text-white/45">
          <li>Données de compte : durée de l'abonnement + 3 ans.</li>
          <li>Enregistrements d'appels : 12 mois par défaut (configurable).</li>
          <li>Données de facturation : 10 ans (obligation comptable).</li>
          <li>Journaux de connexion : 12 mois.</li>
        </ul>
      </Section>

      <Section title="6. Partage des données">
        <p>
          Nous ne vendons jamais vos données. Nous les partageons uniquement avec des sous-traitants
          nécessaires à la fourniture du service : hébergeur cloud (OVH/AWS), Twilio (téléphonie),
          Mistral AI (traitement IA), Gladia (transcription), Stripe (paiement). Tous sont soumis à des
          accords de traitement conformes au RGPD.
        </p>
      </Section>

      <Section title="7. Vos droits">
        <p>
          Conformément au RGPD, vous disposez des droits suivants : accès, rectification, effacement,
          limitation du traitement, portabilité, opposition et retrait du consentement. Pour exercer ces
          droits, contactez{' '}
          <a href="mailto:privacy@receptio.eu" className="text-[#C7601D] hover:underline">
            privacy@receptio.eu
          </a>
          . En cas de litige, vous pouvez saisir la CNIL (cnil.fr).
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées : chiffrement TLS
          en transit, chiffrement AES-256 au repos, accès restreint aux données, audits de sécurité
          réguliers, et plans de réponse aux incidents.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          Cette politique peut être mise à jour. En cas de modification substantielle, nous vous
          informerons par e-mail et/ou notification dans l'application 30 jours avant l'entrée en
          vigueur.
        </p>
      </Section>
    </StaticPageLayout>
  );
}
