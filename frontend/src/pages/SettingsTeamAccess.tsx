import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle, Check, Copy, History, MailPlus,
  RefreshCw, Shield, UserCheck, UserCog, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'agent';
  status: 'active' | 'disabled';
  staff_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  staff_first_name?: string | null;
  staff_last_name?: string | null;
  staff_phone?: string | null;
  staff_role?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: 'admin' | 'agent';
  staff_first_name?: string | null;
  staff_last_name?: string | null;
  invited_by_email?: string | null;
  expires_at: string;
  created_at: string;
}

interface UnlinkedStaff {
  id: string;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  role: string;
  enabled: boolean;
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

interface AuditLog {
  id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  target_label?: string | null;
  created_at: string;
}

type Tab = 'membres' | 'acces' | 'journal';
type StaffMode = 'new' | 'existing' | 'none';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  agent: 'Agent',
};
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-[#C7601D]/10 text-[#C7601D]',
  admin: 'bg-[#344453]/10 text-[#344453]',
  agent: 'bg-[#2D9D78]/10 text-[#2D9D78]',
};

const POLICY_GROUPS: Array<{ group: string; keys: Array<{ key: keyof AgentPolicy; label: string }> }> = [
  {
    group: 'Appels entrants',
    keys: [
      { key: 'callsRead',          label: 'Voir les appels' },
      { key: 'callDetailRead',     label: 'Voir le détail des appels' },
      { key: 'callRecordingsRead', label: 'Écouter les enregistrements' },
      { key: 'callTransfer',       label: 'Transférer / abandonner' },
      { key: 'callDelete',         label: 'Supprimer des appels' },
    ],
  },
  {
    group: 'Appels sortants',
    keys: [
      { key: 'outboundRead',    label: 'Voir ses appels sortants' },
      { key: 'outboundCreate',  label: 'Lancer un appel sortant' },
      { key: 'outboundManage',  label: 'Gérer un appel en cours' },
      { key: 'outboundAllRead', label: 'Voir tous les appels sortants' },
    ],
  },
  {
    group: 'Administration',
    keys: [
      { key: 'analyticsRead',        label: 'Analytics' },
      { key: 'staffManage',          label: 'Staff & routage' },
      { key: 'knowledgeBaseManage',  label: 'Base de connaissances' },
      { key: 'settingsManage',       label: 'Paramètres entreprise' },
      { key: 'intentsManage',        label: 'Intents' },
      { key: 'qaManage',             label: 'QA & coaching' },
      { key: 'auditLogsRead',        label: 'Journal admin' },
      { key: 'memberManage',         label: 'Gestion des membres' },
    ],
  },
];

