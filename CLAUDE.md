# CLAUDE.md - Receptio.eu

## What is this project?

**Receptio.eu** is an AI-powered phone receptionist platform for SMBs. It handles inbound and outbound calls, qualifies customer requests, transcribes conversations, and generates actionable summaries.

### Architecture

- **Frontend** (`frontend/`): React 18 + Vite + TypeScript + TailwindCSS
- **Backend** (`backend/`): Express + TypeScript + WebSocket server for Twilio Media Streams
- **Database**: PostgreSQL 15 (schema: `database/init.sql`)
- **Cache**: Redis 7
- **Telephony**: Twilio (voice + media streams), with OpenAI/Deepgram for STT/TTS

### Key Features

- Three call handling modes per company: Offre A (basic), Offre B (OpenAI pipeline), Offre Bbis (Deepgram pipeline)
- Real-time voice streaming with WebSocket connections
- Outbound call support with live transcript polling
- Dashboard for call monitoring, staff management, and settings

## Project Structure

```
frontend/src/
  pages/          # Route components (Dashboard, Calls, OutboundCall, etc.)
  components/     # Reusable UI components
  contexts/       # React contexts (AuthContext)
  hooks/          # Custom hooks
  index.css       # Brand CSS variables (navy/orange palette)

backend/src/
  routes/         # API endpoints (auth, calls, webhooks, outbound-calls)
  services/       # Business logic (twilioMediaStreams, transcription)
  config/         # Database and Redis connections
  middleware/     # Express middleware (auth, error handling)
  index.ts        # Server entry point with WebSocket attachment
```

## How to work on this project

### Local Development

```bash
# Start infrastructure (Postgres on 5433, Redis on 6379)
docker-compose up -d

# Backend
cd backend && npm run dev        # Starts on :3000 with tsx watch

# Frontend
cd frontend && npm run dev       # Vite dev server on :5173
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `TWILIO_*` - Account SID, Auth Token, Phone number
- `OPENAI_API_KEY` - For transcription and chat completions
- `DEEPGRAM_API_KEY` - For Offre Bbis voice pipeline

### Building

```bash
cd frontend && npm run build     # Outputs to dist/
cd backend && npm run build      # tsc compiles to dist/
```

### Testing Changes

- **API**: `curl http://localhost:3000/health`
- **Webhooks**: Use ngrok or similar to expose localhost for Twilio webhooks
- **Database**: Connect to `postgres://receptio:receptio123@localhost:5433/receptio`

## Conventions

- Use TypeScript strict mode
- React functional components with hooks
- Tailwind for styling; brand colors defined in `frontend/src/index.css`
- API routes return JSON with consistent error shape `{ error: string }`
- Database queries use parameterized statements via `backend/src/config/database.ts`

## Important Notes

- **Never** exit the Node process on database pool errors (handled in `backend/src/config/database.ts`)
- Docker volume `postgres-data` persists data; `database/init.sql` only runs on first container start
- Twilio Media Streams require WebSocket upgrade attached to the HTTP server (`backend/src/index.ts:63`)
- The three telephony modes (Offre A/B/Bbis) are selected per-company in settings
