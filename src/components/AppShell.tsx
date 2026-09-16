import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { useSettings } from '../store/SettingsContext';
import { useAppData } from '../store/AppContext';
import { SettingsDialog } from './SettingsDialog';
import { BackupDialog } from './BackupDialog';
import { ResetDialog } from './ResetDialog';
import { HelpDialog } from './HelpDialog';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PrintHeaderSettings } from './PrintHeaderSettings';
import { AttachmentManager } from './AttachmentManager';
import { ImportWizard } from './ImportWizard';
import { InfoModal } from './FormModal';
import { SearchInput } from './ui';
import type { NavSection } from '../types';

/* ── Nav icon set – thin geometric, consistent weight ─────────────────── */
const NAV_ICONS: Record<NavSection, React.ReactNode> = {
  sources: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 4v4l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  contents: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  analysis: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12L6 7l3 3 2.5-4L14 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  allData: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  timeline: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="5.5" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="10.5" cy="8" r="1.5" fill="currentColor"/>
      <path d="M5.5 5v1.5M10.5 9.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  activity: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8h3l1.5-4 2.5 8L11 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  dictionary: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h4.5A1.5 1.5 0 0 1 9 4.5V13a1.5 1.5 0 0 0-1.5-1.5H3V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M13 3H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 3v8.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  reports: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 9.5l2-3 2 2 2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

interface Props {
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
  children: ReactNode;
  toast: string;
  onToastClear: () => void;
  globalSearch?: string;
  onGlobalSearch?: (v: string) => void;
  onQuickAdd?: () => void;
}

export function AppShell({ activeSection, onSectionChange, children, toast, onToastClear, globalSearch = '', onGlobalSearch, onQuickAdd }: Props) {
  const { t } = useTranslation();
  const { settings, setTheme, saveSettings } = useSettings();
  const appCtx = useAppData();
  const data = appCtx.data ?? { sources: [], contents: [], analyses: [] };
  const { loadSampleData, clearAllData } = appCtx;

  const [showSettings, setShowSettings] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrintHeader, setShowPrintHeader] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [attachmentTarget, setAttachmentTarget] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(toast);
  const toolsRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToastMsg(toast);
    if (toast) {
      const t2 = setTimeout(onToastClear, 3200);
      return () => clearTimeout(t2);
    }
  }, [toast, onToastClear]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setToolsOpen(false); setHelpOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

