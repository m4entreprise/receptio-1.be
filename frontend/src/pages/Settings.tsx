import { useEffect, useState } from 'react';
import { Brain, Building2, Save, ShieldCheck, Sparkles, MessageSquare, Tag, ClipboardCheck, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';

interface Company {
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  created_at?: string | null;
  settings?: {
    offerMode?: string;
    twilioGreetingText?: string;
  } | null;
}

export default function Settings() {
  const [company, setCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    twilioGreetingText: '',
  });
  const [offerMode, setOfferMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await axios.get('/api/companies/me');
      const companyData: Company = response.data.company;
      setCompany(companyData);
      setFormData({
        name: companyData.name || '',
        phoneNumber: companyData.phone_number || '',
        twilioGreetingText: companyData.settings?.twilioGreetingText || '',
      });
      setOfferMode(companyData.settings?.offerMode || null);
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload: any = {
        name: formData.name,
        phoneNumber: formData.phoneNumber,
      };
      if (offerMode === 'A') {
        payload.settings = { twilioGreetingText: formData.twilioGreetingText || undefined };
      }
      await axios.patch('/api/companies/me', payload);
      setMessage('Paramètres sauvegardés avec succès');
      fetchCompany();
    } catch (error) {
      setMessage('Erreur lors de la sauvegarde');
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
            <p className="text-sm font-medium text-[#344453]/50">Chargement des paramètres…</p>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
              <Sparkles className="h-3.5 w-3.5" />
              Espace configuration
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: "var(--font-title)" }}>
                Ajustez votre identité opérationnelle sans perdre en clarté.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Modifiez les informations de votre entreprise et le numéro associé aux appels entrants depuis une interface plus calme, plus lisible et pensée mobile first.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Compte</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Email de référence</p>
                <p className="mt-1 break-all text-base font-semibold text-[#141F28]">{company?.email || 'Non renseigné'}</p>
              </div>

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Compte créé le</p>
                <p className="mt-1 text-base font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>
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
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Informations entreprise</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Mettez à jour les informations utilisées pour relier vos appels entrants.</p>
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
                <p className="mt-2 text-sm leading-6 text-[#344453]/55">
                  Ce numéro sert à associer les appels entrants Twilio à votre entreprise.
                </p>
              </div>
            </div>

            {offerMode === 'A' && (
              <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#344453]/10 text-[#344453]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#141F28]">Message d'accueil répondeur</h3>
                    <p className="text-xs text-[#344453]/50">Offre A — lu par Twilio quand un appel arrive</p>
                  </div>
                </div>
                <textarea
                  id="twilioGreetingText"
                  rows={4}
                  value={formData.twilioGreetingText}
                  onChange={(e) => setFormData({ ...formData, twilioGreetingText: e.target.value })}
                  placeholder={`Bonjour, vous êtes bien chez ${formData.name || 'votre entreprise'}. Merci de laisser votre message après le bip.`}
                  className="mt-4 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-white px-4 py-3 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25"
                />
                <p className="mt-2 text-xs text-[#344453]/45">Laissez vide pour utiliser le message par défaut.</p>
              </div>
            )}

            <div className="rounded-[24px] border border-[#344453]/10 bg-[#344453]/4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Informations du compte</h3>
              <dl className="mt-4 space-y-3">
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-[#344453]/50">Email</dt>
                  <dd className="break-all font-medium text-[#141F28]">{company?.email || 'Non renseigné'}</dd>
                </div>
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-[#344453]/50">Créé le</dt>
                  <dd className="font-medium text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>
                    {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                  </dd>
                </div>
              </dl>
            </div>

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

        {/* Modules de configuration avancée */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                Modules avancés
              </h2>
              <p className="mt-1 text-sm text-[#344453]/55">
                Configuration de la qualification IA et de l'analyse qualité.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[#344453]/8">
            <Link
              to="/settings/ai-models"
              className="flex items-center gap-4 px-4 py-4 sm:px-6 hover:bg-[#344453]/4 transition group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C7601D]/8 text-[#C7601D] group-hover:bg-[#C7601D]/15 transition">
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#141F28]">Gestion des modèles IA</p>
                <p className="text-xs text-[#344453]/55 mt-0.5">
                  Choisissez les modèles Mistral et Gladia pour chaque usage : agent temps réel, transcription, résumés et qualification.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#344453]/30 group-hover:text-[#344453]/60 transition" />
            </Link>

            <Link
              to="/settings/intents"
              className="flex items-center gap-4 px-4 py-4 sm:px-6 hover:bg-[#344453]/4 transition group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453] group-hover:bg-[#344453]/15 transition">
                <Tag className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#141F28]">Intents de qualification</p>
                <p className="text-xs text-[#344453]/55 mt-0.5">
                  Définissez les catégories dans lesquelles l'IA classe automatiquement chaque appel.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#344453]/30 group-hover:text-[#344453]/60 transition" />
            </Link>

            <Link
              to="/settings/qa"
              className="flex items-center gap-4 px-4 py-4 sm:px-6 hover:bg-[#344453]/4 transition group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453] group-hover:bg-[#344453]/15 transition">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#141F28]">Qualité IA (QA)</p>
                <p className="text-xs text-[#344453]/55 mt-0.5">
                  Créez des grilles d'évaluation et analysez la qualité de vos appels avec Mistral.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#344453]/30 group-hover:text-[#344453]/60 transition" />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
