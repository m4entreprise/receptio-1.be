import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface SuperAdmin {
  id: string;
  email: string;
  name?: string;
}

interface SuperAuthContextType {
  admin: SuperAdmin | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const SuperAuthContext = createContext<SuperAuthContextType | undefined>(undefined);

export function SuperAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<SuperAdmin | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sa_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const stored = localStorage.getItem('sa_admin');
      if (stored) setAdmin(JSON.parse(stored));
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, password: string) => {
    const { data } = await axios.post('/api/super/auth/login', { email, password });
    setToken(data.token);
    setAdmin(data.admin);
    localStorage.setItem('sa_token', data.token);
    localStorage.setItem('sa_admin', JSON.stringify(data.admin));
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_admin');
  };

  return (
    <SuperAuthContext.Provider value={{ admin, token, login, logout, isLoading }}>
      {children}
    </SuperAuthContext.Provider>
  );
}

export function useSuperAuth() {
  const ctx = useContext(SuperAuthContext);
  if (!ctx) throw new Error('useSuperAuth must be used within SuperAuthProvider');
  return ctx;
}
