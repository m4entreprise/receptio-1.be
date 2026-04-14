import { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Brain, ChevronDown, Cpu, MessageSquare, Mic, Save, Sparkles, Volume2, Zap } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

// ─── Modèles disponibles ──────────────────────────────────────────────────────

const STT_MODELS_MISTRAL = [
  { value: 'voxtral-mini-2507', label: 'Voxtral Mini 2507', tier: 'fast' as const },
  { value: 'voxtral-mini-2602', label: 'Voxtral Mini 2602', tier: 'fast' as const },
  { value: 'voxtral-mini-transcribe-realtime-2602', label: 'Voxtral Mini Realtime 2602', tier: 'realtime' as const },
];

const TTS_MODELS = [
  { value: 'voxtral-mini-tts-2603', label: 'Voxtral Mini TTS 2603', tier: 'balanced' as const },
];

const LLM_MODELS = [
  { value: 'mistral-small-2603', label: 'Mistral Small 2603', tier: 'fast' as const, recommended: true },
  { value: 'mistral-small-2506', label: 'Mistral Small 2506', tier: 'fast' as const },
  { value: 'mistral-medium-2508', label: 'Mistral Medium 2508', tier: 'balanced' as const },
  { value: 'mistral-large-2512', label: 'Mistral Large 2512', tier: 'powerful' as const },
  { value: 'ministral-3b-2512', label: 'Ministral 3B 2512', tier: 'ultrafast' as const },
  { value: 'ministral-8b-2512', label: 'Ministral 8B 2512', tier: 'fast' as const },
  { value: 'ministral-14b-2512', label: 'Ministral 14B 2512', tier: 'balanced' as const },
  { value: 'magistral-small-2509', label: 'Magistral Small 2509', tier: 'reasoning' as const },
  { value: 'magistral-medium-2509', label: 'Magistral Medium 2509', tier: 'reasoning' as const },
];

type TierKey = 'ultrafast' | 'fast' | 'realtime' | 'balanced' | 'powerful' | 'reasoning';

const TIER_CONFIG: Record<TierKey, { label: string; colors: string }> = {
  ultrafast: { label: 'Ultra rapide', colors: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fast:      { label: 'Rapide',       colors: 'bg-[#2D9D78]/8 text-[#2D9D78] border-[#2D9D78]/20' },
  realtime:  { label: 'Temps réel',   colors: 'bg-blue-50 text-blue-700 border-blue-200' },
  balanced:  { label: 'Équilibré',    colors: 'bg-[#344453]/8 text-[#344453] border-[#344453]/20' },
  powerful:  { label: 'Puissant',     colors: 'bg-[#C7601D]/8 text-[#C7601D] border-[#C7601D]/20' },
  reasoning: { label: 'Raisonnement', colors: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const CUSTOM_VALUE = '__custom__';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiModelsFormData {
  // Agent IA temps réel (Bbis)
  agentSttProvider: 'mistral' | 'gladia';
  agentSttModel: string;
  agentLlmModel: string;
  agentTtsModel: string;
  agentTtsVoice: string;
  // Répondeur IA (Offre B text-based)
  offerBLlmModel: string;
  // Post-appel
  batchSttModel: string;
  summaryLlmModel: string;
  intentLlmModel: string;
  greetingTtsModel: string;
  greetingTtsVoice: string;
}

const DEFAULT_FORM: AiModelsFormData = {
  agentSttProvider: 'mistral',
  agentSttModel: 'voxtral-mini-2507',
  agentLlmModel: 'mistral-small-2603',
  agentTtsModel: 'voxtral-mini-tts-2603',
  agentTtsVoice: '',
  offerBLlmModel: 'mistral-small-2603',
  batchSttModel: 'voxtral-mini-2507',
  summaryLlmModel: 'mistral-small-2603',
  intentLlmModel: 'mistral-small-2603',
  greetingTtsModel: 'voxtral-mini-tts-2603',
  greetingTtsVoice: '',
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: TierKey }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.colors}`}>
      {cfg.label}
    </span>
  );
}

function ProviderPills({
  value,
  onChange,
}: {
  value: 'mistral' | 'gladia';
  onChange: (v: 'mistral' | 'gladia') => void;
}) {
  return (
    <div className="flex gap-2">
      {(['mistral', 'gladia'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            value === p
              ? 'border-[#344453] bg-[#344453] text-white'
              : 'border-[#344453]/15 bg-white text-[#344453]/60 hover:border-[#344453]/30 hover:text-[#344453]'
          }`}
        >
          {p === 'mistral' ? 'Mistral AI' : 'Gladia'}
        </button>
      ))}
    </div>
  );
}

