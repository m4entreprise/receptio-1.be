# Instructions de migration - Refonte Équipe

## ✅ Étapes complétées

1. ✅ Dépendances frontend installées (`npm install`)
2. ✅ Build frontend réussi
3. ✅ Code TypeScript corrigé

## 🔄 Prochaines étapes

### 1. Démarrer Docker Desktop

Assurez-vous que Docker Desktop est démarré sur votre machine Windows.

### 2. Exécuter la migration de base de données

Une fois Docker démarré, exécutez la migration 008 :

```powershell
# Option A: Via docker-compose exec (recommandé)
docker-compose exec postgres psql -U postgres -d receptio -f /docker-entrypoint-initdb.d/migrations/008_advanced_scheduling.sql

# Option B: Copier le fichier puis exécuter
docker cp database/migrations/008_advanced_scheduling.sql receptio-1be-postgres-1:/tmp/
docker-compose exec postgres psql -U postgres -d receptio -f /tmp/008_advanced_scheduling.sql
```

### 3. Redémarrer les services

```powershell
docker-compose restart backend
```

### 4. Vérifier que tout fonctionne

1. Ouvrir l'application: http://localhost:5173
2. Aller dans **Équipe**
3. Vérifier que les 3 onglets s'affichent correctement
4. Tester la création d'un membre
5. Tester l'ajout à un groupe

## 📋 Nouvelles fonctionnalités disponibles

### Backend - Nouvelles routes API

- `GET /api/staff/:staffId/availability` - Récupérer les horaires d'un membre
- `PUT /api/staff/:staffId/availability` - Mettre à jour les horaires
- `GET /api/staff/:staffId/exceptions` - Liste des exceptions (congés, absences)
- `POST /api/staff/:staffId/exceptions` - Créer une exception
- `PATCH /api/staff/:staffId/exceptions/:id` - Modifier une exception
- `DELETE /api/staff/:staffId/exceptions/:id` - Supprimer une exception
- `PATCH /api/staff/groups/:groupId/members/:staffId/schedule` - Horaires personnalisés par groupe

### Frontend - Composants disponibles

Les composants sont créés mais **pas encore intégrés** dans Staff.tsx :

1. **DispatchFlowBuilder** - Builder visuel avec React Flow
   - Canvas interactif
   - Drag & drop
   - Sauvegarde des positions

2. **AdvancedScheduleManager** - Gestion horaires avancée
   - Horaires de base
   - Horaires par groupe
   - Exceptions (congés, absences)

## 🔧 Intégration dans Staff.tsx (à faire)

Pour intégrer les nouveaux composants, voir le guide détaillé dans `REFONTE_EQUIPE.md`.

### Exemple rapide pour le Dispatch Builder

```tsx
import DispatchFlowBuilder from '../components/DispatchFlowBuilder';

// Dans DispatchTab(), remplacer le flow actuel par:
<DispatchFlowBuilder
  rules={rules}
  groups={groups}
  staff={allStaff}
  onRuleClick={openEdit}
  onCreateRule={openCreate}
  onDeleteRule={handleDelete}
  onUpdatePositions={async (updates) => {
    await Promise.all(
      updates.map(({ id, x, y }) =>
        axios.patch(`/api/dispatch-rules/${id}`, { position_x: x, position_y: y })
      )
    );
  }}
/>
```

## 🐛 Dépannage

### Docker ne démarre pas
- Vérifier que Docker Desktop est installé
- Redémarrer Docker Desktop
- Vérifier les logs: `docker-compose logs`

### Migration échoue
- Vérifier que la base de données est accessible
- Vérifier que les migrations précédentes sont appliquées
- Consulter les logs PostgreSQL: `docker-compose logs postgres`

### Build frontend échoue
- Supprimer node_modules: `rm -rf frontend/node_modules`
- Réinstaller: `cd frontend && npm install`
- Rebuild: `npm run build`

## 📚 Documentation complète

Voir `REFONTE_EQUIPE.md` pour:
- Architecture détaillée
- Exemples de code complets
- Guide d'intégration pas à pas
- Tests suggérés
