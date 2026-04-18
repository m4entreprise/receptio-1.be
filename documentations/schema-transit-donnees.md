# Schéma de transit des données

## Vue d’ensemble

```mermaid
flowchart TB
    classDef twilio fill:#E8F1FF,stroke:#2F6FEB,color:#0B1F33,stroke-width:2px;
    classDef mistral fill:#F3E8FF,stroke:#7C3AED,color:#2A114D,stroke-width:2px;
    classDef gladia fill:#E8FFF4,stroke:#0F9D58,color:#06351E,stroke-width:2px;
    classDef server fill:#FFF4E8,stroke:#C7601D,color:#4A2308,stroke-width:2px;
    classDef user fill:#F8F9FB,stroke:#6B7280,color:#111827,stroke-width:1.5px;
    classDef db fill:#FFFBEA,stroke:#B88900,color:#4A3A00,stroke-width:1.5px;

    Caller[Client]:::user

    subgraph IE[Twilio Ireland]
        T1[Voix + webhooks]:::twilio
        T2[Media Streams<br/>audio temps réel]:::twilio
    end

    subgraph DE[Serveur Allemagne]
        S1[Backend<br/>orchestration]:::server
        S2[Pipeline vocal<br/>STT -> LLM -> TTS]:::server
        S3[(PostgreSQL)]:::db
    end

    subgraph FR1[Mistral AI France]
        M1[STT]:::mistral
        M2[LLM<br/>réponse + résumé + intention]:::mistral
        M3[TTS]:::mistral
    end

    subgraph FR2[Gladia France]
        G1[STT alternatif]:::gladia
    end

    Caller -->|Appel| T1
    T1 -->|Métadonnées d'appel| S1
    S1 -->|TwiML / routage| T1
    T2 -->|Audio entrant| S2

    S2 -->|Audio WAV| M1
    S2 -->|Audio WAV| G1
    M1 -->|Texte| S2
    G1 -->|Texte| S2

    S2 -->|Prompt + historique + KB| M2
    M2 -->|Réponse / résumé / intention| S2
    S2 -->|Texte à vocaliser| M3
    M3 -->|Audio WAV| S2
    S2 -->|Audio assistant| T2

    S1 -->|Stockage| S3
    S2 -->|Stockage| S3
```

## Légende rapide

- **Bleu**
  - Twilio Ireland

- **Orange**
  - Serveur principal en Allemagne

- **Violet**
  - Mistral AI en France

- **Vert**
  - Gladia en France

## Flux détaillés

### 1. Appel entrant temps réel

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant T as Twilio Ireland
    participant S as Serveur Allemagne
    participant G as Gladia France
    participant M as Mistral AI France

    C->>T: Appel entrant
    T->>S: Webhook voix<br/>(CallSid, numéros, statuts)
    S-->>T: TwiML avec Media Stream
    T->>S: Audio temps réel<br/>(μ-law 8k)

    alt STT via Gladia
        S->>G: Audio WAV
        G-->>S: Transcription
    else STT via Mistral
        S->>M: Audio WAV
        M-->>S: Transcription
    end

    S->>M: Prompt + historique + contexte métier
    M-->>S: Réponse texte
    S->>M: Texte à synthétiser
    M-->>S: Audio WAV
    S-->>T: Audio assistant
    T-->>C: Réponse vocale
    S->>S: Stockage transcription<br/>événements, résumé
```

### 2. Messagerie / fallback / post-traitement

```mermaid
sequenceDiagram
    autonumber
    participant T as Twilio Ireland
    participant S as Serveur Allemagne
    participant M as Mistral AI France

    T->>S: Callback `recording-complete`<br/>+ RecordingUrl
    S->>T: Téléchargement enregistrement
    S->>M: Audio pour transcription
    M-->>S: Transcription texte
    S->>M: Transcription complète<br/>pour résumé + intention
    M-->>S: Résumé + intention
    S->>S: Stockage DB<br/>+ éventuel email métier
