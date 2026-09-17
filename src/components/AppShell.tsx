import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "../i18n"
import { useSettings } from "../store/SettingsContext"
import { useAppData } from "../store/AppContext"
import { SettingsDialog } from "./SettingsDialog"
import { BackupDialog } from "./BackupDialog"
import { ResetDialog } from "./ResetDialog"
import { HelpDialog } from "./HelpDialog"
import { PerformanceMonitor } from "./PerformanceMonitor"
import { PrintHeaderSettings } from "./PrintHeaderSettings"
import { AttachmentManager } from "./AttachmentManager"
import { ImportWizard } from "./ImportWizard"
import { InfoModal } from "./FormModal"
import { SearchInput, Kbd, IconButton, ToggleChip } from "./ui"
import {
  NAV_ICONS,
  Alert,
  Attachment,
  Backup,
  ChevronL,
  ChevronR,
  ChevronD,
  Close,
  GaugeIcon,
  Help,
  ImportFile,
  InfoIcon,
  KeyboardIcon,
  Plus,
  Printer,
  SettingsIcon,
  SparkleIcon,
  Success,
  ThemeToggle,
  Trash,
} from "./icons"
import type { NavSection } from "../types"
import { APP_VERSION, APP_VERSION_LABEL } from "../core/appInfo"

const NAV_ITEMS: {
  id: NavSection
  labelKey: "dashboard" | "sources" | "contents" | "analysis" | "allData" | "timeline" | "reports" | "activity" | "dictionary"
  descKey: string
  group: "overview" | "collections" | "intelligence" | "system"
}[] = [
  {
    id: "dashboard",
    labelKey: "dashboard",
    descKey: "dashboardDesc",
    group: "overview",
  },
  {
    id: "sources",
    labelKey: "sources",
    descKey: "sourcesDesc",
    group: "collections",
  },
  {
    id: "contents",
    labelKey: "contents",
    descKey: "contentsDesc",
    group: "collections",
  },
  {
    id: "analysis",
    labelKey: "analysis",
    descKey: "analysisDesc",
    group: "collections",
  },
  {
    id: "allData",
    labelKey: "allData",
    descKey: "allDataDesc",
    group: "intelligence",
  },
  {
    id: "timeline",
    labelKey: "timeline",
    descKey: "timelineDesc",
    group: "intelligence",
  },
  {
    id: "reports",
    labelKey: "reports",
    descKey: "reportsDesc",
    group: "intelligence",
  },
  {
    id: "activity",
    labelKey: "activity",
    descKey: "activityDesc",
    group: "system",
  },
  {
    id: "dictionary",
    labelKey: "dictionary",
    descKey: "dictionaryDesc",
    group: "system",
  },
]

interface Props {
  activeSection: NavSection
  onSectionChange: (s: NavSection) => void
  children: React.ReactNode
  toast: string
  onToastClear: () => void
  globalSearch?: string
  onGlobalSearch?: (v: string) => void
  onQuickAdd?: (target: "sources" | "contents" | "analysis") => void
}

