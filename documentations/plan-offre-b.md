# Plan Offre B — Agent vocal IA temps réel

Ce plan vise à faire évoluer l’offre A vers un réceptionniste IA à faible latence sur Twilio + OpenAI, tout en gardant des abstractions claires pour pouvoir remplacer plus tard le fournisseur téléphonique et le LLM.

## Constat actuel

- Le backend gère aujourd’hui un flux **asynchrone** Twilio : greeting TTS, enregistrement, transcription post-appel, résumé, intention, dashboard.
- Les bases utiles existent déjà : `conversations`, `business_rules`, `call_events`, `companies.settings`.
- Le panel admin permet déjà d’éditer l’entreprise et le numéro Twilio, mais **pas encore** la base de connaissances, le numéro de transfert humain ni les règles d’escalade.
- Le dashboard et les détails d’appel sont déjà solides pour l’offre A ; il faudra surtout enrichir les **statuts**, **actions IA** et **événements temps réel**.

## Objectif du premier MVP B

Livrer un agent vocal temps réel qui :

1. répond avec une faible latence,
2. comprend l’intention principale,
3. consulte une base de connaissances d’entreprise éditable depuis le panel admin,
4. transfère vers un humain si l’appelant le demande ou si l’agent bloque trop,
5. prépare les futures intégrations de prise de rendez-vous sans encore les implémenter.

## Architecture cible du MVP B

### 1. Couche temps réel téléphonie/orchestrateur

- Conserver **Twilio** au départ.
- Introduire un **orchestrateur temps réel** backend dédié à l’offre B.
- Isoler les interfaces suivantes dès le départ :
  - `TelephonyProvider`
  - `RealtimeLLMProvider`
  - `KnowledgeProvider`
  - `EscalationPolicy`
- Garder le flux A existant comme fallback/réassurance si l’agent B n’est pas activé pour une entreprise.

### 2. Modèle d’activation par entreprise

Étendre `companies.settings` avec des flags/configs du type :

- `offerMode: 'A' | 'B'`
- `agentEnabled`
- `humanTransferNumber`
- `fallbackToVoicemail`
- `maxAgentFailures`
- `greetingText`
- `knowledgeBaseEnabled`
- `appointmentIntegrationEnabled` (prévu, false par défaut)

### 3. Base de connaissances entreprise

Prévoir une première version simple et robuste :

- données stockées dans la base existante, **sans RAG complexe au début**,
- structure éditable depuis l’admin :
  - FAQ / questions-réponses,
  - informations pratiques,
  - horaires,
  - services,
  - consignes métier,
  - message d’escalade.
- première implémentation possible via :
  - `companies.settings` pour les blocs simples,
  - ou nouvelle table dédiée `knowledge_base_entries` si on veut un CRUD plus propre dès le début.

Recommandation : **table dédiée** plutôt que tout mettre dans `settings`, pour garder le panneau admin maintenable.

### 4. Politique de transfert humain

Le transfert doit être déclenché par :

- demande explicite de l’appelant,
- trop d’échecs de compréhension,
- absence de réponse fiable dans la base entreprise,
- règle métier d’escalade.

Prévoir :

- transfert Twilio vers un numéro paramétrable,
- fallback propre si le numéro n’est pas configuré,
- journalisation explicite dans `call_events` et `call_summaries.actions`.

## Découpage de réalisation recommandé

### Phase 1 — Fondations B

- Ajouter un mode entreprise `A/B`.
- Ajouter les settings admin nécessaires à l’agent vocal.
- Définir les contrats d’abstraction fournisseur/LLM/KB/transfert.
- Étendre le modèle de données pour la base de connaissances.

### Phase 2 — Admin & données métier

- Créer l’UI admin pour gérer :
  - activation de l’agent B,
  - numéro de transfert humain,
  - message d’accueil,
  - seuil d’échec/escalade,
  - base de connaissances.
- Ajouter les routes backend CRUD correspondantes.

### Phase 3 — Orchestrateur temps réel

- Créer le service d’orchestration d’appel temps réel.
- Brancher le provider Twilio temps réel.
- Gérer l’état conversationnel dans `conversations`.
- Journaliser les événements clés dans `call_events`.
- Définir un fallback automatique vers le mode A si le flux temps réel échoue.

### Phase 4 — Raisonnement contrôlé + recherche entreprise

- Introduire une stratégie de réponse pilotée :
  - réponse directe si connue,
  - lookup base entreprise si nécessaire,
  - transfert humain si blocage trop fréquent.
- Ne pas laisser le LLM “inventer” : les réponses métier sensibles doivent venir de la base entreprise ou de règles explicites.

### Phase 5 — Dashboard B

- Enrichir le dashboard/détail d’appel avec :
  - statut de traitement B,
  - motif d’escalade,
  - actions IA réalisées,
  - indicateur transfert humain,
  - fil des événements conversationnels utile.

### Phase 6 — Préparation prise de rendez-vous

Sans implémenter la réservation réelle maintenant :

- définir une interface `AppointmentProvider`,
- prévoir les statuts/actions associés,
- stocker les intentions et paramètres extraits,
- garder la place dans l’admin pour activer plus tard l’intégration.

## Ordre de livraison conseillé

1. **B1 technique** : settings + knowledge base + abstractions + mode entreprise.
2. **B2 conversation** : agent vocal temps réel simple + fallback A.
3. **B3 escalade** : transfert humain robuste + règles de blocage.
4. **B4 visibilité** : dashboard enrichi + logs conversationnels.
5. **B5 extensibilité** : hooks appointment provider + hardening.

## Risques principaux

- **latence** si on mélange trop de logique dans la boucle temps réel,
- **hallucinations** si la base entreprise n’est pas utilisée comme source prioritaire,
- **fragilité téléphonie** si le fallback A n’est pas conservé,
- **panel admin trop flou** si la knowledge base n’a pas un modèle de données clair,
- **couplage fort à Twilio/OpenAI** si on n’introduit pas d’interfaces dès la phase 1.

## Définition de succès du premier MVP B

On considérera le MVP B prêt quand une entreprise peut :

- activer l’agent vocal depuis le panel,
- configurer son numéro de transfert,
- éditer sa base de connaissances,
- recevoir un appel où l’IA répond vite,
- obtenir une réponse issue de la base entreprise quand elle existe,
- être transférée à un humain si demandé ou si l’agent bloque,
- retrouver dans le dashboard le statut, les actions et le journal utile de l’appel.
