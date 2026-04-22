# Dispatch Flow Builder - Formulaires contextualisés

## ✅ Ce qui a été implémenté

Le formulaire du drawer s'adapte maintenant automatiquement selon le type de nœud sélectionné dans le menu "Ajouter un nœud".

## 🎯 Comportement par type de nœud

### 1. **Type: Condition** (Jaune/Warning)

**Champs affichés :**
- ✅ Nom de la règle
- ✅ Description (optionnel)
- ✅ **Déclencheur**
  - Toujours
  - Par intention IA (avec champ de mots-clés)

**Champs masqués :**
- ❌ Cible du transfert
- ❌ Fallback

**Bouton de soumission :** "Créer la condition"

---

### 2. **Type: Action** (Orange)

**Champs affichés :**
- ✅ Nom de la règle
- ✅ Description (optionnel)
- ✅ **Cible du transfert**
  - Groupe d'agents
    - Sélection du groupe
    - Stratégie (Séquentiel/Aléatoire/Simultané)
    - Ordre de priorité (si Séquentiel)
  - Agent spécifique
    - Sélection de l'agent

**Champs masqués :**
- ❌ Déclencheur
- ❌ Fallback

**Bouton de soumission :** "Créer l'action"

---

### 3. **Type: Fallback** (Vert)

**Champs affichés :**
- ✅ Nom de la règle
- ✅ Description (optionnel)
- ✅ **Si personne ne répond…**
  - Messagerie vocale
  - Raccrocher
  - Autre groupe
  - Autre agent

**Champs masqués :**
- ❌ Déclencheur
- ❌ Cible du transfert

**Bouton de soumission :** "Créer le fallback"

---

### 4. **Type: Règle complète** (par défaut)

Lorsqu'on clique sur le bouton "Nouvelle règle" en haut à droite (au lieu du menu du flow builder), le formulaire affiche **tous les champs** comme avant.

**Bouton de soumission :** "Créer la règle"

---

## 📋 Code implémenté

### DispatchFlowBuilder.tsx

```typescript
interface DispatchFlowBuilderProps {
  // ...
  onCreateRule: (nodeType?: 'condition' | 'action' | 'fallback') => void;
  // ...
}

const handleAddNode = (type: 'condition' | 'action' | 'fallback') => {
  setShowNodeMenu(false);
  onCreateRule(type);
};
```

### Staff.tsx

```typescript
// État pour le type de nœud
const [nodeType, setNodeType] = useState<'condition' | 'action' | 'fallback' | null>(null);

// Fonction openCreate adaptée
const openCreate = (type?: 'condition' | 'action' | 'fallback') => {
  setEditingId(null);
  setNodeType(type || null);
  setForm({ ...emptyRuleForm });
  setError('');
  setShowDrawer(true);
};

// Titre du drawer adapté
{editingId 
  ? 'Modifier la règle' 
  : nodeType === 'condition' 
  ? 'Nouvelle condition'
  : nodeType === 'action'
  ? 'Nouvelle action'
  : nodeType === 'fallback'
  ? 'Nouveau fallback'
  : 'Nouvelle règle de dispatch'}

// Sections conditionnelles
{(nodeType === null || nodeType === 'condition') && (
  <div>
    {/* Section Déclencheur */}
  </div>
)}

{(nodeType === null || nodeType === 'action') && (
  <div>
    {/* Section Cible du transfert */}
  </div>
)}

{(nodeType === null || nodeType === 'fallback') && (
  <div>
    {/* Section Fallback */}
  </div>
)}
```

## 🎨 Expérience utilisateur

### Workflow simplifié

1. **Cliquer sur "Ajouter un nœud"** dans le flow builder
2. **Choisir le type** : Condition, Action, ou Fallback
3. **Remplir uniquement les champs pertinents** pour ce type
4. **Créer** avec un bouton spécifique au type

### Avantages

- ✅ **Formulaire simplifié** : Moins de champs = moins de confusion
- ✅ **Guidage clair** : L'utilisateur sait exactement ce qu'il crée
- ✅ **Workflow logique** : Correspond au flow visuel
- ✅ **Boutons contextuels** : "Créer la condition" vs "Créer l'action"

## 🔧 Prochaines améliorations possibles

1. **Valeurs par défaut intelligentes**
   - Pre-remplir certains champs selon le type
   - Ex: Pour fallback, pré-sélectionner "Messagerie vocale"

2. **Validation adaptée**
   - Valider seulement les champs visibles
   - Messages d'erreur spécifiques au type

3. **Preview visuel**
   - Montrer un aperçu du nœud pendant la création
   - Aperçu des connexions possibles

4. **Drag & drop depuis le menu**
   - Glisser le type de nœud directement sur le canvas
   - Positionnement manuel lors de la création

## 📊 Tableau récapitulatif

| Type | Nom | Description | Déclencheur | Cible | Fallback |
|------|-----|-------------|-------------|-------|----------|
| **Condition** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Action** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Fallback** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Règle complète** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

**Build réussi !** ✓ Staff.tsx: 185.60 kB (52.69 kB gzippé)
