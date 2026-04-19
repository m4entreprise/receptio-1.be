import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tag, Check, Edit2, X } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

interface Rate {
  id: string;
  key: string;
  label: string;
  rate_cents: number;
  rate_type: 'monthly' | 'per_minute';
  updated_at: string;
}

function centsToEur(cents: number) {
  return (cents / 100).toFixed(2);
}

function RateRow({ rate, token, onUpdated }: { rate: Rate; token: string; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(centsToEur(rate.rate_cents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const euros = parseFloat(value.replace(',', '.'));
    if (isNaN(euros) || euros < 0) { setError('Valeur invalide'); return; }
    const cents = Math.round(euros * 100);
    setSaving(true);
    setError('');
    try {
      await axios.patch(
        `/api/super/billing/rates/${rate.key}`,
        { rate_cents: cents },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdated();
      setEditing(false);
    } catch {
      setError('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(centsToEur(rate.rate_cents));
    setError('');
    setEditing(false);
  };

  return (
    <tr className="hover:bg-[#F8F9FB] transition-colors">
      <td className="px-6 py-4">
        <p className="font-medium text-[#141F28]">{rate.label}</p>
        <p className="text-xs font-mono text-[#344453]/40 mt-0.5">{rate.key}</p>
      </td>
      <td className="px-6 py-4 text-center">
        {rate.rate_type === 'monthly' ? (
          <span className="rounded-full bg-[#344453]/10 px-2.5 py-0.5 text-xs font-medium text-[#344453]/70">
            Mensuel
          </span>
        ) : (
          <span className="rounded-full bg-[#C7601D]/12 px-2.5 py-0.5 text-xs font-medium text-[#C7601D]">
            Par minute
          </span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24 rounded-lg border border-[#344453]/20 px-3 py-1.5 text-right text-sm focus:border-[#344453]/40 focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
              />
              <span className="text-sm text-[#344453]/50">€</span>
            </div>
            {error && <span className="text-xs text-[#D94052]">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2D9D78]/12 text-[#2D9D78] hover:bg-[#2D9D78]/20 transition disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#344453]/8 text-[#344453]/60 hover:bg-[#344453]/15 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <span className="font-mono font-semibold text-[#141F28]">
              {centsToEur(rate.rate_cents)} €
              <span className="ml-1 text-xs font-normal text-[#344453]/40">
                {rate.rate_type === 'monthly' ? '/mois' : '/min'}
              </span>
            </span>
            <button
              onClick={() => { setValue(centsToEur(rate.rate_cents)); setEditing(true); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-right text-xs text-[#344453]/40">
        {format(new Date(rate.updated_at), 'd MMM yyyy', { locale: fr })}
      </td>
    </tr>
  );
}

export default function AdminPricing() {
  const { token } = useSuperAuth();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await axios.get<Rate[]>('/api/super/billing/rates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRates(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const monthly = rates.filter((r) => r.rate_type === 'monthly');
  const perMin = rates.filter((r) => r.rate_type === 'per_minute');

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C7601D]/12">
            <Tag className="h-5 w-5 text-[#C7601D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Grille tarifaire
            </h1>
            <p className="mt-0.5 text-sm text-[#344453]/55">
              Tarifs appliqués à la facturation — cliquez sur le montant pour modifier
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-[#344453]/40">Chargement…</div>
        ) : (
          <div className="space-y-6">
            {/* Licences mensuelles */}
            <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
              <div className="border-b border-[#344453]/8 bg-[#F8F9FB] px-6 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50">
                  Licences — Abonnements mensuels
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-[#344453]/6">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Licence</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Tarif</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Modifié le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#344453]/6">
                  {monthly.map((rate) => (
                    <RateRow key={rate.key} rate={rate} token={token!} onUpdated={load} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarifs à la minute */}
            <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
              <div className="border-b border-[#344453]/8 bg-[#F8F9FB] px-6 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50">
                  Appels — Tarifs à la minute
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-[#344453]/6">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Type d'appel</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Tarif</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/40">Modifié le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#344453]/6">
                  {perMin.map((rate) => (
                    <RateRow key={rate.key} rate={rate} token={token!} onUpdated={load} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[#344453]/10 bg-[#F8F9FB] px-5 py-4 text-xs text-[#344453]/55">
              <strong className="font-medium text-[#344453]/80">Note :</strong> Les frais de licences sont proratisés au nombre de jours actifs sur la période de facturation (base 30 jours/mois). Les appels sont facturés à la minute entamée.
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
