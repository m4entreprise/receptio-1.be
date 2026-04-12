# Refactoring IA - Note de travail

> **IMPÉRATIF : Aucune donnée ne sort d'Europe**
> Objectif : Standardiser, centraliser ET européaniser la configuration des providers IA
> Providers conservés : **Mistral AI** (FR), **Gladia** (FR)
> Providers à supprimer : **OpenAI** (US), **Deepgram** (US), **Twilio** (US - téléphonie temporaire)

---

## Phase 0 : Nettoyage Codebase (À FAIRE EN PREMIER)

Avant toute migration, nettoyer le code de tout ce qui est **non-utilisé** ou **non-européen**.

### 0.1 Providers IA non-EU à supprimer

| Provider | Pays | Fichier | Action | Usages à vérifier |
|----------|------|---------|--------|-------------------|
| **OpenAI** | 🇺🇸 USA | `services/openai.ts` | **SUPPRIMER** | `webhooks.ts`, `offerB.ts` (generateResponse, transcribeAudio, textToSpeech, summarizeCall, detectIntent) |
| **Deepgram** | 🇺🇸 USA | `services/deepgram.ts` | **SUPPRIMER** | `webhooks.ts` (deepgramTextToSpeech), `twilioMediaStreams.ts` (fallback TTS) |

### 0.2 Code mort / Non-utilisé à identifier

#### Fichiers à vérifier (peut-être morts) :
- `services/openai.ts` - **US = VIRER**
- `services/deepgram.ts` - **US = VIRER**
- `routes/telnyx.ts` ou handlers Telnyx dans `webhooks.ts` - **Jamais activé = VIRER ou commenter**

#### Fonctions à nettoyer dans `webhooks.ts` :
- `handleCallInitiated`, `handleCallAnswered`, `handleCallHangup`, `handleRecordingSaved` - **Telnyx = VIRER**
- Imports Deepgram : `import { textToSpeech as deepgramTextToSpeech }` - **VIRER**
- Imports OpenAI : `import { detectIntent, generateResponse, summarizeCall, transcribeAudio }` - **VIRER**
- Appels à `transcribeAudioUrlWithDiarization` (Mistral) - **Garder, mais vérifier si utilisé**

#### Dans `twilioMediaStreams.ts` :
- Fallback Deepgram TTS (lignes ~1155-1167) - **Remplacer par Mistral uniquement**
- Détection silence basée sur `ENERGY_THRESHOLD` - **Garder, c'est local**
- Tout fallback vers OpenAI - **VIRER**

### 0.3 Tâches de nettoyage détaillées

#### A. Supprimer OpenAI complètement
```bash
# Fichier à supprimer :
backend/src/services/openai.ts

# Imports à supprimer dans :
backend/src/routes/webhooks.ts (lignes 1-10 environ)
backend/src/services/twilioMediaStreams.ts (ligne 9)
backend/src/services/offerB.ts (si importé)

# Remplacer tous les appels :
- generateResponse() → mistralGenerateResponse()
- transcribeAudio() → mistralTranscribeAudioUrlWithDiarization() ou gladia
- textToSpeech() → mistralTextToSpeech()
- summarizeCall() → mistralSummarizeCall()
- detectIntent() → detectStreamingIntent() (déjà local) ou version Mistral
```

#### B. Supprimer Deepgram complètement
```bash
# Fichier à supprimer :
backend/src/services/deepgram.ts

# Imports à supprimer :
backend/src/routes/webhooks.ts (deepgramTextToSpeech)
backend/src/services/twilioMediaStreams.ts (deepgramTextToSpeech, deepgramTranscribeAudioBuffer)

# Remplacer :
- deepgramTextToSpeech() → mistralTextToSpeech()
- deepgramTranscribeAudioBuffer() → mistralTranscribeAudioBuffer() ou gladia
```

#### C. Nettoyer Telnyx (code mort)
```bash
# Dans backend/src/routes/webhooks.ts :
- Supprimer le routeur '/telnyx/call' (lignes 15-43)
- Supprimer les fonctions handleCallInitiated, handleCallAnswered, handleCallHangup, handleRecordingSaved
- Supprimer tous les appels Telnyx
```