function ModelSelect({
  models,
  value,
  onChange,
  label,
  description,
}: {
  models: Array<{ value: string; label: string; tier: TierKey; recommended?: boolean }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
  description?: string;
}) {
  const isPredefined = models.some((m) => m.value === value);
  const selectValue = isPredefined ? value : (value ? CUSTOM_VALUE : models[0]?.value || '');
  const [showCustom, setShowCustom] = useState(!isPredefined && Boolean(value));

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === CUSTOM_VALUE) {
      setShowCustom(true);
      // Don't clear the custom value
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#141F28]">{label}</label>
        {description && <span className="text-xs text-[#344453]/50">{description}</span>}
      </div>
      <div className="relative">
        <select
          value={selectValue}
          onChange={handleSelectChange}
          className="block w-full appearance-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 pr-10 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}{m.recommended ? ' (recommandé)' : ''}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>— Modèle personnalisé</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#344453]/40" />
      </div>

      {showCustom && (
        <input
          type="text"
          value={isPredefined ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ex: mistral-small-latest"
          className="block w-full rounded-2xl border border-[#C7601D]/25 bg-[#C7601D]/4 px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#C7601D]/40 focus:bg-white"
        />
      )}

      {/* Affichage du tier du modèle sélectionné */}
      {!showCustom && isPredefined && (() => {
        const found = models.find((m) => m.value === value);
        return found ? (
          <div className="flex items-center gap-2">
            <TierBadge tier={found.tier} />
          </div>
        ) : null;
      })()}
    </div>
  );
}

