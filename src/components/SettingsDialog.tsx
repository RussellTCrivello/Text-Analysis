import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Select, InlineTabs } from './ui';
import { useSettings } from '../store/SettingsContext';
import { useTranslation } from '../i18n';
import type { Density, Language, Theme } from '../types';

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState({ ...settings });
  const [tab, setTab] = useState('general');

  const set = <K extends keyof typeof draft>(k: K, v: typeof draft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const apply = () => { saveSettings(draft); onClose(); };
  const reset = () => setDraft({ ...settings });

  const tabs = [
    { id: 'general', label: t.settings.tabGeneral },
    { id: 'accessibility', label: t.settings.tabAccessibility },
    { id: 'performance', label: t.settings.tabPerformance },
  ];

  const langOpts: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
  ];
  const themeOpts: { value: Theme; label: string }[] = [
    { value: 'light', label: t.settings.themeLight },
    { value: 'dark', label: t.settings.themeDark },
  ];
  const densityOpts: { value: Density; label: string }[] = [
    { value: 'compact', label: t.settings.densityCompact },
    { value: 'comfortable', label: t.settings.densityComfortable },
    { value: 'expansive', label: t.settings.densityExpansive },
  ];
  const cbOpts = [
    { value: 'none', label: t.settings.colorBlindNone },
    { value: 'deuteranopia', label: t.settings.colorBlindDeuteranopia },
    { value: 'protanopia', label: t.settings.colorBlindProtanopia },
    { value: 'tritanopia', label: t.settings.colorBlindTritanopia },
  ];
  const pageSizeOpts = [25, 50, 100, 200, 500].map(n => ({ value: String(n), label: String(n) }));

  return (
    <InfoModal isOpen={isOpen} title={t.settings.title} onClose={onClose} size="md">
      <div className="flex flex-col gap-0" style={{ minHeight: 380 }}>
        <InlineTabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'general' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.settings.language}>
                <Select
                  value={draft.language}
                  onChange={e => set('language', e.target.value as Language)}
                  options={langOpts}
                />
              </Field>
              <Field label={t.settings.theme}>
                <Select
                  value={draft.theme}
                  onChange={e => set('theme', e.target.value as Theme)}
                  options={themeOpts}
                />
              </Field>
              <Field label={`${t.settings.fontSize} (px)`}>
                <input
                  type="range" min={11} max={18} step={1}
                  value={draft.fontSize}
                  onChange={e => set('fontSize', Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{draft.fontSize}px</span>
              </Field>
              <Field label={t.settings.density}>
                <Select
                  value={draft.density}
                  onChange={e => set('density', e.target.value as Density)}
                  options={densityOpts}
                />
              </Field>
            </div>
          )}

          {tab === 'accessibility' && (
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={draft.highContrast} onChange={e => set('highContrast', e.target.checked)} />
                <span className="text-sm">{t.settings.highContrast}</span>
              </label>
              <Field label={`${t.settings.fontScale} (${draft.fontScale}%)`}>
                <input
                  type="range" min={100} max={200} step={10}
                  value={draft.fontScale}
                  onChange={e => set('fontScale', Number(e.target.value))}
                  className="w-full"
                />
              </Field>
              <Field label={t.settings.colorBlindMode}>
                <Select
                  value={draft.colorBlindMode}
                  onChange={e => set('colorBlindMode', e.target.value as typeof draft.colorBlindMode)}
                  options={cbOpts}
                />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={draft.keyboardShortcuts} onChange={e => set('keyboardShortcuts', e.target.checked)} />
                <span className="text-sm">{t.settings.keyboardShortcuts}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={draft.focusIndicator} onChange={e => set('focusIndicator', e.target.checked)} />
                <span className="text-sm">{t.settings.focusIndicator}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={(draft as typeof draft & { screenReader?: boolean }).screenReader ?? true} onChange={e => set('screenReader', e.target.checked)} />
                <span className="text-sm">Screen Reader Support</span>
              </label>
            </div>
          )}

          {tab === 'performance' && (
            <div className="flex flex-col gap-4">
              <Field label={t.settings.defaultPageSize}>
                <Select
                  value={String(draft.defaultPageSize)}
                  onChange={e => set('defaultPageSize', Number(e.target.value))}
                  options={pageSizeOpts}
                />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={draft.autoSave} onChange={e => set('autoSave', e.target.checked)} />
                <span className="text-sm">{t.settings.autoSave}</span>
              </label>
              {draft.autoSave && (
                <Field label={`${t.settings.autoSaveInterval} (${t.settings.seconds})`}>
                  <input
                    type="number" min={10} max={300} step={5}
                    value={draft.autoSaveInterval}
                    onChange={e => set('autoSaveInterval', Number(e.target.value))}
                    className="w-full rounded border px-2.5 py-1.5 text-sm outline-none"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                  />
                </Field>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Btn onClick={reset}>{t.settings.resetDefaults}</Btn>
          <Btn onClick={onClose}>{t.actions.cancel}</Btn>
          <Btn variant="primary" onClick={apply}>{t.settings.applySettings}</Btn>
        </div>
      </div>
    </InfoModal>
  );
}
