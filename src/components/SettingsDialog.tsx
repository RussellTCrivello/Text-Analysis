/**
 * Settings — a grouped, searchable workspace (fully redesigned).
 *
 * Four categories (Appearance / Interface / Accessibility / Data) with
 * labelled controls, per-setting descriptions, a live appearance preview,
 * unsaved-change tracking with Apply / Discard, and a confirmed
 * reset-to-defaults flow. Draft changes only hit the store on Apply so the
 * user always knows what is live.
 */
import React, { useMemo, useState } from "react"
import { Modal, Btn, Callout, Field, Segmented, Switch } from "./ui"
import { ConfirmDialog } from "./FormModal"
import {
  AccessibilityIcon,
  Check,
  DatabaseIcon,
  GaugeIcon,
  LayersIcon,
  Palette,
  Reset,
  Save,
  TypeIcon,
  Warning,
} from "./icons"
import { useSettings } from "../store/SettingsContext"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import type {
  AppSettings,
  ColorBlindMode,
  Density,
  Language,
  Theme,
} from "../types"

const DEFAULTS: AppSettings = {
  language: "en",
  theme: "light",
  fontSize: 13,
  density: "comfortable",
  highContrast: false,
  fontScale: 100,
  colorBlindMode: "none",
  keyboardShortcuts: true,
  focusIndicator: true,
  screenReader: true,
  defaultPageSize: 50,
  autoSave: true,
  autoSaveInterval: 30,
  tableLayouts: {},
  formLayouts: {},
}

