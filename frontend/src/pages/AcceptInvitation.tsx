import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage('Lien d’invitation invalide.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post('/api/auth/accept-invitation', {
        token,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      window.location.replace('/dashboard');
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Impossible d’accepter l’invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] px-4 py-10 text-[#141F28]" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="mx-auto max-w-md rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
          Activer votre compte
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#344453]/55">
          Définissez votre mot de passe pour rejoindre l’espace entreprise.
        </p>
        {message && (
          <div className="mt-5 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453]">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Prénom"
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              className="rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              placeholder="Nom"
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              className="rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
            />
          </div>
          <input
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            required
            minLength={8}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!token || loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Activation…' : 'Activer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
