# **Document de Cadrage : Receptio.eu**

# **Vision du Projet**

Devenir la plateforme de référence en Belgique pour la gestion simplifiée et complète de tout type de réception, offrant une expérience utilisateur intuitive et des outils performants de réponse et d’analyse statistique pour les organisateurs et les prestataires de services. Les possibilités sont infinies dans le marché, Receptio s’adapte à tout. 

# **Objectifs du Projet**

Un réceptionniste IA répond au téléphone, l’objectif étant de satisfaire l’appelant.

Une fois l'objectif de l'appel atteint :

1. **Notification :** L'entreprise reçoit un e-mail de notification.  
2. **Tableau de bord :** L'information s'affiche sur le tableau de bord, classée selon des critères tels que la catégorie et le niveau d'urgence.  
3. **Détails de l'appel :** La transcription, l'enregistrement audio et un résumé de l'appel sont disponibles.  
4. **Outil d'analyse :** Un outil de statistiques est nécessaire pour l'entreprise, permettant d'analyser les données (exemples : type de catégorie, qualification de l'appel, sujet traité, raisons et processus de l'appel, etc.).

# **Offres**

Pour les offres, on peut penser à un système en 4 catégories qui se recoupent (la 4ème catégorie est une addition des 3 premières qui va se personnaliser à l’entreprise). L’**offre A** est la porte d’entrée (low friction, facile à vendre), l’**offre B** est le cœur du business (valeur réelle), l’**offre C** la montée en gamme (marge \+ différenciation) et l’**offre D / personnalisée** \= levier grands comptes / niches. En résumé:

**Offre A** : **Répondeur intelligent (transcription)**  
Le répondeur enregistre l'appel. Une IA transcrit le message. L'entreprise reçoit la transcription par dashboard, mail ou SMS. Coût marginal quasi nul : stockage \+ transcription IA uniquement. Correspond au répondeur actuel de Thomas, similaire à ce que fait OVH avec la transcription offerte à certains paliers de dépenses.

**Offre B : Agent vocal IA complet**  
L'IA répond en temps réel à l'appelant. Elle traite l'intention (RDV, info, transfert). L'entreprise accède au dashboard avec le résumé de chaque appel. C'est le cœur du projet Receptio.

**Offre C** : **Offre B \+ module statistiques et train de l’IA sur les données récoltées**  
Ajout d'un module analytique IA sur les données d'appels. Proposé comme tiers supérieur car certaines entreprises n'en ont pas l'usage immédiat. Permet un "appel de prix" différencié.

**Règle non négociable (toutes offres)**

Si l'appelant est insatisfait, épuisé ou demande explicitement à parler à un humain, le transfert vers un opérateur humain doit s'effectuer immédiatement, sans friction. Cette fonctionnalité est considérée comme obligatoire.

| Élément | Offre A — Répondeur intelligent | Offre B — Agent vocal IA complet | Offre C — Agent IA \+ statistiques | Offre personnalisée |
| ----- | ----- | ----- | ----- | ----- |
| **Positionnement** | Répondeur amélioré par IA | Réception intelligente automatisée | Réception \+ pilotage business | Solution sur mesure |
| **Principe** | L’appel est enregistré puis traité après coup | L’IA répond en temps réel à l’appelant | L’IA répond \+ analyse globale des appels | Adaptation complète aux besoins client |
| **Temps de réponse** | Asynchrone (post-appel) | Variable | Variable | Variable |
| **Interaction avec l’appelant** | Aucune (répondeur classique) | Conversation naturelle avec IA | Conversation naturelle \+ optimisation continue sur base des données récoltées (uniques à l’entreprise) | Selon configuration |
| **Fonction principale** | Transcription des messages vocaux | Gestion complète des appels entrants | Gestion \+ analyse \+ optimisation | Cas d’usage spécifiques |
| **Traitement IA** | Transcription uniquement | Détection d’intention \+ réponse | Détection \+ réponse \+ analyse macro | Variable |
| **Détection d’intention** | **NON** | **OUI** (RDV, info, urgence…) | **OUI** \+ analyse statistique | Sur mesure |
| **Prise de rendez-vous** | **NON** | **OUI** | **OUI** | Sur mesure |
| **FAQ / réponses automatiques** | **NON** | **OUI** | **OUI** | Sur mesure |
| **Transfert vers humain** | **NON** (ou manuel) | **OUI** (automatique si nécessaire) | **OUI** automatique | **OUI** (obligatoire) |
| **Dashboard entreprise** | Consultation des messages | Suivi complet des appels (consultation des messages \+ réponses de l’IA) | Suivi \+ analytics avancé | Adapté client |
| **Contenu dashboard** | Transcriptions \+ messages | Résumé, statut, actions IA | Résumé \+ KPIs \+ tendances | Sur mesure |
| **Notifications** | Mail / SMS transcription | Mail / dashboard | Mail / dashboard / insights | Sur mesure |
| **Logs / historique** | Basique | Structuré | Structuré \+ exploité | Sur mesure |
| **Statistiques** | **NON** | **NON** (ou limitées) | ✅ (module complet) | Selon besoin |
| **Analyse des appels** | **NON** | **NON** | ✅ typologie, volumes, performance | Sur mesure |
| **Valeur principale** | Ne plus rater d’information | Ne plus rater d’appels et répondre aux clients automatiquement (délégation des tâches répétitives) | Pareil \+ optimiser l’activité | Maximiser l’adéquation métier |
| **Complexité technique** | Faible | Moyenne | Élevée | Variable |
| **Coût marginal** | Très faible | Moyen (temps réel IA) | Plus élevé (IA \+ analytics) | Variable |
| **Client cible** | Très petites structures/ individus | PME / services locaux | PME structurées / scaling | Entreprises spécifiques |
| **Objectif business** | Captation de l’information | Automatisation de la réception | Pilotage et optimisation | Intégration complète |

