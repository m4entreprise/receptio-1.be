import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, ShieldAlert } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

interface Log {
  id: string;
  super_admin_email: string;
  company_name: string;
  created_at: string;
}

export default function AdminLogs() {
  const { token } = useSuperAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<Log[]>('/api/super/impersonation-logs', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setLogs(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6A817]/15">
            <ShieldAlert className="h-5 w-5 text-[#E6A817]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Journal d'audit
            </h1>
            <p className="mt-0.5 text-sm text-[#344453]/55">Historique des impersonations (200 dernières)</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-[#344453]/8 bg-[#F8F9FB]">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Super admin</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Tenant impersonifié</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#344453]/50">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#344453]/6">
              {loading ? (
                <tr><td colSpan={3} className="py-16 text-center text-sm text-[#344453]/40">Chargement…</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#344453]/40">
                      <History className="h-8 w-8" />
                      <p className="text-sm">Aucune impersonation enregistrée</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F9FB] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-[#344453]/8 text-[#344453] rounded-lg px-2.5 py-1">
                        {log.super_admin_email}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-[#141F28]">{log.company_name}</td>
                    <td className="px-6 py-4 text-[#344453]/55">
                      {format(new Date(log.created_at), "d MMM yyyy 'à' HH'h'mm", { locale: fr })}
                    </td>
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
