# Rapport prix technique - Réceptio

**Destinataire** : CFO  
**Date** : 23 avril 2026  
**Objet** : validation des hypothèses de coût technique et de pricing pour les offres téléphoniques A, B et C

---

# 1. Résumé exécutif

Ce document synthétise l'analyse technique et économique des trois parcours téléphoniques de Réceptio :

- **Offre A** : Répondeur classique
- **Offre B** : Réceptionniste IA streaming
- **Offre C** : Appels sortants

## Hypothèses de coût interne retenues pour le business plan

- **A** : `0,025 / min`
- **B** : `0,05 / min`
- **C** : `0,10 / min`

Ces hypothèses sont **prudentes** et **cohérentes** avec :

- la facture Twilio disponible
- les tarifs IA fournis pour Mistral
- le fonctionnement réel du backend vérifié dans le code
- le choix commercial de **facturer dès la création de l'appel**, avec une **minute minimale**
- l'existence d'une **licence agent à `49,99 € HTVA / mois`** destinée à absorber le coût du numéro, de l'infrastructure et les éventuelles pertes ponctuelles

## Conclusion de gestion

La combinaison suivante est économiquement saine :

- **coût interne piloté** : `0,025 / 0,05 / 0,10`
- **licence fixe** : `49,99 € HTVA / agent / mois`
- **facturation à la minute** avec minimum une minute
- **pricing cible** à `x2` minimum, `x2.5` à `x3` idéalement selon l'offre et le niveau de confort souhaité

Le principal point de vigilance reste **l'offre C**, car son coût est majoritairement porté par **Twilio outbound voice**. Néanmoins, au niveau d'hypothèse retenu (`0,10 / min`) et avec la licence agent, le modèle reste défendable.

---

# 2. Objectif du rapport

L'objectif est de fournir au CFO un cadre simple et défendable pour :

- estimer les **coûts variables par minute** des trois offres
- distinguer ce qui relève de **Twilio** et de **l'IA**
- fixer des **hypothèses de coût interne prudentes** pour le business plan
- vérifier qu'une stratégie commerciale basée sur une **licence + une facturation variable à la minute** protège correctement la marge

Ce rapport ne cherche pas à produire une comptabilité analytique exhaustive. Il vise à fournir un **référentiel de décision** robuste, utilisable immédiatement dans un prévisionnel.

---

# 3. Sources utilisées

## Sources tarifaires fournisseurs

### Twilio
Base utilisée : **facture Twilio fournie**.

Lignes principales observées :

- **Inbound Voice Minutes** : `223 min` pour `2,23 $`
- **Outbound Voice Minutes** : `98 min` pour `3,7926 $`
- **Media Streams** : `126 min` pour `0,504 $`
- **Gather Speech Recognition** : `58 tranches de 15 s` pour `1,044 $`
- **Voice Recordings** : `98 min` pour `0,245 $`
- **Text To Speech - Amazon Polly** : `19 usages` pour `0,02 $`
- **Call Recording Storage** : actuellement `0,00 $`

### Mistral
Tarifs fournis :

- **STT `voxtral-mini-2602`** : `0,003 $ / minute`
- **LLM `mistral-small-2603` input** : `0,155 $ / 1M tokens`
- **LLM `mistral-small-2603` output** : `0,6 $ / 1M tokens`
- **TTS `voxtral-mini-ts-2603`** : `0,0169 $ / 1000 caractères`
- **Analyse conversation `mistral-large-2512` input** : `0,5 $ / 1M tokens`
- **Analyse conversation `mistral-large-2512` output** : `1,5 $ / 1M tokens`

## Sources techniques

Le fonctionnement réel a été vérifié dans le backend :

- `backend/src/routes/webhooks.ts`
- `backend/src/routes/outboundCalls.ts`
- `backend/src/services/twilioMediaStreams.ts`
- `backend/src/routes/staff.ts`

Cela permet de valider que les coûts retenus correspondent bien aux flux techniques réellement utilisés.

---

# 4. Règles d'interprétation financière

## 4.1 Coûts fournisseurs en dollars

Les coûts Twilio et Mistral observés sont **nativement en dollars**.

## 4.2 Pricing commercial en euros

La licence agent est exprimée en **euros HTVA**.

