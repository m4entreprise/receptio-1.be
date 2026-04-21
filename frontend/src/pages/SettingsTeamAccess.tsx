import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Copy, MailPlus, Shield, UserCog, UserMinus, UserPlus, History, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

interface Member {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'agent';
  status: 'active' | 'disabled' | 'invited';
  staff_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  staff_first_name?: string | null;
  staff_last_name?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'agent';
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  target_label?: string | null;
  created_at: string;
}

interface StaffOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface AgentPolicy {
  callsRead: boolean;
  callDetailRead: boolean;
  callRecordingsRead: boolean;
  callTransfer: boolean;
  callDelete: boolean;
  outboundRead: boolean;
  outboundCreate: boolean;
  outboundManage: boolean;
  outboundAllRead: boolean;
  analyticsRead: boolean;
  staffManage: boolean;
  knowledgeBaseManage: boolean;
  settingsManage: boolean;
  intentsManage: boolean;
  qaManage: boolean;
  auditLogsRead: boolean;
  memberManage: boolean;
  outboundScope: 'own' | 'all';
}

const policyLabels: Array<{ key: keyof AgentPolicy; label: string }> = [
  { key: 'callsRead', label: 'Voir les appels' },
  { key: 'callDetailRead', label: 'Voir le détail des appels' },
  { key: 'callRecordingsRead', label: 'Écouter les enregistrements' },
  { key: 'callTransfer', label: 'Transférer / abandonner les appels entrants' },
  { key: 'callDelete', label: 'Supprimer des appels' },
  { key: 'outboundRead', label: 'Voir les appels sortants' },
  { key: 'outboundCreate', label: 'Lancer un appel sortant' },
  { key: 'outboundManage', label: 'Piloter un appel sortant en cours' },
  { key: 'outboundAllRead', label: 'Voir les appels sortants de toute l’équipe' },
  { key: 'analyticsRead', label: 'Voir les analytics' },
  { key: 'staffManage', label: 'Gérer le staff et le routage' },
  { key: 'knowledgeBaseManage', label: 'Gérer la base de connaissances' },
  { key: 'settingsManage', label: 'Modifier les paramètres entreprise' },
  { key: 'intentsManage', label: 'Gérer les intents' },
  { key: 'qaManage', label: 'Gérer la QA' },
  { key: 'auditLogsRead', label: 'Voir le journal admin' },
  { key: 'memberManage', label: 'Gérer les membres' },
];

