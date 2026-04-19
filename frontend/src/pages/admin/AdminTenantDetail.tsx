import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Building2, Phone, Mail, Calendar,
  LogIn, Save, PhoneCall, PhoneIncoming, Clock, Users,
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

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<Tenant[]>('/api/super/companies', authHeader);
      const found = data.find((c) => c.id === id);
      if (!found) { navigate('/admin/tenants'); return; }
      setTenant(found);
      setForm({
        name: found.name,
        phoneNumber: found.phone_number ?? '',
        offer: found.settings?.offer ?? 'A',
        suspended: found.settings?.suspended ?? false,
      });
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

  const handleImpersonate = async () => {
    if (!id || !tenant) return;
    if (!confirm(`Ouvrir une session en tant que "${tenant.name}" ?`)) return;
    setImpersonating(true);
    try {
      const { data } = await axios.post(`/api/super/companies/${id}/impersonate`, {}, authHeader);
      // Stocker le token d'impersonation et rediriger vers le dashboard tenant
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

        <div className="grid grid-cols-2 gap-6">
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
                <label className="block text-sm font-medium text-[#344453] mb-1.5">Offre</label>
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
      </div>
    </AdminLayout>
  );
}