## 4.3 Convention de ce rapport

Les montants unitaires par minute retenus pour le business plan sont des **hypothèses de pilotage** :

- **A** : `0,025 / min`
- **B** : `0,05 / min`
- **C** : `0,10 / min`

Pour la version finale du modèle financier, il faudra :

- convertir explicitement les coûts fournisseurs USD en EUR
- intégrer un **buffer de change**
- vérifier si certaines destinations Twilio sortantes ont un coût supérieur à la moyenne observée sur la facture actuelle

---

# 5. Cartographie technique des offres

# 5.1 Offre A - Répondeur classique

## Parcours technique

- appel entrant Twilio
- lecture du message d'accueil
- enregistrement du message vocal
- transcription / résumé / qualification côté IA

## Composantes de coût

- **Twilio inbound voice**
- **Twilio voice recordings**
- **Twilio recording storage** si activé et facturé
- **Twilio Gather** si le flux utilise de la reconnaissance vocale Twilio
- **Mistral STT** pour transcription
- **Mistral LLM** pour résumé / intention / qualification
- **Mistral TTS** si le message d'accueil est généré côté IA
- **Twilio Polly / `<Say>`** uniquement dans certains cas résiduels

## Lecture économique

Le coût de l'offre A est relativement faible et stable. Le vrai risque de hausse vient surtout :

- d'un éventuel usage de **Gather**
- de scénarios très courts où les coûts fixes par appel pèsent proportionnellement davantage

---

# 5.2 Offre B - Réceptionniste IA streaming

## Parcours technique

- appel entrant Twilio
- ouverture d'un **Media Stream** temps réel
- STT en continu
- LLM conversationnel
- TTS pour les réponses vocales
- enregistrement éventuel de l'appel

## Composantes de coût

- **Twilio inbound voice**
- **Twilio Media Streams**
- **Twilio voice recordings**
- **Twilio recording storage** si activé et facturé
- **Mistral STT**
- **Mistral LLM**
- **Mistral TTS**

## Lecture économique

L'offre B coûte plus cher que l'offre A car elle cumule :

- la voix Twilio
- le transport streaming temps réel
- le STT
- le raisonnement LLM
- la TTS IA

Le poste le plus sensible n'est généralement pas le LLM, mais **le volume de TTS généré pendant la conversation**.

---

# 5.3 Offre C - Appels sortants

## Parcours technique

Le flux sortant actuel est **agent-first** :

- Twilio appelle d'abord l'agent
- dès que l'agent décroche, Twilio compose ensuite le client
- un **Media Stream** est ouvert
- l'appel est enregistré
- une transcription / analyse post-appel est déclenchée

## Point critique de compréhension

Pendant la conversation, l'offre C consomme bien **deux jambes outbound voice** :

- une jambe vers l'agent
- une jambe vers le client

C'est la raison principale pour laquelle l'offre C est structurellement la plus coûteuse des trois.

## Hypothèse retenue pour le business plan

Pour l'offre C, l'hypothèse retenue est la suivante :

- **un seul STT en fin d'appel**, avec diarization
- pas de STT live double-piste facturé sur toute la durée dans le modèle financier retenu

## Composantes de coût

- **Twilio outbound voice x2**
- **Twilio Media Streams**
- **Twilio voice recordings**
- **Twilio recording storage** si activé et facturé
- **Mistral STT** en fin d'appel
- **Mistral Large** pour analyse agent + client
- **Twilio Polly / `<Say>`** pour l'annonce de mise en relation

## Lecture économique

Sur l'offre C, le coût est dominé par **Twilio**, pas par le LLM d'analyse.

Même avec `mistral-large-2512`, l'analyse post-appel reste en général un coût secondaire par rapport au poste télécom.

---

# 6. Hypothèses de coût interne retenues

# 6.1 Synthèse

| Offre | Hypothèse de coût interne | Positionnement | Commentaire |
|---|---:|---|---|
| A - Répondeur classique | `0,025 / min` | Prudent | Au-dessus du coût technique attendu, couvre les variations et un éventuel peu de Gather |
| B - Réceptionniste IA | `0,05 / min` | Prudent / pessimiste | Couvre la variabilité liée au TTS et à l'intensité de conversation |
| C - Appels sortants | `0,10 / min` | Prudent | Couvre la double jambe outbound, le stream, l'enregistrement, le STT fin d'appel et l'analyse |

