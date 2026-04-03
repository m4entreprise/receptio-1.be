# Receptio.eu - Réceptionniste IA

Plateforme de gestion d'appels téléphoniques assistée par IA, pensée pour aider les PME à ne plus manquer d'appels importants et à offrir une expérience client plus fluide.

## Vision du projet

Receptio.eu a pour objectif de proposer un accueil téléphonique intelligent capable de répondre, qualifier, orienter et restituer l'information utile à l'entreprise.

L'idée n'est pas seulement d'automatiser une conversation, mais de créer un véritable point d'entrée téléphonique numérique, disponible en continu, capable de s'adapter aux besoins de petites et moyennes structures.

## À quoi sert Receptio.eu

La solution vise à couvrir plusieurs usages concrets :

- **Ne plus perdre d'appels** lorsque l'équipe est occupée, absente ou en dehors des heures d'ouverture.
- **Accueillir les appelants de manière professionnelle** avec un discours cohérent et personnalisable.
- **Qualifier les demandes** avant transmission à la bonne personne ou au bon service.
- **Restituer l'information** sous une forme exploitable pour l'entreprise.
- **Améliorer le suivi client** grâce à une meilleure traçabilité des échanges.

## Public cible

Le projet s'adresse en priorité aux PME, indépendants structurés et entreprises de services qui reçoivent des appels entrants récurrents et souhaitent :

- mieux gérer leur disponibilité,
- filtrer les demandes,
- gagner du temps administratif,
- professionnaliser leur accueil téléphonique,
- préparer une montée en charge sans recruter immédiatement.

## Architecture globale

Le projet est organisé autour de plusieurs briques complémentaires :

- **Une interface d'administration** permettant de piloter la solution, consulter les informations utiles et gérer les comptes.
- **Un backend applicatif** qui centralise les règles métier, la sécurité, les échanges de données et l'orchestration des fonctionnalités.
- **Une couche de données** pour stocker les utilisateurs, les paramètres, l'historique et les éléments nécessaires au fonctionnement de la plateforme.
- **Des services externes spécialisés** pour la téléphonie, la génération de réponses, la voix et certaines notifications.

En pratique, l'appel téléphonique est traité par des services externes, puis enrichi et orchestré par la plateforme afin de produire une réponse adaptée et un retour d'information utile côté entreprise.

## Logique de fonctionnement

À haut niveau, le parcours peut être résumé ainsi :

1. un appelant contacte l'entreprise,
2. la plateforme prend en charge l'interaction,
3. la demande est comprise et structurée,
4. une réponse, une orientation ou une prise d'information est effectuée,
5. les éléments importants sont restitués dans l'espace de gestion.

Cette approche permet d'assurer une continuité de service tout en gardant l'entreprise au centre du dispositif.

## Ce que contient ce dépôt

Le dépôt regroupe les principaux composants du produit :

- **`frontend/`** : l'interface visible par les utilisateurs de la plateforme.
- **`backend/`** : le coeur applicatif et les points d'entrée de l'application.
- **`database/`** : les éléments liés à l'initialisation de la base de données.
- **`scripts/`** : des scripts utilitaires liés au projet et au déploiement.
- **`docker-compose.yml`** : un environnement local pour les services d'infrastructure nécessaires.

## Positionnement produit

Receptio.eu se situe à l'intersection de trois besoins :

- **accueil téléphonique**,
- **automatisation intelligente**,
- **outil de pilotage opérationnel**.

Le projet ne se limite donc pas à un simple standard automatisé. Il s'agit d'une plateforme conçue pour transformer l'appel entrant en information utile, exploitable et actionnable.

## Évolution visée

À terme, la plateforme peut servir de base pour :

- des scénarios métiers plus avancés,
- une personnalisation par secteur d'activité,
- des analyses de performance des appels,
- une meilleure intégration avec les outils internes des entreprises.

## Référence complémentaire

Pour une vision plus détaillée du cadrage initial, voir `Document de cadrage Receptio.eu.md`.
