import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, Plus, Search, ChevronRight, Phone, MoreVertical, Trash2 } from 'lucide-react';
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

function OfferBadge({ offer }: { offer?: string }) {
  return offer === 'B' ? (
    <span className="inline-flex items-center rounded-full bg-[#2D9D78]/12 px-2.5 py-0.5 text-xs font-medium text-[#2D9D78]">
      Offre B — IA
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#344453]/10 px-2.5 py-0.5 text-xs font-medium text-[#344453]/70">
      Offre A — Classique
    </span>
  );
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const { token } = useSuperAuth();
  const navigate = useNavigate();

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/super/companies', authHeader);
      setTenants(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement "${name}" et toutes ses données ?`)) return;
    await axios.delete(`/api/super/companies/${id}`, authHeader);
    setMenuOpen(null);
    load();
  };

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Tenants</h1>
            <p className="mt-1 text-sm text-[#344453]/55">{tenants.length} entreprises enregistrées</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-full bg-[#141F28] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#344453]"
          >
            <Plus className="h-4 w-4" />
            Nouveau tenant
          </button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#344453]/35" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="w-full max-w-sm rounded-xl border border-[#344453]/12 bg-white py-2.5 pl-11 pr-4 text-sm placeholder-[#344453]/30 focus:border-[#344453]/30 focus:outline-none focus:ring-2 focus:ring-[#344453]/8"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-[#344453]/8 bg-[#F8F9FB]">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Entreprise</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Offre</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Appels 30j</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Durée 30j</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Créé le</th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#344453]/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-[#344453]/40">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-[#344453]/40">Aucun résultat</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="group cursor-pointer transition-colors hover:bg-[#F8F9FB]"
                    onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#344453]/8">
                          <Building2 className="h-4 w-4 text-[#344453]/60" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 font-medium text-[#141F28]">
                            {t.name}
                            {t.settings?.suspended && (
                              <span className="rounded-full bg-[#D94052]/12 px-2 py-0.5 text-xs font-medium text-[#D94052]">Suspendu</span>
                            )}
                          </div>
                          <div className="text-xs text-[#344453]/50">{t.email}</div>
                          {t.phone_number && (
                            <div className="flex items-center gap-1 text-xs text-[#344453]/40 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {t.phone_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><OfferBadge offer={t.settings?.offer} /></td>
                    <td className="px-6 py-4 text-right font-mono text-[#141F28]">{t.calls_last_30d.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#344453]/70">{Math.floor(t.duration_last_30d / 60)}min</td>
                    <td className="px-6 py-4 text-[#344453]/55">
                      {format(new Date(t.created_at), 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="relative flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/tenants/${t.id}`)}
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[#344453]/60 transition hover:bg-[#344453]/8 hover:text-[#344453]"
                        >
                          Voir <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                          className="rounded-lg p-1.5 text-[#344453]/40 transition hover:bg-[#344453]/8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuOpen === t.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-xl border border-[#344453]/10 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => handleDelete(t.id, t.name)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#D94052] hover:bg-[#D94052]/6"
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateTenantModal token={token!} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </AdminLayout>
  );
}

function CreateTenantModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phoneNumber: '', offer: 'A' as 'A' | 'B' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/super/companies', form, { headers: { Authorization: `Bearer ${token}` } });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="mb-6 text-lg font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
          Nouveau tenant
        </h2>
        {error && (
          <div className="mb-4 rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {(['name', 'email', 'phoneNumber'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-[#344453] mb-1.5">
                {field === 'name' ? "Nom de l'entreprise" : field === 'email' ? 'Email' : 'Numéro Twilio (optionnel)'}
              </label>
              <input
                type={field === 'email' ? 'email' : 'text'}
                required={field !== 'phoneNumber'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={field === 'phoneNumber' ? '+32...' : undefined}
                className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-3 text-sm focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-[#344453] mb-1.5">Offre</label>
            <select
              value={form.offer}
              onChange={(e) => setForm({ ...form, offer: e.target.value as 'A' | 'B' })}
              className="w-full rounded-xl border border-[#344453]/15 bg-[#F8F9FB] px-4 py-3 text-sm focus:border-[#344453]/40 focus:outline-none"
            >
              <option value="A">Offre A — Répondeur classique</option>
              <option value="B">Offre B — Répondeur IA</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] hover:bg-[#344453]/6 transition">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-full bg-[#141F28] py-3 text-sm font-semibold text-white hover:bg-[#344453] transition disabled:opacity-60">
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
