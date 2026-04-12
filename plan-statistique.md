# Plan — Dashboard Statistique + Module QA configurable

## Vision

Ajouter à Receptio une couche analytique structurée en **3 niveaux** :

| Niveau | Délai | Usage |
|--------|-------|-------|
| **Instantané** | Temps réel | Piloter la journée (charge, flux, alertes) |
| **Quasi-instantané** | 30 s – 5 min | Tags IA post-appel, résumé court, confiance |
| **Batch IA** | Planifié | Scoring qualité, coaching, conformité script |

Règle de tri : si la donnée change une décision **pendant la journée** → instantané. Si elle sert à l'encadrement, la conformité ou le coaching → batch.

---

## Périmètre de l'implémentation

### Ce qu'on construit

1. **Page Analytics** (`/analytics`) — nouvelle entrée dans la nav
2. **Endpoint `GET /api/analytics/kpis`** — 9 KPIs + 4 séries de charts
3. **Module QA configurable** — templates versionnés + critères builder + analyse Mistral on-demand
4. **Page SettingsQA** (`/settings/qa`) — interface admin pour configurer les templates

### Ce qu'on ne touche pas

- `Dashboard.tsx` — garde ses stats de base
- `MonitoringBbis.tsx` — garde son monitoring latences pipeline
- Toute la logique d'appels existante

---

## Statistiques retenues

### 9 KPIs instantanés (page Analytics — onglet Vue d'ensemble)

| KPI | Source SQL | Calcul |
|-----|-----------|--------|
| Total appels | `calls` | `COUNT(*)` |
| Appels entrants | `calls.direction` | `COUNT FILTER (WHERE direction='inbound')` |
| Appels sortants | `calls.direction` | `COUNT FILTER (WHERE direction='outbound')` |
| Durée moyenne | `calls.duration` | `AVG(duration)` |
| Temps moyen avant transfert | `call_events` (routing.transferred) | LATERAL: min(event.timestamp) - call.created_at |
| Taux d'abandon | `calls.queue_status`, `calls.status` | `COUNT FILTER (WHERE queue_status='abandoned' OR status='missed') / total` |
| Taux de transfert | `calls.status` | `COUNT FILTER (WHERE status='transferred') / total` |
| Taux de RDV pris | `call_summaries.actions` | `COUNT FILTER (WHERE actions @> '[{"type":"appointment"}]') / total` |
| Appels urgents | `calls.queue_reason`, `call_summaries.intent` | `COUNT FILTER (WHERE queue_reason ILIKE '%urgent%' OR intent='urgence')` |

### 4 charts (Vue d'ensemble)

| Chart | Type | Données |
|-------|------|---------|
| Volume d'appels | LineChart | `DATE_TRUNC('hour', created_at)` (today) ou `'day'` (7j/30j) × direction |
| Appels par agent | BarChart horizontal | `call_events` (routing.transferred) → JOIN `staff` sur `data->>'staffId'` |
| Répartition par intent | PieChart | `call_summaries.intent` GROUP BY |
| Répartition par issue | BarChart | `calls.status` GROUP BY |

**Sélecteur de période** : Aujourd'hui / 7 jours / 30 jours

### 10 stats batch IA (page Analytics — onglet Qualité IA)

Calculées via Mistral après chaque appel (on-demand ou batch planifié) :

1. Taux de respect du script
2. Taux de questions obligatoires posées
3. Taux de proposition d'action attendue
4. Taux de prise de date effective
5. Score qualité par appel (0–100)
6. Score qualité par agent (moyenne)
7. Score commercial par appel
8. Détection des manquements process
9. Sentiment client moyen
10. Top flags de friction (flags fréquents)

---

## Architecture technique

### Base de données — 3 nouvelles tables

```
analysis_templates
  id, company_id, name, call_type ('*'|'sinistre'|'nouvelle_affaire')
  prompt_template TEXT       ← contient {{TRANSCRIPTION}} {{CRITERES}} {{INTENT}}
  version INTEGER            ← incrémenté à chaque modification sur un template utilisé
  is_active BOOLEAN
  superseded_by UUID         ← pointe vers la version suivante
  created_at

analysis_criteria
  id, template_id
  label, description
  weight INTEGER             ← % contribution au score global
  type 'boolean'|'score_0_5'|'text'
  required BOOLEAN
  position INTEGER           ← ordre d'affichage

call_analysis_results
  id, call_id, template_id, template_version
  scores JSONB               ← {"criteria_id": true | 4 | "bon travail"}
  global_score INTEGER       ← 0–100, pondéré par weight
  verbatims JSONB            ← {"criteria_id": "extrait de transcript justificatif"}
  flags JSONB                ← ["manquement_script", "prospect_chaud"]
  processed_at
```

