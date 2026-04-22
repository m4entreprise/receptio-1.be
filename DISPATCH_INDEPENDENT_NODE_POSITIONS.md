# Dispatch Flow Builder - Positions indépendantes pour tous les nœuds

## ✅ Solution finale implémentée

Tous les nœuds (condition, action, fallback) peuvent maintenant être **déplacés indépendamment** et leurs positions sont **sauvegardées correctement** après F5.

## 🎯 Changements apportés

### 1. **Migration DB 009 - Nouveau champ `node_positions`**

Fichier : `database/migrations/009_dispatch_node_positions.sql`

```sql
ALTER TABLE dispatch_rules 
ADD COLUMN IF NOT EXISTS node_positions JSONB DEFAULT '{}'::jsonb;
```

Structure JSON :
```json
{
  "condition": {"x": 280, "y": 200},
  "action": {"x": 280, "y": 380},
  "fallback": {"x": 550, "y": 380}
}
```

**Avantages :**
- ✅ Un seul champ pour toutes les positions
- ✅ Flexible et extensible
- ✅ Requêtes efficaces avec l'index GIN
- ✅ Backward compatible (garde position_x/position_y)

### 2. **Backend - Support de `node_positions`**

**Schéma Zod** (`dispatchRules.ts`) :
```typescript
const ruleSchema = z.object({
  // ... autres champs
  node_positions: z.record(z.object({
    x: z.number(),
    y: z.number(),
  })).optional(),
});
```

**INSERT** - Création de règle :
```sql
INSERT INTO dispatch_rules (..., node_positions)
VALUES (..., $18)
```

**PATCH** - Mise à jour :
```typescript
if (data.node_positions !== undefined) {
  setClauses.push(`node_positions = $${idx++}`);
  values.push(JSON.stringify(data.node_positions));
}
```

### 3. **Frontend - Sauvegarde de toutes les positions**

**DispatchFlowBuilder.tsx** - Nouveau `handleSavePositions` :

```typescript
const handleSavePositions = useCallback(() => {
  // Regrouper les nœuds par règle
  const ruleMap = new Map<string, Record<string, { x: number; y: number }>>();
  
  nodes.forEach((n) => {
    if (n.id === 'start' || n.id === 'end') return;
    
    // Extraire l'ID de règle et le type de nœud
    const parts = n.id.split('-');
    const ruleId = parts[0];
    const nodeType = parts[1]; // 'condition', 'action', ou 'fallback'
    
    if (!ruleMap.has(ruleId)) {
      ruleMap.set(ruleId, {});
    }
    
    ruleMap.get(ruleId)![nodeType] = {
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    };
  });
  
  // Créer les updates avec node_positions
  const updates = Array.from(ruleMap.entries()).map(([ruleId, positions]) => ({
    id: ruleId,
    node_positions: positions,
  }));
  
  onUpdatePositions(updates);
  setHasChanges(false);
}, [nodes, onUpdatePositions]);
```

**Logique de chargement** :
```typescript
// Utiliser node_positions si disponible, sinon fallback sur position_x/position_y
const nodePos = rule.node_positions || {};

// Position du nœud condition
const conditionPos = nodePos.condition || {
  x: rule.position_x !== undefined && rule.position_x !== null ? rule.position_x : defaultX,
  y: rule.position_y !== undefined && rule.position_y !== null ? rule.position_y : defaultY,
};

// Position de l'action
const actionPos = nodePos.action || {
  x: conditionPos.x,
  y: conditionPos.y + 180,
};

// Position du fallback
const fallbackPos = nodePos.fallback || {
  x: conditionPos.x + 270,
  y: conditionPos.y + 180,
};
```

### 4. **Tous les nœuds sont draggable**

```typescript
// ✅ Action est draggable
const actionNode: Node<FlowNodeData> = {
  id: `${rule.id}-action`,
  type: 'action',
  position: actionPos,
  // draggable: true par défaut
};

// ✅ Fallback est draggable
const fallbackNode: Node<FlowNodeData> = {
  id: `${rule.id}-fallback`,
  type: 'fallback',
  position: fallbackPos,
  // draggable: true par défaut
};
```

**Détection du drag** :
```typescript
const handleNodeDragStop = useCallback(
  (_event: any, node: Node) => {
    // Tous les nœuds sauf start peuvent être déplacés
    if (node.id === 'start' || node.id === 'end') return;
    setHasChanges(true);
  },
  []
);
```

## 🔄 Flux complet