#### D. Variables d'environnement à virer
```bash
# Supprimer de .env et des configs :
OPENAI_API_KEY=xxx
OPENAI_STT_MODEL=xxx
OPENAI_TTS_MODEL=xxx
OPENAI_TTS_VOICE=xxx
OPENAI_LLM_MODEL=xxx
DEEPGRAM_API_KEY=xxx
```

### 0.4 Résultat attendu post-nettoyage

**Fichiers IA présents uniquement :**
```
services/
├── mistral.ts          # Seul provider IA (STT/TTS/LLM)
├── gladia.ts           # À créer (STT streaming/diarization)
└── (plus d'openai.ts, plus de deepgram.ts)
```

**Variables d'environnement IA uniquement :**
```bash
MISTRAL_API_KEY=xxx                    # Requis
GLADIA_API_KEY=xxx                     # Requis
TWILIO_ACCOUNT_SID=xxx                 # Temporaire (téléphonie)
TWILIO_AUTH_TOKEN=xxx                  # Temporaire (téléphonie)
```

### 0.5 Checklist nettoyage (à cocher)

- [ ] **A** - `services/openai.ts` supprimé + imports nettoyés
- [ ] **A** - Tous les appels OpenAI migrés vers Mistral
- [ ] **B** - `services/deepgram.ts` supprimé + imports nettoyés
- [ ] **B** - Tous les appels Deepgram migrés vers Mistral
- [ ] **C** - Code Telnyx supprimé de `webhooks.ts`
- [ ] **D** - `.env` nettoyé des clés US
- [ ] **E** - Test local : un appel se termine sans erreur
- [ ] **F** - Build TypeScript passe sans erreur

---

---

## 1. Providers actuels (après nettoyage)

| Provider | Pays | Capacités | Statut | Fichier |
|----------|------|-----------|--------|---------|
| **Mistral AI** | 🇫🇷 FR | STT (Voxtral), TTS, LLM | ✅ **CONSERVER** | `services/mistral.ts` |
| **Gladia** | 🇫🇷 FR | STT (streaming, diarization) | ✅ **AJOUTER** | À créer : `services/gladia.ts` |
| **Twilio** | 🇺🇸 US | Téléphonie (temporaire) | ⚠️ **REMPLACER ASAP** | `services/twilioMediaStreams.ts`, webhooks |
| ~~Deepgram~~ | 🇺🇸 US | STT/TTS | ❌ **SUPPRIMER** | `services/deepgram.ts` → virer |
| ~~OpenAI~~ | 🇺🇸 US | STT/TTS/LLM | ❌ **SUPPRIMER** | `services/openai.ts` → virer |
| ~~Telnyx~~ | 🇺🇸 US | Téléphonie (jamais activé) | ❌ **SUPPRIMER** | Code dans `webhooks.ts` → virer |

---

## 2. Architecture Téléphonie 100% EU (Post-MVP)

> **Temporairement** : Twilio reste pour le MVP (5 jours investisseur)
> **Cible** : OVH SIP Trunk (FR) ou sipgate (DE) + Janus Gateway

### 2.1 Providers Téléphonie

| Provider | Pays | Type | Usage | Quand |
|----------|------|------|-------|-------|
| **Twilio** | 🇺🇸 US | Voice API | MVP temporaire | Maintenant |
| **OVH SIP** | 🇫🇷 FR | SIP Trunk | Cible post-levée | Q1 2026 |
| **sipgate** | 🇩🇪 DE | SIP Trunk | Alternative cible | Q1 2026 |

### 2.2 Architecture cible OVH

```
Appelant (FR/BE)
    ↓
[OVH SIP Trunk - Roubaix, FR]
    ↓
Janus Gateway (self-hosted, OVH Cloud FR)
    ↓
Ton Backend (OVH Cloud FR)
    ↓
Mistral AI (Paris) / Gladia (Paris)
```

---

## 3. Configuration centralisée souhaitée

### 3.1 Variables d'environnement (version EU)

