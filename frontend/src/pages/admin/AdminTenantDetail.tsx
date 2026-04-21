import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Building2, Phone, Mail, Calendar,
  LogIn, Save, PhoneCall, PhoneIncoming, Clock, Users, Key,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  settings: Record<string, any>;
  created_at: string;
  user_count: number;
  total_calls: number;
  calls_last_30d: number;
  duration_last_30d: number;
}

interface License {
  id: string;
  company_id: string;
  license_key: string;
  active: boolean;
  activated_at: string;
  deactivated_at: string | null;
  notes: string | null;
}

const LICENSE_DEFS = [
  {
    key: 'offer_a',
    label: 'Offre A',
    description: 'Répondeur classique',
    color: 'bg-[#344453]/10 text-[#344453]/70',
  },
  {
    key: 'offer_b',
    label: 'Offre B',
    description: 'Répondeur IA (Mistral + Gladia)',
    color: 'bg-[#2D9D78]/12 text-[#2D9D78]',
  },
  {
    key: 'smart_routing',
    label: 'Routage intelligent',
    description: 'Distribution avancée des appels',
    color: 'bg-[#E6A817]/15 text-[#C78A10]',
  },
  {
    key: 'outbound_license',
    label: 'Appels sortants',
    description: 'Activation des appels sortants',
    color: 'bg-[#C7601D]/12 text-[#C7601D]',
  },
] as const;

