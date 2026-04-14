# Plan d’implémentation - Base de connaissances performante pour le Répondeur IA

## Objectif

Faire évoluer la base de connaissances actuelle vers une **KB fiable, rapide et exploitable en temps réel** pour le **Répondeur IA / Offre Bbis**, sans dégrader la latence de l’appel.

## Contraintes produit

- **latence faible** : la recherche KB ne doit pas ralentir perceptiblement la réponse orale
- **précision élevée** : éviter les réponses plausibles mais fausses
- **contexte court** : ne jamais injecter un gros bloc de texte dans le prompt
- **robustesse au STT** : tolérer les reformulations et petites erreurs de transcription
- **explicabilité** : comprendre pourquoi une info a été sélectionnée

## Vision cible

La KB cible doit être :

- **structurée**
- **chunkée**
- **indexée**
- **recherchée de façon hybride**
- **filtrée selon l’intention**
- **injectée en contexte de façon minimale**
- **cachée et observée**

---

# Phase 1 - Stabiliser et structurer la base actuelle

## But

Rendre la base actuelle exploitable proprement avant d’ajouter une recherche plus avancée.

## Actions

- **enrichir le modèle de données**
  - ajouter des champs à `knowledge_base_entries`
  - champs recommandés :
    - `type`
    - `tags`
    - `language`
    - `synonyms`
    - `valid_from`
    - `valid_to`
    - `confidence_level`

- **catégoriser les contenus**
  - distinguer clairement :
    - FAQ
    - services
    - horaires
    - tarifs
    - exceptions
    - consignes agent

- **réduire la granularité**
  - une entrée = une idée métier
  - éviter les longues fiches fourre-tout

- **normaliser le contenu**
  - titre court
  - contenu factuel
  - pas de mélange entre instructions et faits métier

- **poser des règles éditoriales**
  - écrire les entrées comme des faits réutilisables à l’oral
  - éviter les paragraphes trop longs
  - expliciter les exceptions

## Livrables

- **migration SQL** pour enrichir `knowledge_base_entries`
- **guide de rédaction** pour les entrées KB
- **premier nettoyage** des données existantes

## Gain attendu

- données plus propres
- moins de bruit injecté au LLM
- meilleure base pour le retrieval

---

# Phase 2 - Remplacer `ILIKE` par une recherche sérieuse

## But

Passer d’une recherche textuelle naïve à une recherche robuste et rapide.

## Actions

- **ajouter du full-text search Postgres**
  - colonne `search_vector`
  - index GIN
  - mise à jour à chaque création / modification d’entrée

- **préparer la recherche vectorielle**
  - installer `pgvector` si retenu
  - stocker les embeddings par chunk ou par entrée

- **sortir la logique de recherche dans un service dédié**
  - créer un service du type `knowledgeRetrievalService`
  - ne plus faire de simple concaténation brute dans `offerB.ts`

- **ajouter des filtres structurés**
  - `company_id`
  - `enabled`
  - `language`
  - `type`
  - validité temporelle

## Livrables

- **migration SQL** pour FTS
- **indexes Postgres**
- **nouveau service backend de recherche KB**

## Gain attendu

- meilleure précision sur les mots exacts
- meilleure robustesse sur noms propres, horaires, tarifs, exceptions
- meilleures performances qu’un scan textuel simple

---

# Phase 3 - Chunking et indexation

## But

Découper la connaissance en unités petites, récupérables et pertinentes.

## Actions

- **introduire des chunks**
  - créer une table `knowledge_base_chunks`
  - un chunk = une information exploitable à l’oral

- **modèle recommandé pour `knowledge_base_chunks`**
  - `id`
  - `entry_id`
  - `company_id`
  - `chunk_text`
  - `chunk_order`
  - `type`
  - `tags`
  - `tokens_estimate`
  - `search_vector`
  - `embedding`
  - `enabled`