```

## Ce qui transite concrètement

- **Twilio Ireland <-> Serveur Allemagne**
  - audio téléphonique temps réel
  - métadonnées d'appel
  - identifiants Twilio (`CallSid`, `StreamSid`)
  - URL d'enregistrement et callbacks de statut

- **Serveur Allemagne -> Mistral AI France**
  - audio converti en `wav` pour transcription
  - historique conversationnel court
  - prompt système
  - contexte métier / base de connaissances injectée
  - texte à synthétiser pour TTS
  - transcription complète pour résumé / intention

- **Serveur Allemagne -> Gladia France**
  - audio converti en `wav`
  - langue
  - paramètres de transcription

- **Serveur Allemagne**
  - persiste transcriptions, résumés, événements d'appel, configuration entreprise
  - orchestre les choix de pipeline : `Twilio -> STT -> LLM -> TTS -> Twilio`

## Lecture rapide

- **Twilio Ireland**
  - point d’entrée téléphonique
  - transporte l’audio et déclenche les webhooks

- **Mistral AI France**
  - transcription possible
  - génération de réponse
  - synthèse vocale
  - résumé et détection d’intention

- **Gladia France**
  - transcription alternative en temps réel / différé selon configuration

- **Serveur Allemagne**
  - point central de transit
  - conversion audio
  - orchestration logique
  - stockage des données applicatives

## RGPD et souveraineté européenne

### Sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as Personne concernée<br/>appelant
    participant C as Client Receptio<br/>responsable de traitement
    participant T as Twilio Ireland<br/>sous-traitant téléphonie
    participant S as Serveur Allemagne<br/>sous-traitant applicatif
    participant M as Mistral AI France<br/>sous-traitant IA
    participant G as Gladia France<br/>sous-traitant STT alternatif
    participant DB as Stockage Allemagne<br/>transcriptions, résumés, événements

    U->>T: Communication téléphonique<br/>voix + métadonnées d'appel
    T->>S: Webhooks + Media Streams<br/>transport régional UE identifié
    S->>S: Qualification du flux<br/>minimisation, routage, journalisation

    alt Pipeline STT via Mistral France
        S->>M: Envoi audio nécessaire à la transcription<br/>langue, modèle, contexte strictement utile
        M-->>S: Texte transcrit
    else Pipeline STT via Gladia France
        S->>G: Envoi audio nécessaire à la transcription<br/>langue, modèle, paramètres STT
        G-->>S: Texte transcrit
    end

    S->>M: Envoi du texte utile au traitement IA<br/>historique court, prompt, contexte métier borné
    M-->>S: Réponse texte, résumé, intention
    S->>M: Envoi du texte à synthétiser<br/>si réponse vocale requise
    M-->>S: Audio de synthèse

    S->>DB: Stockage en Allemagne<br/>transcription, résumé, événements, configuration
    S-->>C: Mise à disposition applicative<br/>consultation, export, supervision

    Note over T,S: Flux opérationnels localisés en Europe<br/>Irlande -> Allemagne
    Note over S,M: Traitements IA ciblés en France<br/>sur données nécessaires au service
    Note over S,G: Alternative STT française<br/>activée selon la configuration
    Note over S,DB: Conservation centralisée côté serveur<br/>pour audit, suivi et restitution

    C->>S: Demande RGPD<br/>accès, rectification, suppression, limitation
    S->>DB: Recherche et exécution sur les données stockées
    S-->>C: Restitution ou confirmation d'effacement
```

### Lecture technique

- **Responsable de traitement**
  - le client utilisateur de la plateforme reste le **responsable de traitement** des données d'appel
  - la plateforme, Twilio, Mistral et Gladia interviennent comme **sous-traitants** ou sous-traitants ultérieurs selon la chaîne contractuelle

- **Principe de minimisation**
  - le serveur en Allemagne agit comme point de contrôle
  - il ne transmet aux briques IA que les données nécessaires au traitement demandé :
    - audio utile au STT
    - historique court
    - contexte métier borné
    - texte à synthétiser

- **Confinement géographique des flux**
  - téléphonie : `Twilio Ireland`
  - orchestration et stockage applicatif : `Serveur Allemagne`
  - IA générative et TTS : `Mistral AI France`
  - STT alternatif : `Gladia France`

- **Souveraineté opérationnelle**
  - le point de maîtrise principal est le serveur en Allemagne
  - c’est lui qui décide :
    - quel fournisseur reçoit quoi
    - à quel moment
    - pour quelle finalité
    - ce qui est conservé ou non en base

- **Stockage persistant**
  - les données applicatives durables sont regroupées côté stockage en Allemagne
  - cela couvre notamment :
    - transcription
    - résumé
    - événements d'appel
    - configuration entreprise

- **Droits RGPD**
  - les demandes d'accès, de suppression ou de rectification passent par l’application
  - la mise en œuvre technique s’opère depuis le serveur central vers la base de données
  - selon les engagements contractuels des sous-traitants, une suppression étendue peut aussi devoir être propagée chez les fournisseurs externes si des données y sont conservées

### Point d’attention juridique

- **À confirmer contractuellement**
  - la seule localisation technique visible dans le code ne suffit pas à démontrer à elle seule la conformité complète
  - pour une documentation RGPD formelle, il faut aussi vérifier :
    - DPA / accord de sous-traitance
    - durées de conservation réelles chez chaque fournisseur
    - sous-traitants ultérieurs
    - mécanismes de suppression
    - mesures de sécurité et journalisation

---

## Documentation DPO-ready

### 1. Base légale et finalités

