/**
 * Settings — full information-architecture redesign.
 * Settings are grouped into three sections (General, Accessibility,
 * Performance) reached from a vertical section nav. Every control maps to a
 * real design-system component; the footer surfaces unsaved changes and the
 * apply/reset contract. All previously available settings remain functional.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui';
import { Btn, Field, Input, Select, Segmented, Switch } from './ui';
import { IconSliders, IconAccessibility, IconGauge, IconRefresh, IconSuccess, IconThemeLight, IconThemeDark } from './icons';
import { useSettings } from '../store/SettingsContext';
import { useTranslation } from '../i18n';
import type { Density, Language, Theme } from '../types';

type Section = 'general' | 'accessibility' | 'performance';

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState({ ...settings });
  const [section, setSection] = useState<Section>('general');
  const [saved, setSaved] = useState(false);

  // Re-seed the draft whenever the dialog opens so stale edits never linger.
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...settings });
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const set = <K extends keyof typeof draft>(k: K, v: typeof draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const apply = () => {
    saveSettings(draft);
    setSaved(true);
    window.setTimeout(onClose, 350);
  };
  const reset = () => setDraft({ ...settings });

  const sections: { id: Section; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'general', label: t.settings.tabGeneral, desc: t.settings.generalDesc, icon: <IconSliders size="sm" /> },
    { id: 'accessibility', label: t.settings.tabAccessibility, desc: t.settings.accessibilityDesc, icon: <IconAccessibility size="sm" /> },
    { id: 'performance', label: t.settings.tabPerformance, desc: t.settings.performanceDesc, icon: <IconGauge size="sm" /> },
  ];

  const langOpts: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
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
  const pageSizeOpts = [25, 50, 100, 200, 500].map((n) => ({ value: String(n), label: String(n) }));

  /** One consistent setting row: label + description on the left, control on the right. */
  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{label}</div>
        {hint && <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-fg)' }}>{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.title}
      size="lg"
      footer={
        <>
          {dirty && !saved && (
            <span className="me-auto text-[11px] flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--warning)' }} />
              {t.settings.unsaved}
            </span>
          )}
          {saved && !dirty && (
            <span className="me-auto text-[11px] flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
              <IconSuccess size="xs" />
              {t.settings.applySettings}
            </span>
          )}
          <Btn variant="ghost" onClick={reset} disabled={!dirty} icon={<IconRefresh size="xs" />}>{t.settings.resetDefaults}</Btn>
          <Btn variant="ghost" onClick={onClose}>{t.actions.cancel}</Btn>
          <Btn variant="primary" onClick={apply} disabled={!dirty}>{t.settings.applySettings}</Btn>
        </>
      }
    >
      <div className="flex flex-col sm:flex-row gap-4" style={{ minHeight: 340 }}>
        {/* Section nav */}
        <nav aria-label={t.settings.title} className="flex flex-row sm:flex-col gap-1 shrink-0 overflow-x-auto" style={{ width: 'auto', minWidth: 0 }}>
          {sections.map((sec) => {
            const active = section === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setSection(sec.id)}
                aria-current={active ? 'true' : undefined}
                className="flex items-start gap-2.5 text-start px-3 py-2 rounded-[var(--radius)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{ background: active ? 'var(--primary-soft)' : 'transparent', color: active ? 'var(--primary)' : 'var(--fg-soft)' }}
              >
                <span className="mt-0.5 inline-flex">{sec.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold whitespace-nowrap" style={{ fontFamily: 'var(--font-display)' }}>{sec.label}</span>
                  <span className="hidden sm:block text-[10.5px] leading-snug" style={{ color: 'var(--muted-fg)' }}>{sec.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Section body */}
        <div className="flex-1 min-w-0 overflow-y-auto pe-1" style={{ maxHeight: 430 }}>
          {section === 'general' && (
            <div className="flex flex-col">
              <Row label={t.settings.language} hint={t.settings.generalDesc}>
                <Select value={draft.language} onChange={(e) => set('language', e.target.value as Language)} options={langOpts} className="!w-40" />
              </Row>
              <Row label={t.settings.theme}>
                <Segmented
                  value={draft.theme}
                  onChange={(v) => set('theme', v as Theme)}
                  options={[
                    { value: 'light', label: t.settings.themeLight },
                    { value: 'dark', label: t.settings.themeDark },
                  ]}
                />
              </Row>
              <Row label={t.settings.fontSize} hint={`${draft.fontSize}px`}>
                <input
                  type="range" min={11} max={18} step={1}
                  value={draft.fontSize}
                  onChange={(e) => set('fontSize', Number(e.target.value))}
                  className="w-40"
                  aria-label={t.settings.fontSize}
                />
              </Row>
              <Row label={t.settings.density}>
                <Segmented value={draft.density} onChange={(v) => set('density', v as Density)} options={densityOpts} />
              </Row>
            </div>
          )}

          {section === 'accessibility' && (
            <div className="flex flex-col">
              <Row label={t.settings.highContrast}>
                <Switch checked={draft.highContrast} onChange={(v) => set('highContrast', v)} />
              </Row>
              <Row label={t.settings.fontScale} hint={`${draft.fontScale}%`}>
                <input
                  type="range" min={100} max={200} step={10}
                  value={draft.fontScale}
                  onChange={(e) => set('fontScale', Number(e.target.value))}
                  className="w-40"
                  aria-label={t.settings.fontScale}
                />
              </Row>
              <Row label={t.settings.colorBlindMode}>
                <Select
                  value={draft.colorBlindMode}
                  onChange={(e) => set('colorBlindMode', e.target.value as typeof draft.colorBlindMode)}
                  options={cbOpts}
                  className="!w-48"
                />
              </Row>
              <Row label={t.settings.keyboardShortcuts} hint="Ctrl+1…8 · F1">
                <Switch checked={draft.keyboardShortcuts} onChange={(v) => set('keyboardShortcuts', v)} />
              </Row>
              <Row label={t.settings.focusIndicator}>
                <Switch checked={draft.focusIndicator} onChange={(v) => set('focusIndicator', v)} />
              </Row>
              <Row label={t.settings.screenReader}>
                <Switch checked={draft.screenReader} onChange={(v) => set('screenReader', v)} />
              </Row>
            </div>
          )}

          {section === 'performance' && (
            <div className="flex flex-col">
              <Row label={t.settings.defaultPageSize}>
                <Select
                  value={String(draft.defaultPageSize)}
                  onChange={(e) => set('defaultPageSize', Number(e.target.value))}
                  options={pageSizeOpts}
                  className="!w-28"
                />
              </Row>
              <Row label={t.settings.autoSave}>
                <Switch checked={draft.autoSave} onChange={(v) => set('autoSave', v)} />
              </Row>
              {draft.autoSave && (
                <Row label={t.settings.autoSaveInterval} hint={t.settings.seconds}>
                  <Input
                    type="number" min={10} max={300} step={5}
                    value={draft.autoSaveInterval}
                    onChange={(e) => set('autoSaveInterval', Number(e.target.value))}
                    className="!w-24"
                  />
                </Row>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
