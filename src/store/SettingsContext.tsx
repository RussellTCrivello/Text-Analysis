import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppSettings, ColorBlindMode, Density, Language, Theme } from '../types';

const STORAGE_KEY = 'tam_settings';

const defaults: AppSettings = {
  language: 'en',
  theme: 'light',
  fontSize: 13,
  density: 'comfortable',
  highContrast: false,
  fontScale: 100,
  colorBlindMode: 'none',
  keyboardShortcuts: true,
  focusIndicator: true,
  screenReader: true,
  defaultPageSize: 50,
  autoSave: true,
  autoSaveInterval: 30,
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

interface SettingsCtx {
  settings: AppSettings;
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
  setFontSize: (n: number) => void;
  setDensity: (d: Density) => void;
  saveSettings: (s: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsCtx>({
  settings: defaults,
  setLanguage: () => {},
  setTheme: () => {},
  setFontSize: () => {},
  setDensity: () => {},
  saveSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
    document.documentElement.setAttribute('data-color-blind', settings.colorBlindMode);
  }, [settings]);

  const setLanguage = (language: Language) => setSettings(s => ({ ...s, language }));
  const setTheme = (theme: Theme) => setSettings(s => ({ ...s, theme }));
  const setFontSize = (fontSize: number) => setSettings(s => ({ ...s, fontSize }));
  const setDensity = (density: Density) => setSettings(s => ({ ...s, density }));
  const saveSettings = (patch: Partial<AppSettings>) => setSettings(s => ({ ...s, ...patch }));

  return (
    <SettingsContext.Provider value={{ settings, setLanguage, setTheme, setFontSize, setDensity, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
