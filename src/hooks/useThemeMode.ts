import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'dbmapper-theme-mode';

export interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }

  return context;
}
