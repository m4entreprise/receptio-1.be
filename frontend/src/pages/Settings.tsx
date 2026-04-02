import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

export default function Settings() {
  const [company, setCompany] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await axios.get('/api/companies/me');
      setCompany(response.data.company);
      setFormData({
        name: response.data.company.name || '',
        phoneNumber: response.data.company.phone_number || '',
      });
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await axios.patch('/api/companies/me', formData);
      setMessage('Paramètres sauvegardés avec succès');
      fetchCompany();
    } catch (error) {
      setMessage('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les informations de votre entreprise
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center">
              <Building2 className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">
                Informations entreprise
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
            {message && (
              <div className={`rounded-md p-4 ${
                message.includes('succès') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Numéro de téléphone Twilio
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+32 470 12 34 56"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <p className="mt-2 text-sm text-gray-500">
                Ce numéro sert à associer les appels entrants Twilio à votre entreprise.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Informations du compte</h3>
              <dl className="space-y-1">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Email:</dt>
                  <dd className="text-gray-900">{company?.email}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Créé le:</dt>
                  <dd className="text-gray-900">
                    {company?.created_at && new Date(company.created_at).toLocaleDateString('fr-BE')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