- **découpage recommandé**
  - 1 idée métier par chunk
  - 1 à 4 phrases max
  - pas de chunk trop long

- **pré-calculer les index**
  - embeddings à l’écriture
  - FTS à l’écriture
  - jamais pendant l’appel

## Livrables

- **table `knowledge_base_chunks`**
- **service d’indexation**
- **pipeline de recalcul lors des modifications**

## Gain attendu

- meilleure granularité
- contexte plus compact
- retrieval plus précis

---

# Phase 4 - Passer à une recherche hybride

## But

Combiner la précision du lexical et la souplesse du sémantique.

## Pourquoi pas full vector only

Le vectoriel seul est bon pour les reformulations, mais moins fiable pour :

- mots exacts
- noms propres
- horaires
- tarifs
- références métier précises
- exceptions critiques

Pour un répondeur IA métier, le meilleur compromis est :

- **lexical / FTS** pour la précision
- **vectoriel** pour la tolérance aux reformulations
- **filtres structurés** pour éviter le bruit

## Actions

- **recherche hybride**
  - score lexical
  - score vectoriel
  - score priorité métier
  - filtres structurels

- **retourner un top candidats borné**
  - top 10 à 20 max avant reranking

- **ajouter un reranking simple**
  - sans modèle lourd dans un premier temps
  - score composite pondéré

## Livrables

- **service hybride KB**
- **scoring composite**
- **top-k borné**

## Gain attendu

- meilleure robustesse aux formulations naturelles
- moins d’erreurs de récupération
- moins de bruit dans le prompt

---

# Phase 5 - Adapter la KB au temps réel du Répondeur IA

## But

Ne pas faire de la KB un goulot d’étranglement du pipeline STT -> LLM -> TTS.

## Actions

- **retrieval conditionnel**
  - ne pas interroger la KB à chaque tour
  - bypass sur :
    - salutations
    - au revoir
    - confirmations simples
    - small talk

- **détection d’intention légère**
  - classer rapidement la demande :
    - horaires
    - tarifs
    - service
    - transfert humain
    - urgence
    - autre

- **retrieval ciblé par intention**
  - si intention = horaires, favoriser les chunks `type = horaire`
  - si intention = tarif, favoriser les chunks `type = tarif`

- **injecter très peu de contexte**
  - top 3 à 5 chunks max
  - contexte compact
  - budget strict en taille

- **précharger un contexte essentiel**
  - infos fréquemment demandées
  - horaires
  - services principaux
  - politique de transfert

## Livrables

- **retriever temps réel spécifique Bbis**
- **règles de bypass KB**
- **sélection top 3-5**

## Gain attendu

- latence mieux maîtrisée
- meilleure stabilité conversationnelle
- moins de tokens consommés

---

# Phase 6 - Cache et performance

## But

Réduire au maximum le coût runtime de la KB.

## Actions

- **mettre en cache par entreprise**
  - entrées / chunks actifs
  - métadonnées utiles
  - éventuellement embeddings déjà chargés

- **invalidation sur mise à jour**
  - toute modification KB doit invalider le cache concerné

- **pré-calcul uniquement**
  - embeddings générés à l’écriture
  - index lexical maintenu à l’écriture

- **définir un budget de performance**
  - retrieval < 150 ms
  - top 3-5 injectés max
  - aucun scan non indexé sur gros volume

## Livrables

- **cache KB par `companyId`**
- **mécanisme d’invalidation**
- **métriques temps de retrieval**

## Gain attendu

- coût prédictible
- meilleure fluidité en appel
- moins de charge DB

---

# Phase 7 - Refondre le contexte injecté au LLM

## But

Éviter l’injection brute de contexte et mieux contrôler la réponse du modèle.

## Actions

- **séparer clairement**
  - prompt système
  - historique conversationnel court
  - contexte KB
  - règles de transfert

- **construire un `knowledgeContextBuilder` dédié**
  - format compact
  - lisible
  - borné en taille

- **format recommandé**

