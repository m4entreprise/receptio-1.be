import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

interface Stats {
  total: number;
  today: number;
  answered: number;
  pending: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, answered: 0, pending: 0 });
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [callsRes] = await Promise.all([
        axios.get('/api/calls?limit=5'),
      ]);

      const calls = callsRes.data.calls || [];
      setRecentCalls(calls);

      const today = new Date().toDateString();
      const todayCalls = calls.filter((c: any) => 
        new Date(c.created_at).toDateString() === today
      );

      setStats({
        total: callsRes.data.total || 0,
        today: todayCalls.length,
        answered: calls.filter((c: any) => c.status === 'completed').length,
        pending: calls.filter((c: any) => c.status === 'received').length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total appels', value: stats.total, icon: Phone, color: 'bg-blue-500' },
    { label: 'Aujourd\'hui', value: stats.today, icon: Clock, color: 'bg-green-500' },
    { label: 'Traités', value: stats.answered, icon: CheckCircle, color: 'bg-purple-500' },
    { label: 'En attente', value: stats.pending, icon: AlertCircle, color: 'bg-orange-500' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d'ensemble de vos appels
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {stat.label}
                        </dt>
                        <dd className="text-2xl font-semibold text-gray-900">
                          {stat.value}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Appels récents
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {recentCalls.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun appel pour le moment</p>
            ) : (
              <div className="space-y-4">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    to={`/calls/${call.id}`}
                    className="block hover:bg-gray-50 rounded-lg p-4 border border-gray-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {call.caller_number || 'Numéro inconnu'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(call.created_at).toLocaleString('fr-BE')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {call.transcription_text && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Transcrit
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          call.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {call.status === 'completed' ? 'Terminé' : 'En cours'}
                        </span>
                      </div>
                    </div>
                    {call.transcription_text && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {call.transcription_text}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