| Finalité | Base légale | Données concernées | Justification |
|----------|-------------|-------------------|---------------|
| **Réponse automatique aux appels** | Exécution du contrat (art. 6.1.b RGPD) | Voix, numéro d'appel, métadonnées techniques | Service de réception téléphonique automatisé demandé par le client |
| **Transcription et résumé** | Exécution du contrat / Intérêt légitime (art. 6.1.b/f) | Contenu audio, transcription textuelle, intention détectée | Restitution au client pour suivi qualité et documentation |
| **Supervision et qualité** | Intérêt légitime (art. 6.1.f) | Événements d'appel, durées, statuts | Amélioration du service, détection d'anomalies |
| **Exercice des droits RGPD** | Obligation légale / Exécution du contrat | Identifiants techniques, logs de traitement | Réponse aux demandes d'accès, rectification, suppression |

### 2. Catégories de données et criticité

| Catégorie | Nature | Niveau de sensibilité | Justification |
|-----------|--------|----------------------|---------------|
| **Données d'identification** | Numéro d'appel, CallSid, StreamSid | **Standard** | Identifiants techniques nécessaires au routage |
| **Données biométriques** | Voix (biométrie indirecte) | **Élevé** | Données biométriques au sens large (directive UE 2016/680) |
| **Données de contenu** | Transcription textuelle, résumé | **Élevé** | Contenu potentiellement sensible de la communication |
| **Données de comportement** | Événements, durées, intentions | **Standard** | Métriques de service sans contenu sémantique |

### 3. Schéma de flux DPO-ready

```mermaid
flowchart TB
    classDef person fill:#F8F9FB,stroke:#6B7280,color:#111827,stroke-width:2px;
    classDef controller fill:#E8F1FF,stroke:#2F6FEB,color:#0B1F33,stroke-width:2px;
    classDef processor fill:#FFF4E8,stroke:#C7601D,color:#4A2308,stroke-width:2px;
    classDef subprocessor fill:#F3E8FF,stroke:#7C3AED,color:#2A114D,stroke-width:2px;
    classDef storage fill:#E8FFF4,stroke:#0F9D58,color:#06351E,stroke-width:2px;
    classDef zone fill:#FFFFFF,stroke:#9CA3AF,color:#4B5563,stroke-dasharray: 5 5;

    subgraph ZoneUE["🌍 Zone Européenne — Flux de données"]
        direction TB

        U["👤 Personne concernée<br/>(appelant)"]:::person

        subgraph IE["🇮🇪 Irlande — Téléphonie"]
            T["📞 Twilio Ireland<br/>Sous-traitant téléphonie"]:::processor
        end

        subgraph DE["🇩🇪 Allemagne — Orchestration & Stockage"]
            S["⚙️ Serveur Allemagne<br/>Sous-traitant applicatif"]:::processor
            DB["🗄️ Stockage Allemagne<br/>Données durables"]:::storage
        end

        subgraph FR["🇫🇷 France — Intelligence Artificielle"]
            M["🤖 Mistral AI France<br/>Sous-traitant IA (LLM + TTS)"]:::subprocessor
            G["🎙️ Gladia France<br/>Sous-traitant STT alternatif"]:::subprocessor
        end

        C["🏢 Client Receptio<br/>Responsable de traitement"]:::controller
    end

    %% Flux principaux
    U -->|"Voix + numéro"| T
    T -->|"Webhooks + audio temps réel"| S
    S -->|"Audio WAV"| M
    S -->|"Audio WAV"| G
    M -->|"Transcription + réponse + synthèse"| S
    G -->|"Transcription texte"| S
    S -->|"Conservation sécurisée"| DB
    DB -->|"Consultation / Export"| C

    %% Légende visuelle des flux
    subgraph Legend["Légende des flux"]
        direction LR
        L1["— Données vocales"]:::person
        L2["— Données textuelles"]:::subprocessor
        L3["— Stockage persistant"]:::storage
    end

    style Legend fill:#FFFFFF,stroke:#E5E7EB
    style ZoneUE fill:#FAFAFA,stroke:#E5E7EB
    style IE fill:#E8F4FD,stroke:#7DD3FC
    style DE fill:#FEF3C7,stroke:#FCD34D
    style FR fill:#F3E8FF,stroke:#D8B4FE
```

### 4. Durées de conservation

| Type de donnée | Durée de conservation | Justification | Mécanisme de suppression |
|----------------|----------------------|---------------|-------------------------|
| **Enregistrements audio temporaires** | Durée du traitement uniquement (quelques secondes à minutes) | Nécessité technique immédiate, pas de stockage persistant des fichiers audio bruts | Suppression automatique post-traitement |
| **Transcriptions textuelles** | Durée contractuelle avec le client (typiquement 12 à 36 mois selon secteur) | Obligation légale sectorielle / archivage métier | Suppression programmée ou sur demande |
| **Résumés et intentions** | Identique aux transcriptions | Traçabilité et restitution | Suppression en cascade avec transcriptions |
| **Événements d'appel (métadonnées)** | 24 à 36 mois | Analyse de qualité, facturation, litiges | Archivage puis suppression automatique |
| **Logs techniques RGPD** | 36 mois maximum | Exercice des droits, sécurité, traçabilité | Rotation automatique |

