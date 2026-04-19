import { Navigate } from 'react-router-dom';
import { useSuperAuth } from '../../contexts/SuperAuthContext';

export default function PrivateAdminRoute({ children }: { children: React.ReactNode }) {
  const { admin, isLoading } = useSuperAuth();
  if (isLoading) return null;
  return admin ? <>{children}</> : <Navigate to="/admin/login" replace />;
}
