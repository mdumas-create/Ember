import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface ConfigContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  isFeatureEnabled: (flag: string) => boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('config/flags');
      setFlags(res.data);
    } catch (e) {
      console.error('Failed to fetch flags:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [user?.id]);

  const isFeatureEnabled = (flag: string) => !!flags[flag];

  return (
    <ConfigContext.Provider value={{ flags, loading, isFeatureEnabled }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

