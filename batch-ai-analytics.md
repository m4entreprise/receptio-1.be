# Batch AI Analytics — Plan d'implémentation

## Contexte et problème

### Situation actuelle

Le batch QA est un **faux batch** : une boucle `for` dans `Analytics.tsx` qui appelle `/api/qa/analyze/:callId` un appel à la fois via `axios.post`. Ça tourne dans la mémoire du navigateur.

Conséquences :
- Fermer / recharger la page tue le batch immédiatement
- Chaque analyse est un appel API Mistral synchrone au tarif normal
- Aucune traçabilité : si ça crashe à mi-chemin, on ne sait pas où on en était
- Impossible de reprendre un batch interrompu

### Ce qu'on veut

1. Le batch survit à tout : fermeture de page, refresh, redémarrage navigateur
2. Le frontend peut afficher la progression en se reconnectant à un job existant
3. On économise ~50% sur les coûts d'inférence Mistral

---

## Mistral Batch API — ce qu'on a à disposition

Mistral expose une API batch asynchrone :

| Endpoint | Usage |
|----------|-------|
| `POST /v1/files` | Upload un fichier JSONL de requêtes |
| `POST /v1/batch/jobs` | Crée un job batch à partir du fichier |
| `GET /v1/batch/jobs/{id}` | Interroge le statut du job |
| `GET /v1/files/{id}/content` | Télécharge les résultats JSONL |
| `POST /v1/batch/jobs/{id}/cancel` | Annule un job |

**Format du fichier d'entrée** (JSONL, une requête par ligne) :

```jsonl
{"custom_id":"call-uuid-1","body":{"model":"mistral-small-latest","messages":[...],"temperature":0.4,"max_tokens":500}}
{"custom_id":"call-uuid-2","body":{"model":"mistral-small-latest","messages":[...],"temperature":0.4,"max_tokens":500}}
```

**Statuts du job Mistral** : `queued` → `running` → `success` | `failed` | `timeout_exceeded` | `cancelled`

**Délai de traitement** : quelques minutes à quelques heures (fenêtre max 24h). Pour des batchs de 10-100 appels on est typiquement en moins de 10 minutes.

**Tarif** : 50% moins cher que l'API standard.

---

## Architecture cible

```
Frontend (poll toutes les 10s)
    │
    ├── POST /api/qa/batch          → créer un job
    └── GET  /api/qa/batch/:jobId  → lire la progression

Backend
    ├── Route: qa.ts (nouvelles routes batch)
    ├── Service: qaBatch.ts (logique Mistral Batch API)
    └── Worker: qaBatchWorker.ts (setInterval, avance les jobs)

Base de données
    └── table: qa_batch_jobs
```

### Flow complet

```
1. Utilisateur clique "Lancer un batch"
   → Frontend: POST /api/qa/batch { templateId, period, skipExisting }
   → Backend crée un job en DB (status: 'pending'), retourne { jobId }
   → Frontend stocke jobId dans localStorage, démarre le polling

2. Worker backend (toutes les 15s)
   → lit les jobs en status 'pending'
   → prépare le JSONL (fetch transcripts des appels éligibles)
   → upload le fichier sur Mistral Files API → status: 'uploading'
   → crée le batch job Mistral → status: 'submitted', stocke mistral_batch_id

3. Worker (poll Mistral toutes les 30s)
   → GET /v1/batch/jobs/{mistral_batch_id}
   → met à jour processed_calls depuis request_counts.completed
   → quand status = 'success' → status: 'processing_results'
   → télécharge output JSONL
   → parse chaque ligne, appelle saveAnalysisResult() par appel
   → status: 'done'

4. Frontend (poll /api/qa/batch/:jobId toutes les 10s)
   → affiche barre de progression (processed_calls / total_calls)
   → si on ferme et revient : GET /api/qa/batch/active → reprend le polling
   → quand status = 'done' : reload les résultats QA
```

---

## Schéma base de données

```sql
CREATE TABLE qa_batch_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id           UUID NOT NULL,
  period                VARCHAR(20) NOT NULL,          -- 'today' | '7d' | '30d'
  skip_existing         BOOLEAN NOT NULL DEFAULT TRUE,
  status                VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- statuts internes: pending | uploading | submitted | running | processing_results | done | failed | cancelled
  mistral_batch_id      VARCHAR(255),
  mistral_input_file_id VARCHAR(255),
  mistral_output_file_id VARCHAR(255),
  total_calls           INT NOT NULL DEFAULT 0,
  processed_calls       INT NOT NULL DEFAULT 0,
  success_count         INT NOT NULL DEFAULT 0,
  error_count           INT NOT NULL DEFAULT 0,
  call_ids              JSONB NOT NULL DEFAULT '[]',   -- UUIDs des appels à traiter
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_qa_batch_jobs_company ON qa_batch_jobs(company_id);
CREATE INDEX idx_qa_batch_jobs_status ON qa_batch_jobs(status) WHERE status NOT IN ('done', 'failed', 'cancelled');
```

---

## Fichiers à créer / modifier

### 1. Migration SQL

