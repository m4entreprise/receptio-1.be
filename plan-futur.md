# Plan d'évolution Architecture Modulaire

## Vision globale

Passage d'un modèle **par offres (A/B/Bbis)** à un modèle **à la carte (Odoo-like)** avec un core extensible.

```
┌─────────────────────────────────────────────────────────────┐
│                        CORE (Base)                          │
│  • Transcription IA des appels entrants                       │
│  • Messagerie vocale                                        │
│  • Tableau de bord de base                                  │
│  • Gestion des numéros Twilio                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ VoicePipeline │   │ OutboundCalls │   │    CallQA     │
│  (ex-Bbis)    │   │               │   │  (Associates) │
│               │   │               │   │               │
│ Agent temps   │   │ Appels        │   │ Analyse       │
│ réel STT/TTS  │   │ sortants      │   │ post-appel IA │
│ Deepgram/     │   │ Click-to-call │   │ Coaching      │
│ Mistral       │   │               │   │ micro-mgmt    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │  [FUTUR...]     │
                  │  • SMS Campaign │
                  │  • Analytics    │
                  │  • API Webhooks │
                  │  • CRM Sync     │
                  └─────────────────┘
```

---

## Suppression de l'offre B (Legacy)

### État actuel vs Cible

```
AVANT                          APRÈS
┌──────────┐                   ┌──────────┐
│ Offre A  │  ──────────────▶ │  Core    │
│ (base)   │                   │ (base)   │
└──────────┘                   └──────────┘

┌──────────┐                   ┌──────────┐
│ Offre B  │  ──────────────▶ │   🗑️    │
│ (legacy) │                   │supprimée │
└──────────┘                   └──────────┘

┌──────────┐                   ┌──────────┐
│ Offre    │  ──────────────▶ │ Voice-  │
│ Bbis     │                   │ Pipeline│
│ (stream) │                   │(toggle) │
└──────────┘                   └──────────┘
```

### Impact sur le code

```
backend/src/services/
├── offerB.ts          ─────▶  Simplification (retrait du mode 'B')
├── twilioMediaStreams.ts ───▶  Nettoyage branches 'B'
└── webhooks.ts          ────▶  Conditions simplifiées

frontend/src/
└── pages/Settings.tsx   ────▶  Remplacement dropdown par toggles
```

---

## Architecture Feature Flags

### Nouveau schéma de settings

```
┌────────────────────────────────────────┐
│          company.settings              │
│  (JSONB - remplace offerMode enum)     │
├────────────────────────────────────────┤
│                                        │
│  features: {                            │
│    ┌─────────────────────────┐         │
│    │ inboundVoiceAgent     │ ◀── Toggle ON/OFF
│    │   └─ Deepgram pipeline│         │
│    └─────────────────────────┘         │
│                                        │
│    ┌─────────────────────────┐         │
│    │ outboundCalls          │ ◀── Toggle ON/OFF
│    │   └─ Twilio origination│         │
│    └─────────────────────────┘         │
│                                        │
│    ┌─────────────────────────┐         │
│    │ callQualityReview      │ ◀── Toggle ON/OFF
│    │   └─ QA/Coaching module│         │
│    └─────────────────────────┘         │
│  }                                      │
│                                        │
└────────────────────────────────────────┘
```

### Matrice des fonctionnalités

| Feature | Dépend de | Incompatible avec |
|---------|-----------|-------------------|
| Core | — | — |
| VoicePipeline | Core | — |
| OutboundCalls | Core | — |
| CallQA | Core + (VoicePipeline OU OutboundCalls) | — |

---

## Module CallQA (Associates)

### Vision produit

Outil de **micro-management par l'IA** permettant aux managers de reviewer la qualité des échanges téléphoniques de leurs agents.

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW CALLQA                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Appel entrant avec agent      Appel sortant              │
│         │                              │                    │
│         └──────────────┬───────────────┘                    │
│                        ▼                                    │
│              ┌─────────────────┐                            │
│              │  Trigger QA     │                            │
│              │  (si agent      │                            │
│              │   impliqué)     │                            │
│              └────────┬────────┘                            │
│                       │                                     │
│         ┌─────────────┴─────────────┐                       │
│         │                           │                       │
│         ▼                           ▼                       │
│  ┌──────────────┐           ┌──────────────┐               │
│  │ Batch        │           │ On-demand    │               │
│  │ hebdomadaire │           │ reviewer     │               │
│  │ (auto)       │           │ (manuel)     │               │
│  └──────┬───────┘           └──────┬───────┘               │
│         │                           │                       │
│         └─────────────┬─────────────┘                       │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │  Analyse IA     │                            │
│              │  (LLM scoring)  │                            │
│              │                 │                            │
│              │  • Critères     │                            │
│              │    métier       │                            │
│              │  • Score global │                            │
│              │  • Feedback     │                            │
│              │    textuel      │                            │
│              └────────┬────────┘                            │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │  Dashboard QA   │                            │
│              │                 │                            │
│              │  • Scores par   │                            │
│              │    agent        │                            │
│              │  • Tendances    │                            │
│              │    hebdo/mensuel│                            │
│              │  • Actions      │                            │
│              │    coaching     │                            │
│              └─────────────────┘                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Système de templates par métier