---

# 6.2 Justification détaillée par offre

## A - `0,025 / min`

Ordre de grandeur du coût technique observé :

- inbound voice
- recording
- 1 STT
- un faible coût LLM
- un TTS limité

Dans un scénario standard, le coût réel est inférieur à `0,025 / min`. Ce niveau est donc adapté comme **hypothèse prudente de pilotage**.

## B - `0,05 / min`

L'offre B combine plusieurs postes actifs en même temps :

- voix Twilio
- Media Streams
- STT
- LLM
- TTS IA
- enregistrement

Le TTS est le principal facteur de variabilité. Retenir `0,05 / min` permet de garder un niveau prudent sans exagérer artificiellement le coût.

## C - `0,10 / min`

L'offre C est tirée par :

- **2 jambes outbound voice**
- Media Streams
- enregistrement
- STT fin d'appel
- analyse post-appel

L'hypothèse `0,10 / min` inclut donc déjà un niveau de prudence raisonnable, surtout combiné au fait que la facturation démarre dès la création de l'appel.

---

# 7. Focus CFO sur l'offre C

# 7.1 Pourquoi l'offre C est plus chère

L'offre C cumule des coûts qu'on ne retrouve pas tous dans A et B :

- le call vers l'agent
- le call vers le client
- la fenêtre de mise en relation
- le stream
- l'enregistrement
- la transcription / analyse post-appel

Même si le client n'a pas encore répondu, il y a déjà un coût côté opérateur.

# 7.2 Pourquoi le fait de facturer dès la création de l'appel est important

Le modèle commercial retenu indique :

- **l'appel est facturé dès sa création**
- **une minute entière commence à être facturée immédiatement**

Cette règle protège fortement l'économie de l'offre C car elle monétise :

- le temps de composition
- le temps de mise en relation
- la jambe agent
- les appels courts
- les appels où le client répond tardivement

Autrement dit, la politique de facturation est **mieux alignée avec la structure de coût réelle**.

# 7.3 Impact de l'analyse `mistral-large-2512`

L'analyse post-appel agent + client est incluse dans le coût retenu pour C.

Tarifs utilisés :

- input : `0,5 / 1M tokens`
- output : `1,5 / 1M tokens`

## Exemple illustratif

Exemple d'analyse chargée :

- `15 000 tokens input`
- `2 000 tokens output`

Coût par appel :

```text
Input  = 15 000 / 1 000 000 × 0,5 = 0,0075
Output =  2 000 / 1 000 000 × 1,5 = 0,0030
Total  = 0,0105 par appel
```

Sur un appel de `5 min`, cela représente :

```text
0,0105 / 5 = 0,0021 / min
```

Conclusion : **l'analyse LLM augmente le coût, mais reste secondaire par rapport aux deux jambes outbound voice**.

---

# 8. Licence agent à 49,99 € HTVA

# 8.1 Rôle économique de la licence

La licence agent n'est pas seulement un revenu supplémentaire. Elle a un rôle économique précis :

- absorber le coût du numéro de téléphone
- absorber l'infrastructure et les coûts fixes partagés
- amortir les écarts de coût sur certains appels
- protéger la marge sur les agents à faible usage
- couvrir les éventuelles pertes ponctuelles

## En pratique

La licence joue le rôle de **tampon financier** entre :

- un coût fournisseur variable imparfaitement prévisible
- une promesse commerciale simple et stable

# 8.2 Répartition conceptuelle du modèle de revenu

| Composante | Rôle principal |
|---|---|
| Licence `49,99 € HTVA / agent / mois` | couvre fixes, numéro, infra, variance, amortit les petits écarts |
| Facturation à la minute | couvre le coût variable d'usage et génère la marge sur le volume |

# 8.3 Effet de sécurité sur la marge

Avec une licence agent et une facturation dès la création de l'appel, le risque de vendre sous le coût devient beaucoup plus faible, notamment sur l'offre C.

---

# 9. Recommandations tarifaires

# 9.1 Hypothèse de coût interne à retenir dans le business plan

