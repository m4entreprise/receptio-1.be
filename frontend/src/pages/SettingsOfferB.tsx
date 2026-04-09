import { useEffect, useState } from 'react';
import { Bot, Building2, Database, Pencil, PhoneForwarded, Plus, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

interface OfferBSettings {
  offerMode: 'A' | 'B' | 'Bbis';
  agentEnabled: boolean;
  humanTransferNumber: string;
  fallbackToVoicemail: boolean;
  maxAgentFailures: number;
  greetingText: string;
  knowledgeBaseEnabled: boolean;
  appointmentIntegrationEnabled: boolean;
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
  offerMode: 'A',
  agentEnabled: false,
  humanTransferNumber: '',
  fallbackToVoicemail: true,
  maxAgentFailures: 2,
  greetingText: '',
  knowledgeBaseEnabled: false,
  appointmentIntegrationEnabled: false,
};

const emptyKnowledgeForm = {
  title: '',
  category: '',
  content: '',
  priority: 0,
  enabled: true,
};

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
      setMessage('Paramètres sauvegardés avec succès');
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
        setKnowledgeMessage('Entrée mise à jour avec succès');
      } else {
        await axios.post('/api/knowledge-base', knowledgeForm);
        setKnowledgeMessage('Entrée ajoutée avec succès');
      }

      setKnowledgeForm(emptyKnowledgeForm);
      setEditingKnowledgeId(null);
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error saving knowledge base entry:', error);
      setKnowledgeMessage('Erreur lors de la sauvegarde de l’entrée');
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
      setKnowledgeMessage('Entrée supprimée avec succès');
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error deleting knowledge base entry:', error);
      setKnowledgeMessage('Erreur lors de la suppression');
    }
  };

  const handleToggleKnowledgeEntry = async (entry: KnowledgeBaseEntry) => {
    try {
      await axios.patch(`/api/knowledge-base/${entry.id}`, {
        enabled: !entry.enabled,
      });
      await fetchKnowledgeBase();
    } catch (error) {
      console.error('Error toggling knowledge base entry:', error);
      setKnowledgeMessage('Erreur lors de la mise à jour du statut');
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
            <p className="text-sm font-medium text-[#6f685d]">Chargement des paramètres…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Espace configuration
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Préparez votre réceptionniste IA temps réel sans perdre la main métier.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Activez progressivement l'offre B, configurez le transfert humain et enrichissez la base de connaissances que l'agent utilisera pour répondre vite et proprement.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Compte</p>
            <div className="mt-5 space-y-4">
              {formData.settings.offerMode === 'Bbis' && (
                <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                  <p className="text-sm text-[#344453]/50">Réglages avancés Bbis</p>
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-sm text-[#141F28]">Modifie le prompt, la température et les modèles de l'agent IA dédié à l'Offre Bbis.</p>
                    <Link
                      to="/settings/agent-ia"
                      className="inline-flex items-center justify-center rounded-full bg-[#344453] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a3642]"
                    >
                      Ouvrir Paramètres de l'agent IA
                    </Link>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Email de référence</p>
                <p className="mt-1 break-all text-base font-semibold text-[#141F28]">{company?.email || 'Non renseigné'}</p>
              </div>

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Compte créé le</p>
                <p className="mt-1 text-base font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/25 bg-[#2D9D78]/8 px-4 py-2 text-sm text-[#2D9D78]">
                <ShieldCheck className="h-4 w-4" />
                paramètres synchronisés avec votre compte
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Entreprise & agent vocal</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Configurez le mode d'appel, le transfert humain et les garde-fous du réceptionniste IA.</p>
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
                  Numéro de téléphone Twilio
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

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="offerMode" className="block text-sm font-medium text-[#344453]">
                  Mode actif
                </label>
                <select
                  id="offerMode"
                  value={formData.settings.offerMode}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      offerMode: e.target.value as 'A' | 'B' | 'Bbis',
                    },
                  })}
                  className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                >
                  <option value="A">Offre A — Répondeur intelligent</option>
                  <option value="B">Offre B — Agent vocal IA</option>
                  <option value="Bbis">Offre Bbis — Agent vocal Deepgram</option>
                </select>
              </div>

              {formData.settings.offerMode !== 'A' && (
                <div>
                  <label htmlFor="humanTransferNumber" className="block text-sm font-medium text-[#344453]">
                    Numéro de transfert humain
                  </label>
                  <input
                    type="tel"
                    id="humanTransferNumber"
                    value={formData.settings.humanTransferNumber}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {
                        ...formData.settings,
                        humanTransferNumber: e.target.value,
                      },
                    })}
                    placeholder="+32 4 000 00 00"
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>
              )}
            </div>

            {formData.settings.offerMode === 'A' ? (
              <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#344453]/10 text-[#344453]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#141F28]">Message d'accueil répondeur</h3>
                    <p className="text-xs text-[#344453]/50">Offre A — lu par Twilio à chaque appel entrant</p>
                  </div>
                </div>
                <textarea
                  id="greetingText"
                  rows={3}
                  value={formData.settings.greetingText}
                  onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, greetingText: e.target.value } })}
                  placeholder={`Bonjour, vous êtes bien chez ${formData.name || 'votre entreprise'}. Merci de laisser votre message après le bip.`}
                  className="mt-4 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                />
                <p className="mt-2 text-xs text-[#344453]/45">Laissez vide pour utiliser le message par défaut.</p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label htmlFor="maxAgentFailures" className="block text-sm font-medium text-[#344453]">
                    Seuil de blocage avant transfert
                  </label>
                  <input
                    type="number"
                    id="maxAgentFailures"
                    min={1}
                    max={10}
                    value={formData.settings.maxAgentFailures}
                    onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, maxAgentFailures: Number(e.target.value || 1) } })}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="greetingText" className="block text-sm font-medium text-[#344453]">
                    Message d'accueil agent vocal
                  </label>
                  <input
                    type="text"
                    id="greetingText"
                    value={formData.settings.greetingText}
                    onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, greetingText: e.target.value } })}
                    placeholder="Bonjour, vous êtes bien chez ..."
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {formData.settings.offerMode !== 'A' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-0.5 h-5 w-5 text-[#344453]" />
                    <div className="min-w-0 flex-1">
                      <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#141F28]">
                        <span>Agent vocal activé</span>
                        <input type="checkbox" checked={formData.settings.agentEnabled} onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, agentEnabled: e.target.checked } })} className="h-4 w-4 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]" />
                      </label>
                      <p className="mt-2 text-sm leading-6 text-[#344453]/55">Permet d'utiliser le flux temps réel de l'offre B au lieu du simple répondeur.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Database className="mt-0.5 h-5 w-5 text-[#344453]" />
                    <div className="min-w-0 flex-1">
                      <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#141F28]">
                        <span>Base de connaissances activée</span>
                        <input type="checkbox" checked={formData.settings.knowledgeBaseEnabled} onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, knowledgeBaseEnabled: e.target.checked } })} className="h-4 w-4 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]" />
                      </label>
                      <p className="mt-2 text-sm leading-6 text-[#344453]/55">Quand elle est active, l'agent peut s'appuyer sur les informations ci-dessous pour répondre sans halluciner.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <PhoneForwarded className="mt-0.5 h-5 w-5 text-[#344453]" />
                    <div className="min-w-0 flex-1">
                      <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#141F28]">
                        <span>Fallback vers messagerie</span>
                        <input type="checkbox" checked={formData.settings.fallbackToVoicemail} onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, fallbackToVoicemail: e.target.checked } })} className="h-4 w-4 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]" />
                      </label>
                      <p className="mt-2 text-sm leading-6 text-[#344453]/55">Si l'agent temps réel échoue, l'appel pourra revenir au flux sûr de l'offre A.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-[#344453]" />
                    <div className="min-w-0 flex-1">
                      <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#141F28]">
                        <span>Réservation prévue plus tard</span>
                        <input type="checkbox" checked={formData.settings.appointmentIntegrationEnabled} onChange={(e) => setFormData({ ...formData, settings: { ...formData.settings, appointmentIntegrationEnabled: e.target.checked } })} className="h-4 w-4 rounded border-[#344453]/20 text-[#344453] focus:ring-[#344453]" />
                      </label>
                      <p className="mt-2 text-sm leading-6 text-[#344453]/55">Ce flag réserve le terrain pour les futures intégrations agenda sans activer encore la prise de rendez-vous.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#344453]/55">Les modifications sont enregistrées directement sur votre compte entreprise.</p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Base de connaissances</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Renseignez les informations que l'agent doit connaître avant de répondre ou d'escalader vers un humain.</p>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={handleKnowledgeSubmit} className="space-y-5 rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
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
                <label htmlFor="knowledgeTitle" className="block text-sm font-medium text-[#344453]">
                  Titre
                </label>
                <input
                  type="text"
                  id="knowledgeTitle"
                  value={knowledgeForm.title}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                  placeholder="Horaires, tarifs, zones d’intervention..."
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <div>
                  <label htmlFor="knowledgeCategory" className="block text-sm font-medium text-[#344453]">
                    Catégorie
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
                    Priorité
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
                  Contenu métier
                </label>
                <textarea
                  id="knowledgeContent"
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                  rows={6}
                  placeholder={`Exemple : Nous intervenons dans toute la province de Liège du lundi au vendredi de 8h à 18h.`}
                  className="mt-2 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm font-medium text-[#141F28]">
                <span>Entrée active</span>
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
                  {savingKnowledge ? 'Sauvegarde...' : editingKnowledgeId ? 'Mettre à jour' : 'Ajouter l’entrée'}
                </button>

                {editingKnowledgeId && (
                  <button
                    type="button"
                    onClick={resetKnowledgeEditor}
                    className="rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                  >
                    Annuler l’édition
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {knowledgeEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                  <p className="text-base font-medium text-[#141F28]">Aucune information métier pour l'instant</p>
                  <p className="mt-2 text-sm text-[#344453]/55">Ajoute ici les réponses et données d'entreprise sur lesquelles l'agent devra s'appuyer.</p>
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
                              {entry.enabled ? 'Actif' : 'Désactivé'}
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
                            {entry.enabled ? 'Désactiver' : 'Activer'}
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
                        <span>Priorité {entry.priority}</span>
                        {entry.updated_at && <span>Mis à jour le {new Date(entry.updated_at).toLocaleString('fr-BE')}</span>}
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