```
┌────────────────────────────────────────────────────────────┐
│              TEMPLATES DE CRITÈRES QA                      │
│                    (Par tenant)                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐                                       │
│  │  COMMERCIAL     │                                       │
│  │                 │                                       │
│  │  ✓ Cross-selling│                                       │
│  │  ✓ Upselling    │                                       │
│  │  ✓ Closing      │                                       │
│  │  ✓ Ton          │                                       │
│  │    enthousiaste │                                       │
│  │  ✓ Objections   │                                       │
│  │    gérées       │                                       │
│  └─────────────────┘                                       │
│           ▲                                                │
│           │ assigné à                                       │
│           │                                                 │
│  ┌────────┴────────┐                                       │
│  │  Role: sales_rep │                                       │
│  │  ├─ Jean Dupont  │                                       │
│  │  ├─ Marie Martin │                                       │
│  │  └─ Paul Bernard │                                       │
│  └─────────────────┘                                       │
│                                                            │
│  ┌─────────────────┐                                       │
│  │   ASSUREUR      │                                       │
│  │                 │                                       │
│  │  ✓ Informations │                                       │
│  │    obligatoires│                                       │
│  │  ✓ Mention      │                                       │
│  │    conformité   │                                       │
│  │  ✓ Ton          │                                       │
│  │    professionnel│                                       │
│  │  ✓ Clarté       │                                       │
│  │    explications │                                       │
│  └─────────────────┘                                       │
│           ▲                                                │
│           │ assigné à                                       │
│           │                                                 │
│  ┌────────┴────────┐                                       │
│  │ Role: insurance │                                       │
│  │  ├─ Agent A     │                                       │
│  │  └─ Agent B     │                                       │
│  └─────────────────┘                                       │
│                                                            │
│  ┌─────────────────┐                                       │
│  │      RH         │                                       │
│  │                 │                                       │
│  │  ✓ Procédure    │                                       │
│  │    suivie       │                                       │
│  │  ✓ Respect      │                                       │
│  │    candidat     │                                       │
│  │  ✓ Prochaines   │                                       │
│  │    étapes       │                                       │
│  │    explicitées  │                                       │
│  └─────────────────┘                                       │
│           ▲                                                │
│           │ assigné à                                       │
│           │                                                 │
│  ┌────────┴────────┐                                       │
│  │  Role: hr_staff │                                       │
│  │  ├─ Recruteur 1 │                                       │
│  └─────────────────┘                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Permissions reviewer

```
┌────────────────────────────────────────────────────────────┐
│              HIÉRARCHIE D'ACCÈS QA                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    ┌─────────────┐                         │
│                    │   ADMIN     │                         │
│                    │  (créateur  │                         │
│                    │   tenant)   │                         │
│                    └──────┬──────┘                         │
│                           │                                │
│              ┌────────────┬─┴────────────┐                   │
│              │            │              │                   │
│              ▼            ▼              ▼                   │
│        ┌─────────┐   ┌─────────┐   ┌─────────┐              │
│        │Manager  │   │Manager  │   │Manager  │              │
│        │Sales    │   │Support  │   │RH       │              │
│        └───┬─────┘   └───┬─────┘   └───┬─────┘              │
│            │             │             │                     │
│    ┌───────┼───────┐     │     ┌───────┼───────┐             │
│    │       │       │     │     │       │       │             │
│    ▼       ▼       ▼     ▼     ▼       ▼       ▼             │
│ ┌────┐  ┌────┐  ┌────┐ ┌────┐ ┌────┐  ┌────┐  ┌────┐         │
│ │Jean│  │Marie│  │Paul│ │Sophie│ │Agent│  │Agent│  │Recru│         │
│ │ D. │  │ M. │  │ B. │ │    │ │  A  │  │  B  │  │teur│         │
│ └────┘  └────┘  └────┘ └────┘ └────┘  └────┘  └────┘         │
│                                                            │
│ LÉGENDE :                                                  │
│ • Manager Sales voit les appels de Jean, Marie, Paul       │
│ • Manager Support voit les appels de Sophie                  │
│ • Manager RH voit les appels du Recruteur                   │
│ • Les managers ne voient PAS les appels des autres équipes  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Processus d'analyse IA

