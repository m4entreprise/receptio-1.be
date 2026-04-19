import { useEffect, useState } from 'react';
import axios from 'axios';
import { format, subDays, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, PhoneOff } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

interface BillingRow {
  company_id: string;
  company_name: string;
  company_email: string;
  offer: string | null;
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  total_duration_seconds: number;
  missed_calls: number;
}

interface BillingData {
  from: string;
  to: string;
  rows: BillingRow[];
}

const PRESETS = [
  { label: '7 derniers jours', getFrom: () => subDays(new Date(), 7) },
  { label: '30 derniers jours', getFrom: () => subDays(new Date(), 30) },
  { label: 'Ce mois-ci', getFrom: () => startOfMonth(new Date()) },
];

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export default function AdminBilling() {
  const { token } = useSuperAuth();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

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

  const totals = data?.rows.reduce(
    (acc, r) => ({
      total_calls: acc.total_calls + r.total_calls,
      inbound_calls: acc.inbound_calls + r.inbound_calls,
      outbound_calls: acc.outbound_calls + r.outbound_calls,
      total_duration_seconds: acc.total_duration_seconds + r.total_duration_seconds,
      missed_calls: acc.missed_calls + r.missed_calls,
    }),
    { total_calls: 0, inbound_calls: 0, outbound_calls: 0, total_duration_seconds: 0, missed_calls: 0 }
  );

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Facturation</h1>
            <p className="mt-1 text-sm text-[#344453]/55">Agrégats d'usage par tenant</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || !data}
            className="flex items-center gap-2 rounded-full border border-[#344453]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#344453] hover:bg-[#344453]/6 transition disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Export…' : 'Exporter CSV'}
          </button>
        </div>

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
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#344453]/10" />
            <span className="text-sm text-[#344453]/40">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#344453]/10" />
            <button onClick={() => load()} disabled={loading} className="rounded-full bg-[#141F28] px-4 py-2 text-sm font-medium text-white hover:bg-[#344453] transition disabled:opacity-60">
              {loading ? 'Chargement…' : 'Appliquer'}
            </button>
          </div>
        </div>

        {totals && (
          <div className="mb-6 grid grid-cols-5 gap-4">
            {[
              { icon: PhoneCall, label: 'Total', value: totals.total_calls.toLocaleString() },
              { icon: PhoneIncoming, label: 'Entrants', value: totals.inbound_calls.toLocaleString() },
              { icon: PhoneOutgoing, label: 'Sortants', value: totals.outbound_calls.toLocaleString() },
              { icon: Clock, label: 'Durée totale', value: fmt(totals.total_duration_seconds) },
              { icon: PhoneOff, label: 'Manqués', value: totals.missed_calls.toLocaleString() },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border border-[#344453]/10 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-[#344453]/50" />
                  <span className="text-xs text-[#344453]/50">{label}</span>
                </div>
                <p className="text-xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
          {data && (
            <div className="border-b border-[#344453]/8 px-6 py-3 bg-[#F8F9FB]">
              <p className="text-xs text-[#344453]/50">
                Période : <strong>{format(new Date(data.from), 'd MMM yyyy', { locale: fr })} — {format(new Date(data.to), 'd MMM yyyy', { locale: fr })}</strong> · {data.rows.length} tenants
              </p>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="border-b border-[#344453]/8">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Entreprise</th>
                <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Offre</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Total</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Entrants</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Sortants</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Durée</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Manqués</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#344453]/6">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[#344453]/40">Chargement…</td></tr>
              ) : !data?.rows.length ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[#344453]/40">Aucune donnée sur cette période</td></tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.company_id} className="hover:bg-[#F8F9FB] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-[#141F28]">{r.company_name}</p>
                      <p className="text-xs text-[#344453]/50">{r.company_email}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {r.offer === 'B' ? (
                        <span className="rounded-full bg-[#2D9D78]/12 px-2.5 py-0.5 text-xs font-medium text-[#2D9D78]">B</span>
                      ) : (
                        <span className="rounded-full bg-[#344453]/10 px-2.5 py-0.5 text-xs font-medium text-[#344453]/70">A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-[#141F28]">{r.total_calls.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#344453]/70">{r.inbound_calls.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#344453]/70">{r.outbound_calls.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#344453]/70">{fmt(r.total_duration_seconds)}</td>
                    <td className="px-6 py-4 text-right font-mono text-[#D94052]">{r.missed_calls.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