export function AppShell({
  activeSection,
  onSectionChange,
  children,
  toast,
  onToastClear,
  globalSearch = "",
  onGlobalSearch,
  onQuickAdd,
}: Props) {
  const { t } = useTranslation()
  const { settings, setTheme, saveSettings } = useSettings()
  const appCtx = useAppData()
  const data = appCtx.data ?? { sources: [], contents: [], analyses: [] }
  const { loadSampleData, clearAllData } = appCtx

  const [showSettings, setShowSettings] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showPerf, setShowPerf] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showPrintHeader, setShowPrintHeader] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [attachmentTarget, setAttachmentTarget] = useState<string | undefined>(
    undefined,
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState(toast)
  const toolsRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)
  const quickRef = useRef<HTMLDivElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToastMsg(toast)
    if (toast) {
      const tm = setTimeout(onToastClear, 3200)
      return () => clearTimeout(tm)
    }
  }, [toast, onToastClear])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node))
        setToolsOpen(false)
      if (helpRef.current && !helpRef.current.contains(e.target as Node))
        setHelpOpen(false)
      if (quickRef.current && !quickRef.current.contains(e.target as Node))
        setQuickAddOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToolsOpen(false)
        setHelpOpen(false)
        setQuickAddOpen(false)
      }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  /**
   * Views request the attachment manager through this event so the dialog can
   * stay mounted once in the shell while still opening on a specific record.
   */
  useEffect(() => {
    const h = (event: Event) => {
      const d = (event as CustomEvent<{ contentId?: string }>).detail
      setAttachmentTarget(d?.contentId)
      setShowAttachments(true)
    }
    window.addEventListener("tam:open-attachments", h)
    return () => window.removeEventListener("tam:open-attachments", h)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      // ⌘K focuses the command search everywhere, independently of the
      // section-switching shortcut group which the user can disable.
      if (ctrl && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        searchWrapRef.current?.querySelector<HTMLInputElement>("input")?.focus()
        return
      }
      if (!settings.keyboardShortcuts) return
      const map: Record<string, NavSection> = {
        "1": "sources",
        "2": "contents",
        "3": "analysis",
        "4": "allData",
        "5": "timeline",
        "6": "reports",
        "7": "activity",
        "8": "dictionary",
      }
      if (ctrl && map[e.key]) {
        e.preventDefault()
        onSectionChange(map[e.key])
      } else if (ctrl && (e.key === "n" || e.key === "N")) {
        const target = (
          ["sources", "contents", "analysis"].includes(activeSection)
            ? activeSection
            : "sources"
        ) as "sources" | "contents" | "analysis"
        e.preventDefault()
        onQuickAdd?.(target)
      } else if (e.key === "F1") {
        e.preventDefault()
        setShowHelp(true)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [settings.keyboardShortcuts, onSectionChange, onQuickAdd, activeSection])

  const currentSection = NAV_ITEMS.find((n) => n.id === activeSection)
  const CurrentIcon = currentSection ? NAV_ICONS[currentSection.id] : null

  const groups: ("overview" | "collections" | "intelligence" | "system")[] = [
    "overview",
    "collections",
    "intelligence",
    "system",
  ]
  const groupLabels: Record<
    "overview" | "collections" | "intelligence" | "system",
    string
  > =
    {
      overview: t.nav.groups.overview,
      collections: t.nav.groups.collections,
      intelligence: t.nav.groups.intelligence,
      system: t.nav.groups.system,
    }

  const totalRecords =
    data.sources.length + data.contents.length + data.analyses.length

  const MenuItem = ({
    icon,
    label,
    onClick,
    danger,
    trailing,
  }: {
    icon?: React.ReactNode
    label: React.ReactNode
    onClick: () => void
    danger?: boolean
    trailing?: React.ReactNode
  }) => (
    <button
      role="menuitem"
      onClick={() => {
        onClick()
        setToolsOpen(false)
        setHelpOpen(false)
        setQuickAddOpen(false)
      }}
      className="w-full flex items-center gap-2.5 text-start px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:bg-[var(--surface-3)] [&_svg]:shrink-0"
      style={{
        color: danger ? "var(--error)" : "var(--fg)",
        fontFamily: "var(--font-body)",
      }}
    >
      {icon && (
        <span className="inline-flex w-4 justify-center opacity-80">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {trailing && (
        <span className="shrink-0" style={{ color: "var(--muted-fg)" }}>
          {trailing}
        </span>
      )}
    </button>
  )
  const MenuSep = () => (
    <div
      className="mx-3 my-1"
      role="separator"
      style={{ height: 1, background: "var(--border)" }}
    />
  )

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "var(--bg)", fontFamily: "var(--font-body)" }}
    >
      {/* ── Top command bar ── */}
      <header
        className="flex items-center gap-3 px-3 shrink-0"
        style={{
          background: "var(--topbar-bg)",
          backdropFilter: "blur(12px) saturate(1.5)",
          WebkitBackdropFilter: "blur(12px) saturate(1.5)",
          height: "var(--topbar-h)",
          color: "var(--topbar-fg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Brand + sidebar collapse */}
        <div className="flex items-center gap-2 shrink-0">
          <IconButton
            label={
              sidebarCollapsed ? t.shell.expandSidebar : t.shell.collapseSidebar
            }
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            <PanelIcon collapsed={sidebarCollapsed} />
          </IconButton>
          {/*
            Brand mark: this is the product LOGO, not a UI icon. The documented
            exception to the "Lucide only" rule (icons.tsx) — logos are artwork,
            and Lucide has no equivalent. Everything else in the UI uses Lucide.
          */}
          <div
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] brand-mark"
            style={{ color: "#fff" }}
            aria-hidden="true"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 1L11 3.5V8.5L6 11L1 8.5V3.5L6 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <circle cx="6" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <div
            className="leading-tight topbar-brand-text hidden sm:block"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <div
              className="text-[12.5px] font-extrabold"
              style={{ letterSpacing: "-0.02em", color: "var(--fg)" }}
            >
              {t.app.name}
            </div>
            <div
              className="text-[9px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: "var(--muted-fg-2)" }}
            >
              {t.app.tagline}
            </div>
          </div>
        </div>

        {/* Global command search */}
        <div
          className="flex-1 flex justify-center px-2 min-w-0"
          ref={searchWrapRef}
        >
          <div className="relative w-full max-w-[420px] flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SearchInput
                value={globalSearch}
                onChange={
                  onGlobalSearch ??
                  (() => {
                    /* read-only until a handler is provided */
                  })
                }
                placeholder={`${t.actions.search} ${t.shell.searchScope} (${t.shell.searchShortcut})`}
              />
            </div>
            <span className="hidden lg:inline-flex shrink-0" aria-hidden="true">
              <Kbd>Ctrl K</Kbd>
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Add */}
          <div className="relative" ref={quickRef}>
            <button
              onClick={() => setQuickAddOpen((o) => !o)}
              aria-label={t.shell.quickAdd}
              aria-haspopup="menu"
              aria-expanded={quickAddOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-bold transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                background: "var(--primary)",
                color: "var(--primary-fg)",
                fontFamily: "var(--font-display)",
                boxShadow: "var(--shadow-1)",
              }}
            >
              <Plus size="xs" />
              {t.shell.quickAdd}
              <ChevronD size="xs" style={{ opacity: 0.7 }} />
            </button>
            {quickAddOpen && (
              <div
                role="menu"
                className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[220px] animate-[popIn_0.12s_ease-out]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-pop)",
                }}
              >
                <div
                  className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.1em] font-bold"
                  style={{
                    color: "var(--muted-fg-2)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {t.shell.newRecord}
                </div>
                {(["sources", "contents", "analysis"] as const).map((s) => {
                  const Icon = NAV_ICONS[s]
                  return (
                    <MenuItem
                      key={s}
                      icon={<Icon size="sm" />}
                      label={t.nav[s]}
                      onClick={() => onQuickAdd?.(s)}
                    />
                  )
                })}
                <MenuSep />
                <MenuItem
                  icon={<ImportFile size="sm" />}
                  label={t.ops.importData}
                  onClick={() => setShowImport(true)}
                />
              </div>
            )}
          </div>

          {/* Tools menu */}
          <div className="relative" ref={toolsRef}>
            <button
              onClick={() => {
                setToolsOpen((o) => !o)
                setHelpOpen(false)
              }}
              aria-haspopup="menu"
              aria-expanded={toolsOpen}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                color: "var(--fg-soft)",
                fontFamily: "var(--font-display)",
              }}
            >
              {t.menus.tools}
              <ChevronD
                size="xs"
                style={{
                  opacity: 0.6,
                  transform: toolsOpen ? "rotate(180deg)" : undefined,
                  transition: "transform .12s",
                }}
              />
            </button>
            {toolsOpen && (
              <div
                role="menu"
                className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[230px] py-1 animate-[popIn_0.12s_ease-out]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-pop)",
                }}
              >
                <MenuItem
                  icon={<SettingsIcon size="sm" />}
                  label={t.menus.settings}
                  onClick={() => setShowSettings(true)}
                />
                <MenuItem
                  icon={<Backup size="sm" />}
                  label={t.menus.backupRestore}
                  onClick={() => setShowBackup(true)}
                />
                <MenuItem
                  icon={<ImportFile size="sm" />}
                  label={t.menus.importData}
                  onClick={() => setShowImport(true)}
                />
                <MenuItem
                  icon={<Attachment size="sm" />}
                  label={t.ops.attachments}
                  onClick={() => setShowAttachments(true)}
                />
                <MenuSep />
                <MenuItem
                  icon={<SparkleIcon size="sm" />}
                  label={t.actions.loadSample}
                  onClick={() => {
                    loadSampleData()
                    setToastMsg(t.messages.loadingSample)
                  }}
                />
                <MenuItem
                  icon={<Printer size="sm" />}
                  label={t.menus.printSettings}
                  onClick={() => setShowPrintHeader(true)}
                />
                <MenuItem
                  icon={<GaugeIcon size="sm" />}
                  label={t.menus.performanceMonitor}
                  onClick={() => setShowPerf(true)}
                />
                <MenuSep />
                <MenuItem
                  icon={<Trash size="sm" />}
                  label={t.menus.reset}
                  onClick={() => setShowReset(true)}
                  danger
                />
              </div>
            )}
          </div>

          {/* Help menu */}
          <div className="relative" ref={helpRef}>
            <button
              onClick={() => {
                setHelpOpen((o) => !o)
                setToolsOpen(false)
              }}
              aria-haspopup="menu"
              aria-expanded={helpOpen}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                color: "var(--fg-soft)",
                fontFamily: "var(--font-display)",
              }}
            >
              {t.menus.help}
              <ChevronD
                size="xs"
                style={{
                  opacity: 0.6,
                  transform: helpOpen ? "rotate(180deg)" : undefined,
                  transition: "transform .12s",
                }}
              />
            </button>
            {helpOpen && (
              <div
                role="menu"
                className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[210px] py-1 animate-[popIn_0.12s_ease-out]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-pop)",
                }}
              >
                <MenuItem
                  icon={<Help size="sm" />}
                  label={t.menus.helpDoc}
                  onClick={() => setShowHelp(true)}
                />
                <MenuItem
                  icon={<KeyboardIcon size="sm" />}
                  label={t.menus.shortcuts}
                  onClick={() => setShowShortcuts(true)}
                  trailing={<Kbd>F1</Kbd>}
                />
                <MenuItem
                  icon={<InfoIcon size="sm" />}
                  label={t.menus.about}
                  onClick={() => setShowAbout(true)}
                />
              </div>
            )}
          </div>

          <div
            className="w-px h-6 mx-1"
            style={{ background: "var(--border)" }}
            aria-hidden="true"
          />

          {/* Language */}
          <div
            className="flex items-center rounded-[var(--radius)] p-0.5"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
            role="group"
            aria-label={t.settings.language}
          >
            {(["en", "ar"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => saveSettings({ language: lang })}
                aria-pressed={settings.language === lang}
                className="px-2 py-0.5 text-[10px] font-bold rounded-[5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{
                  color:
                    settings.language === lang
                      ? "var(--primary-fg)"
                      : "var(--muted-fg)",
                  background:
                    settings.language === lang
                      ? "var(--primary)"
                      : "transparent",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Theme */}
          <IconButton
            label={
              settings.theme === "dark"
                ? t.shell.themeToLight
                : t.shell.themeToDark
            }
            onClick={() =>
              setTheme(settings.theme === "dark" ? "light" : "dark")
            }
          >
            <ThemeToggle size="md" />
          </IconButton>

          {/* Settings */}
          <IconButton
            label={t.ops.settings}
            onClick={() => setShowSettings(true)}
          >
            <SettingsIcon size="md" />
          </IconButton>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav
          aria-label="Main navigation"
          className="flex flex-col h-full shrink-0 overflow-hidden"
          style={{
            width: sidebarCollapsed
              ? "var(--sidebar-w-collapsed)"
              : "var(--sidebar-w)",
            background:
              "linear-gradient(180deg, rgba(148,163,255,0.05), transparent 16%), var(--sidebar-bg)",
            color: "var(--sidebar-fg)",
            transition: "width 0.18s cubic-bezier(0.4,0,0.2,1)",
            borderInlineEnd: "1px solid var(--sidebar-border)",
          }}
        >
          <div id="main-sidebar-nav" className="flex-1 overflow-y-auto py-2">
            {groups.map((g) => (
              <div key={g} className="mb-1">
                {!sidebarCollapsed && (
                  <div className="px-3 pt-3 pb-1">
                    <span
                      className="text-[9px] font-bold uppercase"
                      style={{
                        color: "rgba(255,255,255,0.25)",
                        letterSpacing: "0.14em",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {groupLabels[g]}
                    </span>
                  </div>
                )}
                {NAV_ITEMS.filter((n) => n.group === g).map((item) => {
                  const active = activeSection === item.id
                  const globalIdx =
                    NAV_ITEMS.findIndex((n) => n.id === item.id) + 1
                  const Icon = NAV_ICONS[item.id]
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      aria-current={active ? "page" : undefined}
                      data-active={active}
                      aria-label={
                        sidebarCollapsed ? t.nav[item.labelKey] : undefined
                      }
                      title={
                        sidebarCollapsed ? t.nav[item.labelKey] : undefined
                      }
                      className="nav-item w-full flex items-center gap-2.5 py-2 text-sm transition-all duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]"
                      style={{
                        paddingInlineStart: sidebarCollapsed ? 0 : 12,
                        paddingInlineEnd: sidebarCollapsed ? 0 : 12,
                        justifyContent: sidebarCollapsed
                          ? "center"
                          : "flex-start",
                        background: active
                          ? "var(--sidebar-active)"
                          : "transparent",
                        color: active
                          ? "var(--sidebar-active-fg)"
                          : "var(--sidebar-fg)",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            "var(--sidebar-hover)"
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.background = "transparent"
                      }}
                    >
                      <span
                        className="shrink-0 opacity-85 flex items-center justify-center"
                        style={{ width: 18 }}
                      >
                        <Icon size="md" />
                      </span>
                      {!sidebarCollapsed && (
                        <div className="flex-1 text-start min-w-0 flex items-center justify-between">
                          <span
                            className="text-[12px] truncate"
                            style={{
                              fontFamily: "var(--font-display)",
                              fontWeight: active ? 600 : 450,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {t.nav[item.labelKey]}
                          </span>
                          {active && <Kbd>Ctrl {globalIdx}</Kbd>}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Operations footer */}
          <div style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            {!sidebarCollapsed && (
              <div className="px-3 pt-3 pb-1">
                <span
                  className="text-[9px] font-bold uppercase"
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    letterSpacing: "0.14em",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {t.ops.title}
                </span>
              </div>
            )}
            {[
              {
                icon: <Attachment size="sm" />,
                label: t.ops.attachments,
                onClick: () => setShowAttachments(true),
              },
              {
                icon: <Backup size="sm" />,
                label: t.ops.backup,
                onClick: () => setShowBackup(true),
              },
              {
                icon: <ImportFile size="sm" />,
                label: t.ops.importData,
                onClick: () => setShowImport(true),
              },
              {
                icon: <Help size="sm" />,
                label: t.ops.help,
                onClick: () => setShowShortcuts(true),
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-2.5 py-1.5 text-xs transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]"
                style={{
                  paddingInlineStart: sidebarCollapsed ? 0 : 12,
                  paddingInlineEnd: 12,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  color: "rgba(255,255,255,0.42)",
                }}
                title={item.label}
                aria-label={sidebarCollapsed ? item.label : undefined}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--sidebar-hover)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                  e.currentTarget.style.color = "rgba(255,255,255,0.42)"
                }}
              >
                <span
                  className="shrink-0 inline-flex items-center justify-center"
                  style={{ width: 18 }}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span
                    className="truncate text-[11px]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Stats footer */}
          {!sidebarCollapsed && (
            <div
              className="px-3 py-2.5"
              style={{ borderTop: "1px solid var(--sidebar-border)" }}
            >
              <div className="flex gap-3">
                {[
                  {
                    label: "S",
                    value: data.sources.length,
                    color: "var(--color-source)",
                  },
                  {
                    label: "C",
                    value: data.contents.length,
                    color: "var(--color-content)",
                  },
                  {
                    label: "A",
                    value: data.analyses.length,
                    color: "var(--color-analysis)",
                  },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col gap-0.5">
                    <span
                      className="text-[8px] font-bold"
                      style={{
                        color: s.color,
                        opacity: 0.85,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      className="text-[11px] font-bold tnum"
                      style={{
                        color: "rgba(255,255,255,0.42)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb bar */}
          <div
            className="flex items-center px-4 shrink-0 gap-2"
            style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              height: "var(--breadcrumb-h)",
            }}
          >
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 min-w-0"
            >
              <span
                className="text-[11px] font-semibold"
                style={{
                  color: "var(--muted-fg)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {t.app.name}
              </span>
              <ChevronL
                size="xs"
                style={{
                  color: "var(--muted-fg-2)",
                  transform: "rotate(180deg)",
                }}
              />
              {CurrentIcon && currentSection && (
                <span
                  className="text-[12px] font-bold inline-flex items-center gap-1.5 min-w-0"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--fg)",
                  }}
                >
                  <CurrentIcon size="sm" />
                  <span className="truncate">
                    {t.nav[currentSection.labelKey]}
                  </span>
                </span>
              )}
              {currentSection && (
                <span
                  className="text-[11px] ms-1 breadcrumb-desc"
                  style={{ color: "var(--muted-fg)" }}
                >
                  —{" "}
                  {
                    t.nav[
                      (currentSection.descKey as keyof typeof t.nav)
                    ] as string
                  }
                </span>
              )}
            </nav>
            <div className="flex-1" />
            <ToggleChip
              active={settings.theme === "dark"}
              onClick={() =>
                setTheme(settings.theme === "dark" ? "light" : "dark")
              }
            >
              <ThemeToggle size="xs" />
              {settings.theme}
            </ToggleChip>
          </div>

          {/* Storage-failure banner: a dropped save must never be silent. */}
          {appCtx.persistError && (
            <div
              role="alert"
              className="flex items-center gap-2 px-4 py-2 text-[12px] shrink-0"
              style={{
                background: "var(--color-danger-bg, rgba(229,72,77,0.12))",
                color: "var(--color-danger, #e5484d)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Alert size="xs" />
              <span className="flex-1">{t.messages.storageFull}</span>
              <button
                type="button"
                onClick={appCtx.dismissPersistError}
                className="underline"
                style={{ color: "inherit" }}
              >
                {t.messages.storageFullDismiss}
              </button>
            </div>
          )}

          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      {/* ── Status bar ── */}
      <footer
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          background: "var(--sidebar-bg)",
          height: "var(--status-h)",
          color: "rgba(255,255,255,0.3)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.04em",
          borderTop: "1px solid var(--sidebar-border)",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.38)" }}>
          {t.app.name} <span style={{ opacity: 0.5 }}>{t.app.version.replace("{version}", APP_VERSION_LABEL)}</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="tnum">
            <span className="type-dot" style={{ background: "var(--color-source)", color: "var(--color-source)" }} />{" "}
            <span style={{ color: "var(--color-source)" }}>S</span>:
            {data.sources.length}
            <span className="mx-1" style={{ opacity: 0.3 }}>
              ·
            </span>
            <span className="type-dot" style={{ background: "var(--color-content)", color: "var(--color-content)" }} />{" "}
            <span style={{ color: "var(--color-content)" }}>C</span>:
            {data.contents.length}
            <span className="mx-1" style={{ opacity: 0.3 }}>
              ·
            </span>
            <span className="type-dot" style={{ background: "var(--color-analysis)", color: "var(--color-analysis)" }} />{" "}
            <span style={{ color: "var(--color-analysis)" }}>A</span>:
            {data.analyses.length}
            <span className="mx-1 ms-2" style={{ opacity: 0.3 }}>
              |
            </span>
            <strong style={{ color: "rgba(255,255,255,0.5)" }}>
              {totalRecords}
            </strong>{" "}
            {t.messages.records}
          </span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{settings.language.toUpperCase()}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{settings.theme === 'dark' ? t.settings.themeDark : t.settings.themeLight}</span>
        </div>
      </footer>

      {/* ── Dialogs ── */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <BackupDialog
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
        onToast={(m) => setToastMsg(m)}
      />

      <InfoModal
        isOpen={showAbout}
        title={t.about.title}
        onClose={() => setShowAbout(false)}
        size="md"
        icon={<InfoIcon size="sm" />}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p style={{ color: "var(--muted-fg)" }}>{t.about.version.replace("{version}", APP_VERSION)}</p>
          <p>{t.about.description}</p>
          <p
            style={{
              color: "var(--muted-fg)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8em",
            }}
          >
            {t.about.built}
          </p>
        </div>
      </InfoModal>

      <InfoModal
        isOpen={showShortcuts}
        title={t.shortcuts.title}
        onClose={() => setShowShortcuts(false)}
        size="md"
        icon={<KeyboardIcon size="sm" />}
      >
        <div className="flex flex-col gap-0.5">
          {Object.entries(t.shortcuts)
            .filter(([k]) => k !== "title")
            .map(([k, v]) => {
              const parts = (v as string).split(" — ")
              return (
                <div
                  key={k}
                  className="flex items-center gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span
                    className="text-[11px] font-medium rounded px-2 py-0.5 shrink-0 tnum"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      fontFamily: "var(--font-mono)",
                      minWidth: 100,
                    }}
                  >
                    {parts[0]}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {parts[1]}
                  </span>
                </div>
              )
            })}
        </div>
      </InfoModal>

      <PerformanceMonitor
        isOpen={showPerf}
        onClose={() => setShowPerf(false)}
      />
      <ResetDialog
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        onResetData={() => {
          clearAllData()
          setToastMsg(t.messages.allCleared)
        }}
        onResetAll={() => {
          clearAllData()
          saveSettings({ theme: "light", language: "en" })
          setToastMsg(t.messages.allCleared)
        }}
      />
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <PrintHeaderSettings
        isOpen={showPrintHeader}
        onClose={() => setShowPrintHeader(false)}
        onToast={(m) => setToastMsg(m)}
      />
      <AttachmentManager
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        onToast={(m) => setToastMsg(m)}
        initialContentId={attachmentTarget}
      />
      <ImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onToast={(m) => setToastMsg(m)}
      />

      {/* ── Toast ── */}
      <div
        role="status"
        aria-live={settings.screenReader ? "polite" : "off"}
        aria-atomic="true"
        className="fixed z-[60]"
        style={{
          bottom: 28,
          insetInlineEnd: 16,
          pointerEvents: toastMsg ? "auto" : "none",
        }}
      >
        {toastMsg && (
          <div
            className="flex items-start gap-2 px-4 py-2.5 text-sm font-medium animate-[fadeInUp_0.2s_ease-out]"
            style={{
              background:
              "linear-gradient(180deg, rgba(148,163,255,0.05), transparent 16%), var(--sidebar-bg)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "var(--radius-lg)",
              maxWidth: 360,
              boxShadow: "var(--shadow-pop)",
              fontFamily: "var(--font-display)",
              fontSize: "0.75rem",
            }}
          >
            <span className="inline-flex mt-px">
              <Success size="xs" style={{ color: "var(--primary)" }} />
            </span>
            <span>{toastMsg}</span>
            <button
              onClick={onToastClear}
              aria-label={t.actions.close}
              className="ms-1 inline-flex opacity-60 hover:opacity-100 focus-visible:outline-none"
            >
              <Close size="xs" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Sidebar-rail toggle — a real panel affordance rather than a bare arrow. */
function PanelIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className="inline-flex"
      style={{
        transform: collapsed ? "scaleX(-1)" : undefined,
        transition: "transform .18s",
      }}
      aria-hidden="true"
    >
      <ChevronL size="md" />
    </span>
  )
}