const ACTION_COLORS: Record<string, string> = {
  'member.invited':              'bg-[#C7601D]/10 text-[#C7601D]',
  'member.updated':              'bg-[#344453]/10 text-[#344453]',
  'member.invitation_revoked':   'bg-[#D94052]/10 text-[#D94052]',
  'member.ownership_transferred':'bg-[#9B59B6]/10 text-[#9B59B6]',
  'member_access_policy.updated':'bg-[#2D9D78]/10 text-[#2D9D78]',
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName }: { firstName?: string | null; lastName?: string | null }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#344453] text-[11px] font-semibold text-white">
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[role] ?? 'bg-[#344453]/10 text-[#344453]'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { active: 'bg-[#2D9D78]', disabled: 'bg-[#D94052]' };
  const labels: Record<string, string> = { active: 'Actif', disabled: 'Désactivé' };
  return (
    <span className="flex items-center gap-1.5 text-sm text-[#344453]">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors[status] ?? 'bg-[#344453]/40'}`} />
      {labels[status] ?? status}
    </span>
  );
}

function fmt(date?: string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

const TH = 'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40';
const TD = 'px-4 py-3';

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  unlinkedStaff, canInviteAdmin, defaultStaffId, onClose, onDone,
}: {
  unlinkedStaff: UnlinkedStaff[];
  canInviteAdmin: boolean;
  defaultStaffId?: string;
  onClose: () => void;
  onDone: (url: string) => void;
}) {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState<'agent' | 'admin'>('agent');
  const [mode, setMode]     = useState<StaffMode>(defaultStaffId ? 'existing' : 'new');
  const [staffId, setStaffId] = useState(defaultStaffId ?? '');
  const [ns, setNs] = useState({ firstName: '', lastName: '', phone: '', role: 'Secrétaire' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // Admin : pas de profil d'agent par défaut
  useEffect(() => { if (role === 'admin') setMode('none'); }, [role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body: Record<string, unknown> = { email, role };
      if (mode === 'existing' && staffId) body.staffId = staffId;
      if (mode === 'new') {
        body.staffData = {
          firstName:   ns.firstName,
          lastName:    ns.lastName,
          phoneNumber: ns.phone || undefined,
          role:        ns.role  || undefined,
        };
      }
      const { data } = await axios.post('/api/members/invite', body);
      onDone(data.inviteUrl || '');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de la création de l\'invitation.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center p-4">
      <div className="w-full max-w-lg rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C7601D]/10">
              <MailPlus className="h-4 w-4 text-[#C7601D]" />
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Inviter un membre
            </h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-5">
          {/* Email + Rôle */}
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div>
              <label className="block text-sm font-medium text-[#344453]">Email <span className="text-[#D94052]">*</span></label>
              <input
                required type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.be"
                className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none focus:border-[#344453]/25 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#344453]">Rôle</label>
              <select
                value={role} onChange={e => setRole(e.target.value as 'agent' | 'admin')}
                className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none focus:border-[#344453]/25 focus:bg-white transition"
              >
                <option value="agent">Agent</option>
                {canInviteAdmin && <option value="admin">Administrateur</option>}
              </select>
            </div>
          </div>

          {/* Profil d'agent */}
          <div>
            <label className="block text-sm font-medium text-[#344453]">Profil d'agent (routage des appels)</label>
            <p className="mt-0.5 mb-3 text-xs text-[#344453]/45">
              Chaque agent devrait avoir un profil pour pouvoir recevoir des appels transférés.
            </p>
            <div className={`grid gap-2 ${unlinkedStaff.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {([
                { v: 'new'      as StaffMode, label: 'Nouveau profil', icon: UserPlus  },
                ...(unlinkedStaff.length > 0 ? [{ v: 'existing' as StaffMode, label: 'Profil existant', icon: UserCheck }] : []),
                { v: 'none'     as StaffMode, label: 'Sans profil',    icon: UserCog   },
              ]).map(({ v, label, icon: Icon }) => (
                <button key={v} type="button" onClick={() => setMode(v)}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                    mode === v
                      ? 'border-[#344453] bg-[#344453] text-white'
                      : 'border-[#344453]/15 bg-[#F8F9FB] text-[#344453] hover:border-[#344453]/25'
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </button>
              ))}
            </div>

            {mode === 'new' && (
              <div className="mt-3 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-[#344453]">Prénom <span className="text-[#D94052]">*</span></label>
                    <input required type="text" value={ns.firstName} onChange={e => setNs(p => ({ ...p, firstName: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/25" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#344453]">Nom <span className="text-[#D94052]">*</span></label>
                    <input required type="text" value={ns.lastName} onChange={e => setNs(p => ({ ...p, lastName: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/25" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-[#344453]">Téléphone</label>
                    <input type="tel" placeholder="+32 470 …" value={ns.phone} onChange={e => setNs(p => ({ ...p, phone: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/25" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#344453]">Fonction</label>
                    <input type="text" value={ns.role} onChange={e => setNs(p => ({ ...p, role: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/25" />
                  </div>
                </div>
              </div>
            )}

            {mode === 'existing' && (
              <select
                required value={staffId} onChange={e => setStaffId(e.target.value)}
                className="mt-3 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none focus:border-[#344453]/25 focus:bg-white transition"
              >
                <option value="">Sélectionner un profil sans compte…</option>
                {unlinkedStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}{s.phone_number ? ` — ${s.phone_number}` : ''} ({s.role})
                  </option>
                ))}
              </select>
            )}

            {mode === 'none' && (
              <p className="mt-3 rounded-2xl border border-[#C7601D]/15 bg-[#C7601D]/6 px-4 py-3 text-xs text-[#C7601D]">
                Sans profil d'agent, cette personne ne pourra pas être routée pour les appels entrants.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] hover:bg-[#344453]/5 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-full bg-[#C7601D] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] hover:bg-[#b35519] disabled:opacity-50 transition">
              {saving ? 'Création…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Invite Success ───────────────────────────────────────────────────────────

function InviteSuccess({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center p-4">
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2D9D78]/10">
            <Check className="h-4 w-4 text-[#2D9D78]" />
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
            Invitation créée
          </h2>
        </div>
        <p className="mt-3 text-sm text-[#344453]/60">
          Partagez ce lien avec la personne invitée. Il expire dans 7 jours.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-3">
          <span className="flex-1 truncate text-xs text-[#344453]/70" style={{ fontFamily: 'var(--font-mono)' }}>{url}</span>
          <button onClick={() => void copy()}
            className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              copied ? 'bg-[#2D9D78]/10 text-[#2D9D78]' : 'bg-[#344453]/8 text-[#344453] hover:bg-[#344453]/12'
            }`}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <button onClick={onClose}
          className="mt-4 w-full rounded-full bg-[#344453] py-3 text-sm font-semibold text-white hover:bg-[#2a3642] transition">
          Fermer
        </button>
      </div>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({
  members, pendingInvitations, unlinkedStaff,
  canManage, isOwner, currentUserId,
  onRevoke, onMemberUpdate, onInvite,
}: {
  members: Member[];
  pendingInvitations: PendingInvitation[];
  unlinkedStaff: UnlinkedStaff[];
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
  onRevoke: (id: string) => void;
  onMemberUpdate: (id: string, payload: Record<string, unknown>) => void;
  onInvite: (defaultStaffId?: string) => void;
}) {
  const activeCount = members.filter(m => m.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Stats + action */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#344453]/60">
          <span>
            <span className="font-semibold text-[#141F28]">{activeCount}</span>
            {' '}membre{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}
          </span>
          {pendingInvitations.length > 0 && (
            <span>
              <span className="font-semibold text-[#C7601D]">{pendingInvitations.length}</span>
              {' '}invitation{pendingInvitations.length !== 1 ? 's' : ''} en attente
            </span>
          )}
          {unlinkedStaff.length > 0 && (
            <span>
              <span className="font-semibold text-[#344453]">{unlinkedStaff.length}</span>
              {' '}agent{unlinkedStaff.length !== 1 ? 's' : ''} sans compte
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => onInvite()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] hover:bg-[#b35519] transition"
          >
            <UserPlus className="h-4 w-4" /> Inviter
          </button>
        )}
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-[20px] border border-[#344453]/10 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#344453]/8 bg-[#344453]/3">
              <th className={TH}>Membre</th>
              <th className={`${TH} hidden sm:table-cell`}>Rôle</th>
              <th className={`${TH} hidden md:table-cell`}>Statut</th>
              <th className={`${TH} hidden lg:table-cell`}>Agent lié</th>
              <th className={`${TH} hidden xl:table-cell`}>Dernière connexion</th>
              {canManage && <th className={`${TH} text-right`}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#344453]/5">
            {members.map(m => (
              <tr key={m.id} className={`transition hover:bg-[#344453]/2 ${m.status === 'disabled' ? 'opacity-50' : ''}`}>
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Avatar firstName={m.first_name} lastName={m.last_name} />
                    <div>
                      <p className="text-sm font-medium text-[#141F28]">
                        {(m.first_name || m.last_name)
                          ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
                          : m.email}
                      </p>
                      <p className="text-xs text-[#344453]/45">{m.email}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                        <RoleBadge role={m.role} />
                        <StatusDot status={m.status} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className={`${TD} hidden sm:table-cell`}><RoleBadge role={m.role} /></td>
                <td className={`${TD} hidden md:table-cell`}><StatusDot status={m.status} /></td>
                <td className={`${TD} hidden lg:table-cell`}>
                  {m.staff_first_name ? (
                    <div>
                      <p className="text-sm text-[#141F28]">{m.staff_first_name} {m.staff_last_name}</p>
                      {m.staff_phone && (
                        <p className="text-xs text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>{m.staff_phone}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs italic text-[#344453]/30">Aucun</span>
                  )}
                </td>
                <td className={`${TD} hidden xl:table-cell`}>
                  <span className="text-xs text-[#344453]/50">{fmt(m.last_login_at)}</span>
                </td>
                {canManage && (
                  <td className={`${TD} text-right`}>
                    {m.role !== 'owner' && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onMemberUpdate(m.id, { status: m.status === 'disabled' ? 'active' : 'disabled' })}
                          title={m.status === 'disabled' ? 'Réactiver' : 'Désactiver'}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                            m.status === 'disabled'
                              ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78] hover:bg-[#2D9D78]/15'
                              : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12'
                          }`}
                        >
                          {m.status === 'disabled'
                            ? <Check className="h-3.5 w-3.5" />
                            : <UserMinus className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => onMemberUpdate(m.id, { role: m.role === 'agent' ? 'admin' : 'agent' })}
                          title={m.role === 'agent' ? 'Promouvoir admin' : 'Rétrograder agent'}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-[#344453]/15 bg-white px-2.5 text-xs font-medium text-[#344453] hover:bg-[#344453]/5 transition"
                        >
                          {m.role === 'agent' ? '↑ Admin' : '↓ Agent'}
                        </button>
                        {isOwner && m.id !== currentUserId && (
                          <button
                            onClick={() => {
                              if (confirm(`Transférer la propriété du compte à ${m.email} ?`)) {
                                onMemberUpdate(m.id, { role: 'owner' });
                              }
                            }}
                            title="Transférer la propriété"
                            className="inline-flex h-8 items-center justify-center rounded-full border border-[#344453]/15 bg-white px-2.5 text-xs font-medium text-[#344453] hover:bg-[#344453]/5 transition"
                          >
                            Ownership
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invitations en attente */}
      {pendingInvitations.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#344453]">Invitations en attente</h3>
          <div className="overflow-hidden rounded-[20px] border border-[#C7601D]/20 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#C7601D]/10 bg-[#C7601D]/4">
                  <th className={TH}>Email</th>
                  <th className={`${TH} hidden sm:table-cell`}>Rôle</th>
                  <th className={`${TH} hidden md:table-cell`}>Agent lié</th>
                  <th className={`${TH} hidden lg:table-cell`}>Invité par</th>
                  <th className={`${TH} hidden lg:table-cell`}>Expire le</th>
                  {canManage && <th className={`${TH} text-right`}></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#344453]/5">
                {pendingInvitations.map(inv => (
                  <tr key={inv.id} className="transition hover:bg-[#344453]/2">
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#C7601D]/30 text-[#C7601D]/60">
                          <MailPlus className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#141F28]">{inv.email}</p>
                          <div className="mt-0.5 sm:hidden"><RoleBadge role={inv.role} /></div>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} hidden sm:table-cell`}><RoleBadge role={inv.role} /></td>
                    <td className={`${TD} hidden md:table-cell`}>
                      {inv.staff_first_name
                        ? <span className="text-sm text-[#344453]">{inv.staff_first_name} {inv.staff_last_name}</span>
                        : <span className="text-xs italic text-[#344453]/30">Aucun</span>}
                    </td>
                    <td className={`${TD} hidden lg:table-cell text-xs text-[#344453]/50`}>
                      {inv.invited_by_email ?? '—'}
                    </td>
                    <td className={`${TD} hidden lg:table-cell text-xs text-[#344453]/50`}>
                      {fmt(inv.expires_at)}
                    </td>
                    {canManage && (
                      <td className={`${TD} text-right`}>
                        <button
                          onClick={() => onRevoke(inv.id)}
                          title="Révoquer l'invitation"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agents sans compte */}
      {unlinkedStaff.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-[#344453]">Agents sans compte</h3>
          <p className="mb-3 text-xs text-[#344453]/50">
            Ces profils peuvent recevoir des appels mais n'ont pas accès au tableau de bord.
          </p>
          <div className="overflow-hidden rounded-[20px] border border-[#344453]/10 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#344453]/8 bg-[#344453]/3">
                  <th className={TH}>Agent</th>
                  <th className={`${TH} hidden sm:table-cell`}>Téléphone</th>
                  <th className={`${TH} hidden md:table-cell`}>Fonction</th>
                  {canManage && <th className={`${TH} text-right`}></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#344453]/5">
                {unlinkedStaff.map(s => (
                  <tr key={s.id} className={`transition hover:bg-[#344453]/2 ${!s.enabled ? 'opacity-40' : ''}`}>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <Avatar firstName={s.first_name} lastName={s.last_name} />
                        <p className="text-sm font-medium text-[#141F28]">{s.first_name} {s.last_name}</p>
                      </div>
                    </td>
                    <td className={`${TD} hidden sm:table-cell`}>
                      <span className="text-sm text-[#344453]/60" style={{ fontFamily: 'var(--font-mono)' }}>
                        {s.phone_number || <span className="italic font-sans text-[#344453]/30">—</span>}
                      </span>
                    </td>
                    <td className={`${TD} hidden md:table-cell`}>
                      <span className="rounded-full bg-[#344453]/8 px-2.5 py-0.5 text-xs font-medium text-[#344453]">
                        {s.role}
                      </span>
                    </td>
                    {canManage && (
                      <td className={`${TD} text-right`}>
                        <button
                          onClick={() => onInvite(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#C7601D]/25 bg-[#C7601D]/8 px-3 py-1.5 text-xs font-semibold text-[#C7601D] hover:bg-[#C7601D]/15 transition"
                        >
                          <MailPlus className="h-3.5 w-3.5" /> Inviter
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Access Tab ───────────────────────────────────────────────────────────────

function AccessTab({ policy, onSave }: { policy: AgentPolicy; onSave: (p: AgentPolicy) => Promise<void> }) {
  const [local, setLocal] = useState<AgentPolicy>({ ...policy });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const toggle = (key: keyof AgentPolicy) => {
    if (key === 'outboundScope') return;
    setLocal(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try { await onSave(local); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    finally { setSaving(false); }
  };

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#344453]/10 bg-white shadow-sm">
      <div className="border-b border-[#344453]/8 bg-[#344453]/3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-[#344453]/60" />
          <div>
            <p className="text-sm font-semibold text-[#141F28]">Droits par défaut des agents</p>
            <p className="text-xs text-[#344453]/50">Appliqué à tous les agents du tenant à la connexion.</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {POLICY_GROUPS.map(({ group, keys }) => (
          <div key={group}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
              {group}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map(({ key, label }) => (
                <label key={String(key)} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3 hover:bg-white transition select-none">
                  <span className="text-sm text-[#141F28]">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(local[key])}
                    onClick={() => toggle(key)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${local[key] ? 'bg-[#2D9D78]' : 'bg-[#344453]/20'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${local[key] ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Portée appels sortants */}
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
            Portée des appels sortants
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['own', 'all'] as const).map(v => (
              <button key={v} type="button" onClick={() => { setLocal(p => ({ ...p, outboundScope: v })); setSaved(false); }}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  local.outboundScope === v
                    ? 'border-[#344453] bg-[#344453] text-white'
                    : 'border-[#344453]/10 bg-[#F8F9FB] text-[#344453] hover:border-[#344453]/25'
                }`}>
                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  local.outboundScope === v ? 'border-white bg-white' : 'border-[#344453]/30'
                }`}>
                  {local.outboundScope === v && <span className="h-2 w-2 rounded-full bg-[#344453]" />}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {v === 'own' ? 'Ses propres appels uniquement' : 'Tous les appels sortants'}
                  </p>
                  <p className={`mt-0.5 text-xs ${local.outboundScope === v ? 'text-white/70' : 'text-[#344453]/50'}`}>
                    {v === 'own'
                      ? 'L\'agent ne voit que ses propres appels sortants.'
                      : 'L\'agent voit tous les appels sortants du tenant.'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => void save()} disabled={saving}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
            saved
              ? 'bg-[#2D9D78] text-white'
              : 'bg-[#344453] text-white hover:bg-[#2a3642] disabled:opacity-50'
          }`}>
          {saved
            ? <><Check className="h-4 w-4" /> Enregistré</>
            : saving
              ? 'Enregistrement…'
              : <><UserCog className="h-4 w-4" /> Enregistrer la politique</>}
        </button>
      </div>
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#344453]/10 bg-white px-6 py-14 text-center shadow-sm">
        <History className="h-10 w-10 text-[#344453]/20 mb-3" />
        <p className="text-sm font-medium text-[#141F28]">Aucune entrée dans le journal</p>
        <p className="mt-1 text-xs text-[#344453]/45">Les actions admin apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#344453]/10 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#344453]/8 bg-[#344453]/3">
            <th className={TH}>Action</th>
            <th className={`${TH} hidden sm:table-cell`}>Acteur</th>
            <th className={`${TH} hidden md:table-cell`}>Cible</th>
            <th className={`${TH} text-right`}>Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#344453]/5">
          {logs.map(log => (
            <tr key={log.id} className="transition hover:bg-[#344453]/2">
              <td className={TD}>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ACTION_COLORS[log.action] ?? 'bg-[#344453]/10 text-[#344453]'}`}>
                  {log.action}
                </span>
                <p className="mt-1 text-xs text-[#344453]/45 sm:hidden">{log.actor_email ?? 'Système'}</p>
              </td>
              <td className={`${TD} hidden sm:table-cell`}>
                <p className="text-sm text-[#344453]">{log.actor_email ?? 'Système'}</p>
                {log.actor_role && (
                  <p className="text-xs text-[#344453]/45">{ROLE_LABELS[log.actor_role] ?? log.actor_role}</p>
                )}
              </td>
              <td className={`${TD} hidden md:table-cell text-sm text-[#344453]/60`}>
                {log.target_label ?? log.entity_type}
              </td>
              <td className={`${TD} text-right text-xs text-[#344453]/50`}>{fmt(log.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function SettingsTeamAccess() {
  const { user } = useAuth();
  const [tab, setTab]     = useState<Tab>('membres');
  const [loading, setLoading] = useState(true);

  const [members, setMembers]                   = useState<Member[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [unlinkedStaff, setUnlinkedStaff]        = useState<UnlinkedStaff[]>([]);
  const [policy, setPolicy]                     = useState<AgentPolicy | null>(null);
  const [logs, setLogs]                         = useState<AuditLog[]>([]);

  const [inviteModal, setInviteModal] = useState<{ open: boolean; defaultStaffId?: string }>({ open: false });
  const [inviteUrl, setInviteUrl]     = useState('');
  const [toast, setToast]             = useState('');

  const canManage   = Boolean(user?.permissions?.memberManage);
  const canReadLogs = Boolean(user?.permissions?.auditLogsRead);
  const isOwner     = user?.role === 'owner';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const requests: Promise<any>[] = [
        axios.get('/api/members'),
        axios.get('/api/members/access-policy'),
      ];
      if (canReadLogs) requests.push(axios.get('/api/members/audit-logs'));

      const [membersRes, policyRes, logsRes] = await Promise.all(requests);
      setMembers(membersRes.data.members || []);
      setPendingInvitations(membersRes.data.pendingInvitations || []);
      setUnlinkedStaff(membersRes.data.unlinkedStaff || []);
      setPolicy(policyRes.data.agent || null);
      if (logsRes) setLogs(logsRes.data.logs || []);
    } catch {
      showToast('Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleMemberUpdate = async (id: string, payload: Record<string, unknown>) => {
    try {
      await axios.patch(`/api/members/${id}`, payload);
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Erreur lors de la mise à jour.');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await axios.post(`/api/members/invitations/${id}/revoke`);
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Erreur lors de la révocation.');
    }
  };

  const handleSavePolicy = async (p: AgentPolicy) => {
    await axios.put('/api/members/access-policy', { agent: p });
    await load();
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'membres', label: 'Membres', icon: Users,   badge: pendingInvitations.length || undefined },
    { id: 'acces',   label: 'Accès agents', icon: Shield  },
    ...(canReadLogs ? [{ id: 'journal' as Tab, label: 'Journal', icon: History }] : []),
  ];

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
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
              Équipe & accès
            </h1>
            <p className="mt-0.5 text-sm text-[#344453]/50">
              Membres, droits des agents et journal d'administration
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[#344453]/15 bg-white text-[#344453] hover:bg-[#344453]/5 transition shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-[16px] border border-[#344453]/10 bg-white p-1 shadow-sm">
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-[12px] py-2.5 text-sm font-medium transition ${
                tab === id ? 'bg-[#344453] text-white shadow-sm' : 'text-[#344453]/55 hover:bg-[#344453]/5'
              }`}>
              <Icon className="h-4 w-4" />
              {label}
              {badge ? (
                <span className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  tab === id ? 'bg-white text-[#344453]' : 'bg-[#C7601D] text-white'
                }`}>
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'membres' && (
          <MembersTab
            members={members}
            pendingInvitations={pendingInvitations}
            unlinkedStaff={unlinkedStaff}
            canManage={canManage}
            isOwner={isOwner}
            currentUserId={user?.id ?? ''}
            onRevoke={(id) => void handleRevoke(id)}
            onMemberUpdate={(id, payload) => void handleMemberUpdate(id, payload)}
            onInvite={(defaultStaffId) => setInviteModal({ open: true, defaultStaffId })}
          />
        )}
        {tab === 'acces' && policy && (
          <AccessTab policy={policy} onSave={handleSavePolicy} />
        )}
        {tab === 'journal' && (
          <AuditTab logs={logs} />
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#141F28] px-5 py-3 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}

        {/* Invite modal */}
        {inviteModal.open && (
          <InviteModal
            unlinkedStaff={unlinkedStaff}
            canInviteAdmin={isOwner}
            defaultStaffId={inviteModal.defaultStaffId}
            onClose={() => setInviteModal({ open: false })}
            onDone={(url) => {
              setInviteModal({ open: false });
              setInviteUrl(url);
              void load();
            }}
          />
        )}

        {/* Invite success */}
        {inviteUrl && (
          <InviteSuccess url={inviteUrl} onClose={() => setInviteUrl('')} />
        )}
      </div>
    </Layout>
  );
}