interface ModelCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ModelCard({ icon, title, subtitle, children }: ModelCardProps) {
  return (
    <div className="rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#141F28]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[#344453]/55">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = 'agent' | 'offerb' | 'batch';

export default function SettingsModelsIA() {
  const [form, setForm] = useState<AiModelsFormData>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('agent');

  const set = <K extends keyof AiModelsFormData>(key: K, value: AiModelsFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get('/api/companies/me');
        const s = data.company?.settings || {};
        const agent = s.bbisAgent || {};
        const ai = s.aiModels || {};

        setForm({
          agentSttProvider: agent.sttProvider || DEFAULT_FORM.agentSttProvider,
          agentSttModel:    agent.sttModel    || DEFAULT_FORM.agentSttModel,
          agentLlmModel:    agent.llmModel    || DEFAULT_FORM.agentLlmModel,
          agentTtsModel:    agent.ttsModel    || DEFAULT_FORM.agentTtsModel,
          agentTtsVoice:    agent.ttsVoice    || DEFAULT_FORM.agentTtsVoice,

          offerBLlmModel:   ai.offerBLlmModel           || DEFAULT_FORM.offerBLlmModel,
          batchSttModel:    ai.transcriptionSttModel    || DEFAULT_FORM.batchSttModel,
          summaryLlmModel:  ai.summaryLlmModel          || DEFAULT_FORM.summaryLlmModel,
          intentLlmModel:   ai.intentLlmModel           || DEFAULT_FORM.intentLlmModel,
          greetingTtsModel: ai.greetingTtsModel         || DEFAULT_FORM.greetingTtsModel,
          greetingTtsVoice: ai.greetingTtsVoice         || DEFAULT_FORM.greetingTtsVoice,
        });
      } catch {
        setMessage('Erreur lors du chargement des paramètres');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await axios.patch('/api/companies/me', {
        settings: {
          bbisAgent: {
            sttProvider: form.agentSttProvider,
            sttModel:    form.agentSttModel,
            llmModel:    form.agentLlmModel,
            ttsModel:    form.agentTtsModel,
            ttsVoice:    form.agentTtsVoice,
          },
          aiModels: {
            offerBLlmModel:        form.offerBLlmModel,
            transcriptionSttModel: form.batchSttModel,
            summaryLlmModel:       form.summaryLlmModel,
            intentLlmModel:        form.intentLlmModel,
            greetingTtsModel:      form.greetingTtsModel,
            greetingTtsVoice:      form.greetingTtsVoice,
          },
        },
      });
      setMessage('Modèles IA sauvegardés avec succès');
    } catch {
      setMessage('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement des modèles IA…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={handleSave} className="space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Gestion des modèles IA
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Choisissez les cerveaux qui font tourner votre réception.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Configurez précisément quel modèle Mistral ou Gladia est utilisé pour chaque étape : transcription en temps réel, génération de réponses, résumés, qualifications et accueil vocal.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Navigation</p>
            <div className="mt-5 space-y-3">
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#141F28] transition hover:bg-[#F8F9FB]"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour aux paramètres
              </Link>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Stockage</p>
                <p className="mt-0.5 text-sm font-semibold text-[#141F28]">settings.bbisAgent + settings.aiModels</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Providers disponibles</p>
                <p className="mt-0.5 text-sm font-semibold text-[#141F28]">Mistral AI · Gladia</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feedback ─────────────────────────────────────────────────── */}
        {message && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            message.includes('succès')
              ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
              : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
          }`}>
            {message}
          </div>
        )}

        {/* ── Onglets ───────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {([
            { id: 'agent',  icon: <Bot className="h-4 w-4" />,          label: 'Agent IA temps réel' },
            { id: 'offerb', icon: <MessageSquare className="h-4 w-4" />, label: 'Répondeur IA' },
            { id: 'batch',  icon: <Cpu className="h-4 w-4" />,          label: 'Post-appel' },
          ] as const).map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === id
                  ? 'border-[#141F28] bg-[#141F28] text-white shadow-sm'
                  : 'border-[#344453]/15 bg-white text-[#344453]/70 hover:border-[#344453]/30 hover:text-[#344453]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Contenu Agent IA ─────────────────────────────────────────── */}
        {activeTab === 'agent' && (
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-px flex-1 bg-[#344453]/10" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                Pipeline Offre Bbis — STT → LLM → TTS
              </span>
              <div className="h-px flex-1 bg-[#344453]/10" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">

              {/* STT Agent */}
              <ModelCard
                icon={<Mic className="h-5 w-5" />}
                title="Transcription temps réel"
                subtitle="Convertit la voix du client en texte pendant l'appel"
              >
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[#344453]/45">Provider</p>
                  <ProviderPills
                    value={form.agentSttProvider}
                    onChange={(v) => set('agentSttProvider', v)}
                  />
                </div>
                {form.agentSttProvider === 'mistral' && (
                  <ModelSelect
                    models={STT_MODELS_MISTRAL}
                    value={form.agentSttModel}
                    onChange={(v) => set('agentSttModel', v)}
                    label="Modèle STT"
                  />
                )}
                {form.agentSttProvider === 'gladia' && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-medium text-blue-700">Gladia activé</p>
                    <p className="mt-1 text-xs leading-5 text-blue-600">Gladia gérera automatiquement la transcription streaming. Assurez-vous que <code className="font-mono">GLADIA_API_KEY</code> est configurée.</p>
                  </div>
                )}
              </ModelCard>

              {/* LLM Agent */}
              <ModelCard
                icon={<Brain className="h-5 w-5" />}
                title="Génération de réponses"
                subtitle="Comprend la demande et formule la réponse de l'agent"
              >
                <ModelSelect
                  models={LLM_MODELS}
                  value={form.agentLlmModel}
                  onChange={(v) => set('agentLlmModel', v)}
                  label="Modèle LLM"
                  description="Vitesse critique"
                />
                <div className="rounded-2xl border border-[#344453]/8 bg-[#344453]/4 px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#344453]/60">
                    Pour un agent vocal temps réel, privilégiez un modèle <strong>Rapide</strong> ou <strong>Ultra rapide</strong> pour minimiser la latence.
                  </p>
                </div>
              </ModelCard>

              {/* TTS Agent */}
              <ModelCard
                icon={<Volume2 className="h-5 w-5" />}
                title="Synthèse vocale"
                subtitle="Transforme la réponse de l'agent en audio pour le client"
              >
                <ModelSelect
                  models={TTS_MODELS}
                  value={form.agentTtsModel}
                  onChange={(v) => set('agentTtsModel', v)}
                  label="Modèle TTS"
                />
                <div>
                  <label className="block text-sm font-medium text-[#141F28]">Voice ID</label>
                  <input
                    type="text"
                    value={form.agentTtsVoice}
                    onChange={(e) => set('agentTtsVoice', e.target.value)}
                    placeholder="Laisser vide pour la voix par défaut"
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>
              </ModelCard>
            </div>

            <Link
              to="/settings/agent-ia"
              className="inline-flex items-center gap-2 text-sm text-[#344453]/55 transition hover:text-[#344453]"
            >
              <Bot className="h-4 w-4" />
              Configurer le comportement de l'agent (prompt, température, timing…)
            </Link>
          </section>
        )}

        {/* ── Contenu Répondeur IA ─────────────────────────────────────── */}
        {activeTab === 'offerb' && (
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-px flex-1 bg-[#344453]/10" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                Pipeline Offre B — Agent textuel via Twilio Gather
              </span>
              <div className="h-px flex-1 bg-[#344453]/10" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ModelCard
                icon={<Brain className="h-5 w-5" />}
                title="Génération de réponses"
                subtitle="Comprend la demande et formule la réponse du répondeur IA pendant l'appel"
              >
                <ModelSelect
                  models={LLM_MODELS}
                  value={form.offerBLlmModel}
                  onChange={(v) => set('offerBLlmModel', v)}
                  label="Modèle LLM"
                  description="Vitesse vs qualité"
                />
                <div className="rounded-2xl border border-[#344453]/8 bg-[#344453]/4 px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#344453]/60">
                    Utilisé par <code className="font-mono text-[10px]">generateOfferBReply()</code>. Ce pipeline répond à chaque tour de parole du client via Twilio Gather. Un modèle <strong>Rapide</strong> est recommandé pour limiter la latence perçue.
                  </p>
                </div>
              </ModelCard>

              <div className="rounded-[24px] border border-[#344453]/8 bg-[#344453]/4 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#344453]/50" style={{ fontFamily: 'var(--font-mono)' }}>À noter</p>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-[#344453]/65">
                  <li>• Le Répondeur IA (Offre B) est le pipeline <strong>textuel</strong> — il utilise Twilio Gather pour capturer la parole puis génère une réponse LLM.</li>
                  <li>• Il est différent de l'Agent IA temps réel (Offre Bbis) qui utilise le streaming WebSocket.</li>
                  <li>• STT et TTS sont gérés directement par Twilio dans ce mode ; seul le LLM est configurable ici.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Contenu Post-appel ───────────────────────────────────────── */}
        {activeTab === 'batch' && (
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-px flex-1 bg-[#344453]/10" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                Traitement asynchrone après chaque appel
              </span>
              <div className="h-px flex-1 bg-[#344453]/10" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">

              {/* STT Batch */}
              <ModelCard
                icon={<Mic className="h-5 w-5" />}
                title="Transcription post-appel"
                subtitle="Retranscrit l'enregistrement audio après la fin de l'appel (avec diarisation)"
              >
                <ModelSelect
                  models={STT_MODELS_MISTRAL}
                  value={form.batchSttModel}
                  onChange={(v) => set('batchSttModel', v)}
                  label="Modèle STT Mistral"
                />
                <div className="rounded-2xl border border-[#344453]/8 bg-[#344453]/4 px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#344453]/60">
                    Utilisé par <code className="font-mono text-[10px]">transcribeAudioUrlWithDiarization()</code>. Le modèle Mistral Voxtral est utilisé pour la diarisation (séparation agent / client).
                  </p>
                </div>
              </ModelCard>

              {/* Accueil TTS */}
              <ModelCard
                icon={<Volume2 className="h-5 w-5" />}
                title="Message d'accueil vocal"
                subtitle="Voix synthétique jouée avant l'enregistrement du répondeur (Offre A/B)"
              >
                <ModelSelect
                  models={TTS_MODELS}
                  value={form.greetingTtsModel}
                  onChange={(v) => set('greetingTtsModel', v)}
                  label="Modèle TTS"
                />
                <div>
                  <label className="block text-sm font-medium text-[#141F28]">Voice ID</label>
                  <input
                    type="text"
                    value={form.greetingTtsVoice}
                    onChange={(e) => set('greetingTtsVoice', e.target.value)}
                    placeholder="Laisser vide pour la voix par défaut"
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>
              </ModelCard>

              {/* LLM Résumé */}
              <ModelCard
                icon={<Brain className="h-5 w-5" />}
                title="Résumé d'appel"
                subtitle="Génère le résumé textuel affiché dans le dashboard après chaque appel"
              >
                <ModelSelect
                  models={LLM_MODELS}
                  value={form.summaryLlmModel}
                  onChange={(v) => set('summaryLlmModel', v)}
                  label="Modèle LLM"
                  description="Qualité prioritaire"
                />
                <div className="rounded-2xl border border-[#344453]/8 bg-[#344453]/4 px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#344453]/60">
                    Utilisé par <code className="font-mono text-[10px]">summarizeCall()</code>. Un modèle <strong>Équilibré</strong> ou <strong>Puissant</strong> donnera des résumés plus précis.
                  </p>
                </div>
              </ModelCard>

              {/* LLM Intent */}
              <ModelCard
                icon={<Zap className="h-5 w-5" />}
                title="Qualification & Intent"
                subtitle="Classifie automatiquement chaque appel selon vos intents configurés"
              >
                <ModelSelect
                  models={LLM_MODELS}
                  value={form.intentLlmModel}
                  onChange={(v) => set('intentLlmModel', v)}
                  label="Modèle LLM"
                  description="Précision vs vitesse"
                />
                <div className="rounded-2xl border border-[#344453]/8 bg-[#344453]/4 px-3 py-2.5">
                  <p className="text-xs leading-5 text-[#344453]/60">
                    Utilisé par <code className="font-mono text-[10px]">detectIntent()</code>. Un modèle <strong>Rapide</strong> suffit pour la classification simple.
                  </p>
                </div>
              </ModelCard>
            </div>
          </section>
        )}

        {/* ── Sauvegarde ───────────────────────────────────────────────── */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[24px] border border-[#344453]/10 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm text-[#344453]/55">
            Les modifications s'appliquent immédiatement aux nouveaux appels.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Sauvegarde…' : 'Sauvegarder les modèles'}
          </button>
        </div>

      </form>
    </Layout>
  );
}