# **Go-to-market produit (MVP)**

Pour développer l’IA sous forme d’infrastructure européenne, il nous faut rentrer du cash et tester déjà un peu le marché. 

Le go-to-market de Receptio repose sur deux axes complémentaires. D’une part, un **produit** **simple**, immédiatement déployable et compréhensible (le répondeur intelligent). D’autre part, un **projet pilote mené avec une entreprise partenaire** permettant de valider le produit en conditions réelles et de générer des données exploitables

1. ### **Répondeur intelligent (Offre A)**

Le premier produit mis sur le marché est un répondeur intelligent permettant de capter les appels non répondus et de les transformer en information exploitable (comme ce que Thomas a déjà). Concrètement, lorsqu’un appel n’est pas pris, le système enregistre le message vocal, le transcrit automatiquement et l’envoie à l’entreprise sous forme de texte clair (mail, SMS ou dashboard). L’entreprise dispose en parallèle d’un espace simple lui permettant de consulter l’historique des appels, les transcriptions et les informations clés associées.

Ce produit constitue une porte d’entrée à faible friction : il **remplace un usage existant** (répondeur classique) tout en **apportant une valeur immédiate** (gain de temps, meilleure lisibilité, réduction des pertes d’information). Il permet également de **collecter des données réelles sur les appels entrants**, qui serviront de base à l’évolution vers des fonctionnalités plus avancées (agent vocal, automatisation, statistiques).

2. ### **Projet pilote (partenariat entreprise)**

Le second pilier du go-to-market est la **mise en place d’un projet pilote avec une entreprise partenaire** (ex: *Paquay et associés, GlobeZenit Liège*). L’objectif est de **déployer un agent AI sur un périmètre défini** (numéro, équipe ou plage horaire) afin **d’observer son fonctionnement en situation réelle et de mesurer son impact**.

Ce pilote doit être **simple**, **rapide à mettre en place** et **sans risque pour l’entreprise**. Il permet de collecter des indicateurs concrets tels que le volume d’appels non pris, le nombre de messages générés, la typologie des demandes et le potentiel business associé. Ces données ont une **double utilité** : elles permettent d’améliorer le produit et constituent un levier commercial pour la suite du déploiement.

Le projet pilote joue ainsi un rôle central : il **transforme** une **proposition théorique** en **preuve opérationnelle** et sert de fondation au développement commercial ultérieur.

# **Exemple infrastructure Receptio** (EU Compliant)

Au fil des réunions, on a pu dégager une **logique technique minimale du MVP**

1. **Couche téléphonie** (reçoit, émet et route les appels (numéros, SIP, flux audio temps réel))

Rôle :

- recevoir l’appel entrant ;  
- maintenir la session audio ;  
- router vers l’orchestrateur ;  
- transférer vers un humain si nécessaire.

