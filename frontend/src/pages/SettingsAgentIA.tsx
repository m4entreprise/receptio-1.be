import { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Save, SlidersHorizontal, Sparkles } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

interface BbisAgentSettings {
  systemPrompt: string;
  temperature: number;
  llmProvider: 'openai' | 'mistral';
  llmModel: string;
  maxCompletionTokens: number;
  silenceThresholdMs: number;
  minSpeechMs: number;
  bargeInMinSpeechMs: number;
  sttProvider: 'deepgram' | 'mistral';
  sttModel: string;
  ttsProvider: 'deepgram' | 'mistral';
  ttsModel: string;
  ttsVoice: string;
}

interface OfferBSettings {
  bbisAgent?: Partial<BbisAgentSettings> | null;
}

interface Company {
  settings?: Partial<OfferBSettings> | null;
}

const defaultBbisAgentSettings: BbisAgentSettings = {
  systemPrompt: '',
  temperature: 0.4,
  llmProvider: 'openai',
  llmModel: '',
  maxCompletionTokens: 120,
  silenceThresholdMs: 260,
  minSpeechMs: 120,
  bargeInMinSpeechMs: 80,
  sttProvider: 'deepgram',
  sttModel: '',
  ttsProvider: 'deepgram',
  ttsModel: '',
  ttsVoice: '',
};

