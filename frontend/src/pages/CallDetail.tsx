import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Clock, Calendar, ArrowLeft, Trash2, Download } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

export default function CallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCallDetail();
  }, [id]);

  const fetchCallDetail = async () => {
    try {
      const response = await axios.get(`/api/calls/${id}`);
      setCall(response.data.call);
    } catch (error) {
      console.error('Error fetching call detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet appel ?')) return;
    
    setDeleting(true);
    try {
      await axios.delete(`/api/calls/${id}`);
      navigate('/calls');
    } catch (error) {
      console.error('Error deleting call:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (!call) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Appel non trouvé</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/calls')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour aux appels
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Détails de l'appel
            </h1>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Numéro</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {call.caller_number || 'Inconnu'}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(call.created_at), 'PPpp', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Durée</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {call.duration ? `${call.duration} secondes` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {call.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Résumé IA</h3>
                <p className="text-sm text-blue-800">{call.summary}</p>
                {call.intent && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Intention: {call.intent}
                    </span>
                  </div>
                )}
              </div>
            )}

            {call.transcription_text && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Transcription</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {call.transcription_text}
                  </p>
                  {call.language && (
                    <p className="mt-2 text-xs text-gray-500">
                      Langue détectée: {call.language.toUpperCase()}
                      {call.confidence && ` • Confiance: ${(call.confidence * 100).toFixed(0)}%`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {call.recording_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Enregistrement audio</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <audio controls className="w-full">
                    <source src={call.recording_url} type="audio/mpeg" />
                    Votre navigateur ne supporte pas l'élément audio.
                  </audio>
                  <a
                    href={call.recording_url}
                    download
                    className="mt-3 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger l'enregistrement
                  </a>
                </div>
              </div>
            )}

            {call.actions && call.actions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Actions effectuées</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <ul className="space-y-2">
                    {call.actions.map((action: any, index: number) => (
                      <li key={index} className="text-sm text-gray-700">
                        • {action.type}: {action.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