```bash
# ============ IA UNIQUEMENT EU ============
# Requis pour le MVP
MISTRAL_API_KEY=xxx                    # STT + TTS + LLM
GLADIA_API_KEY=xxx                     # STT streaming (optionnel MVP)

# ============ TELEPHONIE (temporaire US) ============
# MVP uniquement - à remplacer par OVH/sipgate
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
PUBLIC_WEBHOOK_URL=https://...

# ============ AUTRES ============
DATABASE_URL=postgresql://...
RESEND_API_KEY=xxx                     # Email (US - remplacer par Scaleway SMTP ?)
FROM_EMAIL=noreply@receptio.be

# ============ OPTIONS STREAMING (Mistral uniquement) ============
MISTRAL_TTS_TIMEOUT_MS=30000
MISTRAL_TTS_MAX_RETRIES=3
OFFER_B_STREAMING_ENABLED=true
OFFER_B_STREAMING_ENERGY_THRESHOLD=500
OFFER_BBIS_STREAMING_SILENCE_MS=260
OFFER_BBIS_STREAMING_MIN_SPEECH_MS=120
OFFER_BBIS_STREAMING_BARGE_IN_MS=80
OFFER_STREAMING_MAX_COMPLETION_TOKENS=120
```

### 3.2 Variables SUPPRIMES (ancienne version)

```bash
# ❌ SUPPRIMER DE L'ENV :
OPENAI_API_KEY=xxx
OPENAI_STT_MODEL=xxx
OPENAI_TTS_MODEL=xxx
OPENAI_TTS_VOICE=xxx
OPENAI_LLM_MODEL=xxx
OPENAI_TTS_SPEED=xxx
DEEPGRAM_API_KEY=xxx
```

### 3.3 Settings par entreprise (BDD)

Table `companies.ai_settings` ou extension de `companies.settings` :

```typescript
interface AiProviderSettings {
  stt: {
    provider: 'deepgram' | 'mistral' | 'gladia';
    model: string;
    language: string;      // 'fr', 'auto'
    diarize: boolean;      // séparation locuteurs
    smartFormat: boolean;  // ponctuation auto
  };
  tts: {
    provider: 'deepgram' | 'mistral';
    model: string;
    voice: string;         // identifiant voix
    speed: number;         // 0.25 - 4.0
  };
  llm: {
    provider: 'mistral';  // seul provider LLM
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;  // prompt custom par tenant
  };
  streaming: {
    enabled: boolean;
    silenceThresholdMs: number;
    minSpeechMs: number;
    bargeInMs: number;
    maxCompletionTokens: number;
  };
}
```

---

## 3. Architecture cible

### 3.1 Abstraction des providers

```
services/
├── ai/
│   ├── providers/
│   │   ├── base.ts           # AbstractProvider interface
│   │   ├── deepgram.ts       # DeepgramProvider implements STT, TTS
│   │   ├── mistral.ts        # MistralProvider implements STT, TTS, LLM
│   │   └── gladia.ts         # GladiaProvider implements STT
│   ├── factory.ts            # ProviderFactory.get(providerName)
│   ├── config.ts             # Chargement config globale + tenant
│   └── streaming.ts          # Pipeline STT-LLM-TTS (Offer Bbis)
```

### 3.2 Interface commune

```typescript
interface SttProvider {
  transcribe(audio: Buffer, options: SttOptions): Promise<TranscriptionResult>;
  supportsStreaming(): boolean;
}

interface TtsProvider {
  synthesize(text: string, options: TtsOptions): Promise<Buffer>;
  getVoices(): Voice[];
}

interface LlmProvider {
  generate(messages: Message[], options: LlmOptions): Promise<string>;
  countTokens(text: string): number;
}
```

---

## 4. Plan de migration détaillé

### Phase 0 (Jour 1-2) : Nettoyage codebase
1. Supprimer `services/openai.ts`
2. Supprimer `services/deepgram.ts`
3. Nettoyer imports dans `webhooks.ts`
4. Nettoyer Telnyx dans `webhooks.ts`
5. Migrer tous les appels vers Mistral
6. Tester build + appel local

### Phase 1 (Jour 3-4) : Migration téléphonie (post-MVP)
1. Ouvrir compte OVH SIP
2. Acheter 1 numéro test
3. Déployer Janus Gateway (self-hosted)
4. Adapter `twilioMediaStreams.ts` → `janusMediaHandler.ts`
5. Migrer numéros Twilio → OVH

### Phase 2 (Jour 5) : Validation investisseur
1. Démo 100% EU (même si Twilio temporaire)
2. Slide architecture "Souveraineté"
3. Roadmap post-levée

---

## 5. Points d'attention

