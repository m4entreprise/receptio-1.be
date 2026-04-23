import { useEffect, useRef, useState } from 'react';
import {
  Bot, Brain, Building2, Check, CheckCircle2, Database, ExternalLink,
  Pencil, PhoneForwarded, Plus, Save, Settings2, ShieldCheck, Sparkles,
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

const DEFAULT_SETTINGS: OfferBSettings = {
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

const EMPTY_KB = { title: '', category: '', content: '', priority: 0, enabled: true };

const MODULES = [
  { to: '/settings/ai-models', icon: Brain, label: 'Modèles IA', description: 'STT, LLM, TTS', color: '#C7601D', permission: 'settingsManage' },
  { to: '/settings/agent-ia', icon: Bot, label: "Comportement agent", description: 'Prompt, tokens, timing', color: '#344453', permission: 'settingsManage' },
  { to: '/settings/intents', icon: Zap, label: 'Intents', description: "Catégories d'appel", color: '#2D9D78', permission: 'intentsManage' },
  { to: '/settings/qa', icon: Target, label: 'Contrôle qualité', description: "Grilles QA", color: '#7B61FF', permission: 'qaManage' },
  { to: '/settings/team-access', icon: ShieldCheck, label: 'Équipe & accès', description: 'Membres, rôles, audit', color: '#141F28', permission: 'memberManage' },
] as const;

type Tab = 'general' | 'voice' | 'knowledge';

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-[#344453]' : 'bg-[#344453]/15'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function ToggleRow({ label, description, icon: Icon, checked, onChange, disabled }: {
  label: string; description: string; icon: React.ElementType;
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#344453]/10 bg-[#344453]/3 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#344453]/8 text-[#344453]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#141F28]">{label}</p>
          <p className="text-xs text-[#344453]/50">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function SaveButton({ saving, saved, disabled }: { saving: boolean; saved: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
        saved
          ? 'bg-[#2D9D78] shadow-[0_4px_14px_rgba(45,157,120,0.25)]'
          : 'bg-[#C7601D] shadow-[0_4px_14px_rgba(199,96,29,0.28)] hover:bg-[#b35519]'
      }`}
    >
      {saved ? <><Check className="h-4 w-4" />Enregistré</> : <><Save className="h-4 w-4" />{saving ? 'Sauvegarde…' : 'Sauvegarder'}</>}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsOfferB() {
  const { user } = useAuth();
  const canManageSettings = user?.permissions?.settingsManage ?? true;
  const canManageKB = user?.permissions?.knowledgeBaseManage ?? true;

  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', phoneNumber: '', settings: DEFAULT_SETTINGS });
  const [kbEntries, setKbEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [kbForm, setKbForm] = useState(EMPTY_KB);
  const [editingKbId, setEditingKbId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingKb, setSavingKb] = useState(false);
  const [kbMsg, setKbMsg] = useState('');
  const [tab, setTab] = useState<Tab>('general');

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleModules = MODULES.filter((m) =>
    user?.permissions?.[m.permission as keyof NonNullable<typeof user>['permissions']] ?? true
  );

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchCompany(), canManageKB ? fetchKb() : Promise.resolve()]);
      } finally {
        setLoading(false);
      }
    };
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageKB]);

  const fetchCompany = async () => {
    const { data } = await axios.get('/api/companies/me');
    const c: Company = data.company;
    setCompany(c);
    setForm({ name: c.name || '', phoneNumber: c.phone_number || '', settings: { ...DEFAULT_SETTINGS, ...(c.settings || {}) } });
  };

  const fetchKb = async () => {
    const { data } = await axios.get('/api/knowledge-base');
    setKbEntries(data.entries || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setSaveError('');
    try {
      await axios.patch('/api/companies/me', { name: form.name, phoneNumber: form.phoneNumber, settings: form.settings });
      await fetchCompany();
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch { setSaveError('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  const handleKbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKb(true); setKbMsg('');
    try {
      if (editingKbId) {
        await axios.patch(`/api/knowledge-base/${editingKbId}`, kbForm);
        setKbMsg('Entrée mise à jour');
      } else {
        await axios.post('/api/knowledge-base', kbForm);
        setKbMsg('Entrée ajoutée');
      }
      setKbForm(EMPTY_KB); setEditingKbId(null);
      await fetchKb();
    } catch { setKbMsg("Erreur lors de la sauvegarde"); }
    finally { setSavingKb(false); }
  };

  const setSetting = <K extends keyof OfferBSettings>(key: K, value: OfferBSettings[K]) =>
    setForm((f) => ({ ...f, settings: { ...f.settings, [key]: value } }));

  const editKb = (e: KnowledgeBaseEntry) => {
    setEditingKbId(e.id);
    setKbForm({ title: e.title, category: e.category || '', content: e.content, priority: e.priority, enabled: e.enabled });
    setKbMsg('');
  };

  const deleteKb = async (id: string) => {
    try {
      await axios.delete(`/api/knowledge-base/${id}`);
      if (editingKbId === id) { setEditingKbId(null); setKbForm(EMPTY_KB); }
      await fetchKb();
    } catch { setKbMsg('Erreur lors de la suppression'); }
  };

  const toggleKb = async (entry: KnowledgeBaseEntry) => {
    try { await axios.patch(`/api/knowledge-base/${entry.id}`, { enabled: !entry.enabled }); await fetchKb(); }
    catch { setKbMsg('Erreur'); }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm text-[#344453]/50">Chargement…</p>
          </div>
        </div>
      </Layout>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType; visible: boolean }[] = [
    { id: 'general', label: 'Général', icon: Building2, visible: true },
    { id: 'voice', label: 'Répondeur vocal', icon: Bot, visible: true },
    { id: 'knowledge', label: 'Base de connaissances', icon: Database, visible: canManageKB },
  ];

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">

        {/* ── En-tête ───────────────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-6 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Espace configuration
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Configurez votre réceptionniste IA.
              </h1>
              <p className="max-w-lg text-sm leading-7 text-white/55">
                Mode de réponse, modèles IA, transfert humain et base de connaissances métier — tout en un.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Compte actif</p>
              <p className="mt-3 break-all text-base font-semibold text-[#141F28]">{company?.email || '—'}</p>
              <p className="mt-1 text-sm text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>
                {company?.created_at ? `Créé le ${new Date(company.created_at).toLocaleDateString('fr-BE')}` : ''}
              </p>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 self-start rounded-full border border-[#2D9D78]/25 bg-[#2D9D78]/8 px-3.5 py-2 text-xs font-medium text-[#2D9D78]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Paramètres synchronisés
            </div>
          </div>
        </section>

        {/* ── Raccourcis modules ─────────────────────────────────────────── */}
        {visibleModules.length > 0 && (
          <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#344453]/8 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Settings2 className="h-4.5 w-4.5 text-[#344453]/50" />
                <span className="text-sm font-semibold text-[#141F28]">Modules avancés</span>
              </div>
              <span className="text-xs text-[#344453]/40">{visibleModules.length} disponibles</span>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {visibleModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.to}
                    to={mod.to}
                    className="group inline-flex items-center gap-2.5 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-2.5 transition hover:border-[#344453]/20 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: `${mod.color}14`, color: mod.color }}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#141F28]">{mod.label}</p>
                      <p className="text-xs text-[#344453]/45">{mod.description}</p>
                    </div>
                    <ExternalLink className="ml-1 h-3 w-3 text-[#344453]/20 transition group-hover:text-[#344453]/50" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Paramètres avec onglets ────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">

          {/* Barre d'onglets */}
          <div className="flex items-center gap-1 border-b border-[#344453]/8 px-4 pt-4 sm:px-6">
            {TABS.filter((t) => t.visible).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-[#F8F9FB] text-[#141F28] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[#344453]'
                      : 'text-[#344453]/55 hover:text-[#344453]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {t.id === 'knowledge' && kbEntries.length > 0 && (
                    <span className="ml-1 rounded-full bg-[#344453]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#344453]">
                      {kbEntries.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Onglet Général ── */}
          {tab === 'general' && (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
              {saveError && (
                <div className="mb-5 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
                  {saveError}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Identité de l'entreprise
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Nom de l'entreprise</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        disabled={!canManageSettings}
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Numéro Twilio</label>
                      <input
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        placeholder="+32 470 12 34 56"
                        disabled={!canManageSettings}
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <p className="mt-1.5 text-xs text-[#344453]/45">Associe les appels entrants Twilio à votre entreprise.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#344453]/8 pt-5">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Mode de réponse
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { value: false, icon: Bot, label: 'Répondeur classique', desc: "Messagerie vocale + routage intelligent optionnel." },
                      { value: true, icon: Sparkles, label: 'Répondeur IA', desc: "Agent IA temps réel, dialogue, transfert humain." },
                    ].map(({ value, icon: Icon, label, desc }) => {
                      const active = form.settings.voicePipelineEnabled === value;
                      return (
                        <button
                          key={String(value)}
                          type="button"
                          disabled={!canManageSettings}
                          onClick={() => setSetting('voicePipelineEnabled', value)}
                          className={`flex items-start gap-4 rounded-[20px] border-2 p-4 text-left transition disabled:cursor-not-allowed ${
                            active
                              ? 'border-[#344453] bg-[#344453]/4 shadow-sm'
                              : 'border-[#344453]/10 bg-[#F8F9FB] hover:border-[#344453]/20 hover:bg-white'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#344453] text-white' : 'bg-[#344453]/8 text-[#344453]'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${active ? 'text-[#141F28]' : 'text-[#344453]/70'}`}>{label}</p>
                            <p className="mt-0.5 text-xs leading-5 text-[#344453]/50">{desc}</p>
                          </div>
                          {active && <Check className="h-4 w-4 shrink-0 text-[#344453]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <SaveButton saving={saving} saved={saved} disabled={!canManageSettings} />
              </div>
            </form>
          )}

          {/* ── Onglet Répondeur ── */}
          {tab === 'voice' && (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
              {saveError && (
                <div className="mb-5 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
                  {saveError}
                </div>
              )}

              {!form.settings.voicePipelineEnabled ? (
                /* ── Répondeur classique ── */
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Messagerie vocale</h3>
                    <label className="block text-sm font-medium text-[#344453]">Message d'accueil</label>
                    <textarea
                      rows={4}
                      value={form.settings.greetingText}
                      onChange={(e) => setSetting('greetingText', e.target.value)}
                      disabled={!canManageSettings}
                      placeholder={`Bonjour, vous êtes bien chez ${form.name || 'votre entreprise'}. Merci de laisser votre message après le bip.`}
                      className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-1.5 text-xs text-[#344453]/45">Lu par Twilio à chaque appel. Laissez vide pour le message par défaut.</p>
                  </div>

                  <div className="border-t border-[#344453]/8 pt-5">
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Routage intelligent</h3>
                    <ToggleRow
                      label="Activer le routage intelligent"
                      description="L'appelant dit son motif ; vous le transférez depuis le dashboard."
                      icon={PhoneForwarded}
                      checked={form.settings.smartRoutingEnabled}
                      onChange={(v) => setSetting('smartRoutingEnabled', v)}
                      disabled={!canManageSettings}
                    />
                    {form.settings.smartRoutingEnabled && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-[#344453]">Question posée à l'appelant</label>
                        <input
                          type="text"
                          value={form.settings.routingQuestion}
                          onChange={(e) => setSetting('routingQuestion', e.target.value)}
                          disabled={!canManageSettings}
                          placeholder="Quel est le motif de votre appel ?"
                          className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Répondeur IA ── */
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Agent vocal</h3>
                    <label className="block text-sm font-medium text-[#344453]">Message d'accueil de l'agent</label>
                    <input
                      type="text"
                      value={form.settings.greetingText}
                      onChange={(e) => setSetting('greetingText', e.target.value)}
                      disabled={!canManageSettings}
                      placeholder={`Bonjour, vous êtes bien chez ${form.name || 'votre entreprise'}. Comment puis-je vous aider ?`}
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-1.5 text-xs text-[#344453]/45">Première phrase prononcée par l'agent à chaque appel.</p>
                  </div>

                  <div className="border-t border-[#344453]/8 pt-5">
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Transfert humain</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-[#344453]">Numéro de transfert</label>
                        <input
                          type="tel"
                          value={form.settings.humanTransferNumber}
                          onChange={(e) => setSetting('humanTransferNumber', e.target.value)}
                          disabled={!canManageSettings}
                          placeholder="+32 4 000 00 00"
                          className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#344453]">Tentatives avant transfert auto</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={form.settings.maxAgentFailures}
                          onChange={(e) => setSetting('maxAgentFailures', Number(e.target.value || 1))}
                          disabled={!canManageSettings}
                          className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-[#344453]">Message audio avant transfert</label>
                      <input
                        type="text"
                        value={form.settings.transferMessage}
                        onChange={(e) => setSetting('transferMessage', e.target.value)}
                        disabled={!canManageSettings}
                        placeholder="Je vous mets en relation avec la personne compétente. Un instant s'il vous plaît."
                        className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <p className="mt-1.5 text-xs text-[#344453]/45">Prononcé juste avant de passer l'appel à un opérateur.</p>
                    </div>
                  </div>

                  <div className="border-t border-[#344453]/8 pt-5">
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Options</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ToggleRow
                        label="Agent vocal activé"
                        description="L'agent décroche et dialogue."
                        icon={Bot}
                        checked={form.settings.agentEnabled}
                        onChange={(v) => setSetting('agentEnabled', v)}
                        disabled={!canManageSettings}
                      />
                      <ToggleRow
                        label="Base de connaissances"
                        description="L'agent utilise vos infos métier."
                        icon={Database}
                        checked={form.settings.knowledgeBaseEnabled}
                        onChange={(v) => setSetting('knowledgeBaseEnabled', v)}
                        disabled={!canManageSettings}
                      />
                      <ToggleRow
                        label="Fallback messagerie"
                        description="Revient au répondeur si l'agent échoue."
                        icon={PhoneForwarded}
                        checked={form.settings.fallbackToVoicemail}
                        onChange={(v) => setSetting('fallbackToVoicemail', v)}
                        disabled={!canManageSettings}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-[#344453]/8 pt-5">
                <p className="text-xs text-[#344453]/40">
                  Mode actif : <span className="font-semibold text-[#344453]">{form.settings.voicePipelineEnabled ? 'Répondeur IA' : 'Répondeur classique'}</span>
                  {' '}— changeable dans l'onglet <button type="button" onClick={() => setTab('general')} className="underline hover:text-[#344453]">Général</button>.
                </p>
                <SaveButton saving={saving} saved={saved} disabled={!canManageSettings} />
              </div>
            </form>
          )}

          {/* ── Onglet Base de connaissances ── */}
          {tab === 'knowledge' && canManageKB && (
            <div className="p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

                {/* Formulaire */}
                <div className="rounded-[20px] border border-[#344453]/10 bg-[#344453]/3 p-4">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    {editingKbId ? 'Modifier l\'entrée' : 'Ajouter une entrée'}
                  </p>

                  {kbMsg && (
                    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      kbMsg.includes('Erreur')
                        ? 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
                        : 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                    }`}>{kbMsg}</div>
                  )}

                  <form onSubmit={handleKbSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Titre</label>
                      <input
                        type="text"
                        value={kbForm.title}
                        onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                        placeholder="Horaires, tarifs, zones d'intervention…"
                        className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-2.5 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_100px] gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#344453]">Catégorie</label>
                        <input
                          type="text"
                          value={kbForm.category}
                          onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })}
                          placeholder="FAQ, horaires…"
                          className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-2.5 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#344453]">Priorité</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={kbForm.priority}
                          onChange={(e) => setKbForm({ ...kbForm, priority: Number(e.target.value || 0) })}
                          className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-white px-4 py-2.5 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Contenu</label>
                      <textarea
                        rows={5}
                        value={kbForm.content}
                        onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })}
                        placeholder="Nous intervenons dans toute la province de Liège du lundi au vendredi de 8h à 18h."
                        className="mt-1.5 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-2.5 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[#344453]/12 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-[#141F28]">Entrée active</span>
                      <Toggle checked={kbForm.enabled} onChange={(v) => setKbForm({ ...kbForm, enabled: v })} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingKb}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#344453] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a3642] disabled:opacity-50"
                      >
                        {editingKbId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {savingKb ? 'Sauvegarde…' : editingKbId ? 'Mettre à jour' : 'Ajouter'}
                      </button>
                      {editingKbId && (
                        <button
                          type="button"
                          onClick={() => { setEditingKbId(null); setKbForm(EMPTY_KB); setKbMsg(''); }}
                          className="rounded-full border border-[#344453]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Liste */}
                <div className="min-w-0">
                  {kbEntries.length === 0 ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#344453]/15 bg-[#344453]/3 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                        <Database className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-[#141F28]">Aucune entrée</p>
                      <p className="mt-1 max-w-xs text-sm text-[#344453]/50">Ajoutez des informations métier pour que l'agent sache y répondre lors des appels.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {kbEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-[20px] border p-4 transition ${editingKbId === entry.id ? 'border-[#C7601D]/30 bg-[#C7601D]/4' : 'border-[#344453]/8 bg-[#F8F9FB] hover:bg-white hover:shadow-sm'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[#141F28]">{entry.title}</span>
                                {entry.category && (
                                  <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-xs text-[#344453]">{entry.category}</span>
                                )}
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${entry.enabled ? 'bg-[#2D9D78]/10 text-[#2D9D78]' : 'bg-[#344453]/8 text-[#344453]/40'}`}>
                                  {entry.enabled && <CheckCircle2 className="h-3 w-3" />}
                                  {entry.enabled ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[#344453]/55">{entry.content}</p>
                              <p className="mt-1 text-xs text-[#344453]/30" style={{ fontFamily: 'var(--font-mono)' }}>
                                Priorité {entry.priority}
                                {entry.updated_at && <> · {new Date(entry.updated_at).toLocaleDateString('fr-BE')}</>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                onClick={() => toggleKb(entry)}
                                className="rounded-full border border-[#344453]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#344453] transition hover:bg-[#344453]/5"
                              >
                                {entry.enabled ? 'Désactiver' : 'Activer'}
                              </button>
                              <button
                                onClick={() => editKb(entry)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                                aria-label="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteKb(entry.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D94052]/20 bg-white text-[#D94052] transition hover:bg-[#D94052]/8"
                                aria-label="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