export default function SettingsTeamAccess() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [policy, setPolicy] = useState<AgentPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'agent' as 'admin' | 'agent', staffId: '' });
  const [inviteUrl, setInviteUrl] = useState('');
  const canManageMembers = Boolean(user?.permissions?.memberManage);
  const canReadLogs = Boolean(user?.permissions?.auditLogsRead);

  const load = async () => {
    setLoading(true);
    try {
      const requests: Promise<any>[] = [
        axios.get('/api/members'),
        axios.get('/api/members/access-policy'),
        axios.get('/api/staff').catch(() => ({ data: { staff: [] } })),
      ];
      if (canReadLogs) {
        requests.push(axios.get('/api/members/audit-logs'));
      }
      const [membersRes, policyRes, staffRes, logsRes] = await Promise.all(requests);
      setMembers(membersRes.data.members || []);
      setInvitations(membersRes.data.invitations || []);
      setPolicy(policyRes.data.agent || null);
      setStaff(staffRes.data.staff || []);
      setLogs(logsRes?.data?.logs || []);
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Impossible de charger la gouvernance du compte.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const staffOptions = useMemo(() => staff.map((member) => ({ value: member.id, label: `${member.first_name} ${member.last_name}` })), [staff]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const { data } = await axios.post('/api/members/invite', {
        email: inviteForm.email,
        role: inviteForm.role,
        staffId: inviteForm.staffId || null,
      });
      setInviteUrl(data.inviteUrl || '');
      setInviteForm({ email: '', role: 'agent', staffId: '' });
      setMessage('Invitation créée avec succès.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Erreur lors de la création de l’invitation.');
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage('Lien d’invitation copié.');
  };

  const handleSavePolicy = async () => {
    if (!policy) return;
    setMessage('');
    try {
      await axios.put('/api/members/access-policy', { agent: policy });
      setMessage('Politique agent enregistrée.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Erreur lors de la sauvegarde des accès agents.');
    }
  };

  const handleMemberUpdate = async (memberId: string, payload: Record<string, unknown>) => {
    setMessage('');
    try {
      await axios.patch(`/api/members/${memberId}`, payload);
      setMessage('Membre mis à jour.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Erreur lors de la mise à jour du membre.');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setMessage('');
    try {
      await axios.post(`/api/members/invitations/${invitationId}/revoke`);
      setMessage('Invitation révoquée.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Erreur lors de la révocation.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                Équipe & accès
              </h1>
              <p className="mt-2 text-sm text-[#344453]/55">
                Gérez les membres du tenant, les invitations, les droits des agents et le journal admin.
              </p>
            </div>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full border border-[#344453]/15 bg-[#F8F9FB] px-4 py-2 text-sm text-[#344453]"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
          {message && (
            <div className="mt-4 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453]">
              {message}
            </div>
          )}
        </section>

        {canManageMembers && (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={handleInvite} className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <MailPlus className="h-5 w-5 text-[#C7601D]" />
                <h2 className="text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Inviter un membre</h2>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#344453]">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Rôle</label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'agent' }))}
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Lier à un staff</label>
                    <select
                      value={inviteForm.staffId}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, staffId: e.target.value }))}
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Aucun</option>
                      {staffOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white">
                  <UserPlus className="h-4 w-4" />
                  Créer l’invitation
                </button>
                {inviteUrl && (
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#344453]/15 px-5 py-3 text-sm font-medium text-[#344453]"
                  >
                    <Copy className="h-4 w-4" />
                    Copier le lien d’invitation
                  </button>
                )}
              </div>
            </form>

            <section className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[#344453]" />
                <h2 className="text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Accès des agents</h2>
              </div>
              {policy && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {policyLabels.map(({ key, label }) => (
                      <label key={String(key)} className="flex items-start justify-between gap-4 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3">
                        <span className="text-sm text-[#141F28]">{label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(policy[key])}
                          onChange={(e) => setPolicy((prev) => prev ? { ...prev, [key]: e.target.checked } : prev)}
                          className="mt-1 h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Portée des appels sortants agents</label>
                    <select
                      value={policy.outboundScope}
                      onChange={(e) => setPolicy((prev) => prev ? { ...prev, outboundScope: e.target.value as 'own' | 'all' } : prev)}
                      className="mt-2 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                    >
                      <option value="own">Seulement ses propres appels sortants</option>
                      <option value="all">Tous les appels sortants du tenant</option>
                    </select>
                  </div>
                  <button onClick={() => void handleSavePolicy()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#344453] px-5 py-3 text-sm font-semibold text-white">
                    <UserCog className="h-4 w-4" />
                    Enregistrer la politique agent
                  </button>
                </div>
              )}
            </section>
          </section>
        )}

        <section className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Membres</h2>
          <div className="mt-5 space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-[#141F28]">{member.email}</p>
                    <p className="mt-1 text-sm text-[#344453]/55">
                      {member.role} · {member.status}
                      {member.staff_first_name ? ` · lié à ${member.staff_first_name} ${member.staff_last_name}` : ''}
                    </p>
                  </div>
                  {canManageMembers && member.role !== 'owner' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void handleMemberUpdate(member.id, { status: member.status === 'disabled' ? 'active' : 'disabled' })}
                        className="rounded-full border border-[#344453]/15 px-4 py-2 text-sm text-[#344453]"
                      >
                        {member.status === 'disabled' ? 'Réactiver' : 'Désactiver'}
                      </button>
                      <button
                        onClick={() => void handleMemberUpdate(member.id, { role: member.role === 'agent' ? 'admin' : 'agent' })}
                        className="rounded-full border border-[#344453]/15 px-4 py-2 text-sm text-[#344453]"
                      >
                        {member.role === 'agent' ? 'Promouvoir admin' : 'Rétrograder agent'}
                      </button>
                      {user?.role === 'owner' && member.id !== user.id && (
                        <button
                          onClick={() => void handleMemberUpdate(member.id, { role: 'owner' })}
                          className="rounded-full bg-[#141F28] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Transférer ownership
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Invitations</h2>
          <div className="mt-5 space-y-3">
            {invitations.length === 0 ? (
              <p className="text-sm text-[#344453]/55">Aucune invitation.</p>
            ) : invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-[#141F28]">{invitation.email}</p>
                  <p className="mt-1 text-sm text-[#344453]/55">{invitation.role} · {invitation.status} · expire le {new Date(invitation.expires_at).toLocaleDateString('fr-BE')}</p>
                </div>
                {canManageMembers && invitation.status === 'pending' && (
                  <button onClick={() => void handleRevokeInvitation(invitation.id)} className="inline-flex items-center gap-2 rounded-full border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-2 text-sm text-[#D94052]">
                    <UserMinus className="h-4 w-4" />
                    Révoquer
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {canReadLogs && (
          <section className="rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-[#344453]" />
              <h2 className="text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Journal admin</h2>
            </div>
            <div className="mt-5 space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-4">
                  <p className="text-sm font-semibold text-[#141F28]">{log.action}</p>
                  <p className="mt-1 text-sm text-[#344453]/55">{log.actor_email || 'Système'} · {log.target_label || log.entity_type} · {new Date(log.created_at).toLocaleString('fr-BE')}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