### 5. Mesures techniques et organisationnelles (MTD)

#### Chiffrement

| Élément | Mesure | Justification |
|---------|--------|---------------|
| **Données en transit** | TLS 1.3 pour tous les flux HTTP/WebSocket | Confidentialité des échanges inter-services |
| **Données au repos** | Chiffrement AES-256 côté base de données | Protection en cas d'accès physique non autorisé |
| **Clés API** | Stockage variables d'environnement, rotation régulière | Sécurité des accès aux sous-traitants |

#### Pseudonymisation / Minimisation

| Mesure | Implémentation | Efficacité |
|--------|---------------|------------|
| **Identifiants techniques** | CallSid, StreamSid générés par Twilio | Dissociation de l'identité réelle |
| **Historique conversationnel** | Limitation à N messages (actuellement 12) | Réduction de l'empreinte de données |
| **Contexte KB** | Sélection top 3-5 chunks maximum | Minimisation du contexte métier injecté |
| **Filtrage intentionnel** | Bypass KB sur salutations / small talk | Évitement de requêtes inutiles |

#### Contrôle d'accès

| Niveau | Mesure |
|--------|--------|
| **Authentification** | JWT avec expiration courte (15-60 min) |
| **Autorisation** | RBAC (Role-Based Access Control) par tenant |
| **Audit** | Journalisation des accès aux données sensibles |
| **Segregation** | Isolation des données par entreprise (company_id) |

#### Resilience et sécurité opérationnelle

| Menace | Contre-mesure |
|--------|---------------|
| **Fuite chez sous-traitant** | DPA contractualisé, audits réguliers, clauses de destruction |
| **Accès non autorisé serveur** | Hardening, firewall, monitoring, patching |
| **Injection dans prompts** | Validation des entrées, échappement, contexte borné |
| **Rétention excessive** | TTL automatique, politiques de rétention configurables |

### 6. Exercice des droits - Processus détaillé

```mermaid
sequenceDiagram
    autonumber
    participant U as Personne concernée
    participant C as Client Receptio
    participant S as Serveur Allemagne
    participant DB as Stockage
    participant EXT as Sous-traitants externes

    U->>C: Demande RGPD<br/>(accès, rectif., suppression, limitation)
    C->>S: Transmission demande<br/>avec identifiants de recherche
    S->>DB: Recherche multi-critères<br/>numéro, dates, CallSid, tenant
    S-->>C: Restitution données trouvées

    alt Suppression demandée
        S->>DB: Anonymisation / suppression enregistrements
        S->>EXT: Notification aux sous-traitants<br/>(selon DPA contractuel)
        EXT-->>S: Confirmation d'effacement
        S-->>C: Confirmation suppression complète
        C-->>U: Accusé de réception
    else Accès demandé
        C-->>U: Transcription, résumé, métadonnées
    end
```

### 7. Registre des traitements - Synthèse

| Élément | Détail |
|---------|--------|
| **Référence** | Traitement-RECEPTIO-001 : Gestion des appels téléphoniques automatisée |
| **Responsable** | Client utilisateur de la plateforme (par délégation Receptio en tant que sous-traitant applicatif) |
| **DPO désigné** | À confirmer selon structure du client |
| **Sous-traitants** | Twilio Ireland, Mistral AI France, Gladia France, Hébergeur serveur Allemagne |
| **Pays tiers** | Aucun dans la chaîne actuelle (100% UE : IE, DE, FR) |
| **Garanties** | DPA signés, SCC si nécessaire, certification ISO 27001 à vérifier chez chaque fournisseur |

### 8. Points de vigilance pour le DPO

| Risque | Évaluation | Mesures complémentaires recommandées |
|--------|-----------|-----------------------------------|
| **Voix comme donnée biométrique** | Risque élevé si réutilisation abusive | Désactivation possible du stockage audio brut, rétention transcription uniquement |
| **IA générative et hallucinations** | Risque modéré de données incorrectes | Validation humaine possible, marquage "généré par IA" |
| **Sous-traitants ultérieurs** | Risque modéré si cascade non maîtrisée | Mapping complet de la chaîne, vérification DPA en cascade |
| **Portabilité des données** | Risque faible mais à prévoir | Export structuré (JSON/CSV) des transcriptions et résumés |
| **Transferts futurs hors UE** | Risque à anticiper | Clauses contractuelles de non-transfert sans notification |