```
┌─────────────────────────────────────────────────────────────┐
│              PIPELINE D'ANALYSE IA                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INPUT                                                      │
│  ┌─────────────────────────────────────────────┐          │
│  │  Transcription + Enregistrement audio         │          │
│  │                                               │          │
│  │  Client: "Bonjour, j'aimerais un devis pour   │          │
│  │          mon assurance habitation"            │          │
│  │                                               │          │
│  │  Agent:   "Oui bien sûr, avez-vous aussi      │          │
│  │          une voiture ? On pourrait faire un   │          │
│  │          pack et vous faire 10% de réduc"     │          │
│  └─────────────────────────────────────────────┘          │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────┐          │
│  │  PROMPT ENGINEERING                           │          │
│  │                                               │          │
│  │  "Analyse cet échange selon les critères:    │          │
│  │   - cross_sell_attempted (0-100)             │          │
│  │   - info_disclosed (0-100)                  │          │
│  │   - tone_professional (0-100)               │          │
│  │                                             │          │
│  │   Retourne un JSON avec scores et feedback" │          │
│  └─────────────────────────────────────────────┘          │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────┐          │
│  │  OUTPUT LLM                                   │          │
│  │                                               │          │
│  │  {                                            │          │
│  │    "overall_score": 87,                     │          │
│  │    "criteria_scores": {                      │          │
│  │      "cross_sell_attempted": 95,            │          │
│  │      "info_disclosed": 70,                   │          │
│  │      "tone_professional": 90                │          │
│  │    },                                         │          │
│  │    "feedback": "Excellent cross-sell sur le   │          │
│  │      pack auto. Manque: pas mentionné les     │          │
│  │      conditions de résiliation",            │          │
│  │    "strengths": ["Proactivité commerciale"], │          │
│  │    "improvements": ["Mentionner CGV"]         │          │
│  │  }                                            │          │
│  └─────────────────────────────────────────────┘          │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────┐          │
│  │  STOCKAGE                                     │          │
│  │                                               │          │
│  │  Table: qa_analyses                           │          │
│  │  • call_id                                    │          │
│  │  • template_id (assureur)                     │          │
│  │  • overall_score: 87                          │          │
│  │  • criteria_scores: {...}                     │          │
│  │  • ai_feedback                                │          │
│  │  • created_at                                 │          │
│  └─────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Roadmap de migration

### Phase 1 : Foundation (Semaines 1-2)

```
┌────────────────────────────────────────────────────────────┐
│  🗑️  SUPPRESSION OFFRE B (Legacy)                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐       │
│  │OfferB  │   │Twilio  │   │Webhooks│   │Companies│       │
│  │Service │──▶│Streams │──▶│        │──▶│Route    │       │
│  │        │   │        │   │        │   │         │       │
│  └────────┘   └────────┘   └────────┘   └────────┘       │
│                                                            │
│  Actions :                                                 │
│  □ Identifier toutes les refs à offerMode='B'              │
│  □ Supprimer branches conditionnelles mode 'B'             │
│  □ Nettoyer types/interfaces offerMode                     │
│  □ Migration données : offerMode='B' → 'A'                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Phase 2 : Modularisation (Semaines 3-4)

```
┌────────────────────────────────────────────────────────────┐
│  🔄  REFACTOR A/BBIS → CORE + MODULES                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  AVANT                        APRÈS                        │
│  ┌──────────┐                 ┌──────────┐                  │
│  │ offerMode│                 │ features │                  │
│  │ enum     │                 │ JSONB    │                  │
│  │ A/B/Bbis │                 │          │                  │
│  └──────────┘                 └──────────┘                  │
│                                                            │
│  Remplacer :                                               │
│  - settings.offerMode                                      │
│  + settings.features.inboundVoiceAgent (bool)              │
│  + settings.features.outboundCalls (bool)                │
│                                                            │
│  UI Settings :                                             │
│  ┌─────────────────────────────────────────┐               │
│  │  ☑ Core (toujours actif)              │               │
│  │                                         │               │
│  │  ☐ Agent vocal temps réel             │               │
│  │    └─ Deepgram (ex-Bbis)               │               │
│  │                                         │               │
│  │  ☐ Appels sortants                      │               │
│  │                                         │               │
│  │  ☐ Analyse qualité (CallQA)            │               │
│  │    └─ Configuration templates...        │               │
│  └─────────────────────────────────────────┘               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Phase 3 : Module Outbound (Semaine 5)

```
┌────────────────────────────────────────────────────────────┐
│  📞  EXTRACTION OUTBOUND EN MODULE STANDALONE              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Déjà indépendant mais pas "feature-flaggé" :              │
│                                                            │
│  □ Ajouter feature flag outboundCalls                      │
│  □ Conditionner routes /webhooks/outbound                  │
│  □ Masquer nav item "Sortant" si désactivé                 │
│  □ Masquer bouton dashboard si désactivé                   │
│                                                            │
│  Dépendances :                                             │
│  • Twilio (déjà présent pour inbound)                    │
│  • DB calls (déjà utilisé)                               │
│                                                            │
│  Pas de breaking change pour les tenants actuels.        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Phase 4 : Module CallQA (Semaines 6-8)

