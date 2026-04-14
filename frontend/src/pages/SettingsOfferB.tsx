import { useEffect, useState } from 'react';
import { Bot, Brain, Building2, Database, ExternalLink, Pencil, PhoneForwarded, Plus, Save, ShieldCheck, Sparkles, Target, Trash2, Zap } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

interface OfferBSettings {
  voicePipelineEnabled: boolean;
  agentEnabled: boolean;
  humanTransferNumber: string;
  fallbackToVoicemail: boolean;
  maxAgentFailures: number;
  greetingText: string;
  knowledgeBaseEnabled: boolean;
  appointmentIntegrationEnabled: boolean;
  smartRoutingEnabled: boolean;
  routingQuestion: string;
  transferMessage: string;
}

interface Company {
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  created_at?: string | null;
  settings?: Partial<OfferBSettings> | null;
}

interface KnowledgeBaseEntry {
  id: string;
  title: string;
  category?: string | null;
  content: string;
  priority: number;
  enabled: boolean;
  updated_at?: string;
}

const defaultOfferBSettings: OfferBSettings = {
  voicePipelineEnabled: false,
  agentEnabled: false,
  humanTransferNumber: '',
  fallbackToVoicemail: true,
  maxAgentFailures: 2,
  greetingText: '',
  knowledgeBaseEnabled: false,
  appointmentIntegrationEnabled: false,
  smartRoutingEnabled: false,
  routingQuestion: '',
  transferMessage: '',
};

const emptyKnowledgeForm = {
  title: '',
  category: '',
  content: '',
  priority: 0,
  enabled: true,
};

const modules = [
  {
    to: '/settings/ai-models',
    icon: Brain,
    label: 'Gestion des modèles IA',
    description: 'STT, LLM, TTS et voix',
    color: '#C7601D',
  },
  {
    to: '/settings/agent-ia',
    icon: Bot,
    label: "Comportement de l'agent",
    description: 'Prompt, tokens, timing vocal',
    color: '#344453',
  },
  {
    to: '/settings/intents',
    icon: Zap,
    label: 'Intentions & qualification',
    description: "Catégories d'appel, critères",
    color: '#2D9D78',
  },
  {
    to: '/settings/qa',
    icon: Target,
    label: 'Contrôle qualité',
    description: "Grilles d'évaluation QA",
    color: '#7B61FF',
  },
];

