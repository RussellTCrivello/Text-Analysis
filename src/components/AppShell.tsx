import React, { useEffect, useRef, useState } from 'react';
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

/* ── Nav icon set – thin geometric, consistent weight ─────────────────────── */
const NAV_ICONS: Record<NavSection, React.ReactNode> = {
  sources: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 4v4l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>),
  contents: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>),
  analysis: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12L6 7l3 3 2.5-4L14 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  allData: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /></svg>),
  timeline: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="5.5" cy="8" r="1.5" fill="currentColor" /><circle cx="10.5" cy="8" r="1.5" fill="currentColor" /><path d="M5.5 5v1.5M10.5 9.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>),
  activity: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8h3l1.5-4 2.5 8L11 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  dictionary: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h4.5A1.5 1.5 0 0 1 9 4.5V13a1.5 1.5 0 0 0-1.5-1.5H3V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M13 3H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 3v8.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>),
  reports: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5 9.5l2-3 2 2 2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>),
};

const NAV_ITEMS: { id: NavSection; label: string; desc: string; group: 'collections' | 'intelligence' | 'system' }[] = [
  { id: 'sources', label: 'Sources', desc: 'Manage information sources', group: 'collections' },
  { id: 'contents', label: 'Contents', desc: 'Manage captured content', group: 'collections' },
  { id: 'analysis', label: 'Analysis', desc: 'Structured analysis records', group: 'collections' },
  { id: 'allData', label: 'All Data', desc: 'Unified read-only view', group: 'intelligence' },
  { id: 'timeline', label: 'Timeline', desc: 'Chronological events', group: 'intelligence' },
  { id: 'reports', label: 'Reports', desc: 'Query & chart builder', group: 'intelligence' },
  { id: 'activity', label: 'Activity', desc: 'Audit trail of changes', group: 'system' },
  { id: 'dictionary', label: 'Dictionary', desc: 'Gazetteer & taxonomy', group: 'system' },
];

const GROUP_LABELS: Record<'collections' | 'intelligence' | 'system', string> = {
  collections: 'Collections',
  intelligence: 'Intelligence',
  system: 'System',
};

interface Props {
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
  children: React.ReactNode;
  toast: string;
  onToastClear: () => void;
  globalSearch?: string;
  onGlobalSearch?: (v: string) => void;
}