/**
   * Views request the attachment manager through this event so the dialog can
   * stay mounted once in the shell while still opening on a specific record.
   */
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ contentId?: string }>).detail;
      setAttachmentTarget(detail?.contentId);
      setShowAttachments(true);
    };
    window.addEventListener('tam:open-attachments', handler);
    return () => window.removeEventListener('tam:open-attachments', handler);
  }, []);

  useEffect(() => {
    if (!settings.keyboardShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === '1') { e.preventDefault(); onSectionChange('sources'); }
      else if (ctrl && e.key === '2') { e.preventDefault(); onSectionChange('contents'); }
      else if (ctrl && e.key === '3') { e.preventDefault(); onSectionChange('analysis'); }
      else if (ctrl && e.key === '4') { e.preventDefault(); onSectionChange('allData'); }
      else if (ctrl && e.key === '5') { e.preventDefault(); onSectionChange('timeline'); }
      else if (ctrl && e.key === '6') { e.preventDefault(); onSectionChange('reports'); }
      else if (ctrl && e.key === '7') { e.preventDefault(); onSectionChange('activity'); }
      else if (ctrl && e.key === '8') { e.preventDefault(); onSectionChange('dictionary'); }
      else if (e.key === 'F1') { e.preventDefault(); setShowHelp(true); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [settings.keyboardShortcuts, onSectionChange]);

  const navItems: { id: NavSection; label: string; desc: string }[] = [
    { id: 'sources', label: t.nav.sources, desc: t.nav.sourcesDesc },
    { id: 'contents', label: t.nav.contents, desc: t.nav.contentsDesc },
    { id: 'analysis', label: t.nav.analysis, desc: t.nav.analysisDesc },
    { id: 'allData', label: t.nav.allData, desc: t.nav.allDataDesc },
    { id: 'timeline', label: t.nav.timeline, desc: t.nav.timelineDesc },
    { id: 'reports', label: t.nav.reports, desc: t.nav.reportsDesc },
    { id: 'activity', label: t.nav.activity, desc: t.nav.activityDesc },
    { id: 'dictionary', label: t.nav.dictionary, desc: t.nav.dictionaryDesc },
  ];

  const opsItems = [
    { icon: '📎', label: t.ops.attachments, onClick: () => setShowAttachments(true) },
    { icon: '💾', label: t.ops.backup, onClick: () => setShowBackup(true) },
    { icon: '📥', label: t.ops.importData, onClick: () => setShowImport(true) },
    { icon: '⚙', label: t.ops.settings, onClick: () => setShowSettings(true) },
    { icon: '?', label: t.ops.help, onClick: () => setShowShortcuts(true) },
  ];

  const currentSection = navItems.find(n => n.id === activeSection);

  /* ── Shared menu dropdown ──────────────────────────────────────────── */
  const Dropdown = ({ open, toggle, label, dropRef, children }: {
    open: boolean; toggle: () => void; label: string; dropRef: React.RefObject<HTMLDivElement | null>; children: ReactNode;
  }) => (
    <div className="relative" ref={dropRef}>
      <button
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-0.5 px-2.5 py-1 text-[11px] font-medium rounded-[4px] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.5)]"
        style={{
          color: open ? '#fff' : 'rgba(255,255,255,0.6)',
          background: open ? 'rgba(255,255,255,0.1)' : 'transparent',
          letterSpacing: '0.01em',
          fontFamily: 'var(--font-display)',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
      >
        {label}
        <svg width="9" height="9" viewBox="0 0 10 6" fill="none" className="ms-0.5 opacity-60" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full mt-1 z-50 overflow-hidden min-w-[200px] py-1"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
            insetInlineStart: 0,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );

  const DropItem = ({ label, onClick, danger, icon }: { label: string; onClick: () => void; danger?: boolean; icon?: string }) => (
    <button
      role="menuitem"
      onClick={() => { onClick(); setToolsOpen(false); setHelpOpen(false); }}
      className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors hover:bg-[var(--muted-bg)] focus-visible:outline-none focus-visible:bg-[var(--muted-bg)]"
      style={{ color: danger ? 'var(--error)' : 'var(--fg)', fontFamily: 'var(--font-body)' }}
    >
      {icon && <span className="opacity-70 text-sm leading-none" aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );

  const DropSep = () => <div className="mx-3 my-1" role="separator" style={{ height: 1, background: 'var(--border)' }} />;

  const totalRecords = data.sources.length + data.contents.length + data.analyses.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>

      {/* ── Application header ── */}
      <header
        className="flex items-center gap-1 px-3 shrink-0"
        style={{ background: 'var(--sidebar-bg)', height: 44, color: '#fff' }}
      >
        {/* Logo mark + wordmark */}
        <div className="flex items-center gap-2 me-2 shrink-0">
          <div
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span
            className="text-[12px] font-bold"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}
          >
            {t.app.name}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Menu bar */}
        <Dropdown open={toolsOpen} toggle={() => { setToolsOpen(o => !o); setHelpOpen(false); }} label={t.menus.tools} dropRef={toolsRef}>
          <DropItem icon="⚙" label={t.menus.settings} onClick={() => setShowSettings(true)} />
          <DropItem icon="💾" label={t.menus.backupRestore} onClick={() => setShowBackup(true)} />
          <DropItem icon="📥" label={t.menus.importData} onClick={() => setShowImport(true)} />
          <DropItem icon="📎" label={t.ops.attachments} onClick={() => setShowAttachments(true)} />
          <DropSep />
          <DropItem icon="📊" label={t.actions.loadSample} onClick={() => { loadSampleData(); setToastMsg(t.messages.loadingSample); }} />
          <DropItem icon="🖨" label={t.menus.printSettings} onClick={() => setShowPrintHeader(true)} />
          <DropItem icon="📚" label={t.nav.dictionary} onClick={() => onSectionChange('dictionary')} />
          <DropItem icon="📈" label={t.nav.activity} onClick={() => onSectionChange('activity')} />
          <DropItem icon="⚡" label={t.menus.performanceMonitor} onClick={() => setShowPerf(true)} />
          <DropSep />
          <DropItem icon="🗑" label={t.menus.reset} onClick={() => setShowReset(true)} danger />
        </Dropdown>

        <Dropdown open={helpOpen} toggle={() => { setHelpOpen(o => !o); setToolsOpen(false); }} label={t.menus.help} dropRef={helpRef}>
          <DropItem icon="❓" label={t.menus.helpDoc} onClick={() => setShowHelp(true)} />
          <DropItem icon="⌨" label={t.menus.shortcuts} onClick={() => setShowShortcuts(true)} />
          <DropItem icon="ℹ" label={t.menus.about} onClick={() => setShowAbout(true)} />
        </Dropdown>

        {/* Global search — centered */}
        <div className="flex-1 flex justify-center px-6">
          <div style={{ width: 300 }}>
            <SearchInput
              value={globalSearch}
              onChange={onGlobalSearch ?? (() => {})}
              placeholder={`${t.actions.search} all records…`}
            />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 ms-auto shrink-0">
          {/* Quick Add */}
          <button
            onClick={onQuickAdd}
            aria-label={t.actions.addNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.5)]"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.01em',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {t.actions.addNew}
          </button>

          {/* Divider */}
          <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Language toggle */}
          {(['en', 'ar'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => saveSettings({ language: lang })}
              className="px-2 py-1 text-[10px] font-bold rounded transition-all duration-100"
              style={{
                color: settings.language === lang ? '#fff' : 'rgba(255,255,255,0.35)',
                background: settings.language === lang ? 'rgba(255,255,255,0.12)' : 'transparent',
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-7 h-7 flex items-center justify-center rounded transition-all duration-100 hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.5)]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {settings.theme === 'dark' ? (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5L4.5 4.5M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 9A5 5 0 117 3c0 .5.1 1 .2 1.5A4 4 0 1013 9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t.ops.settings}
            className="w-7 h-7 flex items-center justify-center rounded transition-all duration-100 hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.5)]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <nav
          aria-label={t.nav.sources ? 'Main navigation' : 'Main navigation'}
          className="flex flex-col h-full shrink-0 overflow-hidden"
          style={{
            width: sidebarCollapsed ? 48 : 196,
            background: 'var(--sidebar-bg)',
            color: 'var(--sidebar-fg)',
            transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
            borderInlineEnd: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="main-sidebar-nav"
            className="flex items-center justify-end pe-3 h-8 text-xs transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]"
            style={{
              color: 'rgba(255,255,255,0.25)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
              style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Workspace label */}
          {!sidebarCollapsed && (
            <div className="px-3 pt-4 pb-2">
              <span
                className="text-[9px] font-bold uppercase"
                style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}
              >Workspace</span>
            </div>
          )}

          {/* Nav items */}
          <div id="main-sidebar-nav" className="flex-1 overflow-y-auto">
            {navItems.map((item, idx) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={sidebarCollapsed ? item.label : undefined}
                  className="w-full flex items-center gap-2.5 py-2 text-sm transition-all duration-100 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]"
                  style={{
                    paddingInlineStart: sidebarCollapsed ? 16 : 12,
                    paddingInlineEnd: sidebarCollapsed ? 16 : 12,
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                    color: active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-fg)',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Active indicator */}
                  {active && (
                    <span
                      className="absolute start-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                  )}
                  <span className="shrink-0 opacity-80">{NAV_ICONS[item.id]}</span>
                  {!sidebarCollapsed && (
                    <div className="flex-1 text-start min-w-0 flex items-center justify-between">
                      <span
                        className="text-[12px] truncate"
                        style={{ fontFamily: 'var(--font-display)', fontWeight: active ? 600 : 400, letterSpacing: '-0.01em' }}
                      >{item.label}</span>
                      {active && (
                        <span
                          className="text-[9px] font-mono shrink-0 ms-1 opacity-50"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >⌃{idx + 1}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Operations section */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {!sidebarCollapsed && (
              <div className="px-3 pt-3 pb-1.5">
                <span
                  className="text-[9px] font-bold uppercase"
                  style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}
                >{t.ops.title}</span>
              </div>
            )}
            {opsItems.map(item => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-2.5 py-1.5 text-xs transition-all duration-100"
                style={{
                  paddingInlineStart: sidebarCollapsed ? 16 : 12,
                  paddingInlineEnd: 12,
                  color: 'rgba(255,255,255,0.38)',
                }}
                title={sidebarCollapsed ? item.label : ''}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)'; }}
              >
                <span className="shrink-0 text-sm leading-none">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="truncate text-[11px]" style={{ fontFamily: 'var(--font-display)' }}>{item.label}</span>
                )}
              </button>
            ))}
          </div>

          {/* Stats footer */}
          {!sidebarCollapsed && (
            <div
              className="px-3 py-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex gap-3">
                {[
                  { label: 'S', value: data.sources.length, color: 'var(--color-source)' },
                  { label: 'C', value: data.contents.length, color: 'var(--color-content)' },
                  { label: 'A', value: data.analyses.length, color: 'var(--color-analysis)' },
                ].map(stat => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold" style={{ color: stat.color, opacity: 0.8, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{stat.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Context breadcrumb header */}
          <div
            className="flex items-center px-4 shrink-0 gap-2"
            style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', height: 36 }}
          >
            <span className="text-[11px]" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
              {t.app.name}
            </span>
            <span style={{ color: 'var(--border)', fontSize: 14 }}>›</span>
            <span
              className="text-[12px] font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)', letterSpacing: '-0.01em' }}
            >
              {currentSection?.label}
            </span>
            {currentSection?.desc && (
              <span className="text-[11px] ms-1" style={{ color: 'var(--muted-fg)' }}>
                — {currentSection.desc}
              </span>
            )}
          </div>

          {/* Active view */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      {/* ── Status bar ── */}
      <footer
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          background: 'var(--sidebar-bg)',
          height: 22,
          color: 'rgba(255,255,255,0.28)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: '0.04em',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>{t.app.name} <span style={{ opacity: 0.5 }}>{t.app.version}</span></span>
        <div className="flex items-center gap-3">
          <span>
            <span style={{ color: 'var(--color-source)' }}>S</span>:{data.sources.length}
            <span className="mx-1" style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: 'var(--color-content)' }}>C</span>:{data.contents.length}
            <span className="mx-1" style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: 'var(--color-analysis)' }}>A</span>:{data.analyses.length}
            <span className="mx-1 ms-2" style={{ opacity: 0.3 }}>|</span>
            <strong style={{ color: 'rgba(255,255,255,0.45)' }}>{totalRecords}</strong> records
          </span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{settings.language.toUpperCase()}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{settings.theme}</span>
        </div>
      </footer>

      {/* ── Dialogs ── */}
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <BackupDialog isOpen={showBackup} onClose={() => setShowBackup(false)} onToast={msg => setToastMsg(msg)} />

      <InfoModal isOpen={showAbout} title={t.about.title} onClose={() => setShowAbout(false)} size="md">
        <div className="flex flex-col gap-3 text-sm">
          <p style={{ color: 'var(--muted-fg)' }}>{t.about.version}</p>
          <p>{t.about.description}</p>
          <p style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>{t.about.built}</p>
        </div>
      </InfoModal>

      <InfoModal isOpen={showShortcuts} title={t.shortcuts.title} onClose={() => setShowShortcuts(false)} size="md">
        <div className="flex flex-col gap-0.5">
          {Object.entries(t.shortcuts).filter(([k]) => k !== 'title').map(([k, v]) => {
            const parts = (v as string).split(' — ');
            return (
              <div key={k} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span
                  className="text-[11px] font-medium rounded px-2 py-0.5 shrink-0"
                  style={{ background: 'var(--secondary-bg)', fontFamily: 'var(--font-mono)', minWidth: 100 }}
                >
                  {parts[0]}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{parts[1]}</span>
              </div>
            );
          })}
        </div>
      </InfoModal>

      <PerformanceMonitor isOpen={showPerf} onClose={() => setShowPerf(false)} />
      <ResetDialog
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        onResetData={() => { clearAllData(); setToastMsg('All data cleared.'); }}
        onResetAll={() => { clearAllData(); saveSettings({ theme: 'light', language: 'en' }); setToastMsg('Database reset complete.'); }}
      />
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <PrintHeaderSettings isOpen={showPrintHeader} onClose={() => setShowPrintHeader(false)} onToast={msg => setToastMsg(msg)} />
      <AttachmentManager
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        onToast={msg => setToastMsg(msg)}
        initialContentId={attachmentTarget}
      />
      <ImportWizard isOpen={showImport} onClose={() => setShowImport(false)} onToast={msg => setToastMsg(msg)} />

      {/* ── Toast notification ── */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed z-[60]"
        style={{ bottom: 28, insetInlineEnd: 16, pointerEvents: toastMsg ? 'auto' : 'none' }}
      >
        {toastMsg && (
          <div
            className="px-4 py-2.5 text-sm font-medium animate-[fadeInUp_0.2s_ease-out]"
            style={{
              background: 'var(--sidebar-bg)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              maxWidth: 360,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
            }}
          >
            <span aria-hidden="true" style={{ color: 'var(--primary)', marginInlineEnd: 8 }}>✓</span>
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
