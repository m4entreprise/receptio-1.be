import { useEffect, useState } from 'react';
import { Building2, Save, ShieldCheck, Sparkles } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

interface Company {
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  created_at?: string | null;
}

export default function Settings() {
  const [company, setCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
  });
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
      });
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
      await axios.patch('/api/companies/me', formData);
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
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              <Sparkles className="h-3.5 w-3.5" />
              Espace configuration
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                Ajustez votre identité opérationnelle sans perdre en clarté.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Modifiez les informations de votre entreprise et le numéro associé aux appels entrants depuis une interface plus calme, plus lisible et pensée mobile first.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Compte</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Email de référence</p>
                <p className="mt-1 break-all text-base font-semibold text-[#171821]">{company?.email || 'Non renseigné'}</p>
              </div>

              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Compte créé le</p>
                <p className="mt-1 text-base font-semibold text-[#171821]">
                  {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                paramètres synchronisés avec votre compte
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white/80 shadow-sm">
          <div className="flex items-center gap-3 border-b border-black/5 px-4 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#171821]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Informations entreprise</h2>
              <p className="mt-1 text-sm text-[#6f685d]">Mettez à jour les informations utilisées pour relier vos appels entrants.</p>
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

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#171821]">
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition focus:border-black/20 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-[#171821]">
                  Numéro de téléphone Twilio
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+32 470 12 34 56"
                  className="mt-2 block w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                />
                <p className="mt-2 text-sm leading-6 text-[#6f685d]">
                  Ce numéro sert à associer les appels entrants Twilio à votre entreprise.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-[#f7f4ee] p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b8478]">Informations du compte</h3>
              <dl className="mt-4 space-y-3">
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-[#8b8478]">Email</dt>
                  <dd className="break-all font-medium text-[#171821]">{company?.email || 'Non renseigné'}</dd>
                </div>
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-[#8b8478]">Créé le</dt>
                  <dd className="font-medium text-[#171821]">
                    {company?.created_at ? new Date(company.created_at).toLocaleDateString('fr-BE') : 'Date indisponible'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#6f685d]">Les modifications sont enregistrées directement sur votre compte entreprise.</p>
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
