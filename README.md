# Receptio.eu - Réceptionniste IA

Plateforme de gestion d'appels téléphoniques par IA pour PME belges.

## Stack technique

- **Backend**: Node.js + TypeScript + Express + PostgreSQL
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Services**: Telnyx (téléphonie) + Deepgram (STT/TTS) + Mistral AI (LLM)

## Démarrage rapide

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- pnpm (recommandé) ou npm

### Installation

```bash
# Cloner le repo
git clone https://github.com/votre-org/receptio-1.be.git
cd receptio-1.be

# Copier les variables d'environnement
cp .env.example .env

# Démarrer l'infrastructure (PostgreSQL, Redis)
docker-compose up -d

# Installer les dépendances backend
cd backend
pnpm install

# Installer les dépendances frontend
cd ../frontend
pnpm install
```

### Développement

```bash
# Terminal 1 - Backend
cd backend
pnpm dev

# Terminal 2 - Frontend
cd frontend
pnpm dev
```

## Structure du projet

```
receptio-1.be/
├── backend/          # API Node.js + TypeScript
├── frontend/         # Dashboard React
├── database/         # Schémas SQL
└── docker-compose.yml
```

## Offres

- **Offre A**: Répondeur intelligent (transcription)
- **Offre B**: Agent vocal IA complet
- **Offre C**: Analytics avancés

## Documentation

Voir `Document de cadrage Receptio.eu.md` pour la vision complète du projet.