```
┌────────────────────────────────────────────────────────────┐
│  📊  IMPLÉMENTATION CALLQA                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Semaine 6 : DB + API                                      │
│  ┌────────────────────────────────────────┐                │
│  │ □ Tables qa_templates                  │                │
│  │ □ Tables qa_analyses                   │                │
│  │ □ Tables qa_reviewer_access            │                │
│  │ □ API CRUD templates                   │                │
│  │ □ API lancer analyse on-demand         │                │
│  └────────────────────────────────────────┘                │
│                                                            │
│  Semaine 7 : Pipeline IA + Batch                           │
│  ┌────────────────────────────────────────┐                │
│  │ □ Service d'analyse LLM                │                │
│  │ □ Queue de traitement                  │                │
│  │ □ Cron batch hebdomadaire              │                │
│  │ □ Webhook post-appel → trigger QA      │                │
│  └────────────────────────────────────────┘                │
│                                                            │
│  Semaine 8 : Frontend                                      │
│  ┌────────────────────────────────────────┐                │
│  │ □ Page Settings : config templates     │                │
│  │ □ Page Settings : mapping rôles        │                │
│  │ □ Dashboard QA (liste analyses)        │                │
│  │ □ Vue détail appel avec scores         │                │
│  │ □ Graphiques tendances par agent       │                │
│  └────────────────────────────────────────┘                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Phase 5 : Polish & Billing (Semaine 9)

```
┌────────────────────────────────────────────────────────────┐
│  💰  BILLING & PRICING MODULAIRE                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Module          │ Base │ +Voice │ +Outbound │ +CallQA   │
│  ─────────────────┼──────┼────────┼───────────┼───────────│
│  Prix mensuel    │ 29€  │ +20€   │ +15€      │ +25€      │
│                                                            │
│  Inclus :                                                  │
│  • Core : 100 appels/mois                                │
│  • Voice : illimité (consomme crédits API)               │
│  • Outbound : 50 appels/mois inclus                      │
│  • CallQA : 200 analyses/mois                            │
│                                                            │
│  □ Migration tenants existants                           │
│    - Offre A → Core only                                 │
│    - Offre Bbis → Core + VoicePipeline                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Vue d'ensemble des dépendances

```
        Core
         │
    ┌────┴────┬────────────┬────────────────┐
    │         │            │                │
    ▼         ▼            ▼                ▼
 Voice    Outbound      CallQA           [Futur]
Pipeline   Calls      (dépend de
           │          Voice OU
           │          Outbound)
 └──────────────────┬───────────────────────────┘
                    │
                    ▼
              ┌──────────┐
              │  Twilio  │
              │  (voice) │
              └──────────┘
                    │
           ┌────────┴────────┐
           │                 │
           ▼                 ▼
      ┌──────────┐      ┌──────────┐
      │Mistral   │      │  LLM     │
      │(STT/TTS) │      │(QA/Chat) │
      └──────────┘      └──────────┘
```

---

## KPIs & Objectifs

| Métrique | Cible |
|----------|-------|
| Temps de migration Offre B | 2 semaines max |
| Breaking changes pour clients A | 0 |
| Breaking changes pour clients Bbis | 0 (migration auto) |
| Nombre de modules v1 | 4 (Core, Voice, Outbound, CallQA) |
| Temps d'analyse IA par appel | < 30s |
| Latence activation feature toggle | < 5s |

---

## Notes & Risques

**Risques identifiés :**
- Complexité du CallQA : modèles de scoring métier très variables
- Coût IA : analyses CallQA peuvent devenir chères à volume
- Adoption : managers doivent adopter l'outil (change management)

**Mitigations :**
- Templates entièrement configurables par tenant
- Limite de crédits analyses mensuels avec alerte
- Dashboard simple, focus sur actions coaching concrètes
