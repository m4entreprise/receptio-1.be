# Plan d’implémentation streaming Offre Bbis

Ce plan remplace le pipeline `Bbis` bufferisé actuel par un pipeline temps réel progressif avec STT streaming en priorité, TTS streaming ensuite, instrumentation fine, fallbacks sûrs et déploiement contrôlé.

## Objectif

Réduire fortement la latence perçue de l’Offre `Bbis` sans perdre en stabilité opérationnelle, en gardant un fallback vers le pipeline actuel tant que le nouveau chemin n’est pas validé.

## État actuel constaté

- Le point d’entrée téléphonie est `backend/src/routes/webhooks.ts`.
- Le pipeline temps réel Twilio est centralisé dans `backend/src/services/twilioMediaStreams.ts`.
- `Bbis` utilise aujourd’hui :
  - Twilio Media Streams pour l’entrée/sortie transport
  - Deepgram STT en mode buffer HTTP (`/listen`)
  - OpenAI LLM en requête classique
  - Deepgram TTS REST (`/speak`)
- Les réglages `Bbis` sont persistés dans `companies.settings.bbisAgent` et exposés dans `frontend/src/pages/SettingsAgentIA.tsx`.
- Le pipeline actuel repose encore sur une logique de fin d’énoncé locale (`silenceThresholdMs`, `minSpeechMs`) avant lancement STT/LLM/TTS.

## Cible fonctionnelle

- Démarrer la transcription `Bbis` dès réception des frames Twilio.
- Exploiter des résultats STT partiels/finals pour réduire le délai avant décision.
- Conserver la gestion d’interruption (`barge-in`) côté Twilio.
- Permettre un rollout progressif par drapeau de configuration.
- Garder un fallback immédiat vers le pipeline bufferisé existant si le streaming échoue.

## Enseignements ajoutés depuis l’analyse Bluejay

Les recommandations les plus pertinentes pour ce projet sont :

- traiter le vrai KPI comme `fin de parole utilisateur -> premier audio agent` plutôt que seulement la latence brute STT/LLM/TTS
- faire des `partials STT` un signal exploitable, pas seulement une sortie informative
- améliorer l’`endpointing`, car le silence de fin de tour reste une source majeure de “dead air” dans le pipeline actuel
- précharger le contexte métier et tout ce qui peut éviter une requête réseau pendant le tour temps réel
- instrumenter en `p50/p95/p99`, pas seulement avec des logs unitaires
- utiliser des phrases d’attente courtes et honnêtes uniquement quand une opération lente est inévitable

Ces points renforcent l’ordre de priorité déjà retenu :

1. endpointing + STT streaming/partials
2. préchargement et réduction du travail sur le chemin critique
3. TTS first-audio et TTS streaming
4. observabilité TTFA/p95/p99

## Phases proposées

### 1. Introduire une architecture de session streaming `Bbis`

Créer une sous-couche dédiée `Bbis realtime session` dans `twilioMediaStreams.ts` ou dans un service dédié pour séparer :

- transport Twilio
- session STT Deepgram websocket
- orchestration LLM
- session TTS / lecture audio
- état de conversation et annulation

Résultat attendu : le code actuel ne mélange plus buffering, STT, TTS et orchestration dans une seule boucle.

### 2. Implémenter le STT streaming Deepgram en priorité

Ajouter un client websocket Deepgram dans `backend/src/services/deepgram.ts` avec :

- ouverture/fermeture de session
- envoi de chunks audio µ-law ou PCM selon le format retenu
- réception d’événements partiels et finaux
- timeout, reconnect et erreurs explicites

Points de conception à trancher pendant l’implémentation :

- envoyer à Deepgram l’audio Twilio tel quel si le format est accepté, sinon décoder/réencoder une seule fois
- distinguer transcript `interim` vs `final`
- ne lancer le LLM que sur segments `final` ou sur condition stricte de stabilité
- traiter les `partials` comme signal de préchauffe pour l’intent, la récupération de contexte et les annulations

Résultat attendu : suppression du bloc `processBufferedUtterance()` pour `Bbis` ou réduction de son rôle à un fallback.

### 3. Revoir l’orchestration LLM autour d’événements STT

Refactoriser la logique LLM pour qu’elle soit pilotée par des événements de transcription plutôt que par un buffer complet.

À prévoir :

- verrou pour éviter plusieurs générations concurrentes
- annulation des générations devenues obsolètes si le client continue à parler
- stratégie de déclenchement :
  - sur segment final uniquement dans un premier temps
  - éventuellement sur transcript stabilisé ensuite
- préchauffage de la préparation du contexte dès qu’un partial est jugé stable
- conservation du contexte conversationnel actuel
- maintien des règles `__TRANSFER__`, salutation, au revoir, fallback clarification

Résultat attendu : un tour conversationnel démarre plus tôt tout en restant déterministe.

### 3 bis. Précharger et compacter le contexte avant le tour

Appliquer explicitement le principe de `context pre-loading` au pipeline existant :

- charger le contexte entreprise et knowledge base dès `initializeStreamingSession()`
- conserver ce contexte en mémoire sur la durée de l’appel
- éviter toute requête non indispensable pendant le tour utilisateur
- garder le contexte injecté au LLM compact pour optimiser le `time-to-first-token`

Résultat attendu : moins de variance réseau et un LLM plus rapide à démarrer.

### 4. Ajouter un TTS streaming derrière un flag séparé

Conserver d’abord le TTS REST comme référence stable, puis ajouter un second chemin `Bbis TTS streaming` activable indépendamment.

Étapes :

