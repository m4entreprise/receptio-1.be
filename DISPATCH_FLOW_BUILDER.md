# Dispatch Flow Builder - Éditeur de workflow visuel

## ✅ Nouvelle version implémentée

Le DispatchFlowBuilder a été complètement refondu pour offrir une **vraie expérience de workflow builder** avec des nœuds glissables et des connexions personnalisables.

## 🎨 Types de nœuds

### 1. **Nœud Start** (Appel entrant)
- Point d'entrée du flux
- Non déplaçable
- Couleur: Navy (#344453)

### 2. **Nœud Condition** (Jaune/Warning)
- Évalue une condition (intent, horaire, appelant...)
- **2 sorties** :
  - ✅ Handle "true" (gauche) - Condition vraie → Vert (#2D9D78)
  - ❌ Handle "false" (droite) - Condition fausse → Rouge (#D94052)
- Glissable et éditable
- Couleur: Warning (#E6A817)

### 3. **Nœud Action** (Orange)
- Action à exécuter (transfert groupe/agent, messagerie, raccrocher)
- 1 entrée, 1 sortie
- Affiche la stratégie de distribution (séquentiel, aléatoire, simultané)
- Glissable et éditable
- Couleur: Orange (#C7601D)

### 4. **Nœud Fallback** (Vert)
- Action de secours si pas de réponse
- 1 entrée, pas de sortie
- Couleur: Success (#2D9D78)

## 🔗 Connexions

### Connexions de condition
- **Verte** (ligne pleine) : Condition vraie → "Oui"
- **Rouge** (ligne pleine) : Condition fausse → "Non"
- **Rouge pointillée** : Fallback → "Pas de réponse"

### Connexions animées
Toutes les connexions sont animées pour montrer le sens du flux.

## 🎯 Fonctionnalités

### Menu d'ajout de nœuds
Bouton "Ajouter un nœud" en haut à droite avec 3 options :
1. **Condition** - Intent, horaire, appelant…
2. **Action** - Transfert, messagerie…
3. **Fallback** - Si pas de réponse

### Drag & Drop
- Tous les nœuds (sauf Start) sont déplaçables
- Les positions sont sauvegardées automatiquement
- Bouton "Sauvegarder" apparaît quand il y a des changements

### Légende
Panneau en bas à gauche expliquant les couleurs :
- 🟢 Condition vraie
- 🔴 Condition fausse
- ⭕ Fallback (pointillé)

### Zoom & Pan
- Zoom : 0.3x à 1.5x
- Zoom par défaut : 0.8x
- Pan libre sur le canvas
- Contrôles de zoom dans le coin

## 📐 Structure du flux

Pour chaque règle de dispatch, le builder crée automatiquement :

```
[Start]
   ↓
[Condition: Intent = "support" ?]
   ↓ Oui (vert)          ↓ Non (rouge)
[Action: Transfert]   [Condition suivante]
   ↓ Pas de réponse (rouge pointillé)
[Fallback: Messagerie]
```

## 🎨 Codes couleur

| Élément | Couleur | Hex |
|---------|---------|-----|
| Start | Navy | #344453 |
| Condition | Warning | #E6A817 |
| Action | Orange | #C7601D |
| Fallback | Success | #2D9D78 |
| Connexion vraie | Success | #2D9D78 |
| Connexion fausse | Error | #D94052 |

## 🔧 Utilisation dans Staff.tsx

```tsx
import DispatchFlowBuilder from '../components/DispatchFlowBuilder';

// Dans DispatchTab()
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

## 🚀 Avantages vs ancienne version

### Avant (liste par priorité)
- ❌ Vision linéaire verticale
- ❌ Pas de branchements visuels
- ❌ Difficile de voir les conditions
- ❌ Pas de drag & drop

### Maintenant (flow builder)
- ✅ Vision map/graphe
- ✅ Branchements conditionnels clairs (Oui/Non)
- ✅ Nœuds de types différents
- ✅ Drag & drop complet
- ✅ Connexions personnalisables
- ✅ Légende intégrée
- ✅ Menu contextuel pour ajouter des nœuds

## 🎯 Prochaines améliorations possibles

1. **Connexions personnalisées** : Permettre de connecter manuellement les nœuds
2. **Nœuds multiples** : Ajouter plusieurs conditions en parallèle
3. **Groupes de nœuds** : Regrouper des nœuds dans des containers
4. **Templates** : Sauvegarder et réutiliser des flows complets
5. **Validation** : Vérifier que le flow est complet avant sauvegarde
6. **Export/Import** : Exporter le flow en JSON

## 📊 Exemple de flux complexe

```
[Appel entrant]
       ↓
[Intent = "urgence" ?]
   ↓ Oui                    ↓ Non
[Transfert Urgences]    [Horaire ouvert ?]
   ↓ Pas réponse           ↓ Oui              ↓ Non
[Messagerie]         [Transfert Support]  [Messagerie]
                        ↓ Pas réponse
                     [Transfert Direction]
```

Ce type de flux est maintenant **visuellement clair** avec le nouveau builder !