```text
Informations métier fiables :
1. Horaires : du lundi au vendredi de 8h à 18h.
2. Rendez-vous : prise de rendez-vous possible par téléphone.
3. Urgences : pas de prise en charge téléphonique le dimanche.
```

- **forcer des règles de réponse**
  - ne pas inventer
  - utiliser uniquement les informations fiables
  - demander une précision si l’info manque
  - transférer si nécessaire

## Livrables

- **builder de contexte KB**
- **nouveau format d’injection dans le prompt**

## Gain attendu

- moins d’hallucinations
- contexte plus court
- meilleure cohérence des réponses

---

# Phase 8 - Observabilité et qualité

## But

Pouvoir mesurer objectivement si la KB aide ou dégrade le Répondeur IA.

## Actions

- **journaliser la recherche KB**
  - temps de retrieval
  - nombre de chunks retenus
  - taille du contexte injecté
  - type d’intention détectée
  - score des chunks retenus

- **ajouter des événements métier**
  - `kb.search.started`
  - `kb.search.completed`
  - `kb.results.selected`
  - `kb.cache.hit`
  - `kb.cache.miss`

- **créer des jeux de tests métier**
  - horaires
  - tarifs
  - rendez-vous
  - transfert humain
  - urgence
  - synonymes
  - reformulations
  - transcription STT bruitée

- **définir des KPIs**
  - latence KB
  - top-1 pertinent
  - top-3 pertinent
  - taux de fallback
  - taux de transfert inutile

## Livrables

- **logs dédiés KB**
- **cas de tests métier**
- **tableau d’indicateurs**

## Gain attendu

- debugging plus facile
- amélioration continue
- arbitrages techniques basés sur des données

---

# Découpage concret recommandé

## Sprint 1

- **[data model]**
  - enrichir `knowledge_base_entries`
  - définir la convention éditoriale

- **[context builder]**
  - remplacer l’injection brute actuelle

- **[cleanup]**
  - nettoyer les entrées existantes

## Sprint 2

- **[fts]**
  - ajouter full-text search Postgres
  - indexer correctement

- **[retrieval service]**
  - créer un service dédié de recherche KB

- **[metrics]**
  - tracer temps et volume de contexte

## Sprint 3

- **[chunking]**
  - créer `knowledge_base_chunks`
  - mettre en place l’indexation

- **[hybrid search]**
  - ajouter embeddings + score hybride

- **[reranking]**
  - top 3-5 proprement sélectionnés

## Sprint 4

- **[bbis realtime]**
  - retrieval conditionnel
  - cache par entreprise
  - budget strict de latence

- **[validation]**
  - tests métier
  - mesure de précision et latence

---

# Priorités absolues

- **[1]** sortir de `ILIKE`
- **[2]** chunker la connaissance
- **[3]** borner très fortement le contexte injecté
- **[4]** ajouter cache + observabilité
- **[5]** passer à une recherche hybride plutôt que full vector only

---

# Recommandation pragmatique

Si l’objectif est d’aller vite sans sur-architecturer :

## court terme

- enrichir le modèle de données
- passer à Postgres FTS
- chunker proprement
- injecter top 3 seulement
- ajouter un cache simple

## moyen terme

- embeddings
- recherche hybride
- reranking
- retrieval conditionnel basé sur l’intention

## long terme

- pipeline KB optimisé pour temps réel
- métriques qualité / latence
- amélioration continue pilotée par données

---

# Résumé

La KB idéale pour le Répondeur IA n’est pas une grosse base vectorielle balancée dans le prompt. C’est un système de connaissance **structuré, chunké, indexé, hybride, filtré, caché et injecté au compte-gouttes**.

Le plus important est de garantir à la fois :

- **faible latence**
- **haute précision**
- **contexte minimal**
- **comportement explicable**

Sans cela, la KB risque soit de rater des infos importantes, soit d’augmenter sensiblement la latence du répondeur IA.
