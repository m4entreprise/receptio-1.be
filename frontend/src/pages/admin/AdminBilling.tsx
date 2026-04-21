import { useEffect, useState } from 'react';
import axios from 'axios';
import { format, subDays, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Download, PhoneIncoming, PhoneOutgoing,
  PhoneOff, ChevronDown, ChevronRight, Receipt, Tag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

interface LicenseEntry {
  key: string;
  label: string;
  active: boolean;
  activated_at: string;
  deactivated_at: string | null;
  days_active: number;
  monthly_rate_cents: number;
  fee_cents: number;
}

interface BillingRow {
  company_id: string;
  company_name: string;
  company_email: string;
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  inbound_duration_seconds: number;
  outbound_duration_seconds: number;
  total_duration_seconds: number;
  missed_calls: number;
  active_licenses: LicenseEntry[];
  license_fees_cents: number;
  inbound_minutes: number;
  outbound_minutes: number;
  inbound_cost_cents: number;
  outbound_cost_cents: number;
  total_cents: number;
}

interface BillingData {
  from: string;
  to: string;
  rates: Record<string, { label: string; rate_type: string; rate_cents: number }>;
  rows: BillingRow[];
}

const PRESETS = [
  { label: '7 derniers jours', getFrom: () => subDays(new Date(), 7) },
  { label: '30 derniers jours', getFrom: () => subDays(new Date(), 30) },
  { label: 'Ce mois-ci', getFrom: () => startOfMonth(new Date()) },
];

const LICENSE_COLORS: Record<string, { bg: string; text: string; short: string }> = {
  offer_a: { bg: 'bg-[#344453]/10', text: 'text-[#344453]/70', short: 'A' },
  offer_b: { bg: 'bg-[#2D9D78]/12', text: 'text-[#2D9D78]', short: 'B' },
  smart_routing: { bg: 'bg-[#E6A817]/15', text: 'text-[#C78A10]', short: 'Routage' },
  outbound_license: { bg: 'bg-[#C7601D]/12', text: 'text-[#C7601D]', short: 'Sortants' },
};

function eur(cents: number) {
  return (cents / 100).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function AdminBilling() {
  const { token } = useSuperAuth();
  const navigate = useNavigate();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async (f = from, t = to) => {
    setLoading(true);
    try {
      const { data: res } = await axios.get<BillingData>('/api/super/billing', {
        ...authHeader,
        params: { from: f, to: t },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const applyPreset = (getFrom: () => Date) => {
    const f = format(getFrom(), 'yyyy-MM-dd');
    const t = format(new Date(), 'yyyy-MM-dd');
    setFrom(f);
    setTo(t);
    load(f, t);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.get('/api/super/billing/export', {
        ...authHeader,
        params: { from, to },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totals = data?.rows.reduce(
    (acc, r) => ({
      license_fees: acc.license_fees + r.license_fees_cents,
      inbound: acc.inbound + r.inbound_cost_cents,
      outbound: acc.outbound + r.outbound_cost_cents,
      total: acc.total + r.total_cents,
      calls: acc.calls + r.total_calls,
    }),
    { license_fees: 0, inbound: 0, outbound: 0, total: 0, calls: 0 }
  );

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Facturation
            </h1>
            <p className="mt-1 text-sm text-[#344453]/55">Coûts par tenant — licences + appels</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/pricing')}
              className="flex items-center gap-2 rounded-full border border-[#344453]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#344453] hover:bg-[#344453]/6 transition"
            >
              <Tag className="h-4 w-4" />
              Tarifs
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || !data}
              className="flex items-center gap-2 rounded-full border border-[#344453]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#344453] hover:bg-[#344453]/6 transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Export…' : 'CSV'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.getFrom)}
              className="rounded-full border border-[#344453]/15 bg-white px-3.5 py-1.5 text-xs font-medium text-[#344453] hover:bg-[#344453]/8 transition"
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
            />
            <span className="text-sm text-[#344453]/40">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#344453]/10"
            />
            <button
              onClick={() => load()}
              disabled={loading}
              className="rounded-full bg-[#141F28] px-4 py-2 text-sm font-medium text-white hover:bg-[#344453] transition disabled:opacity-60"
            >
              {loading ? 'Chargement…' : 'Appliquer'}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {totals && (
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              { icon: Tag, label: 'Frais licences', value: eur(totals.license_fees), color: 'text-[#344453]/60' },
              { icon: PhoneIncoming, label: 'Entrants', value: eur(totals.inbound), color: 'text-[#2D9D78]' },
              { icon: PhoneOutgoing, label: 'Sortants', value: eur(totals.outbound), color: 'text-[#C7601D]' },
              { icon: Receipt, label: 'Total facturable', value: eur(totals.total), color: 'text-[#141F28]' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-2xl border border-[#344453]/10 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-[#344453]/50">{label}</span>
                </div>
                <p className="text-xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                  {value}
                </p>
                {label === 'Total facturable' && (
                  <p className="mt-1 text-xs text-[#344453]/40">{totals.calls.toLocaleString()} appels · {data?.rows.length} tenants</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rates info */}
        {data?.rates && (
          <div className="mb-4 flex flex-wrap gap-3">
            {Object.entries(data.rates).map(([key, r]) => (
              <span key={key} className="rounded-full border border-[#344453]/10 bg-white px-3 py-1 text-xs text-[#344453]/55">
                {r.label} — <strong className="text-[#344453]/80">{(r.rate_cents / 100).toFixed(2)} €{r.rate_type === 'monthly' ? '/mois' : '/min'}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
          {data && (
            <div className="border-b border-[#344453]/8 px-6 py-3 bg-[#F8F9FB]">
              <p className="text-xs text-[#344453]/50">
                Période : <strong>{format(new Date(data.from), 'd MMM yyyy', { locale: fr })} — {format(new Date(data.to), 'd MMM yyyy', { locale: fr })}</strong>
                {' '}· {data.rows.length} tenants
              </p>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="border-b border-[#344453]/8">
              <tr>
                <th className="px-4 py-3.5 w-8" />
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Entreprise</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Licences</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Frais fixes</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Entrants</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Sortants</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#344453]/6">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-[#344453]/40">Chargement…</td>
                </tr>
              ) : !data?.rows.length ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-[#344453]/40">
                    Aucune donnée sur cette période
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <>
                    <tr
                      key={r.company_id}
                      className="hover:bg-[#F8F9FB] transition-colors cursor-pointer"
                      onClick={() => toggleExpand(r.company_id)}
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-4 text-[#344453]/30">
                        {expanded.has(r.company_id)
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </td>
                      {/* Entreprise */}
                      <td className="px-4 py-4">
                        <p className="font-medium text-[#141F28]">{r.company_name}</p>
                        <p className="text-xs text-[#344453]/50">{r.company_email}</p>
                        {r.total_calls > 0 && (
                          <p className="text-xs text-[#344453]/40 mt-0.5">
                            {r.total_calls} appels · {r.missed_calls} manqués
                          </p>
                        )}
                      </td>
                      {/* Licences */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {r.active_licenses.filter((l) => l.active).length === 0 ? (
                            <span className="text-xs text-[#344453]/30">—</span>
                          ) : (
                            r.active_licenses
                              .filter((l) => l.active)
                              .map((l) => {
                                const c = LICENSE_COLORS[l.key] ?? { bg: 'bg-[#344453]/10', text: 'text-[#344453]/70', short: l.key };
                                return (
                                  <span
                                    key={l.key}
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
                                  >
                                    {c.short}
                                  </span>
                                );
                              })
                          )}
                        </div>
                      </td>
                      {/* Frais licences */}
                      <td className="px-4 py-4 text-right font-mono text-[#344453]/70">
                        {r.license_fees_cents > 0 ? eur(r.license_fees_cents) : <span className="text-[#344453]/30">—</span>}
                      </td>
                      {/* Entrants */}
                      <td className="px-4 py-4 text-right">
                        {r.inbound_minutes > 0 ? (
                          <div>
                            <p className="font-mono text-[#2D9D78]">{eur(r.inbound_cost_cents)}</p>
                            <p className="text-xs text-[#344453]/40">{r.inbound_minutes} min</p>
                          </div>
                        ) : <span className="font-mono text-[#344453]/30">—</span>}
                      </td>
                      {/* Sortants */}
                      <td className="px-4 py-4 text-right">
                        {r.outbound_minutes > 0 ? (
                          <div>
                            <p className="font-mono text-[#C7601D]">{eur(r.outbound_cost_cents)}</p>
                            <p className="text-xs text-[#344453]/40">{r.outbound_minutes} min</p>
                          </div>
                        ) : <span className="font-mono text-[#344453]/30">—</span>}
                      </td>
                      {/* Total */}
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono font-semibold ${r.total_cents > 0 ? 'text-[#141F28]' : 'text-[#344453]/30'}`}>
                          {r.total_cents > 0 ? eur(r.total_cents) : '—'}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {expanded.has(r.company_id) && (
                      <tr key={`${r.company_id}-detail`}>
                        <td colSpan={7} className="px-6 pb-4 pt-0 bg-[#F8F9FB]/50">
                          <div className="rounded-xl border border-[#344453]/8 bg-white p-4 mt-1">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Licences detail */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50 mb-3">
                                  Détail licences
                                </p>
                                {r.active_licenses.length === 0 ? (
                                  <p className="text-xs text-[#344453]/40">Aucune licence assignée</p>
                                ) : (
                                  <div className="space-y-2">
                                    {r.active_licenses.map((l) => (
                                      <div key={l.key} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className={`h-1.5 w-1.5 rounded-full ${l.active ? 'bg-[#2D9D78]' : 'bg-[#344453]/20'}`} />
                                          <span className="text-[#344453]/70">{l.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                          <span className="text-[#344453]/40">
                                            {l.days_active}j · {(l.monthly_rate_cents / 100).toFixed(2)} €/mois
                                          </span>
                                          <span className="font-mono font-medium text-[#141F28] w-16 text-right">
                                            {eur(l.fee_cents)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="flex justify-between border-t border-[#344453]/8 pt-2 text-xs font-medium">
                                      <span className="text-[#344453]/60">Sous-total licences</span>
                                      <span className="font-mono text-[#141F28]">{eur(r.license_fees_cents)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Calls detail */}
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50 mb-3">
                                  Détail appels
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <PhoneIncoming className="h-3.5 w-3.5 text-[#2D9D78]" />
                                      <span className="text-[#344453]/70">
                                        Entrants — {r.inbound_calls} appel{r.inbound_calls !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[#344453]/40">
                                        {r.inbound_minutes} min
                                        {data.rates['inbound_per_min'] && (
                                          <> · {(data.rates['inbound_per_min'].rate_cents / 100).toFixed(2)} €/min</>
                                        )}
                                      </span>
                                      <span className="font-mono font-medium text-[#2D9D78] w-16 text-right">
                                        {eur(r.inbound_cost_cents)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <PhoneOutgoing className="h-3.5 w-3.5 text-[#C7601D]" />
                                      <span className="text-[#344453]/70">
                                        Sortants — {r.outbound_calls} appel{r.outbound_calls !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[#344453]/40">
                                        {r.outbound_minutes} min
                                        {data.rates['outbound_per_min'] && (
                                          <> · {(data.rates['outbound_per_min'].rate_cents / 100).toFixed(2)} €/min</>
                                        )}
                                      </span>
                                      <span className="font-mono font-medium text-[#C7601D] w-16 text-right">
                                        {eur(r.outbound_cost_cents)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <PhoneOff className="h-3.5 w-3.5 text-[#D94052]" />
                                      <span className="text-[#344453]/70">Manqués</span>
                                    </div>
                                    <span className="font-mono text-[#D94052] w-16 text-right">
                                      {r.missed_calls}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t border-[#344453]/8 pt-2 text-xs font-medium">
                                    <span className="text-[#344453]/60">Sous-total appels</span>
                                    <span className="font-mono text-[#141F28]">
                                      {eur(r.inbound_cost_cents + r.outbound_cost_cents)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Grand total */}
                            <div className="mt-4 flex justify-between border-t border-[#344453]/10 pt-3">
                              <span className="text-sm font-semibold text-[#344453]/70">Total facturable sur la période</span>
                              <span className="text-base font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                                {eur(r.total_cents)}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>

          {/* Totals row */}
          {totals && data && data.rows.length > 0 && !loading && (
            <div className="border-t border-[#344453]/12 bg-[#F8F9FB] px-6 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#344453]/50">
                Totaux ({data.rows.length} tenants)
              </span>
              <div className="flex items-center gap-8 text-sm">
                <span className="text-[#344453]/60">Licences: <strong className="text-[#344453]">{eur(totals.license_fees)}</strong></span>
                <span className="text-[#2D9D78]">Entrants: <strong>{eur(totals.inbound)}</strong></span>
                <span className="text-[#C7601D]">Sortants: <strong>{eur(totals.outbound)}</strong></span>
                <span className="text-[#141F28] font-bold text-base" style={{ fontFamily: 'var(--font-title)' }}>
                  {eur(totals.total)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