Fichier : `database/migrations/003_qa_batch_jobs.sql`

```sql
-- (contenu du CREATE TABLE ci-dessus)
```

### 2. Service Mistral Batch

Fichier : `backend/src/services/qaBatch.ts`

Responsabilités :
- `buildBatchJsonl(calls, templateId, companyId)` → construit le JSONL
- `uploadFileMistral(jsonlBuffer)` → POST /v1/files, retourne file_id
- `createMistralBatchJob(inputFileId)` → POST /v1/batch/jobs, retourne batch_id
- `pollMistralBatchJob(batchId)` → GET /v1/batch/jobs/{id}
- `downloadBatchResults(outputFileId)` → GET /v1/files/{id}/content
- `parseAndSaveBatchResults(outputJsonl, callIds, templateId)` → save en DB

### 3. Worker batch

Fichier : `backend/src/services/qaBatchWorker.ts`

```typescript
// Démarré dans index.ts avec startQaBatchWorker()
// setInterval toutes les 30s :
//   - advance jobs 'pending' → upload + submit
//   - advance jobs 'submitted'/'running' → poll Mistral
//   - advance jobs 'processing_results' → parse + save
```

### 4. Nouvelles routes QA

Dans `backend/src/routes/qa.ts`, ajouter :

```
POST /api/qa/batch
  body: { templateId, period, skipExisting }
  → vérifie qu'il n'y a pas déjà un job actif pour cette company
  → crée le job en DB
  → retourne { jobId, totalCalls }

GET /api/qa/batch/:jobId
  → retourne { status, totalCalls, processedCalls, successCount, errorCount, errorMessage }

GET /api/qa/batch/active
  → retourne le job en cours (status != done/failed/cancelled) pour la company
  → utilisé au rechargement de page pour reprendre le polling

POST /api/qa/batch/:jobId/cancel
  → si job 'submitted'/'running' : appelle DELETE /v1/batch/jobs/{mistral_batch_id}/cancel
  → status → 'cancelled'
```

### 5. Frontend — Analytics.tsx

Remplacer la boucle `handleStartBatch` par :

```typescript
const handleStartBatch = async () => {
  const res = await axios.post('/api/qa/batch', {
    templateId: batchSelectedTemplate,
    period,
    skipExisting: batchSkipExisting,
  }, { headers: authHeader() });

  const { jobId } = res.data;
  localStorage.setItem('qa_batch_job_id', jobId);
  startPolling(jobId);
};

const startPolling = (jobId: string) => {
  // poll toutes les 10s
  // met à jour batchState depuis la réponse
  // quand status === 'done' → loadQaResults() + clear localStorage
  // quand status === 'failed' → afficher l'erreur
};

// Au montage du composant :
useEffect(() => {
  const savedJobId = localStorage.getItem('qa_batch_job_id');
  if (savedJobId) {
    // vérifier via GET /api/qa/batch/active si le job est encore en cours
    // si oui → reprendre le polling
    // si non (done/failed) → clear localStorage
  }
}, []);
```

---

## Gestion des cas limites

| Situation | Comportement |
|-----------|-------------|
| Batch en cours quand on en lance un second | Refus (409) — un seul batch actif par company |
| Mistral met plus de 24h | Job passe en `failed` avec message "timeout Mistral" |
| Appel sans transcription dans le batch | Mistral retourne une erreur pour ce `custom_id` → `error_count++` |
| Batch annulé depuis le frontend | On annule aussi le job côté Mistral |
| Redémarrage du serveur backend | Le worker reprend automatiquement les jobs non terminés au démarrage |

---

## Considérations tarification Mistral

- Batch API = 50% de réduction sur `mistral-small-latest`
- Prix actuel standard : ~$0.2/M tokens input, ~$0.6/M tokens output
- Prix batch : ~$0.1/M input, ~$0.3/M output
- Pour un batch de 50 appels (~500 tokens input chacun) : ~$0.0025 au lieu de $0.005

> **Attention** : Mistral Batch API n'est pas instantané. Si on a besoin d'une analyse QA immédiate sur un appel spécifique, on garde l'endpoint `/api/qa/analyze/:callId` synchrone pour les analyses unitaires. Le batch est réservé aux analyses en volume.

---

## Ordre d'implémentation recommandé

1. **Migration SQL** — ajouter `qa_batch_jobs` en DB
2. **Service `qaBatch.ts`** — fonctions Mistral Batch API (uploadFile, createJob, pollJob, downloadResults)
3. **Routes backend** — POST/GET/cancel batch
4. **Worker** — `qaBatchWorker.ts` + `startQaBatchWorker()` dans `index.ts`
5. **Frontend** — remplacer la boucle par POST + polling
6. **Test** — avec un petit batch de 2-3 appels pour valider le round-trip complet

---

## Ce qu'on ne change PAS

- `/api/qa/analyze/:callId` reste en place pour les analyses unitaires (page détail appel, bouton manuel)
- Les templates QA, critères, et `call_analysis_results` ne changent pas
- La structure des résultats affichés dans l'onglet QA ne change pas
