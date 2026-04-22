# Dispatch Flow Builder - Persistance des positions

## ✅ Problème résolu

Les nœuds restent maintenant à leur position correcte après sauvegarde. Les nouvelles règles créées reçoivent automatiquement une position intelligente basée sur les règles existantes.

## 🎯 Implémentation

### 1. **Frontend - Calcul automatique de position**

Dans `Staff.tsx`, lors de la création d'une nouvelle règle :

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault(); 
  setSaving(true); 
  setError('');
  
  try {
    // Calculer une position automatique pour les nouvelles règles
    const xCenter = 400;
    let position_x = xCenter - 120;  // Position horizontale centrée
    let position_y = 200 + (rules.length * 300);  // Espacement vertical de 300px

    // Si on crée un nouveau nœud, calculer la position en bas des règles existantes
    if (!editingId && rules.length > 0) {
      const lastRule = rules[rules.length - 1];
      if (lastRule.position_y !== undefined && lastRule.position_y !== null) {
        position_y = lastRule.position_y + 300;
      }
    }

    const payload = {
      // ... autres champs
      // Ajouter la position pour les nouvelles règles
      ...(editingId ? {} : { position_x, position_y }),
    };
    
    if (editingId) await axios.patch(`/api/dispatch-rules/${editingId}`, payload);
    else await axios.post('/api/dispatch-rules', payload);
    
    setShowDrawer(false); 
    await fetchRules();
  } catch (err) {
    // ...
  }
};
```

### 2. **Backend - Support des positions**

#### Route `dispatchRules.ts`

**Schéma de validation Zod :**
```typescript
const ruleSchema = z.object({
  // ... autres champs
  position_x: z.number().optional(),
  position_y: z.number().optional(),
});
```

**Route POST (création) :**
```sql
INSERT INTO dispatch_rules (
  company_id, name, description, priority, enabled,
  condition_type, conditions,
  target_type, target_group_id, target_staff_id,
  distribution_strategy, agent_order,
  fallback_type, fallback_group_id, fallback_staff_id,
  position_x, position_y  -- ✅ Ajouté
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
RETURNING *
```

**Route PATCH (mise à jour) :**
```typescript
if (data.position_x !== undefined) { 
  setClauses.push(`position_x = $${idx++}`); 
  values.push(data.position_x); 
}
if (data.position_y !== undefined) { 
  setClauses.push(`position_y = $${idx++}`); 
  values.push(data.position_y); 
}
```

### 3. **Types TypeScript mis à jour**

#### `Staff.tsx`
```typescript
interface DispatchRule {
  // ... autres champs
  position_x?: number | null;
  position_y?: number | null;
}
```

#### `DispatchFlowBuilder.tsx`
```typescript
interface DispatchRule {
  // ... autres champs
  position_x?: number | null;
  position_y?: number | null;
}

// Utilisation avec null check
const conditionNode: Node<FlowNodeData> = {
  id: `${rule.id}-condition`,
  type: 'condition',
  position: {
    x: rule.position_x !== undefined && rule.position_x !== null 
      ? rule.position_x 
      : xCenter - 120,
    y: rule.position_y !== undefined && rule.position_y !== null 
      ? rule.position_y 
      : yOffset,
  },
  // ...
};
```

## 📊 Logique de positionnement

### Position par défaut (nouvelles règles)

- **X** : `400 - 120 = 280px` (centré horizontalement)
- **Y** : `200 + (nombre de règles × 300)px` (espacement vertical)

### Position intelligente

Si des règles existent déjà et ont des positions enregistrées :
- **X** : Position par défaut
- **Y** : Position de la dernière règle + 300px

### Exemple

```
Règle 1 : position_y = 200
Règle 2 : position_y = 500  (200 + 300)
Règle 3 : position_y = 800  (500 + 300)
```

## 🔄 Flux complet

### 1. Création d'une nouvelle règle

```
User clique "Ajouter un nœud" → Condition/Action/Fallback
  ↓
Frontend calcule position_x/position_y automatiquement
  ↓
POST /api/dispatch-rules avec position_x et position_y
  ↓
Backend insère en DB avec les positions
  ↓
Frontend recharge les règles
  ↓
DispatchFlowBuilder affiche le nœud à la position enregistrée
```

### 2. Déplacement d'un nœud existant

```
User déplace un nœud dans le canvas
  ↓
onNodeDragStop déclenché
  ↓
setHasChanges(true) → Bouton "Sauvegarder" apparaît
  ↓
User clique "Sauvegarder"
  ↓
onUpdatePositions appelé avec nouvelles positions
  ↓
Frontend envoie PATCH /api/dispatch-rules/:id pour chaque nœud
  ↓
Backend met à jour position_x et position_y en DB
```

## ✅ Avantages

1. **Positions préservées** : Les nœuds restent où l'utilisateur les a placés
2. **Positionnement automatique intelligent** : Les nouveaux nœuds ne se superposent pas
3. **Espacement cohérent** : 300px entre chaque règle
4. **Flexibilité** : L'utilisateur peut réorganiser librement

## 🎨 Résultat visuel

### Avant (sans positions)
```
[Start]
   ↓
[Condition 1]  [Condition 2]  [Condition 3]  ← Tous au même endroit!
```

### Après (avec positions)
```
[Start]
   ↓
[Condition 1]
   ↓
[Condition 2]
   ↓
[Condition 3]
```

Chaque règle a maintenant sa propre position unique et persistante !

## 🚀 Build réussi

```
✓ TypeScript compilé sans erreur
✓ Build terminé en 8.98s
✓ Staff.tsx: 185.81 kB (52.78 kB gzippé)
✓ Backend accepte position_x et position_y
```

## 📝 Tests recommandés

1. ✅ Créer une nouvelle règle → Vérifier qu'elle apparaît en bas
2. ✅ Déplacer un nœud → Sauvegarder → Recharger → Vérifier la position
3. ✅ Créer plusieurs règles → Vérifier l'espacement automatique
4. ✅ Éditer une règle existante → Vérifier que la position ne change pas