export default function SettingsAgentIA() {
  const [formData, setFormData] = useState(defaultBbisAgentSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await axios.get('/api/companies/me');
        const companyData: Company = response.data.company;
        setFormData({
          ...defaultBbisAgentSettings,
          ...(companyData.settings?.bbisAgent || {}),
        });
      } catch (error) {
        console.error('Error fetching Bbis agent settings:', error);
        setMessage('Erreur lors du chargement des paramètres');
      } finally {
        setLoading(false);
      }
    };

    void fetchCompany();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await axios.patch('/api/companies/me', {
        settings: {
          bbisAgent: formData,
        },
      });
      setMessage('Paramètres de l’agent IA sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving Bbis agent settings:', error);
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
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Chargement des paramètres de l’agent IA…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              <Sparkles className="h-3.5 w-3.5" />
              Modèle Bbis
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                Paramètres de l’agent IA
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Ajuste le prompt système, la température, les modèles et les réglages de fluidité utilisés par l’Offre Bbis pour tester rapidement plusieurs comportements sans modifier le code.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Navigation</p>
            <div className="mt-5 space-y-4">
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#171821] transition hover:bg-[#fcfbf8]"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour aux paramètres vocaux
              </Link>

              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Portée</p>
                <p className="mt-1 text-base font-semibold text-[#171821]">Offre Bbis uniquement</p>
              </div>

              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Stockage</p>
                <p className="mt-1 text-base font-semibold text-[#171821]">companies.settings.bbisAgent</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white/80 shadow-sm">
          <div className="flex items-center gap-3 border-b border-black/5 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#171821]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Réglages du modèle Bbis</h2>
              <p className="mt-1 text-sm text-[#6f685d]">Ces paramètres pilotent le comportement de l’agent vocal Deepgram/OpenAI de l’Offre Bbis.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                message.includes('succès')
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {message}
              </div>
            )}

            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-[#171821]">
                Prompt système
              </label>
              <textarea
                id="systemPrompt"
                rows={10}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Tu es le réceptionniste téléphonique de ..."
                className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-[#171821]">
                  Température
                </label>
                <input
                  type="number"
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: Number(e.target.value || 0) })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>

              <div className="rounded-[24px] border border-black/5 bg-[#f7f4ee] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <SlidersHorizontal className="mt-0.5 h-5 w-5 text-[#171821]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#171821]">Conseil de réglage</p>
                    <p className="mt-2 text-sm leading-6 text-[#6f685d]">Entre `0.2` et `0.6` pour un agent stable. Monte vers `0.8` si tu veux plus de variété dans les réponses.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="llmProvider" className="block text-sm font-medium text-[#171821]">
                  Provider LLM
                </label>
                <select
                  id="llmProvider"
                  value={formData.llmProvider}
                  onChange={(e) => setFormData({ ...formData, llmProvider: e.target.value as 'openai' | 'mistral' })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                >
                  <option value="openai">OpenAI</option>
                  <option value="mistral">Mistral AI</option>
                </select>
              </div>

              <div>
                <label htmlFor="llmModel" className="block text-sm font-medium text-[#171821]">
                  Modèle LLM
                </label>
                <input
                  type="text"
                  id="llmModel"
                  value={formData.llmModel}
                  onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                  placeholder={formData.llmProvider === 'mistral' ? 'mistral-small-latest' : 'gpt-5.4-nano'}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="maxCompletionTokens" className="block text-sm font-medium text-[#171821]">
                  Tokens max de réponse
                </label>
                <input
                  type="number"
                  id="maxCompletionTokens"
                  min={20}
                  max={500}
                  step={1}
                  value={formData.maxCompletionTokens}
                  onChange={(e) => setFormData({ ...formData, maxCompletionTokens: Number(e.target.value || 0) })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>

              <div className="rounded-[24px] border border-black/5 bg-[#f7f4ee] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <SlidersHorizontal className="mt-0.5 h-5 w-5 text-[#171821]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#171821]">Fluidité de conversation</p>
                    <p className="mt-2 text-sm leading-6 text-[#6f685d]">Baisse les seuils pour une réponse plus rapide. Monte-les si l’agent te coupe trop tôt ou déclenche sur des bruits courts.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <label htmlFor="silenceThresholdMs" className="block text-sm font-medium text-[#171821]">
                  Fin de phrase (ms)
                </label>
                <input
                  type="number"
                  id="silenceThresholdMs"
                  min={60}
                  max={1500}
                  step={10}
                  value={formData.silenceThresholdMs}
                  onChange={(e) => setFormData({ ...formData, silenceThresholdMs: Number(e.target.value || 0) })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="minSpeechMs" className="block text-sm font-medium text-[#171821]">
                  Parole minimale (ms)
                </label>
                <input
                  type="number"
                  id="minSpeechMs"
                  min={40}
                  max={1500}
                  step={10}
                  value={formData.minSpeechMs}
                  onChange={(e) => setFormData({ ...formData, minSpeechMs: Number(e.target.value || 0) })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="bargeInMinSpeechMs" className="block text-sm font-medium text-[#171821]">
                  Interruption IA (ms)
                </label>
                <input
                  type="number"
                  id="bargeInMinSpeechMs"
                  min={40}
                  max={1000}
                  step={10}
                  value={formData.bargeInMinSpeechMs}
                  onChange={(e) => setFormData({ ...formData, bargeInMinSpeechMs: Number(e.target.value || 0) })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="sttProvider" className="block text-sm font-medium text-[#171821]">
                  Provider STT
                </label>
                <select
                  id="sttProvider"
                  value={formData.sttProvider}
                  onChange={(e) => setFormData({ ...formData, sttProvider: e.target.value as 'deepgram' | 'mistral' })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                >
                  <option value="deepgram">Deepgram</option>
                  <option value="mistral">Mistral AI</option>
                </select>
              </div>

              <div>
                <label htmlFor="sttModel" className="block text-sm font-medium text-[#171821]">
                  Modèle STT
                </label>
                <input
                  type="text"
                  id="sttModel"
                  value={formData.sttModel}
                  onChange={(e) => setFormData({ ...formData, sttModel: e.target.value })}
                  placeholder={formData.sttProvider === 'mistral' ? 'voxtral-mini-latest' : 'nova-2'}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <label htmlFor="ttsProvider" className="block text-sm font-medium text-[#171821]">
                  Provider TTS
                </label>
                <select
                  id="ttsProvider"
                  value={formData.ttsProvider}
                  onChange={(e) => setFormData({ ...formData, ttsProvider: e.target.value as 'deepgram' | 'mistral' })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                >
                  <option value="deepgram">Deepgram</option>
                  <option value="mistral">Mistral AI</option>
                </select>
              </div>

              <div>
                <label htmlFor="ttsModel" className="block text-sm font-medium text-[#171821]">
                  Modèle TTS
                </label>
                <input
                  type="text"
                  id="ttsModel"
                  value={formData.ttsModel}
                  onChange={(e) => setFormData({ ...formData, ttsModel: e.target.value })}
                  placeholder={formData.ttsProvider === 'mistral' ? 'voxtral-mini-tts-2603' : 'aura-asteria-fr'}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="ttsVoice" className="block text-sm font-medium text-[#171821]">
                  {formData.ttsProvider === 'mistral' ? 'Voice ID Mistral' : 'Voix TTS'}
                </label>
                <input
                  type="text"
                  id="ttsVoice"
                  value={formData.ttsVoice}
                  onChange={(e) => setFormData({ ...formData, ttsVoice: e.target.value })}
                  placeholder={formData.ttsProvider === 'mistral' ? 'voice_id optionnel' : 'aura-asteria-fr'}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#6f685d]">Ces réglages sont sauvegardés au niveau de votre entreprise et seront utilisés par l’Offre Bbis.</p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111118] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
