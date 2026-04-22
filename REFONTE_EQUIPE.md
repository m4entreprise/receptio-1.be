# Refonte Page Équipe - Guide d'implémentation

## ✅ Étapes complétées

### 1. Base de données (Migration 008)
- ✅ Table `staff_availability` pour horaires individuels
- ✅ Colonne `custom_schedule` dans `staff_group_members` pour horaires par groupe
- ✅ Table `staff_schedule_exceptions` pour absences/congés
- ✅ Métadonnées visuelles pour dispatch builder (position_x, position_y, color)

**Fichier**: `database/migrations/008_advanced_scheduling.sql`

### 2. Backend - Nouvelles routes
- ✅ Route `/api/staff/:staffId/availability` (GET, PUT)
- ✅ Route `/api/staff/:staffId/exceptions` (GET, POST, PATCH, DELETE)
- ✅ Route `/api/staff/groups/:groupId/members/:staffId/schedule` (PATCH)
- ✅ Enrichissement de `/api/staff-groups` avec custom_schedule et priority

**Fichiers**:
- `backend/src/routes/staffAvailability.ts` (nouveau)
- `backend/src/routes/staffGroups.ts` (modifié)
- `backend/src/index.ts` (route montée)

### 3. Frontend - Composants avancés
- ✅ `DispatchFlowBuilder.tsx` - Builder visuel avec React Flow
- ✅ `AdvancedScheduleManager.tsx` - Gestion horaires multi-niveaux

**Fichiers**:
- `frontend/src/components/DispatchFlowBuilder.tsx`
- `frontend/src/components/AdvancedScheduleManager.tsx`
- `frontend/package.json` (reactflow ajouté)

## 🚧 Prochaines étapes

### 4. Intégration dans Staff.tsx
Remplacer l'onglet Dispatch actuel par le nouveau DispatchFlowBuilder:

```tsx
// Dans DispatchTab()
import DispatchFlowBuilder from '../components/DispatchFlowBuilder';

// Remplacer le flow visuel actuel par:
<DispatchFlowBuilder
  rules={rules}
  groups={groups}
  staff={allStaff}
  onRuleClick={openEdit}
  onCreateRule={openCreate}
  onDeleteRule={handleDelete}
  onUpdatePositions={handleUpdatePositions}
/>
```

### 5. Ajouter gestion horaires dans StaffTab
Ajouter un bouton "Horaires" pour chaque membre qui ouvre un modal avec AdvancedScheduleManager:

```tsx
// Dans la table des membres, ajouter:
<button onClick={() => openScheduleManager(member)}>
  <Clock className="h-3.5 w-3.5" />
</button>

// Modal:
{showScheduleManager && selectedMember && (
  <AdvancedScheduleManager
    staff={selectedMember}
    groups={memberGroups}
    baseSchedule={memberAvailability?.schedule}
    exceptions={memberExceptions}
    onUpdateBaseSchedule={handleUpdateSchedule}
    onAddException={handleAddException}
    onDeleteException={handleDeleteException}
  />
)}
```

### 6. Implémenter les fonctions API
```tsx
const handleUpdatePositions = async (updates: { id: string; x: number; y: number }[]) => {
  await Promise.all(
    updates.map(({ id, x, y }) =>
      axios.patch(`/api/dispatch-rules/${id}`, { position_x: x, position_y: y })
    )
  );
};

const handleUpdateSchedule = async (staffId: string, schedule: WeeklySchedule) => {
  await axios.put(`/api/staff/${staffId}/availability`, { schedule });
};

const handleAddException = async (staffId: string, exception: any) => {
  await axios.post(`/api/staff/${staffId}/exceptions`, exception);
};
```

### 7. Migration de la base de données
Exécuter la migration:
```bash
# Dans le container Docker ou via psql
psql -U postgres -d receptio -f database/migrations/008_advanced_scheduling.sql
```

### 8. Installation des dépendances
```bash
cd frontend
npm install
```

## 📋 Fonctionnalités implémentées

### Dispatch Builder Visuel
- ✅ Canvas interactif avec zoom/pan
- ✅ Nœuds drag & drop
- ✅ Connexions visuelles animées
- ✅ Panneau de configuration par règle
- ✅ Sauvegarde des positions
- ✅ Bouton création rapide

### Gestion Horaires Avancée
- ✅ Horaires de base par membre
- ✅ Vue par groupe (placeholder)
- ✅ Exceptions (absences, congés, horaires spéciaux)
- ✅ Interface calendrier intuitive
- ✅ Codes couleur par type d'exception

### Multi-équipes
- ✅ Support membre dans plusieurs groupes
- ✅ Priorité par membre dans chaque groupe
- ✅ Horaires personnalisés par groupe (structure DB)

## 🎨 Design System

Tous les composants respectent la charte graphique:
- **Navy**: #344453
- **Orange**: #C7601D
- **Success**: #2D9D78
- **Warning**: #E6A817
- **Error**: #D94052
- **Fonts**: Plus Jakarta Sans (titres), DM Sans (corps), JetBrains Mono (code)

## 🔒 Sécurité & Permissions

Toutes les routes backend utilisent:
- `authenticateToken` pour l'authentification
- `requirePermission(req, 'staffManage')` pour les modifications
- Vérification company_id pour isolation multi-tenant

## 📝 Notes importantes

1. **React Flow CSS**: Importer `reactflow/dist/style.css` dans le composant
2. **Migrations**: Numérotation après 007_fix_user_invitations_uniqueness.sql
3. **Rétrocompatibilité**: Les anciennes données restent compatibles
4. **Performance**: Index DB créés pour toutes les requêtes fréquentes

## 🧪 Tests suggérés

1. Créer un membre avec horaires personnalisés
2. Ajouter le membre à plusieurs groupes
3. Définir des horaires différents par groupe
4. Créer des exceptions (congés, absences)
5. Créer des règles de dispatch et les réorganiser visuellement
6. Vérifier la sauvegarde des positions dans le flow builder

## 🚀 Déploiement

1. Exécuter la migration DB
2. Installer les dépendances frontend
3. Rebuild le backend (TypeScript)
4. Rebuild le frontend
5. Redémarrer les services

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm install
npm run build

# Docker
docker-compose restart
```