export function AppShell({ activeSection, onSectionChange, children, toast, onToastClear, globalSearch = '', onGlobalSearch }: Props) {
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(toast);
  const toolsRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setToastMsg(toast); if (toast) { const tm = setTimeout(onToastClear, 3200); return () => clearTimeout(tm); } }, [toast, onToastClear]);
  useEffect(() => { const h = (e: MouseEvent) => { if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false); if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false); if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickAddOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setToolsOpen(false); setHelpOpen(false); setQuickAddOpen(false); } }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  useEffect(() => {
    const h = (event: Event) => { const d = (event as CustomEvent<{ contentId?: string }>).detail; setAttachmentTarget(d?.contentId); setShowAttachments(true); };
    window.addEventListener('tam:open-attachments', h);
    return () => window.removeEventListener('tam:open-attachments', h);
  }, []);

  useEffect(() => {
    if (!settings.keyboardShortcuts) return;
    const h = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const map: Record<string, NavSection> = { '1': 'sources', '2': 'contents', '3': 'analysis', '4': 'allData', '5': 'timeline', '6': 'reports', '7': 'activity', '8': 'dictionary' };
      if (ctrl && map[e.key]) { e.preventDefault(); onSectionChange(map[e.key]); }
      else if (e.key === 'F1') { e.preventDefault(); setShowHelp(true); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [settings.keyboardShortcuts, onSectionChange]);

  const currentSection = NAV_ITEMS.find((n) => n.id === activeSection);

  /* ── Shared menu dropdown ──────────────────────────────────────────── */
  const Dropdown = ({ open, toggle, label, dropRef, children }: { open: boolean; toggle: () => void; label: string; dropRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) => (
    <div className="relative" ref={dropRef}>
      <button onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: 'var(--fg-soft)', fontFamily: 'var(--font-display)' }}>
        {label}
        <svg width="9" height="9" viewBox="0 0 10 6" fill="none" className="opacity-60" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[210px] animate-[popIn_0.12s_ease-out]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)' }}>
          {children}
        </div>
      )}
    </div>
  );

  const DropItem = ({ label, onClick, danger, icon }: { label: React.ReactNode; onClick: () => void; danger?: boolean; icon?: React.ReactNode }) => (
    <button role="menuitem" onClick={() => { onClick(); setToolsOpen(false); setHelpOpen(false); }} className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:bg-[var(--surface-3)]" style={{ color: danger ? 'var(--error)' : 'var(--fg)', fontFamily: 'var(--font-body)' }}>
      {icon && <span className="text-sm leading-none opacity-75" aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );
  const DropSep = () => <div className="mx-3 my-1" role="separator" style={{ height: 1, background: 'var(--border)' }} />;

  const totalRecords = data.sources.length + data.contents.length + data.analyses.length;
  const groups: ('collections' | 'intelligence' | 'system')[] = ['collections', 'intelligence', 'system'];

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>
      {/* ── Top command bar ── */}
      <header className="flex items-center gap-3 px-3 shrink-0" style={{ background: 'var(--topbar-bg)', height: 'var(--topbar-h)', color: 'var(--topbar-fg)', borderBottom: '1px solid var(--border)' }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)]" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent-violet))', color: '#fff', boxShadow: 'var(--shadow-1)' }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" /><circle cx="6" cy="6" r="1.6" fill="currentColor" /></svg>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-[12.5px] font-extrabold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--fg)' }}>{t.app.name}</div>
            <div className="text-[9px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--muted-fg-2)' }}>{t.app.tagline}</div>
          </div>
        </div>

        <div className="w-px h-6 mx-1 hidden sm:block" style={{ background: 'var(--border)' }} />

        {/* Global command search */}
        <div className="flex-1 flex justify-center px-2 min-w-0">
          <div className="relative w-full max-w-[420px]">
            <SearchInput value={globalSearch} onChange={onGlobalSearch ?? (() => {})} placeholder={`${t.actions.search} everything…  (⌘K)`} />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative" ref={quickRef}>
            <button onClick={() => setQuickAddOpen((o) => !o)} aria-label={t.actions.addNew} aria-haspopup="menu" aria-expanded={quickAddOpen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-bold transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', fontFamily: 'var(--font-display)', boxShadow: 'var(--shadow-1)' }}>
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              {t.actions.addNew}
            </button>
            {quickAddOpen && (
              <div role="menu" className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[180px] animate-[popIn_0.12s_ease-out]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)' }}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-bold" style={{ color: 'var(--muted-fg-2)', fontFamily: 'var(--font-display)' }}>New record</div>
                {(['sources', 'contents', 'analysis'] as NavSection[]).map((s) => (
                  <button key={s} role="menuitem" onClick={() => { setQuickAddOpen(false); onSectionChange(s); }} className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors hover:bg-[var(--surface-3)]" style={{ color: 'var(--fg)' }}>{NAV_ICONS[s]}<span>{NAV_ITEMS.find((n) => n.id === s)?.label}</span></button>
                ))}
                <DropSep />
                <button role="menuitem" onClick={() => { setQuickAddOpen(false); setShowImport(true); }} className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors hover:bg-[var(--surface-3)]" style={{ color: 'var(--fg)' }}>📥<span>{t.ops.importData}</span></button>
              </div>
            )}
          </div>

          <Dropdown open={toolsOpen} toggle={() => { setToolsOpen((o) => !o); setHelpOpen(false); }} label={t.menus.tools} dropRef={toolsRef}>
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

          <Dropdown open={helpOpen} toggle={() => { setHelpOpen((o) => !o); setToolsOpen(false); }} label={t.menus.help} dropRef={helpRef}>
            <DropItem icon="❓" label={t.menus.helpDoc} onClick={() => setShowHelp(true)} />
            <DropItem icon="⌨" label={t.menus.shortcuts} onClick={() => setShowShortcuts(true)} />
            <DropItem icon="ℹ" label={t.menus.about} onClick={() => setShowAbout(true)} />
          </Dropdown>

          <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />

          <div className="flex items-center rounded-[var(--radius)] p-0.5" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {(['en', 'ar'] as const).map((lang) => (
              <button key={lang} onClick={() => saveSettings({ language: lang })} className="px-2 py-0.5 text-[10px] font-bold rounded-[5px] transition-all" style={{ color: settings.language === lang ? 'var(--primary-fg)' : 'var(--muted-fg)', background: settings.language === lang ? 'var(--primary)' : 'transparent', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{lang.toUpperCase()}</button>
            ))}
          </div>

          <button onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')} aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: 'var(--muted-fg)' }}>
            {settings.theme === 'dark' ? (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5L4.5 4.5M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>) : (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 9A5 5 0 117 3c0 .5.1 1 .2 1.5A4 4 0 1013 9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>)}
          </button>

          <button onClick={() => setShowSettings(true)} aria-label={t.ops.settings} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: 'var(--muted-fg)' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav aria-label="Main navigation" className="flex flex-col h-full shrink-0 overflow-hidden" style={{ width: sidebarCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)', transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)', borderInlineEnd: '1px solid var(--sidebar-border)' }}>
          <button onClick={() => setSidebarCollapsed((c) => !c)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} className="flex items-center justify-end pe-3 h-9 text-xs transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid var(--sidebar-border)' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          <div id="main-sidebar-nav" className="flex-1 overflow-y-auto py-2">
            {groups.map((g) => (
              <div key={g} className="mb-1">
                {!sidebarCollapsed && (
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}>{GROUP_LABELS[g]}</span>
                  </div>
                )}
                {NAV_ITEMS.filter((n) => n.group === g).map((item, idx) => {
                  const active = activeSection === item.id;
                  const globalIdx = NAV_ITEMS.findIndex((n) => n.id === item.id) + 1;
                  return (
                    <button key={item.id} onClick={() => onSectionChange(item.id)} aria-current={active ? 'page' : undefined} aria-label={sidebarCollapsed ? item.label : undefined} title={sidebarCollapsed ? item.label : undefined} className="w-full flex items-center gap-2.5 py-2 text-sm transition-all duration-100 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]" style={{ paddingInlineStart: sidebarCollapsed ? 0 : 12, paddingInlineEnd: sidebarCollapsed ? 0 : 12, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', background: active ? 'var(--sidebar-active)' : 'transparent', color: active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-fg)' }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {active && <span className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: 'var(--primary)', insetInlineStart: 0 }} />}
                      <span className="shrink-0 opacity-85 flex items-center justify-center" style={{ width: 18 }}>{NAV_ICONS[item.id]}</span>
                      {!sidebarCollapsed && (
                        <div className="flex-1 text-start min-w-0 flex items-center justify-between">
                          <span className="text-[12px] truncate" style={{ fontFamily: 'var(--font-display)', fontWeight: active ? 600 : 450, letterSpacing: '-0.01em' }}>{item.label}</span>
                          {active && <span className="text-[9px] font-mono shrink-0 ms-1 opacity-50" style={{ fontFamily: 'var(--font-mono)' }}>⌃{globalIdx}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Operations footer */}
          <div style={{ borderTop: '1px solid var(--sidebar-border)' }}>
            {!sidebarCollapsed && (<div className="px-3 pt-3 pb-1"><span className="text-[9px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em', fontFamily: 'var(--font-display)' }}>{t.ops.title}</span></div>)}
            {[
              { icon: '📎', label: t.ops.attachments, onClick: () => setShowAttachments(true) },
              { icon: '💾', label: t.ops.backup, onClick: () => setShowBackup(true) },
              { icon: '📥', label: t.ops.importData, onClick: () => setShowImport(true) },
            ].map((item) => (
              <button key={item.label} onClick={item.onClick} className="w-full flex items-center gap-2.5 py-1.5 text-xs transition-all duration-100" style={{ paddingInlineStart: sidebarCollapsed ? 0 : 12, paddingInlineEnd: 12, justifyContent: sidebarCollapsed ? 'center' : 'flex-start', color: 'rgba(255,255,255,0.38)' }}
                title={sidebarCollapsed ? item.label : undefined}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
              >
                <span className="shrink-0 text-sm leading-none flex items-center justify-center" style={{ width: 18 }}>{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate text-[11px]" style={{ fontFamily: 'var(--font-display)' }}>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Stats footer */}
          {!sidebarCollapsed && (
            <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
              <div className="flex gap-3">
                {[{ label: 'S', value: data.sources.length, color: 'var(--color-source)' }, { label: 'C', value: data.contents.length, color: 'var(--color-content)' }, { label: 'A', value: data.analyses.length, color: 'var(--color-analysis)' }].map((s) => (
                  <div key={s.label} className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold" style={{ color: s.color, opacity: 0.85, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{s.label}</span>
                    <span className="text-[11px] font-bold tnum" style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'var(--font-mono)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb bar */}
          <div className="flex items-center px-4 shrink-0 gap-2 breadcrumb-desc" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 'var(--breadcrumb-h)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>{t.app.name}</span>
            <span style={{ color: 'var(--border-strong)', fontSize: 14 }} aria-hidden="true">/</span>
            <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}>
              {!sidebarCollapsed && NAV_ICONS[activeSection]}
              {currentSection?.label}
            </span>
            {currentSection?.desc && (<span className="text-[11px] ms-1 breadcrumb-desc" style={{ color: 'var(--muted-fg)' }}>— {currentSection.desc}</span>)}
          </div>

          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between px-3 shrink-0" style={{ background: 'var(--sidebar-bg)', height: 'var(--status-h)', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.04em', borderTop: '1px solid var(--sidebar-border)' }}>
        <span style={{ color: 'rgba(255,255,255,0.38)' }}>{t.app.name} <span style={{ opacity: 0.5 }}>{t.app.version}</span></span>
        <div className="flex items-center gap-3">
          <span><span style={{ color: 'var(--color-source)' }}>S</span>:{data.sources.length}<span className="mx-1" style={{ opacity: 0.3 }}>·</span><span style={{ color: 'var(--color-content)' }}>C</span>:{data.contents.length}<span className="mx-1" style={{ opacity: 0.3 }}>·</span><span style={{ color: 'var(--color-analysis)' }}>A</span>:{data.analyses.length}<span className="mx-1 ms-2" style={{ opacity: 0.3 }}>|</span><strong style={{ color: 'rgba(255,255,255,0.5)' }}>{totalRecords}</strong> records</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{settings.language.toUpperCase()}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{settings.theme}</span>
        </div>
      </footer>

      {/* ── Dialogs ── */}
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <BackupDialog isOpen={showBackup} onClose={() => setShowBackup(false)} onToast={(m) => setToastMsg(m)} />

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
                <span className="text-[11px] font-medium rounded px-2 py-0.5 shrink-0 tnum" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', fontFamily: 'var(--font-mono)', minWidth: 100 }}>{parts[0]}</span>
                <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{parts[1]}</span>
              </div>
            );
          })}
        </div>
      </InfoModal>

      <PerformanceMonitor isOpen={showPerf} onClose={() => setShowPerf(false)} />
      <ResetDialog isOpen={showReset} onClose={() => setShowReset(false)} onResetData={() => { clearAllData(); setToastMsg('All data cleared.'); }} onResetAll={() => { clearAllData(); saveSettings({ theme: 'light', language: 'en' }); setToastMsg('Database reset complete.'); }} />
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <PrintHeaderSettings isOpen={showPrintHeader} onClose={() => setShowPrintHeader(false)} onToast={(m) => setToastMsg(m)} />
      <AttachmentManager isOpen={showAttachments} onClose={() => setShowAttachments(false)} onToast={(m) => setToastMsg(m)} initialContentId={attachmentTarget} />
      <ImportWizard isOpen={showImport} onClose={() => setShowImport(false)} onToast={(m) => setToastMsg(m)} />

      {/* ── Toast ── */}
      <div role="status" aria-live="polite" aria-atomic="true" className="fixed z-[60]" style={{ bottom: 28, insetInlineEnd: 16, pointerEvents: toastMsg ? 'auto' : 'none' }}>
        {toastMsg && (
          <div className="px-4 py-2.5 text-sm font-medium animate-[fadeInUp_0.2s_ease-out]" style={{ background: 'var(--sidebar-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-lg)', maxWidth: 360, boxShadow: 'var(--shadow-pop)', fontFamily: 'var(--font-display)', fontSize: '0.75rem' }}>
            <span aria-hidden="true" style={{ color: 'var(--primary)', marginInlineEnd: 8 }}>✓</span>
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