Je recommande de retenir officiellement :

- **A** : `0,025 / min`
- **B** : `0,05 / min`
- **C** : `0,10 / min`

# 9.2 Grille de pricing variable suggérée

## Option minimale prudente : `x2`

| Offre | Coût interne | Prix de vente x2 |
|---|---:|---:|
| A | `0,025` | `0,05` |
| B | `0,05` | `0,10` |
| C | `0,10` | `0,20` |

## Option recommandée : `x2.5`

| Offre | Coût interne | Prix de vente x2.5 |
|---|---:|---:|
| A | `0,025` | `0,0625` |
| B | `0,05` | `0,125` |
| C | `0,10` | `0,25` |

## Option haute : `x3`

| Offre | Coût interne | Prix de vente x3 |
|---|---:|---:|
| A | `0,025` | `0,075` |
| B | `0,05` | `0,15` |
| C | `0,10` | `0,30` |

# 9.3 Recommandation de gestion

Pour une première version du business plan :

- conserver la **licence agent à `49,99 € HTVA`**
- retenir `0,025 / 0,05 / 0,10` comme coûts internes
- modéliser un pricing variable au **minimum à x2**
- privilégier **x2.5 à x3** sur les usages où la variabilité du coût est plus forte

---

# 10. Principaux risques à surveiller

## Risques de coût

- **destinations Twilio sortantes plus chères** que la moyenne de la facture actuelle
- **variation USD / EUR**
- **hausse du volume de TTS** sur l'offre B
- **usage effectif de Gather** sur l'offre A
- **appels très courts** si des exceptions commerciales empêchent de facturer la minute minimale

## Risques de pilotage

- ne pas distinguer les usages par offre dans les reportings
- ne pas suivre le coût réel des appels sortants par destination
- laisser dériver les prompts ou le volume de TTS sans contrôle

---

# 11. Plan d'action recommandé au CFO

## Décisions à valider

- valider les hypothèses de coût interne : `A=0,025`, `B=0,05`, `C=0,10`
- valider la **licence `49,99 € HTVA / agent / mois`** comme composante de couverture des coûts fixes et de variance
- valider la règle commerciale : **facturation dès création de l'appel avec minimum une minute**
- définir la grille de pricing minute cible : `x2`, `x2.5` ou `x3`

## Suivi recommandé

- mesurer séparément les coûts A, B et C dès les premiers mois d'exploitation
- suivre spécifiquement le coût Twilio de l'offre C par destination
- recalibrer les hypothèses après une première période d'observation réelle

---

# 12. Conclusion

Le modèle économique proposé est cohérent.

Les hypothèses suivantes peuvent être retenues dans le business plan :

- **A - Répondeur classique** : `0,025 / min`
- **B - Réceptionniste IA streaming** : `0,05 / min`
- **C - Appels sortants** : `0,10 / min`

Cette grille est compatible avec :

- la structure technique réelle du produit
- la facture Twilio observée
- les tarifs IA fournis
- la politique de facturation retenue
- la licence agent à `49,99 € HTVA`

En synthèse :

- **A** et **B** sont bien couverts
- **C** est la plus sensible, mais reste défendable à `0,10 / min`
- la combinaison **licence + minute minimale + pricing x2/x3** fournit un cadre robuste pour éviter une vente sous coût dans le scénario standard

---

# 13. Annexe technique

## Références de code validées

### Offre A

- gestion des appels entrants et TwiML : `backend/src/routes/webhooks.ts`
- voicemail classique : `buildOfferAVoicemailTwiml`
- traitement d'enregistrement : `/twilio/recording-complete`

### Offre B

- streaming temps réel : `buildOfferBStreamingTwiml`
- orchestration streaming : `backend/src/services/twilioMediaStreams.ts`
- démarrage d'enregistrement Twilio : `startTwilioRecording`

### Offre C

- création d'appel sortant : `backend/src/routes/outboundCalls.ts`
- bridge agent -> client : `/twilio/outbound-answer`
- stream sortant : `<Start><Stream ... track="both_tracks">`
- analyse post-appel : `/twilio/outbound-recording`

Ces références confirment que le modèle de coût retenu repose sur le **comportement réel du système**, et non sur une simple hypothèse théorique.