### 5.1 Migrations nécessaires (priorisées)

| Élément | Action | Impact | Priorité |
|---------|--------|--------|----------|
| `services/openai.ts` | **SUPPRIMER** + migrer usages vers Mistral | Moyen | 🔴 **Jour 1** |
| `services/deepgram.ts` | **SUPPRIMER** + migrer usages vers Mistral | Faible | 🔴 **Jour 1** |
| `webhooks.ts` imports | Nettoyer imports OpenAI/Deepgram/Telnyx | Moyen | 🔴 **Jour 1** |
| `webhooks.ts` Telnyx | Supprimer handlers Telnyx (code mort) | Faible | 🟡 **Jour 2** |
| `types/index.ts` | Migrer `BbisAgentSettings` → `AiProviderSettings` | Moyen | 🟡 **Jour 2** |
| `twilioMediaStreams.ts` | Remplacer fallbacks US par Mistral | Fort | 🟡 **Jour 2** |
| `services/gladia.ts` | Créer le provider (optionnel MVP) | Moyen | 🟢 **Post-MVP** |
| `twilioMediaStreams.ts` → OVH | Migrer vers Janus Gateway | Très fort | 🟢 **Post-levée** |

### 4.2 Compatibilité Gladia

Gladia utilise un modèle différent pour le streaming temps réel :
- WebSocket natif (pas REST polling)
- Diarization intégrée
- Latence différente à tester

→ Créer un adaptateur spécifique `gladia.ts`

### 4.3 Voix TTS

| Provider | Voix disponibles | Format sortie | Pays |
|----------|------------------|---------------|------|
| ~~Deepgram~~ | ~~Aura~~ | ~~linear16, wav~~ | ~~🇺🇸 US~~ ❌ |
| **Mistral** | Voxtral (base) | wav | 🇫🇷 FR ✅ |

→ Normaliser en WAV 8kHz µ-law pour compatibilité téléphonie

---

## 6. Tâches prioritaires (ordre strict)

### Phase 0 : Nettoyage (Avant tout)
- [ ] **1.** Supprimer `services/openai.ts` + migrer usages vers Mistral
- [ ] **2.** Supprimer `services/deepgram.ts` + migrer usages vers Mistral
- [ ] **3.** Nettoyer `webhooks.ts` (imports + Telnyx)
- [ ] **4.** Vérifier `twilioMediaStreams.ts` (plus de fallback US)
- [ ] **5.** Nettoyer `.env` des variables US
- [ ] **6.** Build + test local OK

### Phase 1 : Refacto (Optionnel pre-MVP)
- [ ] **7.** Créer `services/ai/providers/base.ts` avec interfaces
- [ ] **8.** Refactorer `mistral.ts` → `providers/mistral.ts`
- [ ] **9.** Créer `providers/gladia.ts` (optionnel)
- [ ] **10.** Créer `factory.ts` pour résolution dynamique

### Phase 2 : Souveraineté totale (Post-levée)
- [ ] **11.** OVH SIP Trunk + Janus Gateway
- [ ] **12.** Migrer Twilio → OVH
- [ ] **13.** Remplacer Resend (US) par SMTP EU (Scaleway/OVH)

---

## 7. Questions résolues ✅

| Question | Réponse |
|----------|---------|
| Gladia remplace Deepgram ? | ✅ **OUI** - Deepgram (US) supprimé, Gladia (FR) pour diarization si besoin |
| Provider par défaut ? | ✅ **Mistral uniquement** pour STT/TTS/LLM |
| Fallback provider ? | ❌ **NON** - Un seul provider EU par capacité (simplification) |
| Diarization obligatoire ? | ❌ **NON** - Optionnel, Gladia seulement si besoin |
| Téléphonie EU ? | ⚠️ **OVH** cible post-MVP, Twilio temporaire |

---

## 8. Résumé pour l'investisseur

> **"Notre stack IA est 100% française : Mistral (Paris) pour tout le NLP, données hébergées en France. La téléphonie passe temporairement par Twilio pour le MVP mais migration vers OVH (Roubaix) est prévue Q1 2026 avec architecture Janus Gateway self-hosted. Zéro dépendance US à terme."**

---

*Document créé le : 12 avril 2026*
*Mise à jour : Phase 0 nettoyage ajoutée, pivot 100% EU*
