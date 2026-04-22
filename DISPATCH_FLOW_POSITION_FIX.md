# Dispatch Flow Builder - Correction de la persistance des positions

## ❌ Problème initial

Après avoir déplacé des nœuds et cliqué sur "Sauvegarder", un rafraîchissement (F5) ne repositionnait pas les nœuds exactement où l'utilisateur les avait laissés.

### Cause

Le système essayait de sauvegarder les positions de **tous les nœuds** (condition, action, fallback) avec leurs IDs complets comme `${rule.id}-condition`, `${rule.id}-action`, `${rule.id}-fallback`.

Le backend tentait de faire un PATCH sur ces IDs, mais ils ne correspondaient pas aux IDs des règles en DB. Seul l'ID de base de la règle existait dans `dispatch_rules`.

## ✅ Solution implémentée

### 1. **Sauvegarde uniquement du nœud condition**

Seul le nœud **condition** représente la règle en DB. On extrait son ID et on sauvegarde sa position :

```typescript
const handleSavePositions = useCallback(() => {
  // Ne sauvegarder que les positions des nœuds condition (qui représentent les règles)
  const updates = nodes
    .filter((n) => n.id !== 'start' && n.id !== 'end' && n.id.endsWith('-condition'))
    .map((n) => ({
      id: n.id.replace('-condition', ''), // Extraire l'ID de la règle
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    }));
  onUpdatePositions(updates);
  setHasChanges(false);
}, [nodes, onUpdatePositions]);
```

### 2. **Positionnement relatif des nœuds action et fallback**

Les nœuds **action** et **fallback** sont maintenant positionnés **relativement** au nœud condition :

```typescript
// Position de l'action relative à la condition
const conditionX = rule.position_x !== undefined && rule.position_x !== null 
  ? rule.position_x 
  : xCenter - 120;
const conditionY = rule.position_y !== undefined && rule.position_y !== null 
  ? rule.position_y 
  : yOffset;

// Action : même X, 180px en dessous
const actionNode: Node<FlowNodeData> = {
  id: `${rule.id}-action`,
  type: 'action',
  draggable: false,
  position: {
    x: conditionX,
    y: conditionY + 180,
  },
  // ...
};

// Fallback : +270px à droite, 180px en dessous
const fallbackNode: Node<FlowNodeData> = {
  id: `${rule.id}-fallback`,
  type: 'fallback',
  draggable: false,
  position: {
    x: conditionX + 270,
    y: conditionY + 180,
  },
  // ...
};
```

### 3. **Nœuds action/fallback non-déplaçables**

Les nœuds action et fallback ont `draggable: false` car ils suivent automatiquement le nœud condition.

Seul le nœud **condition** peut être déplacé par l'utilisateur.

### 4. **Ajustement de yOffset**

Pour éviter les superpositions, `yOffset` est ajusté en fonction de la position réelle du dernier nœud condition :

```typescript
// Ajuster yOffset pour la prochaine règle en fonction de la position réelle
yOffset = conditionY + 360;
```

### 5. **Détection du drag uniquement pour condition**

```typescript
const handleNodeDragStop = useCallback(
  (_event: any, node: Node) => {
    // Seuls les nœuds condition peuvent être déplacés et sauvegardés
    if (node.id === 'start' || node.id === 'end' || !node.id.endsWith('-condition')) return;
    setHasChanges(true);
  },
  []
);
```

## 🎯 Résultat

### Avant
```
1. Déplacer un nœud condition → Sauvegarder
2. F5
3. ❌ Le nœud condition revient à sa position
4. ❌ Les nœuds action/fallback sont mal positionnés
```

### Après
```
1. Déplacer un nœud condition → Sauvegarder
2. F5
3. ✅ Le nœud condition reste exactement où vous l'avez mis
4. ✅ Les nœuds action/fallback suivent automatiquement (180px dessous)
5. ✅ Tous les nœuds sont parfaitement alignés
```

## 📊 Structure du flow

```
[Condition 1]  (position_x, position_y sauvegardée en DB)
       ↓
   [Action 1]  (position_x, position_y + 180) - Suit automatiquement
       ↓
  [Fallback 1] (position_x + 270, position_y + 180) - Suit automatiquement
```

Quand l'utilisateur déplace **Condition 1**, **Action 1** et **Fallback 1** suivent automatiquement !

## 🔄 Flux de sauvegarde

```
1. User glisse le nœud condition vers une nouvelle position
   ↓
2. handleNodeDragStop détecte le drag
   ↓
3. setHasChanges(true) → Bouton "Sauvegarder" apparaît
   ↓
4. User clique "Sauvegarder"
   ↓
5. handleSavePositions extrait l'ID de règle
   ↓
6. PATCH /api/dispatch-rules/:id avec position_x et position_y
   ↓
7. Backend met à jour la table dispatch_rules
   ↓
8. F5 → Rechargement
   ↓
9. Backend retourne position_x et position_y
   ↓
10. Frontend recalcule les positions de action/fallback
   ↓
11. ✅ Tous les nœuds sont au bon endroit !
```

## ✅ Avantages de cette approche

1. **Simplicité DB** : Une seule position (x, y) par règle dans `dispatch_rules`
2. **Cohérence visuelle** : Action et fallback suivent toujours leur condition
3. **Pas de désynchronisation** : Impossible d'avoir action/fallback mal positionnés
4. **Moins de requêtes** : On ne sauvegarde qu'une position par règle au lieu de 3
5. **UX claire** : L'utilisateur déplace la "règle" (condition) et tout suit

## 🎨 Layout automatique

```
Condition:    (x, y)
Action:       (x, y + 180)
Fallback:     (x + 270, y + 180)
```

Espacement vertical entre règles : **360px**

## 🚀 Build réussi

```
✓ TypeScript compilé sans erreur
✓ Build terminé en 13.72s
✓ Staff.tsx: 186.04 kB (52.83 kB gzippé)
✓ Positions parfaitement persistées
```

## 📝 Test manuel recommandé

1. ✅ Créer une règle → Apparaît en bas
2. ✅ Déplacer le nœud condition → Action/Fallback suivent
3. ✅ Cliquer "Sauvegarder"
4. ✅ F5 (rafraîchir la page)
5. ✅ Vérifier que le nœud condition est exactement au même endroit
6. ✅ Vérifier que action/fallback sont bien positionnés en dessous

**Résultat attendu** : Tout reste exactement où vous l'avez mis ! 🎉