type Section = "appearance" | "interface" | "accessibility" | "data"

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3 px-3 rounded-[var(--radius)]"
      style={{ borderBottom: "1px solid var(--border-faint)" }}
    >
      <div className="min-w-0">
        <div
          className="text-xs font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </div>
        {description && (
          <p
            className="text-[11px] mt-0.5 leading-snug"
            style={{ color: "var(--muted-fg)" }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">{control}</div>
    </div>
  )
}

export function SettingsDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { settings, saveSettings } = useSettings()
  const { lastSavedAt } = useAppData()
  const [draft, setDraft] = useState<AppSettings>({ ...settings })
  const [section, setSection] = useState<Section>("appearance")
  const [resetOpen, setResetOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Re-sync the draft whenever the dialog is (re-)opened.
  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setDraft({ ...settings })
      setSavedFlash(false)
    }
  }

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const dirty = useMemo(() => {
    const keys = Object.keys(draft) as Array<keyof AppSettings>
    return keys.some((k) => draft[k] !== settings[k])
  }, [draft, settings])
  const intervalError =
    draft.autoSave &&
    (draft.autoSaveInterval < 10 || draft.autoSaveInterval > 300)

  const apply = () => {
    if (intervalError) return
    saveSettings(draft)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1800)
    onClose()
  }
  const discard = () => setDraft({ ...settings })
  const doResetDefaults = () => {
    setDraft({ ...DEFAULTS })
    setResetOpen(false)
  }

  const sections: {
    id: Section
    label: string
    desc: string
    icon: React.ReactNode
  }[] = [
    {
      id: "appearance",
      label: t.settings.groupAppearance,
      desc: t.settings.groupAppearanceDesc,
      icon: <Palette size="sm" />,
    },
    {
      id: "interface",
      label: t.settings.groupInterface,
      desc: t.settings.groupInterfaceDesc,
      icon: <LayersIcon size="sm" />,
    },
    {
      id: "accessibility",
      label: t.settings.groupAccessibility,
      desc: t.settings.groupAccessibilityDesc,
      icon: <AccessibilityIcon size="sm" />,
    },
    {
      id: "data",
      label: t.settings.groupData,
      desc: t.settings.groupDataDesc,
      icon: <DatabaseIcon size="sm" />,
    },
  ]

  const langOpts = [
    { value: "en", label: "English" },
    { value: "ar", label: "العربية" },
  ]
  const cbOpts: { value: ColorBlindMode; label: string }[] = [
    { value: "none", label: t.settings.colorBlindNone },
    { value: "deuteranopia", label: t.settings.colorBlindDeuteranopia },
    { value: "protanopia", label: t.settings.colorBlindProtanopia },
    { value: "tritanopia", label: t.settings.colorBlindTritanopia },
  ]

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        icon={<GaugeIcon size="sm" />}
        title={
          <span className="inline-flex items-center gap-2">
            {t.settings.title}
            {dirty && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: "var(--warning-soft)",
                  color: "var(--warning)",
                }}
              >
                <Warning size="xs" /> {t.settings.unsavedChanges}
              </span>
            )}
            {!dirty && savedFlash && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: "var(--success-soft)",
                  color: "var(--success)",
                }}
              >
                <Check size="xs" /> {t.messages.settingsSaved}
              </span>
            )}
          </span>
        }
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => setResetOpen(true)}
              icon={<Reset size="sm" />}
            >
              {t.settings.resetDefaults}
            </Btn>
            <div className="flex-1" />
            <Btn variant="ghost" onClick={discard} disabled={!dirty}>
              {t.settings.discardChanges}
            </Btn>
            <Btn
              variant="primary"
              onClick={apply}
              disabled={!dirty || intervalError}
              icon={<Save size="sm" />}
            >
              {t.settings.applySettings}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col lg:flex-row gap-4 min-h-[420px]">
          {/* Category rail */}
          <nav
            className="lg:w-52 shrink-0 flex lg:flex-col gap-1"
            aria-label={t.settings.title}
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id ? "true" : undefined}
                className="flex items-center gap-2.5 text-start px-3 py-2 rounded-[var(--radius)] transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{
                  background:
                    section === s.id ? "var(--primary-soft)" : "transparent",
                  color: section === s.id ? "var(--primary)" : "var(--fg-soft)",
                  fontWeight: section === s.id ? 700 : 500,
                  border: `1px solid ${
                    section === s.id ? "var(--primary-soft-2)" : "transparent"
                  }`,
                }}
              >
                <span className="inline-flex w-4 justify-center">{s.icon}</span>
                <span className="min-w-0">
                  <span
                    className="block truncate"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="hidden lg:block text-[10px] truncate"
                    style={{ color: "var(--muted-fg-2)", fontWeight: 400 }}
                  >
                    {s.desc}
                  </span>
                </span>
              </button>
            ))}
            <div
              className="hidden lg:block mt-auto rounded-[var(--radius)] p-2.5 text-[11px]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--muted-fg)",
              }}
            >
              <div
                className="flex items-center gap-1.5 font-semibold"
                style={{ color: "var(--fg-soft)" }}
              >
                <DatabaseIcon size="xs" /> {t.settings.autoSave}
              </div>
              <p
                className="mt-1 tnum"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px" }}
              >
                {lastSavedAt
                  ? `${t.settings.autoSave}: ${
                      draft.autoSave ? "on" : "off"
                    } · ${lastSavedAt.slice(11, 19)}`
                  : "—"}
              </p>
            </div>
          </nav>

          {/* Content */}
          <div
            className="flex-1 min-w-0 rounded-[var(--radius-lg)]"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            {section === "appearance" && (
              <div className="p-2">
                <SettingRow
                  title={t.settings.theme}
                  description={t.settings.themeDesc}
                  control={
                    <Segmented
                      ariaLabel={t.settings.theme}
                      options={[
                        { value: "light", label: t.settings.themeLight },
                        { value: "dark", label: t.settings.themeDark },
                      ]}
                      value={draft.theme}
                      onChange={(v) => set("theme", v as Theme)}
                    />
                  }
                />
                <SettingRow
                  title={t.settings.language}
                  description={t.settings.languageDesc}
                  control={
                    <Segmented
                      ariaLabel={t.settings.language}
                      options={langOpts}
                      value={draft.language}
                      onChange={(v) => set("language", v as Language)}
                    />
                  }
                />
                <SettingRow
                  title={`${t.settings.fontSize} · ${draft.fontSize}px`}
                  description={t.settings.fontSizeDesc}
                  control={
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={11}
                        max={18}
                        step={1}
                        value={draft.fontSize}
                        onChange={(e) =>
                          set("fontSize", Number(e.target.value))
                        }
                        aria-label={t.settings.fontSizeDesc}
                        style={{ accentColor: "var(--primary)", width: 120 }}
                      />
                    </div>
                  }
                />
                <SettingRow
                  title={`${t.settings.fontScale} · ${draft.fontScale}%`}
                  description={t.settings.fontScaleDesc}
                  control={
                    <input
                      type="range"
                      min={100}
                      max={200}
                      step={5}
                      value={draft.fontScale}
                      onChange={(e) => set("fontScale", Number(e.target.value))}
                      aria-label={t.settings.fontScaleDesc}
                      style={{ accentColor: "var(--primary)", width: 120 }}
                    />
                  }
                />
                {/* Live preview */}
                <div
                  className="mt-3 rounded-[var(--radius-lg)] p-4"
                  style={{
                    background: draft.theme === "dark" ? "#121826" : "#ffffff",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    <TypeIcon size="xs" /> {t.settings.previewTitle}
                  </div>
                  <p
                    className="font-bold"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--fg)",
                      fontSize: draft.fontSize,
                      marginBottom: 4,
                    }}
                  >
                    {t.app.name}
                  </p>
                  <p
                    style={{
                      color: "var(--fg-soft)",
                      fontSize: draft.fontSize * (draft.fontScale / 100),
                      lineHeight: 1.6,
                    }}
                  >
                    {t.settings.previewSample}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-fg)",
                      }}
                    >
                      {draft.density}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        background: "var(--success-soft)",
                        color: "var(--success)",
                      }}
                    >
                      {t.messages.saved}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        background: "var(--error-soft)",
                        color: "var(--error)",
                      }}
                    >
                      {t.actions.delete}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {section === "interface" && (
              <div className="p-2">
                <SettingRow
                  title={t.settings.density}
                  description={t.settings.densityDesc}
                  control={
                    <Segmented
                      ariaLabel={t.settings.density}
                      options={[
                        { value: "compact", label: t.settings.densityCompact },
                        {
                          value: "comfortable",
                          label: t.settings.densityComfortable,
                        },
                        {
                          value: "expansive",
                          label: t.settings.densityExpansive,
                        },
                      ]}
                      value={draft.density}
                      onChange={(v) => set("density", v as Density)}
                    />
                  }
                />
                <SettingRow
                  title={t.settings.defaultPageSize}
                  description={t.settings.defaultPageSizeDesc}
                  control={
                    <Segmented
                      ariaLabel={t.settings.defaultPageSize}
                      options={[25, 50, 100, 200, 500].map((n) => ({
                        value: String(n),
                        label: String(n),
                      }))}
                      value={String(draft.defaultPageSize)}
                      onChange={(v) => set("defaultPageSize", Number(v))}
                      size="xs"
                    />
                  }
                />
                <SettingRow
                  title={t.settings.keyboardShortcuts}
                  description={t.settings.keyboardShortcutsDesc}
                  control={
                    <Switch
                      checked={draft.keyboardShortcuts}
                      onChange={(v) => set("keyboardShortcuts", v)}
                      label={draft.keyboardShortcuts ? "on" : "off"}
                    />
                  }
                />
                <SettingRow
                  title={t.ops.help}
                  description={t.shortcuts.f1}
                  control={
                    <span
                      className="text-[10px]"
                      style={{
                        color: "var(--muted-fg-2)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      F1 · Ctrl+1–8 · Ctrl+K
                    </span>
                  }
                />
              </div>
            )}

            {section === "accessibility" && (
              <div className="p-2">
                <SettingRow
                  title={t.settings.highContrast}
                  description={t.settings.highContrastDesc}
                  control={
                    <Switch
                      checked={draft.highContrast}
                      onChange={(v) => set("highContrast", v)}
                    />
                  }
                />
                <div
                  className="py-3 px-3"
                  style={{ borderBottom: "1px solid var(--border-faint)" }}
                >
                  <div
                    className="text-xs font-semibold mb-1.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t.settings.colorBlindMode}
                  </div>
                  <p
                    className="text-[11px] mb-2"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {t.settings.colorBlindModeDesc}
                  </p>
                  <div
                    className="flex flex-wrap gap-1"
                    role="radiogroup"
                    aria-label={t.settings.colorBlindMode}
                  >
                    {cbOpts.map((o) => (
                      <button
                        key={o.value}
                        role="radio"
                        aria-checked={draft.colorBlindMode === o.value}
                        onClick={() => set("colorBlindMode", o.value)}
                        className="px-2.5 py-1 text-[11px] rounded-[var(--radius-sm)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        style={{
                          background:
                            draft.colorBlindMode === o.value
                              ? "var(--primary)"
                              : "var(--surface)",
                          color:
                            draft.colorBlindMode === o.value
                              ? "var(--primary-fg)"
                              : "var(--muted-fg)",
                          border: `1px solid ${
                            draft.colorBlindMode === o.value
                              ? "var(--primary)"
                              : "var(--border-strong)"
                          }`,
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="flex gap-2 mt-2.5"
                    aria-label={t.sections.dictionary.custom}
                  >
                    {["source", "content", "analysis"].map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{
                            background: `var(--color-${k})`,
                            border: "1px solid var(--border-strong)",
                          }}
                          aria-hidden="true"
                        />
                        {t.nav[(k as "sources" | "contents" | "analysis")]}
                      </span>
                    ))}
                  </div>
                </div>
                <SettingRow
                  title={t.settings.focusIndicator}
                  description={t.settings.focusIndicatorDesc}
                  control={
                    <Switch
                      checked={draft.focusIndicator}
                      onChange={(v) => set("focusIndicator", v)}
                    />
                  }
                />
                <SettingRow
                  title={t.settings.screenReader}
                  description={t.settings.screenReaderDesc}
                  control={
                    <Switch
                      checked={draft.screenReader}
                      onChange={(v) => set("screenReader", v)}
                    />
                  }
                />
              </div>
            )}

            {section === "data" && (
              <div className="p-2">
                <SettingRow
                  title={t.settings.autoSave}
                  description={t.settings.autoSaveDesc}
                  control={
                    <Switch
                      checked={draft.autoSave}
                      onChange={(v) => set("autoSave", v)}
                    />
                  }
                />
                {draft.autoSave && (
                  <div className="p-3">
                    <Field
                      label={`${t.settings.autoSaveInterval} · ${draft.autoSaveInterval}s`}
                      error={
                        intervalError ? t.settings.secondsRange : undefined
                      }
                      hint={
                        intervalError
                          ? undefined
                          : t.settings.autoSaveIntervalDesc
                      }
                    >
                      <input
                        type="number"
                        min={10}
                        max={300}
                        step={5}
                        value={draft.autoSaveInterval}
                        onChange={(e) =>
                          set("autoSaveInterval", Number(e.target.value))
                        }
                        aria-label={t.settings.autoSaveIntervalDesc}
                        className="w-32 px-2.5 py-1.5 text-sm rounded-[var(--radius)] outline-none tnum"
                        style={{
                          background: "var(--surface)",
                          color: "var(--fg)",
                          border: `1px solid ${
                            intervalError
                              ? "var(--error)"
                              : "var(--border-strong)"
                          }`,
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                    </Field>
                  </div>
                )}
                <div className="px-3 pb-2 pt-1">
                  <Callout
                    variant="info"
                    title={t.sections.dictionary.appliesImmediately}
                  >
                    {lastSavedAt ? (
                      <span
                        className="tnum"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {t.backup.lastBackup === "Last backup"
                          ? "Last saved "
                          : ""}
                        {lastSavedAt.replace("T", " ").slice(0, 19)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)" }}>
                        {t.backup.neverBackedUp}
                      </span>
                    )}
                  </Callout>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={resetOpen}
        title={t.settings.resetDefaults}
        message={t.settings.resetConfirm}
        onConfirm={doResetDefaults}
        onCancel={() => setResetOpen(false)}
      />
    </>
  )
}