- encapsuler la génération TTS derrière une interface unique
- garder le mode REST comme fallback automatique
- ajouter un mode streaming qui émet les premiers chunks audio dès disponibilité
- pousser les chunks vers Twilio au fil de l’eau
- optimiser le `time-to-first-audio` comme métrique principale du TTS
- prévoir le cache de quelques phrases très courtes et récurrentes si elles sont réellement fréquentes

Attention : le TTS streaming apporte surtout un gain sur le `time-to-first-audio`, mais augmente la complexité de gestion d’interruption, de flush et d’annulation.

### 4 bis. Ajouter des thinking phrases courtes pour les cas inévitables

Prévoir une petite couche de réponses d’attente non bloquantes uniquement pour les cas où un délai restera perceptible :

- transfert humain
- récupération d’information lente
- erreur transitoire fournisseur

Contraintes :

- phrase courte
- honnête
- contextuelle
- ne doit jamais retarder la vraie réponse si celle-ci est déjà prête

Résultat attendu : réduction de la latence perçue sur les cas longs, sans masquer une dette technique structurelle.

### 5. Étendre les settings entreprise pour piloter le rollout

Ajouter dans `bbisAgent` les réglages nécessaires au rollout du nouveau pipeline, par exemple :

- `sttStreamingEnabled`
- `ttsStreamingEnabled`
- `allowInterimTranscriptTrigger`
- `partialTranscriptDebounceMs`
- `deepgramEndpointingMs` ou équivalent
- `streamingFallbackEnabled`
- `thinkingPhrasesEnabled`
- `thinkingPhraseMaxDelayMs`

Exposer ces champs dans :

- `backend/src/types/index.ts`
- `backend/src/routes/companies.ts`
- `backend/src/services/offerB.ts`
- `frontend/src/pages/SettingsAgentIA.tsx`

Résultat attendu : activer progressivement le streaming par entreprise sans redéploiement.

### 6. Renforcer la télémétrie et les garde-fous

Ajouter des métriques/logs structurés par tour :

- `turnId` et `traceId` corrélés à `callId`
- `TTFA` = fin de parole utilisateur -> premier audio agent
- délai premier transcript partiel
- délai transcript final
- latence d’endpointing
- délai LLM
- `TTFT` LLM si disponible
- délai premier audio TTS
- durée totale tour utilisateur -> première syllabe
- nombre d’annulations / barges-in
- nombre de fallback vers pipeline bufferisé

Ajouter aussi :

- timeouts par sous-service
- circuit breaker simple sur échecs répétés Deepgram websocket
- fermeture propre des sockets à la fin d’appel
- nettoyage des ressources si Twilio coupe
- suivi `p50/p95/p99` pour TTFA, endpointing, TTFT et first-audio TTS
- scénarios synthétiques couvrant bruit, accents, interruptions et lenteur fournisseur

Résultat attendu : débuggage facile et rollout observable.

### 7. Prévoir une stratégie de déploiement progressive

Ordre recommandé :

1. STT streaming activable par flag, TTS REST conservé
2. validation en environnement de test
3. activation sur un petit nombre d’entreprises
4. instrumentation et comparaison avec pipeline actuel
5. ajout optionnel du TTS streaming
6. bascule par défaut seulement après stabilité prouvée

## Découpage technique conseillé

### Backend

- `backend/src/services/twilioMediaStreams.ts`
  - isoler les branches `B` et `Bbis`
  - introduire une machine d’état ou un orchestrateur de session
- `backend/src/services/deepgram.ts`
  - ajouter client websocket STT streaming
  - ajouter éventuellement client TTS streaming
- `backend/src/services/openai.ts`
  - garder l’API actuelle, prévoir annulation/timeout si nécessaire
- `backend/src/services/offerB.ts`
  - defaults et lecture des flags
- `backend/src/routes/companies.ts`
  - validation Zod des nouveaux champs
- `backend/src/routes/webhooks.ts`
  - conserver l’entrée Twilio existante, ajuster si besoin pour flags/rollout

### Frontend

- `frontend/src/pages/SettingsAgentIA.tsx`
  - ajouter switches/inputs pour streaming et debounce/endpointing
  - grouper les options avancées pour éviter une UI trop chargée

## Risques principaux

- Les transcripts partiels peuvent provoquer des réponses prématurées si la stratégie de déclenchement est trop agressive.
- Le TTS streaming est plus complexe à synchroniser avec le barge-in et les annulations.
- Les websockets Deepgram ajoutent des cas d’erreur réseau qui n’existent pas avec le REST simple.
- Un trop grand refactor dans `twilioMediaStreams.ts` sans découpage intermédiaire augmentera le risque de régression.

## Recommandation d’implémentation

Faire l’implémentation en deux lots :

- Lot 1 : architecture + endpointing mesuré + STT streaming + partials + logs + fallback sûr
- Lot 2 : TTS streaming + thinking phrases ciblées + réglages avancés + optimisation fine

## Top priorités issues du croisement article + code actuel

- Le gain le plus immédiat reste la suppression de l’attente `silence -> buffer complet -> STT REST` actuellement présente dans `processBufferedUtterance()`.
- Le deuxième levier est d’utiliser les `partials STT` pour préchauffer l’intention et le contexte sans déclencher trop tôt une réponse définitive.
- Le troisième levier est de piloter le TTS par le `first audio`, puis seulement ensuite par la durée totale de synthèse.
- Le quatrième levier est d’observer les régressions en `p95/p99`, pas seulement au ressenti ou via quelques appels manuels.

## Critères de succès

- baisse claire du délai entre fin/quasi-fin de parole et réponse agent
- aucun impact négatif majeur sur transfert humain, fin d’appel et persistance
- rollback simple vers le pipeline bufferisé
- builds backend/frontend verts
- logs suffisants pour comparer ancien et nouveau pipeline
- métriques TTFA / endpointing / TTS first-audio disponibles pour comparer avant/après
