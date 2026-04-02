import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Search, Filter } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

export default function Calls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCalls();
  }, [statusFilter]);

  const fetchCalls = async () => {
    try {
      const params: any = { limit: 100 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await axios.get('/api/calls', { params });
      setCalls(response.data.calls || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    const matchesSearch = 
      call.caller_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.transcription_text?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appels</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez tous vos appels entrants
            </p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou transcription..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="received">Reçus</option>
                  <option value="completed">Terminés</option>
                  <option value="answered">Répondus</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredCalls.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>Aucun appel trouvé</p>
              </div>
            ) : (
              filteredCalls.map((call) => (
                <Link
                  key={call.id}
                  to={`/calls/${call.id}`}
                  className="block hover:bg-gray-50 transition p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {call.caller_number || 'Numéro inconnu'}
                          </p>
                          {call.transcription_text && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Transcrit
                            </span>
                          )}
                          {call.summary && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Résumé IA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          {format(new Date(call.created_at), 'PPpp', { locale: fr })}
                          {call.duration > 0 && ` • ${call.duration}s`}
                        </p>
                        {call.transcription_text && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {call.transcription_text}
                          </p>
                        )}
                        {call.summary && (
                          <p className="text-sm text-gray-500 italic mt-1">
                            {call.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.status === 'completed' 
                          ? 'bg-blue-100 text-blue-800' 
                          : call.status === 'answered'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {call.status === 'completed' ? 'Terminé' : call.status === 'answered' ? 'Répondu' : 'Reçu'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
