# new-da — Refonte Dashboard Opérationnel

## 📋 Résumé exécutif

Transformation du dashboard tenant d'un outil "joli pour être joli" vers une **plateforme opérationnelle professionnelle** :
- Tableau filtrable 25 appels/page avec pagination
- Bande KPI live sticky + file d'attente urgente
- Sidebar navigation fixe (4 sections principales)
- CallDetail redesigné (layout 2 colonnes, métadonnées sidebar)
- Prêt pour nouveau panel admin (structure définie)

---

## ✅ Changements effectués

### 1. Backend — Enrichissement API calls

**Fichier** : `backend/src/routes/calls.ts`

```typescript
// LEFT JOIN LATERAL sur call_analysis_results
SELECT c.*,
  t.text as transcription_text, t.language, t.segments,
  cs.summary, cs.intent,
  car.id as qa_result_id, car.global_score as qa_score
FROM calls c
LEFT JOIN transcriptions t ON c.id = t.call_id
LEFT JOIN call_summaries cs ON c.id = cs.call_id
LEFT JOIN LATERAL (
  SELECT id, global_score
  FROM call_analysis_results
  WHERE call_id = c.id
  ORDER BY processed_at DESC
  LIMIT 1
) car ON true
WHERE c.company_id = $1
```

**Nouveaux filtres** :
- `?direction=inbound|outbound` — Entrant / Sortant
- `?from=ISO8601&to=ISO8601` — Plage de dates
- `?search=text` — Recherche sur numéro + résumé (ILIKE)
- `?status=completed|transferred|queued|...` — Statut unique

**Response enrichie** :
```json
{
  "calls": [
    {
      "id": "uuid",
      "caller_number": "+33...",
      "status": "completed",
      "direction": "inbound",
      "duration": 240,
      "summary": "...",
      "qa_result_id": "uuid|null",
      "qa_score": 87|null
    }
  ],
  "total": 1024,
  "limit": 25,
  "offset": 0
}
```

---

### 2. Frontend — Navigation Sidebar

**Fichier** : `frontend/src/components/Layout.tsx`

**Structure** :
```
┌─────────────────────────────────────────┐
│ [Logo] Receptio Dashboard               │
├─────────────────────────────────────────┤
│ Opérations        (LayoutDashboard)     │
│ Sortant           (PhoneOutgoing)       │
│ Équipe            (Users)               │
│ Analytics         (BarChart2)           │
│ ───────────────────────────────────────│ (divider)
│ Paramètres        (Settings)            │
├─────────────────────────────────────────┤
│ user@example.com                        │
│ [Déconnexion]                           │
└─────────────────────────────────────────┘
```

