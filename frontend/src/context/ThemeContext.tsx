import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, ThemeMode, darkColors, lightColors } from '../utils/theme';

type ThemeContextData = {
  mode: ThemeMode;
  colors: typeof lightColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

const getItem = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
};

const setItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await getItem('themeMode');
      const initial = stored === 'dark' ? 'dark' : 'light';
      applyTheme(initial);
      setModeState(initial);
      setReady(true);
    };
    load().catch(() => {
      applyTheme('light');
      setReady(true);
    });
  }, []);

  const setMode = async (next: ThemeMode) => {
    applyTheme(next);
    setModeState(next);
    await setItem('themeMode', next);
  };

  const toggle = async () => {
    await setMode(mode === 'dark' ? 'light' : 'dark');
  };

  const colors = mode === 'dark' ? darkColors : lightColors;
  const value = useMemo(() => ({ mode, colors, setMode, toggle, ready }), [mode, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => useContext(ThemeContext);