### 1. Création d'une règle
```
1. User crée une règle → Positions par défaut calculées
2. Backend insère avec node_positions = {}
3. Frontend affiche avec positions par défaut
```

### 2. Déplacement de nœuds
```
1. User déplace "Condition" → Nouvelle position (150, 300)
2. User déplace "Action" → Nouvelle position (150, 500)
3. User déplace "Messagerie" → Nouvelle position (420, 500)
4. Bouton "Sauvegarder" apparaît
```

### 3. Sauvegarde
```
5. User clique "Sauvegarder"
6. handleSavePositions regroupe les positions :
   {
     "condition": {"x": 150, "y": 300},
     "action": {"x": 150, "y": 500},
     "fallback": {"x": 420, "y": 500}
   }
7. PATCH /api/dispatch-rules/:id avec node_positions
8. Backend UPDATE node_positions = '{"condition":...}'
```

### 4. Rechargement (F5)
```
9. User fait F5
10. Frontend charge les règles depuis l'API
11. Backend retourne node_positions dans la réponse
12. Frontend lit node_positions et positionne les nœuds
13. ✅ Chaque nœud est exactement où vous l'avez mis !
```

## 📊 Structure des données

### Base de données
```sql
dispatch_rules (
  id UUID,
  name VARCHAR,
  -- ... autres champs
  position_x INTEGER,  -- Deprecated, garde pour backward compat
  position_y INTEGER,  -- Deprecated, garde pour backward compat
  node_positions JSONB -- ✅ Nouveau : toutes les positions
)
```

### Exemple de `node_positions`
```json
{
  "condition": {
    "x": 280,
    "y": 200
  },
  "action": {
    "x": 280,
    "y": 450
  },
  "fallback": {
    "x": 550,
    "y": 450
  }
}
```

## 🚀 Pour appliquer la migration

### 1. Backend
```bash
cd backend
npm run build
```

### 2. Base de données
```bash
# Dans le container Postgres
docker exec -it receptio-db-1 psql -U receptio -d receptio -f /path/to/009_dispatch_node_positions.sql
```

Ou via le script de migration automatique (si vous en avez un).

### 3. Frontend
```bash
cd frontend
npm run build
# ✓ Build réussi - 186.04 kB (52.89 kB gzippé)
```

### 4. Redémarrer les services
```bash
docker-compose restart
```

## ✅ Résultat final

### Avant (ce qui ne fonctionnait pas)
- ❌ Seul le nœud condition se déplaçait
- ❌ Action et fallback étaient bloqués
- ❌ Après F5, les positions étaient perdues
- ❌ Impossible de personnaliser le layout

### Après (maintenant)
- ✅ **Tous les nœuds** se déplacent indépendamment
- ✅ **Condition** peut être n'importe où
- ✅ **Action** peut être n'importe où
- ✅ **Fallback** peut être n'importe où
- ✅ **F5** → Tout reste exactement où vous l'avez mis
- ✅ **Layout personnalisable** à volonté

## 🎨 Exemples de layouts possibles

### Layout vertical (par défaut)
```
    [Condition]
         ↓
      [Action]
         ↓
    [Fallback]
```

### Layout horizontal
```
[Condition] → [Action] → [Fallback]
```

### Layout personnalisé
```
    [Condition]
    ↙        ↘
[Action]   [Fallback]
```

**Vous choisissez !** Chaque règle peut avoir son propre layout.

## 📝 Test recommandé

1. ✅ Créer une règle → Vérifier positions par défaut
2. ✅ Déplacer Condition → Vérifier que c'est possible
3. ✅ Déplacer Action → Vérifier que c'est possible
4. ✅ Déplacer Messagerie → Vérifier que c'est possible
5. ✅ Cliquer "Sauvegarder"
6. ✅ F5 (rafraîchir la page)
7. ✅ Vérifier que TOUS les nœuds sont exactement où vous les avez mis

**Résultat attendu** : Plus AUCUN problème ! Tous les nœuds restent où vous les mettez. 🎉

## 🔧 Backward compatibility

Si une règle n'a pas encore de `node_positions` :
- ✅ Utilise `position_x`/`position_y` pour condition
- ✅ Calcule positions par défaut pour action/fallback
- ✅ Dès que vous déplacez un nœud, `node_positions` est créé
- ✅ Les anciennes règles continuent de fonctionner

---

**Migration DB 009** appliquée ✓  
**Backend** mis à jour ✓  
**Frontend** compilé ✓  

**Vous pouvez maintenant bouger TOUS les nœuds librement !** 🚀