export default function AdminTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useSuperAuth();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState({ name: '', phoneNumber: '', offer: 'A' as 'A' | 'B', suspended: false });

  const [licenses, setLicenses] = useState<License[]>([]);
  const [licToggles, setLicToggles] = useState<Record<string, boolean>>({});
  const [licDirty, setLicDirty] = useState(false);
  const [savingLic, setSavingLic] = useState(false);
  const [licSuccess, setLicSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [companiesRes, licensesRes] = await Promise.all([
        axios.get<Tenant[]>('/api/super/companies', authHeader),
        axios.get<License[]>(`/api/super/companies/${id}/licenses`, authHeader),
      ]);

      const found = companiesRes.data.find((c) => c.id === id);
      if (!found) { navigate('/admin/tenants'); return; }
      setTenant(found);
      setForm({
        name: found.name,
        phoneNumber: found.phone_number ?? '',
        offer: found.settings?.offer ?? 'A',
        suspended: found.settings?.suspended ?? false,
      });

      setLicenses(licensesRes.data);
      const toggles: Record<string, boolean> = {};
      for (const def of LICENSE_DEFS) {
        const existing = licensesRes.data.find((l) => l.license_key === def.key);
        toggles[def.key] = existing?.active ?? false;
      }
      setLicToggles(toggles);
      setLicDirty(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await axios.patch(`/api/super/companies/${id}`, form, authHeader);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLicenses = async () => {
    if (!id) return;
    setSavingLic(true);
    try {
      await axios.put(
        `/api/super/companies/${id}/licenses`,
        {
          licenses: LICENSE_DEFS.map((def) => ({
            license_key: def.key,
            active: licToggles[def.key] ?? false,
          })),
        },
        authHeader
      );
      setLicSuccess(true);
      setLicDirty(false);
      setTimeout(() => setLicSuccess(false), 2500);
      load();
    } finally {
      setSavingLic(false);
    }
  };

  const handleImpersonate = async () => {
    if (!id || !tenant) return;
    if (!confirm(`Ouvrir une session en tant que "${tenant.name}" ?`)) return;
    setImpersonating(true);
    try {
      const { data } = await axios.post(`/api/super/companies/${id}/impersonate`, {}, authHeader);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.open('/dashboard', '_blank');
    } finally {
      setImpersonating(false);
    }
  };

  if (loading || !tenant) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center text-sm text-[#344453]/40">Chargement…</div>
      </AdminLayout>
    );
  }

  const stats = [
    { icon: PhoneCall, label: 'Total appels', value: tenant.total_calls.toLocaleString() },
    { icon: PhoneIncoming, label: 'Appels 30j', value: tenant.calls_last_30d.toLocaleString() },
    { icon: Clock, label: 'Durée 30j', value: `${Math.floor(tenant.duration_last_30d / 60)}min` },
    { icon: Users, label: 'Utilisateurs', value: tenant.user_count },
  ];

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/tenants')}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[#344453]/60 hover:bg-[#344453]/8 hover:text-[#344453] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                {tenant.name}
              </h1>
              {tenant.settings?.suspended && (
                <span className="rounded-full bg-[#D94052]/12 px-2.5 py-0.5 text-xs font-medium text-[#D94052]">Suspendu</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#344453]/40 font-mono">{tenant.id}</p>
          </div>
          <button
            onClick={handleImpersonate}
            disabled={impersonating}
            className="flex items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b35519] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {impersonating ? 'Connexion…' : 'Impersonifier'}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-[#344453]/10 bg-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#344453]/8">
                  <Icon className="h-4 w-4 text-[#344453]/70" />
                </div>
                <span className="text-sm text-[#344453]/55">{label}</span>
              </div>
              <p className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Informations */}
          <div className="rounded-2xl border border-[#344453]/10 bg-white p-6">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Informations</h2>
            <dl className="space-y-4">
              {[
                { icon: Building2, label: 'Entreprise', value: tenant.name },
                { icon: Mail, label: 'Email', value: tenant.email },
                { icon: Phone, label: 'Numéro Twilio', value: tenant.phone_number ?? '—' },
                {
                  icon: Calendar,
                  label: 'Créé le',
                  value: format(new Date(tenant.created_at), "d MMMM yyyy 'à' HH'h'mm", { locale: fr }),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]/40" />
                  <div>
                    <p className="text-xs text-[#344453]/50">{label}</p>
                    <p className="text-sm font-medium text-[#141F28]">{value}</p>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Modifier */}
          <div className="rounded-2xl border border-[#344453]/10 bg-white p-6">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Modifier</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#344453] mb-1.5">Nom</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-2.5 text-sm focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453] mb-1.5">Numéro Twilio</label>
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  placeholder="+32..."
                  className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-2.5 text-sm focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453] mb-1.5">Offre (legacy)</label>
                <select
                  value={form.offer}
                  onChange={(e) => setForm({ ...form, offer: e.target.value as 'A' | 'B' })}
                  className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-2.5 text-sm focus:border-[#344453]/40 focus:outline-none"
                >
                  <option value="A">Offre A — Répondeur classique</option>
                  <option value="B">Offre B — Répondeur IA</option>
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#344453]/10 px-4 py-3">
                <input
                  type="checkbox"
                  id="suspended"
                  checked={form.suspended}
                  onChange={(e) => setForm({ ...form, suspended: e.target.checked })}
                  className="h-4 w-4 rounded border-[#344453]/20 accent-[#D94052]"
                />
                <label htmlFor="suspended" className="text-sm text-[#344453]">Compte suspendu</label>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#141F28] py-3 text-sm font-semibold text-white hover:bg-[#344453] transition disabled:opacity-60"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveSuccess ? 'Enregistré !' : saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>

        {/* Licences */}
        <div className="rounded-2xl border border-[#344453]/10 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[#344453]/50" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Licences actives</h2>
            </div>
            {licDirty && (
              <button
                onClick={handleSaveLicenses}
                disabled={savingLic}
                className="flex items-center gap-1.5 rounded-full bg-[#141F28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#344453] transition disabled:opacity-60"
              >
                {savingLic ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {licSuccess ? 'Enregistré !' : savingLic ? 'Enregistrement…' : 'Enregistrer les licences'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {LICENSE_DEFS.map((def) => {
              const isActive = licToggles[def.key] ?? false;
              const licData = licenses.find((l) => l.license_key === def.key);

              return (
                <div
                  key={def.key}
                  className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                    isActive
                      ? 'border-[#344453]/15 bg-[#F8F9FB]'
                      : 'border-[#344453]/8 bg-white opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${def.color}`}>
                      {def.label}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#141F28]">{def.description}</p>
                      {isActive && licData?.activated_at ? (
                        <p className="text-xs text-[#2D9D78] mt-0.5">
                          Activé le {format(new Date(licData.activated_at), 'd MMM yyyy', { locale: fr })}
                        </p>
                      ) : !isActive && licData?.deactivated_at ? (
                        <p className="text-xs text-[#D94052]/70 mt-0.5">
                          Désactivé le {format(new Date(licData.deactivated_at), 'd MMM yyyy', { locale: fr })}
                        </p>
                      ) : !isActive ? (
                        <p className="text-xs text-[#344453]/40 mt-0.5">Non activé</p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => {
                      setLicToggles((prev) => ({ ...prev, [def.key]: !prev[def.key] }));
                      setLicDirty(true);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      isActive ? 'bg-[#2D9D78]' : 'bg-[#344453]/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {!licDirty && (
            <p className="mt-4 text-xs text-[#344453]/40">
              Les licences sont proratisées au nombre de jours actifs lors de la facturation.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
