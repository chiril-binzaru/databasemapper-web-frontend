import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { THEME_MODE_STORAGE_KEY, ThemeModeContext } from '../hooks/useThemeMode';
import type { ThemeMode } from '../hooks/useThemeMode';

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export default function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    setModeState(nextMode);
  }, []);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}