export default function SettingsOfferB() {
  const [company, setCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    settings: defaultOfferBSettings,
  });
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [knowledgeForm, setKnowledgeForm] = useState(emptyKnowledgeForm);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [message, setMessage] = useState('');
  const [knowledgeMessage, setKnowledgeMessage] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        await Promise.all([fetchCompany(), fetchKnowledgeBase()]);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await axios.get('/api/companies/me');
      const companyData: Company = response.data.company;
      setCompany(companyData);
      setFormData({
        name: companyData.name || '',
        phoneNumber: companyData.phone_number || '',
        settings: {
          ...defaultOfferBSettings,
          ...(companyData.settings || {}),
        },
      });
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchKnowledgeBase = async () => {
    try {
      const response = await axios.get('/api/knowledge-base');
      setKnowledgeEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await axios.patch('/api/companies/me', {
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        settings: formData.settings,
      });
      setMessage('Param\u00e8tres sauvegard\u00e9s avec succ\u00e8s');
      await fetchCompany();
    } catch (error) {
      console.error('Error saving company settings:', error);
      setMessage('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleKnowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKnowledge(true);
    setKnowledgeMessage('');
    try {
      if (editingKnowledgeId) {
        await axios.patch(`/api/knowledge-base/${editingKnowledgeId}`, knowledgeForm);
        setKnowledgeMessage('Entr\u00e9e mise \u00e0 jour avec succ\u00e8s');
      } else {
        await axios.post('/api/knowledge-base', knowledgeForm);
        setKnowledgeMessage('Entr\u00e9e ajout\u00e9e avec succ\u00e8s');
      }
      setKnowledgeForm(emptyKnowledgeForm);
      setEditingKnowledgeId(null);
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error saving knowledge base entry:', error);
      setKnowledgeMessage("Erreur lors de la sauvegarde de l'entr\u00e9e");
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleEditKnowledgeEntry = (entry: KnowledgeBaseEntry) => {
    setEditingKnowledgeId(entry.id);
    setKnowledgeForm({
      title: entry.title,
      category: entry.category || '',
      content: entry.content,
      priority: entry.priority,
      enabled: entry.enabled,
    });
    setKnowledgeMessage('');
  };

  const handleDeleteKnowledgeEntry = async (entryId: string) => {
    try {
      await axios.delete(`/api/knowledge-base/${entryId}`);
      if (editingKnowledgeId === entryId) {
        setEditingKnowledgeId(null);
        setKnowledgeForm(emptyKnowledgeForm);
      }
      setKnowledgeMessage('Entr\u00e9e supprim\u00e9e avec succ\u00e8s');
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error deleting knowledge base entry:', error);
      setKnowledgeMessage('Erreur lors de la suppression');
    }
  };

  const handleToggleKnowledgeEntry = async (entry: KnowledgeBaseEntry) => {
    try {
      await axios.patch(`/api/knowledge-base/${entry.id}`, { enabled: !entry.enabled });
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error toggling knowledge base entry:', error);
      setKnowledgeMessage('Erreur lors de la mise \u00e0 jour du statut');
    }
  };

  const resetKnowledgeEditor = () => {
    setEditingKnowledgeId(null);
    setKnowledgeForm(emptyKnowledgeForm);
    setKnowledgeMessage('');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Chargement des param\u00e8tres\u2026</p>
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
              Espace configuration
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Configurez votre r\u00e9ceptionniste t\u00e9l\u00e9phonique IA.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Choisissez votre mode de r\u00e9ponse, param\u00e9trez les mod\u00e8les IA, le transfert humain et enrichissez la base de connaissances utilis\u00e9e lors des appels.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Compte</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Email de r\u00e9f\u00e9rence</p>
                <p className="mt-0.5 break-all text-sm font-semibold text-[#141F28]">{company?.email || 'Non renseign\u00e9'}</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Compte cr\u00e9\u00e9 le</p>
                <p className="mt-0.5 text-sm font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/25 bg-[#2D9D78]/8 px-4 py-2 text-xs text-[#2D9D78]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Param\u00e8tres synchronis\u00e9s avec votre compte
              </div>
            </div>
          </div>
        </section>

        {/* ── Modules avancés ──────────────────────────────────────────── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Modules avanc\u00e9s</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Tous les modules sont accessibles quel que soit le mode actif.</p>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.to}
                  to={mod.to}
                  className="flex items-center gap-3 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3.5 transition hover:bg-white hover:shadow-sm"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${mod.color}15`, color: mod.color }}
                  >
                    <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#141F28]">{mod.label}</p>
                    <p className="truncate text-xs text-[#344453]/50">{mod.description}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#344453]/30" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Configuration principale ─────────────────────────────────── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Entreprise & mode de r\u00e9ponse</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Choisissez comment votre r\u00e9ceptionniste g\u00e8re les appels entrants.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                message.includes('succ\u00e8s')
                  ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                  : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
              }`}>
                {message}
              </div>
            )}

            {/* Infos entreprise */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#344453]">
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-[#344453]">
                  Num\u00e9ro de t\u00e9l\u00e9phone Twilio
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+32 470 12 34 56"
                  className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                />
              </div>
            </div>

            {/* Sélecteur de mode */}
            <div>
              <p className="mb-3 text-sm font-medium text-[#344453]">Mode de r\u00e9ponse</p>
              <div className="rounded-[24px] border border-[#344453]/12 bg-[#F8F9FB] p-1.5">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, settings: { ...formData.settings, voicePipelineEnabled: false } })}
                    className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                      !formData.settings.voicePipelineEnabled
                        ? 'bg-white text-[#141F28] shadow-sm'
                        : 'text-[#344453]/50 hover:text-[#344453]'
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                    R\u00e9pondeur classique
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, settings: { ...formData.settings, voicePipelineEnabled: true } })}
                    className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                      formData.settings.voicePipelineEnabled
                        ? 'bg-[#344453] text-white shadow-sm'
                        : 'text-[#344453]/50 hover:text-[#344453]'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    R\u00e9pondeur IA
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#344453]/45">
                {formData.settings.voicePipelineEnabled
                  ? "L'agent IA d\u00e9croche, dialogue en temps r\u00e9el et inclut le routage intelligent."
                  : "R\u00e9pondeur vocal classique avec messagerie. Le routage intelligent est disponible en option."}
              </p>
            </div>

            {/* ── Mode répondeur classique ── */}
            {!formData.settings.voicePipelineEnabled && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="greetingText" className="block text-sm font-medium text-[#344453]">
                    Message d'accueil
                  </label>
                  <textarea
                    id="greetingText"
                    rows={3}
                    value={formData.settings.greetingText}
                    onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, greetingText: e.target.value } })}
                    placeholder={`Bonjour, vous \u00eates bien chez ${formData.name || 'votre entreprise'}. Merci de laisser votre message apr\u00e8s le bip.`}
                    className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Lu par Twilio \u00e0 chaque appel entrant. Laissez vide pour le message par d\u00e9faut.</p>
                </div>

                <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <PhoneForwarded className="mt-0.5 h-5 w-5 shrink-0 text-[#344453]" />
                      <div>
                        <p className="text-sm font-medium text-[#141F28]">Routage intelligent</p>
                        <p className="mt-1 text-sm leading-6 text-[#344453]/55">L'appelant dit son motif, il est mis en attente, et vous le transf\u00e9rez depuis le dashboard.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.smartRoutingEnabled}
                      onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, smartRoutingEnabled: e.target.checked } })}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]"
                    />
                  </div>
                  {formData.settings.smartRoutingEnabled && (
                    <div className="mt-4 border-t border-[#344453]/8 pt-4">
                      <label htmlFor="routingQuestion" className="block text-sm font-medium text-[#344453]">
                        Question pos\u00e9e \u00e0 l'appelant
                      </label>
                      <input
                        type="text"
                        id="routingQuestion"
                        value={formData.settings.routingQuestion}
                        onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, routingQuestion: e.target.value } })}
                        placeholder="Quel est le motif de votre appel ?"
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Mode répondeur IA ── */}
            {formData.settings.voicePipelineEnabled && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="greetingTextAgent" className="block text-sm font-medium text-[#344453]">
                    Message d'accueil de l'agent
                  </label>
                  <input
                    type="text"
                    id="greetingTextAgent"
                    value={formData.settings.greetingText}
                    onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, greetingText: e.target.value } })}
                    placeholder={`Bonjour, vous \u00eates bien chez ${formData.name || 'votre entreprise'}. Comment puis-je vous aider ?`}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Premi\u00e8re phrase prononc\u00e9e par l'agent \u00e0 chaque appel.</p>
                </div>

                {/* Transfert humain */}
                <div className="rounded-[24px] border border-[#344453]/12 bg-[#F8F9FB] p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#344453]">
                    <PhoneForwarded className="h-4 w-4" />
                    Transfert vers un humain
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <label htmlFor="humanTransferNumber" className="block text-sm font-medium text-[#344453]">
                        Num\u00e9ro de transfert
                      </label>
                      <input
                        type="tel"
                        id="humanTransferNumber"
                        value={formData.settings.humanTransferNumber}
                        onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, humanTransferNumber: e.target.value } })}
                        placeholder="+32 4 000 00 00"
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                      />
                    </div>
                    <div>
                      <label htmlFor="maxAgentFailures" className="block text-sm font-medium text-[#344453]">
                        Tentatives avant transfert auto
                      </label>
                      <input
                        type="number"
                        id="maxAgentFailures"
                        min={1}
                        max={10}
                        value={formData.settings.maxAgentFailures}
                        onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, maxAgentFailures: Number(e.target.value || 1) } })}
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="transferMessage" className="block text-sm font-medium text-[#344453]">
                      Message audio avant transfert
                    </label>
                    <input
                      type="text"
                      id="transferMessage"
                      value={formData.settings.transferMessage}
                      onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, transferMessage: e.target.value } })}
                      placeholder="Je vous mets en relation avec la personne comp\u00e9tente. Un instant s'il vous pla\u00eet."
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                    />
                    <p className="mt-1.5 text-xs text-[#344453]/45">Prononc\u00e9 par l'agent vocal juste avant de passer l'appel.</p>
                  </div>
                </div>

                {/* Options */}
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4">
                    <div className="flex items-start gap-3">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]" />
                      <div>
                        <p className="text-sm font-medium text-[#141F28]">Agent vocal activ\u00e9</p>
                        <p className="mt-1 text-xs leading-5 text-[#344453]/55">L'agent d\u00e9croche et dialogue activement.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.agentEnabled}
                      onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, agentEnabled: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4">
                    <div className="flex items-start gap-3">
                      <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]" />
                      <div>
                        <p className="text-sm font-medium text-[#141F28]">Base de connaissances</p>
                        <p className="mt-1 text-xs leading-5 text-[#344453]/55">L'agent s'appuie sur vos infos m\u00e9tier.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.knowledgeBaseEnabled}
                      onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, knowledgeBaseEnabled: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4">
                    <div className="flex items-start gap-3">
                      <PhoneForwarded className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]" />
                      <div>
                        <p className="text-sm font-medium text-[#141F28]">Fallback messagerie</p>
                        <p className="mt-1 text-xs leading-5 text-[#344453]/55">Revient au r\u00e9pondeur si l'agent \u00e9choue.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.settings.fallbackToVoicemail}
                      onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, fallbackToVoicemail: e.target.checked } })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#344453]/55">Les modifications sont enregistr\u00e9es directement sur votre compte entreprise.</p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Sauvegarde\u2026' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </section>

        {/* ── Base de connaissances ─────────────────────────────────────── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Base de connaissances</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Renseignez les informations que l'agent doit conna\u00eetre avant de r\u00e9pondre ou d'\u00e9scalader vers un humain.</p>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={handleKnowledgeSubmit} className="space-y-5 rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
              {knowledgeMessage && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  knowledgeMessage.includes('succ\u00e8s')
                    ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                    : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
                }`}>
                  {knowledgeMessage}
                </div>
              )}

              <div>
                <label htmlFor="knowledgeTitle" className="block text-sm font-medium text-[#344453]">
                  Titre
                </label>
                <input
                  type="text"
                  id="knowledgeTitle"
                  value={knowledgeForm.title}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                  placeholder="Horaires, tarifs, zones d'intervention..."
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <div>
                  <label htmlFor="knowledgeCategory" className="block text-sm font-medium text-[#344453]">
                    Cat\u00e9gorie
                  </label>
                  <input
                    type="text"
                    id="knowledgeCategory"
                    value={knowledgeForm.category}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                    placeholder="FAQ, horaires, services..."
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                  />
                </div>
                <div>
                  <label htmlFor="knowledgePriority" className="block text-sm font-medium text-[#344453]">
                    Priorit\u00e9
                  </label>
                  <input
                    type="number"
                    id="knowledgePriority"
                    min={0}
                    max={100}
                    value={knowledgeForm.priority}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, priority: Number(e.target.value || 0) })}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="knowledgeContent" className="block text-sm font-medium text-[#344453]">
                  Contenu m\u00e9tier
                </label>
                <textarea
                  id="knowledgeContent"
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                  rows={6}
                  placeholder="Exemple : Nous intervenons dans toute la province de Li\u00e8ge du lundi au vendredi de 8h \u00e0 18h."
                  className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm font-medium text-[#141F28]">
                <span>Entr\u00e9e active</span>
                <input
                  type="checkbox"
                  checked={knowledgeForm.enabled}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={savingKnowledge}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#344453] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingKnowledgeId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {savingKnowledge ? 'Sauvegarde\u2026' : editingKnowledgeId ? 'Mettre \u00e0 jour' : "Ajouter l'entr\u00e9e"}
                </button>
                {editingKnowledgeId && (
                  <button
                    type="button"
                    onClick={resetKnowledgeEditor}
                    className="rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                  >
                    Annuler l'\u00e9dition
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {knowledgeEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                  <p className="text-base font-medium text-[#141F28]">Aucune information m\u00e9tier pour l'instant</p>
                  <p className="mt-2 text-sm text-[#344453]/55">Ajoutez ici les r\u00e9ponses et donn\u00e9es d'entreprise sur lesquelles l'agent s'appuiera.</p>
                </div>
              ) : (
                knowledgeEntries.map((entry) => (
                  <div key={entry.id} className="rounded-[24px] border border-[#344453]/8 bg-[#F8F9FB] p-4 sm:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#141F28] sm:text-base">{entry.title}</p>
                            {entry.category && (
                              <span className="inline-flex items-center rounded-full bg-[#344453]/8 px-3 py-1 text-xs font-medium text-[#344453]">
                                {entry.category}
                              </span>
                            )}
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              entry.enabled ? 'bg-[#2D9D78]/10 text-[#2D9D78]' : 'bg-[#344453]/8 text-[#344453]/50'
                            }`}>
                              {entry.enabled ? 'Actif' : 'D\u00e9sactiv\u00e9'}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#344453]/60">{entry.content}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleKnowledgeEntry(entry)}
                            className="rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                          >
                            {entry.enabled ? 'D\u00e9sactiver' : 'Activer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditKnowledgeEntry(entry)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                            title="Modifier"
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D94052]/20 bg-white text-[#D94052] transition hover:bg-[#D94052]/8"
                            title="Supprimer"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span>Priorit\u00e9 {entry.priority}</span>
                        {entry.updated_at && <span>Mis \u00e0 jour le {new Date(entry.updated_at).toLocaleString('fr-BE')}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
