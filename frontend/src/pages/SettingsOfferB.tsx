import { useEffect, useRef, useState } from 'react';
import {
  Bot, Brain, Building2, Check, CheckCircle2, Database, ExternalLink,
  Pencil, PhoneForwarded, Plus, Save, ShieldCheck, Sparkles,
  Target, Trash2, Zap,
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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
    permission: 'settingsManage' as const,
  },
  {
    to: '/settings/agent-ia',
    icon: Bot,
    label: "Comportement de l'agent",
    description: 'Prompt, tokens, timing vocal',
    color: '#344453',
    permission: 'settingsManage' as const,
  },
  {
    to: '/settings/intents',
    icon: Zap,
    label: 'Intentions & qualification',
    description: "Catégories d'appel, critères",
    color: '#2D9D78',
    permission: 'intentsManage' as const,
  },
  {
    to: '/settings/qa',
    icon: Target,
    label: 'Contrôle qualité',
    description: "Grilles d'évaluation QA",
    color: '#7B61FF',
    permission: 'qaManage' as const,
  },
  {
    to: '/settings/team-access',
    icon: ShieldCheck,
    label: 'Équipe & accès',
    description: 'Membres, invitations, rôles, audit',
    color: '#141F28',
    permission: 'memberManage' as const,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[#344453]' : 'bg-[#344453]/15'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function FieldRow({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-[#344453]/10 bg-[#344453]/3 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#344453]/8 text-[#344453]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#141F28]">{label}</p>
          <p className="mt-0.5 text-xs leading-5 text-[#344453]/55">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsOfferB() {
  const { user } = useAuth();
  const canManageSettings = user?.permissions?.settingsManage ?? true;
  const canManageKnowledgeBase = user?.permissions?.knowledgeBaseManage ?? true;

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
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeMessage, setKnowledgeMessage] = useState('');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleModules = modules.filter((m) => {
    return user?.permissions?.[m.permission as keyof NonNullable<typeof user>['permissions']] ?? true;
  });

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          fetchCompany(),
          canManageKnowledgeBase ? fetchKnowledgeBase() : Promise.resolve(),
        ]);
      } finally {
        setLoading(false);
      }
    };
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageKnowledgeBase]);

  const fetchCompany = async () => {
    const { data } = await axios.get('/api/companies/me');
    const c: Company = data.company;
    setCompany(c);
    setFormData({
      name: c.name || '',
      phoneNumber: c.phone_number || '',
      settings: { ...defaultOfferBSettings, ...(c.settings || {}) },
    });
  };

  const fetchKnowledgeBase = async () => {
    const { data } = await axios.get('/api/knowledge-base');
    setKnowledgeEntries(data.entries || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await axios.patch('/api/companies/me', {
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        settings: formData.settings,
      });
      await fetchCompany();
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Erreur lors de la sauvegarde');
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
        setKnowledgeMessage('Entrée mise à jour avec succès');
      } else {
        await axios.post('/api/knowledge-base', knowledgeForm);
        setKnowledgeMessage('Entrée ajoutée avec succès');
      }
      setKnowledgeForm(emptyKnowledgeForm);
      setEditingKnowledgeId(null);
      await fetchKnowledgeBase();
    } catch {
      setKnowledgeMessage("Erreur lors de la sauvegarde de l'entrée");
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

  const handleDeleteKnowledgeEntry = async (id: string) => {
    try {
      await axios.delete(`/api/knowledge-base/${id}`);
      if (editingKnowledgeId === id) {
        setEditingKnowledgeId(null);
        setKnowledgeForm(emptyKnowledgeForm);
      }
      setKnowledgeMessage('Entrée supprimée avec succès');
      await fetchKnowledgeBase();
    } catch {
      setKnowledgeMessage('Erreur lors de la suppression');
    }
  };

  const handleToggleKnowledgeEntry = async (entry: KnowledgeBaseEntry) => {
    try {
      await axios.patch(`/api/knowledge-base/${entry.id}`, { enabled: !entry.enabled });
      await fetchKnowledgeBase();
    } catch {
      setKnowledgeMessage('Erreur lors de la mise à jour du statut');
    }
  };

  const resetKnowledgeEditor = () => {
    setEditingKnowledgeId(null);
    setKnowledgeForm(emptyKnowledgeForm);
    setKnowledgeMessage('');
  };

  const setSetting = <K extends keyof OfferBSettings>(key: K, value: OfferBSettings[K]) =>
    setFormData((f) => ({ ...f, settings: { ...f.settings, [key]: value } }));

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement des paramètres…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">

        {/* ── En-tête ───────────────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Espace configuration
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Configurez votre réceptionniste téléphonique IA.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Choisissez le mode de réponse, paramétrez les modèles IA, le transfert humain et enrichissez la base de connaissances utilisée lors des appels.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Compte</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Email de référence</p>
                <p className="mt-0.5 break-all text-sm font-semibold text-[#141F28]">{company?.email || 'Non renseigné'}</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-xs text-[#344453]/50">Compte créé le</p>
                <p className="mt-0.5 text-sm font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/25 bg-[#2D9D78]/8 px-4 py-2 text-xs text-[#2D9D78]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Paramètres synchronisés avec votre compte
              </div>
            </div>
          </div>
        </section>

        {/* ── Modules ───────────────────────────────────────────────────── */}
        {visibleModules.length > 0 && (
          <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Modules avancés</h2>
                <p className="mt-0.5 text-sm text-[#344453]/55">Configuration fine de l'IA, des intents, de la qualité et de l'équipe.</p>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
              {visibleModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.to}
                    to={mod.to}
                    className="group flex items-center gap-3 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3.5 transition hover:border-[#344453]/20 hover:bg-white hover:shadow-sm"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition"
                      style={{ background: `${mod.color}15`, color: mod.color }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#141F28]">{mod.label}</p>
                      <p className="truncate text-xs text-[#344453]/50">{mod.description}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#344453]/25 transition group-hover:text-[#344453]/50" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Entreprise & mode de réponse ──────────────────────────────── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Entreprise & mode de réponse</h2>
              <p className="mt-0.5 text-sm text-[#344453]/55">Identité, numéro Twilio et comportement des appels entrants.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6">

            {saveError && (
              <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm font-medium text-[#D94052]">
                {saveError}
              </div>
            )}

            {/* Infos entreprise */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Identité</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#344453]">Nom de l'entreprise</label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!canManageSettings}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-[#344453]">Numéro de téléphone Twilio</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+32 470 12 34 56"
                    disabled={!canManageSettings}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Associe les appels entrants Twilio à votre entreprise.</p>
                </div>
              </div>
            </div>

            {/* Sélecteur de mode */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Mode de réponse</p>
              <div className="rounded-[24px] border border-[#344453]/12 bg-[#F8F9FB] p-1.5">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSetting('voicePipelineEnabled', false)}
                    disabled={!canManageSettings}
                    className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      !formData.settings.voicePipelineEnabled
                        ? 'bg-white text-[#141F28] shadow-sm'
                        : 'text-[#344453]/50 hover:text-[#344453]'
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                    Répondeur classique
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetting('voicePipelineEnabled', true)}
                    disabled={!canManageSettings}
                    className={`flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      formData.settings.voicePipelineEnabled
                        ? 'bg-[#344453] text-white shadow-sm'
                        : 'text-[#344453]/50 hover:text-[#344453]'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Répondeur IA
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#344453]/45">
                {formData.settings.voicePipelineEnabled
                  ? "L'agent IA décroche, dialogue en temps réel et inclut le routage intelligent."
                  : "Répondeur vocal classique avec messagerie. Le routage intelligent est disponible en option."}
              </p>
            </div>

            {/* ── Mode répondeur classique ── */}
            {!formData.settings.voicePipelineEnabled && (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Options répondeur</p>
                <div>
                  <label htmlFor="greetingText" className="block text-sm font-medium text-[#344453]">Message d'accueil</label>
                  <textarea
                    id="greetingText"
                    rows={3}
                    value={formData.settings.greetingText}
                    onChange={(e) => setSetting('greetingText', e.target.value)}
                    disabled={!canManageSettings}
                    placeholder={`Bonjour, vous êtes bien chez ${formData.name || 'votre entreprise'}. Merci de laisser votre message après le bip.`}
                    className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Lu par Twilio à chaque appel entrant. Laissez vide pour le message par défaut.</p>
                </div>

                <div className="rounded-[20px] border border-[#344453]/10 bg-[#344453]/3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#344453]/8 text-[#344453]">
                        <PhoneForwarded className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#141F28]">Routage intelligent</p>
                        <p className="mt-0.5 text-xs leading-5 text-[#344453]/55">L'appelant dit son motif, il est mis en attente, et vous le transférez depuis le dashboard.</p>
                      </div>
                    </div>
                    <Toggle
                      checked={formData.settings.smartRoutingEnabled}
                      onChange={(v) => setSetting('smartRoutingEnabled', v)}
                      disabled={!canManageSettings}
                    />
                  </div>
                  {formData.settings.smartRoutingEnabled && (
                    <div className="mt-4 border-t border-[#344453]/8 pt-4">
                      <label htmlFor="routingQuestion" className="block text-sm font-medium text-[#344453]">Question posée à l'appelant</label>
                      <input
                        type="text"
                        id="routingQuestion"
                        value={formData.settings.routingQuestion}
                        onChange={(e) => setSetting('routingQuestion', e.target.value)}
                        disabled={!canManageSettings}
                        placeholder="Quel est le motif de votre appel ?"
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Mode répondeur IA ── */}
            {formData.settings.voicePipelineEnabled && (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Options agent IA</p>

                <div>
                  <label htmlFor="greetingTextAgent" className="block text-sm font-medium text-[#344453]">Message d'accueil de l'agent</label>
                  <input
                    type="text"
                    id="greetingTextAgent"
                    value={formData.settings.greetingText}
                    onChange={(e) => setSetting('greetingText', e.target.value)}
                    disabled={!canManageSettings}
                    placeholder={`Bonjour, vous êtes bien chez ${formData.name || 'votre entreprise'}. Comment puis-je vous aider ?`}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Première phrase prononcée par l'agent à chaque appel.</p>
                </div>

                {/* Transfert humain */}
                <div className="rounded-[20px] border border-[#344453]/12 bg-[#F8F9FB] p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#344453]">
                    <PhoneForwarded className="h-4 w-4" />
                    Transfert vers un humain
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label htmlFor="humanTransferNumber" className="block text-sm font-medium text-[#344453]">Numéro de transfert</label>
                      <input
                        type="tel"
                        id="humanTransferNumber"
                        value={formData.settings.humanTransferNumber}
                        onChange={(e) => setSetting('humanTransferNumber', e.target.value)}
                        disabled={!canManageSettings}
                        placeholder="+32 4 000 00 00"
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label htmlFor="maxAgentFailures" className="block text-sm font-medium text-[#344453]">Tentatives avant transfert auto</label>
                      <input
                        type="number"
                        id="maxAgentFailures"
                        min={1}
                        max={10}
                        value={formData.settings.maxAgentFailures}
                        onChange={(e) => setSetting('maxAgentFailures', Number(e.target.value || 1))}
                        disabled={!canManageSettings}
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label htmlFor="transferMessage" className="block text-sm font-medium text-[#344453]">Message audio avant transfert</label>
                    <input
                      type="text"
                      id="transferMessage"
                      value={formData.settings.transferMessage}
                      onChange={(e) => setSetting('transferMessage', e.target.value)}
                      disabled={!canManageSettings}
                      placeholder="Je vous mets en relation avec la personne compétente. Un instant s'il vous plaît."
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-1.5 text-xs text-[#344453]/45">Prononcé juste avant de passer l'appel à un opérateur.</p>
                  </div>
                </div>

                {/* Options */}
                <div className="grid gap-3 lg:grid-cols-3">
                  <FieldRow
                    label="Agent vocal activé"
                    description="L'agent décroche et dialogue activement."
                    icon={Bot}
                    checked={formData.settings.agentEnabled}
                    onChange={(v) => setSetting('agentEnabled', v)}
                    disabled={!canManageSettings}
                  />
                  <FieldRow
                    label="Base de connaissances"
                    description="L'agent s'appuie sur vos infos métier."
                    icon={Database}
                    checked={formData.settings.knowledgeBaseEnabled}
                    onChange={(v) => setSetting('knowledgeBaseEnabled', v)}
                    disabled={!canManageSettings}
                  />
                  <FieldRow
                    label="Fallback messagerie"
                    description="Revient au répondeur si l'agent échoue."
                    icon={PhoneForwarded}
                    checked={formData.settings.fallbackToVoicemail}
                    onChange={(v) => setSetting('fallbackToVoicemail', v)}
                    disabled={!canManageSettings}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="submit"
                disabled={saving || !canManageSettings}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  saved ? 'bg-[#2D9D78] shadow-[0_4px_14px_rgba(45,157,120,0.25)]' : 'bg-[#C7601D] hover:bg-[#b35519]'
                }`}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Enregistré
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Base de connaissances ─────────────────────────────────────── */}
        {canManageKnowledgeBase && (
          <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Base de connaissances</h2>
                <p className="mt-0.5 text-sm text-[#344453]/55">Renseignez les informations que l'agent doit connaître avant de répondre ou d'escalader vers un humain.</p>
              </div>
            </div>

            <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">

              {/* Formulaire */}
              <form onSubmit={handleKnowledgeSubmit} className="space-y-4 rounded-[24px] border border-[#344453]/10 bg-[#344453]/3 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>
                  {editingKnowledgeId ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
                </p>

                {knowledgeMessage && (
                  <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                    knowledgeMessage.includes('succès')
                      ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                      : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
                  }`}>
                    {knowledgeMessage}
                  </div>
                )}

                <div>
                  <label htmlFor="knowledgeTitle" className="block text-sm font-medium text-[#344453]">Titre</label>
                  <input
                    type="text"
                    id="knowledgeTitle"
                    value={knowledgeForm.title}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                    placeholder="Horaires, tarifs, zones d'intervention…"
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label htmlFor="knowledgeCategory" className="block text-sm font-medium text-[#344453]">Catégorie</label>
                    <input
                      type="text"
                      id="knowledgeCategory"
                      value={knowledgeForm.category}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                      placeholder="FAQ, horaires, services…"
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                    />
                  </div>
                  <div>
                    <label htmlFor="knowledgePriority" className="block text-sm font-medium text-[#344453]">Priorité</label>
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
                  <label htmlFor="knowledgeContent" className="block text-sm font-medium text-[#344453]">Contenu métier</label>
                  <textarea
                    id="knowledgeContent"
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    rows={5}
                    placeholder="Exemple : Nous intervenons dans toute la province de Liège du lundi au vendredi de 8h à 18h."
                    className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                  />
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-[#344453]/12 bg-white px-4 py-3">
                  <span className="text-sm font-medium text-[#141F28]">Entrée active</span>
                  <Toggle
                    checked={knowledgeForm.enabled}
                    onChange={(v) => setKnowledgeForm({ ...knowledgeForm, enabled: v })}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    disabled={savingKnowledge}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#344453] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingKnowledgeId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {savingKnowledge ? 'Sauvegarde…' : editingKnowledgeId ? 'Mettre à jour' : "Ajouter l'entrée"}
                  </button>
                  {editingKnowledgeId && (
                    <button
                      type="button"
                      onClick={resetKnowledgeEditor}
                      className="rounded-full border border-[#344453]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>

              {/* Liste */}
              <div className="space-y-3">
                {knowledgeEntries.length === 0 ? (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#344453]/15 bg-[#344453]/3 px-6 py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                      <Database className="h-6 w-6" />
                    </div>
                    <p className="text-base font-medium text-[#141F28]">Aucune entrée pour l'instant</p>
                    <p className="mt-1.5 max-w-xs text-sm text-[#344453]/55">
                      Ajoutez ici les réponses et données d'entreprise sur lesquelles l'agent s'appuiera lors des appels.
                    </p>
                  </div>
                ) : (
                  knowledgeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-[24px] border p-4 transition sm:p-5 ${
                        editingKnowledgeId === entry.id
                          ? 'border-[#C7601D]/25 bg-[#C7601D]/4'
                          : 'border-[#344453]/8 bg-[#F8F9FB]'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#141F28]">{entry.title}</p>
                            {entry.category && (
                              <span className="inline-flex items-center rounded-full bg-[#344453]/8 px-2.5 py-0.5 text-xs font-medium text-[#344453]">
                                {entry.category}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              entry.enabled ? 'bg-[#2D9D78]/10 text-[#2D9D78]' : 'bg-[#344453]/8 text-[#344453]/50'
                            }`}>
                              {entry.enabled && <CheckCircle2 className="h-3 w-3" />}
                              {entry.enabled ? 'Actif' : 'Désactivé'}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#344453]/60">{entry.content}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#344453]/35" style={{ fontFamily: 'var(--font-mono)' }}>
                            <span>Priorité {entry.priority}</span>
                            {entry.updated_at && <span>{new Date(entry.updated_at).toLocaleString('fr-BE')}</span>}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleKnowledgeEntry(entry)}
                            className="rounded-full border border-[#344453]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#344453] transition hover:bg-[#344453]/5"
                          >
                            {entry.enabled ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditKnowledgeEntry(entry)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                            aria-label="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D94052]/20 bg-white text-[#D94052] transition hover:bg-[#D94052]/8"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