**Règle de versioning** : si `prompt_template` est modifié ET que des résultats existent déjà → créer une nouvelle version (transaction : désactiver l'ancien, INSERT nouveau, copier les critères, mettre `superseded_by`). Si aucun résultat → UPDATE direct.

### Backend — nouveaux fichiers

```
backend/src/
  routes/
    analytics.ts        ← GET /api/analytics/kpis?period=today|7d|30d
    qa.ts               ← CRUD templates + critères + POST /analyze/:callId
  services/
    qaAnalysis.ts       ← prompt builder + appel Mistral + calcul global_score
```

**Endpoint analytics** : pattern identique à `monitoring.ts` — `authenticateToken`, tout filtré par `company_id`.

**Service QA** : utilise `generateResponse()` depuis `mistral.ts` avec `temperature: 0.1` pour forcer une réponse JSON déterministe. Nettoie le markdown éventuel (` ```json `) avant `JSON.parse`.

**Calcul global_score** :
```
score_global = Σ (score_normalisé_critère × weight_critère) / Σ weights
```
- `boolean` → normalisé 0 ou 1
- `score_0_5` → normalisé valeur / 5
- `text` → ignoré du calcul numérique

### Endpoints QA

```
GET    /api/qa/templates                  — liste templates actifs
POST   /api/qa/templates                  — créer (name + promptTemplate requis)
GET    /api/qa/templates/:id              — détail + critères
PATCH  /api/qa/templates/:id              — modifier (versioning si besoin)
DELETE /api/qa/templates/:id              — soft-delete si résultats, DELETE sinon
GET    /api/qa/templates/:id/criteria     — liste critères triés par position
POST   /api/qa/templates/:id/criteria     — créer critère
PATCH  /api/qa/criteria/:id              — modifier critère
DELETE /api/qa/criteria/:id              — supprimer
POST   /api/qa/analyze/:callId            — lancer analyse on-demand { templateId }
GET    /api/qa/results                    — liste résultats (filtres: period, templateId, agentId)
GET    /api/qa/results/:callId            — résultats pour un appel
```

### Frontend — nouveaux fichiers

```
frontend/src/
  pages/
    Analytics.tsx       ← page principale avec 2 onglets
    SettingsQA.tsx      ← builder de templates et critères
```

**Modifications** :
- `Layout.tsx` : ajouter `{ path: '/analytics', icon: BarChart2, label: 'Analytics' }` + `grid-cols-7` mobile
- `App.tsx` : 2 imports + 2 routes

### Structure page Analytics

```
/analytics
  ├── PeriodSelector (Aujourd'hui | 7 jours | 30 jours)
  ├── TabBar (Vue d'ensemble | Qualité IA)
  │
  ├── [Vue d'ensemble]
  │     ├── KpiGrid — 9 cards (pattern Dashboard.tsx)
  │     ├── VolumeChart — LineChart inbound/outbound par slot
  │     ├── AgentBarChart — BarChart horizontal appels par agent
  │     ├── IntentPieChart — PieChart répartition intent
  │     └── OutcomeBarChart — BarChart répartition status
  │
  └── [Qualité IA]
        ├── [si 0 template] — invitation à configurer → /settings/qa
        ├── AgentQATable — scores moyens par agent
        ├── ScoreTrendChart — évolution score global dans le temps
        └── FlagCloud — top flags fréquents
```

### Structure page SettingsQA

```
/settings/qa
  ├── Header (pattern Settings.tsx)
  ├── TemplateList
  │     ├── TemplateCard (nom, version, call_type, nb critères, statut)
  │     ├── Bouton "Nouveau template"
  │     └── TemplateFormModal
  │           ├── Champs : nom, call_type, promptTemplate (textarea)
  │           └── Aide contextuelle : variables disponibles {{TRANSCRIPTION}} {{CRITERES}} {{INTENT}}
  └── CriteriaBuilder (affiché quand template sélectionné)
        ├── CriterionRow (label, description, weight %, type, required)
        └── AddCriterionForm
```

**Comportement PATCH** : si le serveur retourne un id différent (nouvelle version) → toast "Version v{N} créée, ancienne archivée".

---

## Palette et style

Cohérent avec l'existant (Tailwind + variables CSS) :

| Élément | Couleur |
|---------|---------|
| Inbound | `#344453` |
| Outbound | `#C7601D` |
| Sinistre | `#D94052` |
| Nouvelle affaire | `#2D9D78` |
| Autre | `#344453` |
| Cards | `bg-white border-[#344453]/10 rounded-[24px]` |

Charts : pattern `MonitoringBbis.tsx` — `ResponsiveContainer`, `CartesianGrid strokeDasharray="3 3"`, `fontSize: 11` sur les axes.

---

## Fichiers à créer / modifier

| Fichier | Action | Priorité |
|---------|--------|----------|
| `database/migrations/003_analytics_qa.sql` | Créer | 1 |
| `backend/src/routes/analytics.ts` | Créer | 2 |
| `backend/src/services/qaAnalysis.ts` | Créer | 3 |
| `backend/src/routes/qa.ts` | Créer | 4 |
| `backend/src/index.ts` | Modifier (2 lignes) | 5 |
| `frontend/src/components/Layout.tsx` | Modifier (1 item nav + grid) | 6 |
| `frontend/src/App.tsx` | Modifier (2 imports + 2 routes) | 7 |
| `frontend/src/pages/Analytics.tsx` | Créer | 8 |
| `frontend/src/pages/SettingsQA.tsx` | Créer | 9 |

**Fichiers de référence** (modèles à suivre, ne pas modifier) :
- `backend/src/routes/monitoring.ts` — pattern route backend
- `backend/src/services/mistral.ts:108` — signature `generateResponse`
- `frontend/src/pages/MonitoringBbis.tsx` — pattern charts recharts
- `frontend/src/pages/Dashboard.tsx` — pattern KPI cards

---

## Vérification end-to-end

```bash
# 1. Appliquer la migration
psql $DATABASE_URL -f database/migrations/003_analytics_qa.sql

# 2. Lancer le backend
cd backend && npm run dev

# 3. Tester les endpoints
curl http://localhost:3000/api/analytics/kpis?period=today
curl -X POST http://localhost:3000/api/qa/templates -d '{"name":"Test","promptTemplate":"..."}'

# 4. Lancer le frontend
cd frontend && npm run dev

# 5. Naviguer et tester
# /analytics → KPI cards + charts
# /settings/qa → créer un template + des critères
# POST /api/qa/analyze/:callId avec un vrai callId
# Retour sur /analytics onglet "Qualité IA" → scores affichés
```