**Features** :
- Sidebar fixe 220px (desktop)
- Mobile : header compact + bottom nav (5 items)
- Active state : background [#344453], texte white
- Badge QA alerts sur Analytics
- Permissions respectées via `user?.permissions`

---

### 3. Frontend — Dashboard unifié

**Fichier** : `frontend/src/pages/Dashboard.tsx` (1033 lignes)

**Structure** :

#### A. Bandeau KPI (sticky)
```
Aujourd'hui | 7 jours | 30 jours | Personnalisé
┌──────────────────────────────────────────┐
│ 12 appels | 9 entrants | 3 sortants     │
│ File: 2 🔴 | Durée moy: 3m20s | Taux: 75%│
│                         🕐 14:32:15      │
└──────────────────────────────────────────┘
```

- Sélecteur période (Aujourd'hui / 7j / 30d / Custom avec date range)
- 6 KPIs : total appels, entrants, sortants, file d'attente (🔴 si >0), durée moy, taux transfert
- Dernière actualisation (HH:mm:ss)
- Auto-refresh : 30s appels, 10s queue

#### B. File d'attente urgente (si appels en attente)
```
🔴 2 appels en attente de transfert
┌─ +33 6 12 34 56 78 · 3m42s · urgence ────┐
│ [Dupont Marie ▾]  [Transférer]  [❌]     │
└────────────────────────────────────────────┘
```

- Visible uniquement si `queuedCalls.length > 0`
- Timer live (10s tick)
- Dropdown agent (staff enabled seulement)
- Boutons : Transférer (POST `/api/calls/{id}/transfer`), Abandonner (POST `/api/calls/{id}/abandon`)

#### C. Barre de filtres
```
[🔍 Numéro, résumé…] [Tous statuts ▾] [Tous/Entrant/Sortant] [Réinitialiser ✕]
                                                              123 résultats
```

- Recherche texte : debounce 400ms, ILIKE numéro + résumé
- Multi-select statuts : Tous, Terminé, Transféré, En attente, En cours, Manqué, Échoué
- Direction toggle : Tous / Entrant / Sortant (badges)
- Reset : cache search, statut, direction
- Compteur résultats total

#### D. Tableau principal (25 par page)
```
Heure   | Numéro      | Direction | Durée  | Statut    | Résumé IA | Score QA | →
─────────────────────────────────────────────────────────────────────────────────
14:32   | +33 6 12... | ↙ Entrant | 4m10s | ✓ Traité | 📄 Voir   | 87/100 ⚡| →
14:18   | +33 7 45... | ↙ Entrant | 1m05s | ✗ Manqué | —         | Analyser | →
```

**Colonnes** :
| Colonne | Type | Tri | Responsive |
|---------|------|-----|-----------|
| Heure | HH:mm (ou dd/mm HH:mm si >1j) | ✓ | Visible |
| Numéro | Texte | — | Visible |
| Direction | Badge Entrant/Sortant | — | Masqué <sm |
| Durée | Xm Ys | ✓ | Masqué <md |
| Statut | Badge coloré | — | Visible |
| Résumé IA | Bouton "Voir" ou "—" | — | Masqué <lg |
| Score QA | Badge 87/100 (cliquable → rapport) ou "Analyser" | — | Masqué <lg |
| Actions | Lien → CallDetail | — | Visible |

**Loading state** : spinner + "Chargement…"
**Empty state** : icône téléphone + "Aucun appel trouvé" + conseil filtres

**Pagination** :
```
← Précédent   Page 1 / 5 · 125 appels   Suivant →
```

#### E. Modal Résumé IA
```
Résumé IA
+33 6 12 34 56 78 · 14/04 14:32

[Texte du résumé sur plusieurs lignes…]

[Voir le détail complet →]
```

- Au clic sur "📄 Voir"
- Modal scrollable (max 400px)
- Fermeture : clic fond, bouton X

#### F. Modal Analyse QA
```
Analyser cet appel
Sélectionnez un template d'évaluation QA

◯ Template 1 — Inbound appels entrants
◯ Template 2 — Support client
◯ Template 3 — Ventes

[Annuler]  [⚡ Lancer l'analyse]
```

- Radio select templates (GET `/api/qa/templates`)
- Submit : POST `/api/qa/analyze/{id}` avec `templateId`
- Loading spinner pendant l'analyse
- Après succès : tableau se rafraîchit et affiche le nouveau score

---

### 4. Frontend — Routing

**Fichier** : `frontend/src/App.tsx`

```typescript
// Avant
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/calls" element={<Calls />} />

// Après
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/calls" element={<Navigate to="/dashboard" replace />} />
// /calls/:id et /calls/:id/qa restent intactes
```

**Effet** :
- Anciens liens `/calls` redirigent automatiquement vers `/dashboard`
- Les routes détail/QA continuent de fonctionner
- Import `Calls` supprimé du lazy loading

---

### 5. Frontend — CallDetail Redesigné

**Fichier** : `frontend/src/pages/CallDetail.tsx` (843 lignes)

**Avant** : Hero sombre marketing + 3 mini-cartes redondantes + layout fragmenté
**Après** : Header compact + 2 colonnes (sidebar + contenu)

#### Header compact (une seule barre)
```
[← Opérations]  📞 +33 6 12 34 56 78  ✓ Traité | ↙ Entrant | ⚡ 87/100
                                                [Rapport QA]  [🗑️ Supprimer]
```

- Bouton retour → `/dashboard`
- Numéro + icône direction
- Badges : statut coloré, direction (Entrant/Sortant), score QA si disponible
- Lien "Rapport QA" si analysé
- Bouton supprimer (confirmation)

#### Colonne gauche (280px fixe)
```
Informations
├─ 📞 Numéro          +33 6 12 34 56 78
├─ 📅 Date            14/04/2026 14:32
├─ ⏱️  Durée           4m10s
└─ 🌐 Langue          FR · 95%

Rappeler ce numéro
├─ [Dupont Marie ▾]
├─ [✓ Appel initié OU ❌ Erreur]
└─ [📞 Rappeler le client]

Analyse QA
├─ [Template 1 ▾]
├─ [✓ Analyse terminée OR ❌ Erreur]
├─ [⚡ Lancer l'analyse]
└─ Résultats précédents
   ├─ Template 1 · 14/04 14:32 · 87/100
   └─ [Flags: prospect_chaud, urgence]

Actions effectuées
├─ Type 1 — Description 1
└─ Type 2 — Description 2
```

#### Colonne droite (flex)
```
Résumé IA
📄 Résumé IA       [Intention: sinistre]
[Texte du résumé…]

Transcription
[Chat bubble style: Client | Agent]
[Scrollable max 500px]

Enregistrement audio
[▶️] [─────●──────] 0:32 / 2:15  [🔊] [⬇️]
```

**Changements clés** :
- ❌ Supprimé : hero sombre "Détail d'appel", 3 cartes numéro/date/durée doublons
- ✅ Ajouté : header compact, sidebar 280px, métadonnées table
- ✅ Responsive : 2 colonnes desktop, stack mobile
- ✅ Correction : `navigate('/calls')` → `navigate('/dashboard')`

---

## 📋 À implémenter — Panel Admin (new-da part 2)

### A. Admin Routes structurées

**Routes à ajouter** (`frontend/src/App.tsx`) :
```typescript
// Admin panel (sous /admin/*)
<Route path="/admin/dashboard" element={<PrivateAdminRoute><AdminDashboard /></PrivateAdminRoute>} />
<Route path="/admin/tenants" element={<PrivateAdminRoute><AdminTenants /></PrivateAdminRoute>} />
<Route path="/admin/tenant/:id" element={<PrivateAdminRoute><AdminTenantDetail /></PrivateAdminRoute>} />
<Route path="/admin/billing" element={<PrivateAdminRoute><AdminBilling /></PrivateAdminRoute>} />
<Route path="/admin/analytics" element={<PrivateAdminRoute><AdminAnalytics /></PrivateAdminRoute>} />
<Route path="/admin/logs" element={<PrivateAdminRoute><AdminLogs /></PrivateAdminRoute>} />
```

### B. Admin Layout (sidebar pour super-admin)

**Fichier** : `frontend/src/components/admin/AdminLayout.tsx`

Structure identique au Layout tenant :
```
┌─────────────────────────────────────┐
│ [⚙️] Receptio Admin                │
├─────────────────────────────────────┤
│ Aperçu            (Activity)        │ ← New
│ Entreprises       (Building2)       │ ← Rename "Tenants"
│ Facturation       (CreditCard)      │
│ Analytics         (BarChart3)       │ ← New
│ Logs              (FileText)        │
├─────────────────────────────────────┤
│ admin@receptio.com                  │
│ [Déconnexion]                       │
└─────────────────────────────────────┘
```

### C. Admin Dashboard

**Fichier** : `frontend/src/pages/admin/AdminDashboard.tsx`

```
┌─ Super KPIs ─────────────────────────┐
│ 156 entreprises | 1.2M appels/mois   │
│ 89% uptime | $45.2k ARR (30d)       │
│ Taux croissance: +12% MoM            │
└──────────────────────────────────────┘

┌─ Alertes urgentes ───────────────────┐
│ 🔴 3 entreprises en retard paiement   │
│ 🟡 2 dépassements quotas              │
│ 🟡 Erreur API /transcription (0.5%)  │
└──────────────────────────────────────┘

┌─ Entreprises récemment créées ───────┐
│ Company A · 14/04 · Status: active   │
│ Company B · 13/04 · Status: trial    │
│ Company C · 12/04 · Status: pending  │
└──────────────────────────────────────┘

┌─ Call volume trend (30d) ────────────┐
│ [Line chart: daily call count]       │
└──────────────────────────────────────┘
```

**Données à fetch** :
- `GET /api/super/stats/overview` — Entreprises, appels, uptime, ARR
- `GET /api/super/alerts` — Facturations en retard, quotas, erreurs
- `GET /api/super/tenants?limit=5&sort=created_at` — Dernières créations
- `GET /api/super/analytics/volume?period=30d` — Trend volume

### D. Admin Tenants (amélioration)

**Fichier** : `frontend/src/pages/admin/AdminTenants.tsx`

Tableau (lieu de cartes) :
```
Nom               | Users | Appels (30d) | ARR     | Status | Offre | Actions
────────────────────────────────────────────────────────────────────────────────
Company A         | 5     | 12,543       | $1,200  | Active | B     | [→]
Company B (trial) | 1     | 145          | $0      | Trial  | A     | [→]
Company C         | 8     | 45,234       | $5,600  | Paused | B     | [→]
```

**Colonnes** :
| Nom | Users actifs | Appels mois | ARR 30d | Status badge | Offre A/B | Actions |
|-----|---|---|---|---|---|---|
| Sortie | → AdminTenantDetail | — | — | — | — | ✓ |

### E. Admin Tenant Detail (amélioration)

**Fichier** : `frontend/src/pages/admin/AdminTenantDetail.tsx`

```
┌─ Infos entreprise ─────────────────────────┐
│ Company A · UUID: ...                      │
│ Status: Active (créé 01/01/2026)           │
│ Offre: B (IA réceptionniste)               │
│ Utilisateurs: 5 / 10 (limité forfait)      │
│ Appels: 12,543 / ∞ ce mois                 │
│ ARR: $1,200 · Prochain renouvellement      │
│ 15/05/2026                                 │
└────────────────────────────────────────────┘

Contacts administrateurs
├─ contact@company.com · Owner · Créé 01/01
├─ support@company.com · Admin · Créé 15/02
└─ [+ Ajouter]

Historique appels (30j)
[Petit tableau: date, volume, durée moy]

Facturation
├─ Statut abonnement: Actif
├─ Prochaine facture: 15/05/2026
├─ Montant: $1,200
├─ Historique: [Dernières 5 factures]
└─ [Actions: pause, terminer, changer offre]

Logs d'impersonation
[Tableau: user, date, durée, action]

Quotas & limites
├─ Utilisateurs: 5 / 10
├─ Appels/mois: 12,543 / ∞
├─ Stockage: 2.3 GB / 5 GB
└─ [Modifier quotas]
```

### F. Admin Billing

**Fichier** : `frontend/src/pages/admin/AdminBilling.tsx`

```
┌─ KPIs Facturation ───────────────────┐
│ ARR (30j): $45,234                   │
│ Entreprises actives: 156             │
│ Taux rétention: 98.2%                │
│ Taux renouvellement: 94.1%           │
│ MRR moyen: $290/entreprise           │
└──────────────────────────────────────┘

Entreprises en retard paiement
[Tableau: Nom, montant dû, jours retard]

Factures récentes
[Tableau: Entreprise, montant, date, status]

Tarification actuelle
┌─ Offre A (Répondeur) ────┐
│ $200/mois · base         │
│ + $0.02/appel entrant    │
└──────────────────────────┘

┌─ Offre B (IA) ───────────┐
│ $800/mois · base         │
│ + $0.04/appel entrant    │
│ + $0.02/appel sortant    │
└──────────────────────────┘
```

### G. Admin Analytics

**Fichier** : `frontend/src/pages/admin/AdminAnalytics.tsx`

```
Aperçu global (30d)
├─ Appels: 1,234,567 (↑ 12% vs mois précédent)
├─ Utilisateurs: 1,245 tenants
├─ Uptime: 99.87%
├─ Latence p95: 240ms
└─ Erreurs: 0.3% des appels

Volume d'appels (30d)
[Line chart: daily volume par offre A/B]

Top 10 entreprises
[Bar chart: volume appels par tenant]

Usage par feature
├─ Transcription: 89% des appels
├─ Résumé IA: 76% des appels
├─ QA: 45% des appels
└─ Outbound: 23% des appels

Erreurs courantes
1. Twilio connection timeout (0.2%)
2. Mistral API rate limit (0.1%)
3. Gladia STT timeout (0.05%)
```

### H. Admin Logs

**Fichier** : `frontend/src/pages/admin/AdminLogs.tsx`

```
Filtres
[Entreprise ▾] [Type ▾] [Niveau ▾] [🔍] [Période: 7d]

Logs (derniers 100)
┌─────────────────────────────────────────────────────┐
│ 14:32  INFO    Company A       Impersonation login   │
│        user@a.com → admin pour 1h                   │
├─────────────────────────────────────────────────────┤
│ 14:15  ERROR   Company B       API error             │
│        /transcribe: Mistral API timeout              │
├─────────────────────────────────────────────────────┤
│ 13:45  WARNING Système         Quota warning         │
│        Company C approaching storage limit           │
└─────────────────────────────────────────────────────┘
```

### I. Backend routes super-admin

**À implémenter** (`backend/src/routes/super.ts`) :

```typescript
GET    /api/super/stats/overview          → KPIs globaux
GET    /api/super/alerts                  → Alertes urgentes
GET    /api/super/tenants                 → List + pagination
GET    /api/super/tenants/:id             → Détail + historique
GET    /api/super/tenants/:id/logs        → Impersonation logs
GET    /api/super/billing/invoices        → Factures
GET    /api/super/analytics/volume        → Call volume trend
GET    /api/super/analytics/errors        → Erreurs courantes
GET    /api/super/logs                    → Audit logs système
POST   /api/super/tenants/:id/pause       → Pause abonnement
POST   /api/super/tenants/:id/modify-quota → Modifier quotas
```

---

## 🚀 Prochaines étapes

### Phase 1 (Actuelle — Done)
- ✅ Backend : enrichissement `/api/calls` avec QA score
- ✅ Frontend Layout : sidebar navigation
- ✅ Frontend Dashboard : tableau, filtres, pagination
- ✅ Frontend CallDetail : redesign compact

### Phase 2 (À venir)
- ⬜ Admin Layout + Dashboard + Tenants + TenantDetail
- ⬜ Admin Billing + Analytics + Logs
- ⬜ Backend routes `/api/super/*`
- ⬜ Tests e2e du workflow complet

### Phase 3 (Optionnel)
- ⬜ Real-time updates via WebSocket (KPI live)
- ⬜ Export CSV appels + factures
- ⬜ Bulk actions (transfert multi-appels)
- ⬜ Dark mode toggle

---

## 🧪 Tests locaux

```bash
# Backend
cd backend
npm run dev
# http://localhost:3000

# Frontend
cd frontend
npm run dev
# http://localhost:5173

# Build
npm run build
```

**Checklist** :
- [ ] Tableau 25 appels affiche avec pagination
- [ ] Filtres (période, statut, direction, recherche) fonctionnels
- [ ] File d'attente urgente visible & transfert/abandon fonctionnels
- [ ] Score QA cliquable → rapport détail
- [ ] Modal analyse QA fonctionne
- [ ] CallDetail header + sidebar compact
- [ ] Navigation sidebar active state correct
- [ ] Mobile responsive (colonnes masquées)

---

## 📝 Notes

- **JWT secrets** : `JWT_SECRET` (tenants) ≠ `SUPERADMIN_JWT_SECRET` (admin)
- **Permissions** : Respectées via `user?.permissions` (callsRead, staffManage, etc.)
- **Responsive** : Desktop sidebar + mobile bottom nav (5 items max)
- **Auto-refresh** : 30s appels, 10s queue, 60s alerts admin
- **Locale** : `fr-FR` pour dates/heures sauf API (ISO8601)

---

**Branch** : `new-da`  
**Commits** : 4 (backend, layout, dashboard, routing)  
**Files changed** : 4 (routes/calls.ts, Layout.tsx, Dashboard.tsx, App.tsx, CallDetail.tsx)  
**Lines** : +862 / -442 (net +420)
