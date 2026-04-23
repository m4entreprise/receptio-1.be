import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  companyId: string;
  role: string;
  status: 'invited' | 'active' | 'disabled';
  staffId?: string | null;
  firstName?: string;
  lastName?: string;
  permissions?: {
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
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

interface OnboardingData {
  sector?: string;
  companySize?: string;
  openDays?: string[];
  openFrom?: string;
  openUntil?: string;
  agentCount?: number;
  offer?: 'a' | 'b';
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName: string;
  companyPhone?: string;
  onboarding?: OnboardingData;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      axios.get('/api/auth/me')
        .then((response) => {
          const refreshedUser = response.data.user;
          setUser(refreshedUser);
          localStorage.setItem('user', JSON.stringify(refreshedUser));
        })
        .catch(() => {
        });
    }
    setIsLoading(false);
  }, [token]);

  // Déconnexion automatique si le JWT expire (401 depuis le backend)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await axios.post('/api/auth/login', { email, password });
    const { token: newToken, user: newUser } = response.data;
    
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const register = async (data: RegisterData) => {
    const response = await axios.post('/api/auth/register', data);
    const { token: newToken, user: newUser } = response.data;
    
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