Proposition d’entreprise EU Conforme : [**Telnyx**](https://telnyx.com/)

2. **Orchestrateur** (cerveau opérationnel qui gère la conversation, les règles métier et coordonne toutes les briques (STT, LLM, TTS, agenda)).

Il gère :

- l’état de la conversation ;  
- qui parle et quand ;  
- les interruptions ;  
- les règles métier ;  
- les appels aux briques IA ;  
- les actions concrètes (prise de rendez-vous, lookup, transfert).

Proposition de système EU conforme : développé en interne (**Node.js** / **Python** sur serveur UE type **OVHcloud** ou **Scaleway**)

3. **STT** (Speech-to-text)

Transforme l’audio du client en texte exploitable.

Proposition d’entreprise EU conforme: [**Deepgram**](https://deepgram.com/)

4. **LLM** (Moteur conversationnel)

Ne doit pas piloter directement tout le système. Il doit plutôt être utilisé comme moteur de compréhension et de formulation au sein d’un cadre contrôlé par l’orchestrateur.

Proposition d’entreprise EU conforme: [**Mistral AI**](https://mistral.ai/fr)

5. **TTS** (Text-to-speech)

Transforme la réponse texte finale en voix.

Proposition d’entreprise EU conforme: [**Deepgram**](https://deepgram.com/) (ou autre moteur voix hébergé UE)

6. **Logique métier** (trouver un autre nom)

C’est là que se trouve la vraie valeur de Receptio :

- scénarios par secteur ;  
- règles d’ouverture ;  
- gestion agenda ;  
- règles de transfert ;  
- priorités business ;  
- réponses autorisées.

Proposition de service EU conforme: Développée en interne (hébergement UE type OVHcloud)

7. **Dashboard opérationnel** (interface entreprise)

Interface centralisée permettant à l’entreprise de visualiser, comprendre et exploiter chaque interaction traitée par l’IA.

Il permet :

- consulter la **liste chronologique des appels** ;  
- accéder à une **fiche** **détaillée** **par appel** (powered by AI) ;  
- lire la **retranscription** (résumé \+ verbatim) ;  
- **visualiser** le **type d’appel détecté** (RDV, info, urgence…) ;  
- voir l’**action effectuée** (réponse IA, transfert, RDV pris…) ;  
- **écouter l’audio si activé** (voir coûts) ;  
- identifier le **statut** (résolu, transféré, en attente…).

Composants principaux :

- **Boîte de réception IA** (tous les appels/messages centralisés)  
- **Historique des appels** (horodatage, durée, type)  
- **Fiche appel détaillée** (transcription, audio, action)  
- **Journal des événements** (logs structurés)

Proposition de service : Développé en interne (front \+ back, hébergement UE type OVHcloud / Scaleway)

8. **Statistiques & pilotage** (analytics)

Couche d’analyse permettant à l’entreprise de piloter son activité à partir des appels traités par l’IA.

Il permet :

- analyser le volume global d’appels ;  
- comprendre la typologie des demandes ;  
- mesurer la performance de l’IA ;  
- identifier les pics d’activité ;  
- optimiser l’organisation opérationnelle.

**Indicateurs clés** (proposition initiale) :

- nombre total d’appels ;  
- appels traités par l’IA ;  
- appels transférés à un humain ;  
- taux de résolution ;  
- nombre de rendez-vous pris ;  
- répartition par type d’appel (RDV, info, urgence…) ;  
- distribution par jour / heure ;  
- durée moyenne des appels ;  
- pics d’activité.

**Composants principaux :**

- Vue macro (dashboard global)  
- Typologie des appels  
- Taux de résolution  
- Performance business (RDV, conversion)  
- Analyse temporelle (pics, heures creuses)

**Proposition de service :** Développé en interne (dashboard analytics, hébergement UE)

**Flowchart LR**  
A\[Appel entrant\] → B\[Téléphonie\]  
B → C\[Orchestrateur\]  
C → D\[STT\]  
D → E\[LLM \+ règles métier \+ données\]  
E → F\[TTS\]  
F → C  
C → B

C → G\[Agenda / CRM / FAQ / transfert humain\]

C → H\[Logs appels / événements\]  
H → I\[Dashboard opérationnel\]  
H → J\[Statistiques & analytics\]

# **Idées adjacentes**

La base de données de receptio, pour une entreprise, constitue un trésor précieux d’information pour relancer sa clientèle et aussi pour améliorer la qualité de l’IA.  
La base de données de receptio constitue une ressource précieuse pour connaître les habitudes des clients des PME wallonnes (avec une anonymisation).

# **SWOT**

Ce modèle SWOT est basé sur l’infrastructure précédente, à savoir EU Compliant.

| S — Forces | W — Faiblesses | O — Opportunités | T — Menaces |
| ----- | ----- | ----- | ----- |
| **▸ Architecture EU-compliant native**  Mistral, Telnyx, OVHcloud — RGPD intégré dès la conception, argument rassurant pour les PME wallonnes (même à plus haut prix). **▸ Offre A à très faible friction**  Porte d'entrée simple sans effort d'onboarding, adaptée aux petites structures sans DSI. **▸ Règle de transfert humain intégrée**  Garantit la continuité de service (fort pour les patrons de PME attachés à la relation client directe). **▸ Ancrage local (Liège) et réseau de proximité**  Connaissance du tissu économique wallon, accès à des pilotes partenaires (Paquay, GlobeZenit). **▸ Modèle d'offres progressif A → B → C → D**  Entrée sans risque et upsell naturel, adapté aux budgets contraints des PME. **▸ Flexibilité chez Thomas et Nicolas pour travailler vite et longtemps** Ce qui n’est pas le cas de grosses machines comme NSI. | **▸ Urgence de développement — double pression**  La concurrence peut être urgente ET il faut générer du cash rapidement pour valider la viabilité personnelle du projet. Risque de dispersion ou de sous-qualité. **▸ Aucun pricing défini** (sur une infrastructure EU Compliant)  Impossible de valider la rentabilité sans modèle de coûts marginaux (STT \+ LLM \+ TTS \+ infra). Risque de sous-tarification au lancement (d’où le projet pilote). **▸ Charge technique concentrée sur Thomas**  Goulot d'étranglement potentiel sur la vitesse d'exécution \-\> équipe restreinte. **▸ Couche métier encore floue**  Identifiée comme la vraie valeur de Receptio, mais les scénarios sectoriels concrets ne sont pas encore spécifiés. **▸ Dépendance Deepgram (STT \+ TTS)**  Un seul fournisseur sur du EU Compliance pour deux couches critiques. Risque de continuité et de conformité EU long terme. | **▸ PME wallonnes sous-digitalisées**  Beaucoup de TPE/PME locales n'ont pas de solution de gestion des appels (marché peu adressé, faible concurrence directe locale). **▸ Aides publiques à la digitalisation**  Chèques-entreprises, aides Digitalwallonia, Wallonie Entreprendre (dispositifs existants pour financer l'adoption côté client, facilitant la vente). **▸ Sensibilité RGPD croissante**  Les PME belges sont de plus en plus vigilantes sur la localisation des données (l'architecture EU devient un argument commercial concret). **▸ Accès indirect au Venture Lab via Charly**  Le père de Charly est coach au Venture Lab, levier de conseils et de réseau, pas un accès direct au financement (processus d'admission long). **▸ Maturité croissante des LLM vocaux**  Mistral, Deepgram s'améliorent rapidement, ce qui était coûteux il y a 18 mois devient accessible et fiable. | **▸ Concurrence internationale rapide**  Aircall, Bland.ai, Vapi et d'autres players bien financés peuvent pivoter vers les PME européennes rapidement. **▸ Conservatisme des PME wallonnes**  Adoption lente des nouvelles technologies. Cycle de vente long, besoin de réassurance et de démonstrations en présentiel. **▸ Évolution réglementaire IA en Europe**  L'AI Act pourrait imposer des obligations de transparence et divulgation sur les systèmes d'IA vocaux. **▸ Télécom incumbents (Proximus, Orange BE)**  Des acteurs télécom déjà en place pourraient lancer des offres similaires avec leur base client existante comme levier (cas du licenciement de 1400 employés pour Proximus). **▸ Risque de sous-tarification précoce**  Sans grille tarifaire validée rapidement, un premier client mal pricé crée un précédent difficile à renégocier. |

# **Étapes suivantes**

**Techniques**:

- Il faut qu’on mette en place la formule A rapidement parce qu’elle a un faible coût marginal et une valeur immédiate pour le client.   
- Il faut tester la mise en place de l’infrastructure EU.  
- Acheter nom de domaine receptio.be

**Financières** : 

- Trouver un premier client pour avoir un peu de cash   
- Faire des demandes de subventions (3 recherches approfondies de Nico arrivent)

**Juridiques**:

- Entamer les démarches pour que Receptio soit legal compliant comme la constitution d’une SRL, le respect des normes européennes (RGPD, AI Act…)  
- Faire un pacte d’associé et des accords de confidentialités  
- Possibilité de brevet ?

**Commerciales**:

- Faire un business plan (plan financier)  
- Avoir une DA entière (logo…)  
- 