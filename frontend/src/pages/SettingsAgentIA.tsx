import { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Brain, ExternalLink, Save, SlidersHorizontal, Sparkles } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

interface BbisAgentSettings {
  systemPrompt: string;
  temperature: number;
  maxCompletionTokens: number;
  silenceThresholdMs: number;
  minSpeechMs: number;
  bargeInMinSpeechMs: number;
}

interface Company {
  settings?: { bbisAgent?: Partial<BbisAgentSettings> | null } | null;
}

const DEFAULT: BbisAgentSettings = {
  systemPrompt: '',
  temperature: 0.4,
  maxCompletionTokens: 120,
  silenceThresholdMs: 260,
  minSpeechMs: 120,
  bargeInMinSpeechMs: 80,
};

export default function SettingsAgentIA() {
  const [formData, setFormData] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get('/api/companies/me');
        const company: Company = data.company;
        setFormData({ ...DEFAULT, ...(company.settings?.bbisAgent || {}) });
      } catch {
        setMessage('Erreur lors du chargement des paramètres');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await axios.patch('/api/companies/me', {
        settings: { bbisAgent: formData },
      });
      setMessage("Paramètres de l'agent IA sauvegardés avec succès");
    } catch {
      setMessage('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement des paramètres de l'agent IA…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Comportement agent
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Personnalisez le comportement de l'agent IA.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Définissez le prompt système, la créativité, la longueur des réponses et la sensibilité de détection vocale. Les modèles utilisés se configurent dans Gestion des modèles IA.
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
              <Link
                to="/settings/ai-models"
                className="flex items-center gap-3 rounded-2xl border border-[#C7601D]/20 bg-[#C7601D]/6 px-4 py-3 transition hover:bg-[#C7601D]/10"
              >
                <Brain className="h-5 w-5 shrink-0 text-[#C7601D]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#141F28]">Gestion des modèles IA</p>
                  <p className="text-xs text-[#344453]/55">Choisir STT, LLM et TTS →</p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-[#C7601D]/60" />
              </Link>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Portée</p>
                <p className="mt-0.5 text-sm font-semibold text-[#141F28]">Offre Bbis uniquement</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Formulaire ───────────────────────────────────────────────── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Comportement de l'agent</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Prompt, créativité, longueur des réponses et sensibilité de détection vocale.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                message.includes('succès')
                  ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                  : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
              }`}>
                {message}
              </div>
            )}

            {/* Prompt système */}
            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-[#344453]">
                Prompt système
              </label>
              <p className="mt-1 text-xs text-[#344453]/55">Instructions données à l'agent avant chaque conversation. Laissez vide pour utiliser le prompt par défaut.</p>
              <textarea
                id="systemPrompt"
                rows={10}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder={`Tu es le réceptionniste téléphonique de [Votre entreprise]. Réponds en français, de manière concise et professionnelle. Si le client demande un humain, réponds exactement __TRANSFER__.`}
                className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
              />
            </div>

            {/* Température + info */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-[#344453]">
                  Température <span className="ml-1 font-mono text-xs text-[#344453]/50">{formData.temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: Number(e.target.value) })}
                  className="mt-3 block w-full accent-[#C7601D]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-[#344453]/40">
                  <span>Déterministe</span>
                  <span>Créatif</span>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#344453]/8 bg-[#344453]/4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-[#344453]" />
                  <div>
                    <p className="text-sm font-medium text-[#141F28]">Conseil</p>
                    <p className="mt-1 text-xs leading-5 text-[#344453]/60">Entre <strong>0.2</strong> et <strong>0.5</strong> pour un agent prévisible. Montez vers <strong>0.8</strong> pour plus de variété dans les formulations.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tokens max */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="maxCompletionTokens" className="block text-sm font-medium text-[#344453]">
                  Longueur max de réponse <span className="ml-1 font-mono text-xs text-[#344453]/50">{formData.maxCompletionTokens} tokens</span>
                </label>
                <input
                  type="range"
                  id="maxCompletionTokens"
                  min={20}
                  max={500}
                  step={10}
                  value={formData.maxCompletionTokens}
                  onChange={(e) => setFormData({ ...formData, maxCompletionTokens: Number(e.target.value) })}
                  className="mt-3 block w-full accent-[#C7601D]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-[#344453]/40">
                  <span>Court (20)</span>
                  <span>Long (500)</span>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#344453]/8 bg-[#344453]/4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-[#344453]" />
                  <div>
                    <p className="text-sm font-medium text-[#141F28]">Fluidité vocale</p>
                    <p className="mt-1 text-xs leading-5 text-[#344453]/60">Pour un agent vocal, gardez entre <strong>80</strong> et <strong>150</strong> tokens. Les réponses longues allongent la latence perçue.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timing vocal */}
            <div>
              <p className="text-sm font-medium text-[#344453]">Détection vocale</p>
              <p className="mt-1 text-xs text-[#344453]/55">Calibrez la sensibilité de l'agent à la voix du client pour éviter les déclenchements parasites ou les coupures prématurées.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div>
                  <label htmlFor="silenceThresholdMs" className="block text-xs font-medium text-[#344453]/70">
                    Fin de phrase <span className="font-mono">{formData.silenceThresholdMs}ms</span>
                  </label>
                  <input
                    type="range"
                    id="silenceThresholdMs"
                    min={60}
                    max={1500}
                    step={10}
                    value={formData.silenceThresholdMs}
                    onChange={(e) => setFormData({ ...formData, silenceThresholdMs: Number(e.target.value) })}
                    className="mt-2 block w-full accent-[#344453]"
                  />
                  <p className="mt-1 text-[10px] text-[#344453]/40">Silence → fin d'utterance</p>
                </div>

                <div>
                  <label htmlFor="minSpeechMs" className="block text-xs font-medium text-[#344453]/70">
                    Parole min <span className="font-mono">{formData.minSpeechMs}ms</span>
                  </label>
                  <input
                    type="range"
                    id="minSpeechMs"
                    min={40}
                    max={1500}
                    step={10}
                    value={formData.minSpeechMs}
                    onChange={(e) => setFormData({ ...formData, minSpeechMs: Number(e.target.value) })}
                    className="mt-2 block w-full accent-[#344453]"
                  />
                  <p className="mt-1 text-[10px] text-[#344453]/40">Durée minimale valide</p>
                </div>

                <div>
                  <label htmlFor="bargeInMinSpeechMs" className="block text-xs font-medium text-[#344453]/70">
                    Interruption <span className="font-mono">{formData.bargeInMinSpeechMs}ms</span>
                  </label>
                  <input
                    type="range"
                    id="bargeInMinSpeechMs"
                    min={40}
                    max={1000}
                    step={10}
                    value={formData.bargeInMinSpeechMs}
                    onChange={(e) => setFormData({ ...formData, bargeInMinSpeechMs: Number(e.target.value) })}
                    className="mt-2 block w-full accent-[#344453]"
                  />
                  <p className="mt-1 text-[10px] text-[#344453]/40">Pour couper l'agent IA</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#344453]/55">Ces réglages s'appliquent à l'Offre Bbis uniquement.</p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
