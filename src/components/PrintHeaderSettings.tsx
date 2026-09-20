/**
 * Print & export header settings, bound to the workspace print configuration
 * that `buildPrintDocument`, the PDF/DOCX exporters and the Reports workspace
 * all read from. Includes the logo upload, page geometry and the document
 * number sequence.
 */
import React, { useState } from "react"
import { InfoModal } from "./FormModal"
import { Btn, Field, Input, Select, Checkbox } from "./ui"
import { Check, Close, Print, Reset, Save } from "./icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import {
  DEFAULT_PRINT_CONFIG,
  nextDocumentNumber,
  type PrintHeaderConfig,
} from "../core/print"

interface Props {
  isOpen: boolean
  onClose: () => void
  onToast?: (message: string) => void
}

export function PrintHeaderSettings({ isOpen, onClose, onToast }: Props) {
  const { printConfig, setPrintConfig } = useAppData()
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<PrintHeaderConfig>(printConfig)
  const [dirty, setDirty] = useState(false)

  const set = (patch: Partial<PrintHeaderConfig>) => {
    setCfg((c) => ({ ...c, ...patch }))
    setDirty(true)
  }

  const save = () => {
    setPrintConfig(cfg)
    setDirty(false)
    onToast?.(t.print.savedToast)
    onClose()
  }

  const row = (label: string, el: React.ReactNode) => (
    <div className="flex items-center gap-3">
      <span
        className="text-xs w-40 shrink-0"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </span>
      <div className="flex-1">{el}</div>
    </div>
  )

  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (file.size > 512 * 1024) {
      onToast?.(t.print.logoTooBig)
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) =>
      set({ logoDataUrl: String(ev.target?.result ?? ""), includeLogo: true })
    reader.readAsDataURL(file)
  }

  const docNumber = nextDocumentNumber(cfg)

  const card = "rounded-xl p-4 flex flex-col gap-2"
  const cardStyle = { background: "var(--secondary-bg)" }
  const heading = "text-xs font-bold uppercase tracking-wide mb-1"

  return (
    <InfoModal
      isOpen={isOpen}
      title={t.print.title}
      onClose={onClose}
      size="lg"
      icon={<Print size="sm" />}
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className={card} style={cardStyle}>
          <div className={heading} style={{ color: "var(--muted-fg)" }}>
            {t.print.headerCard}
          </div>
          {row(
            t.print.header1,
            <Input
              value={cfg.header1}
              onChange={(e) => set({ header1: e.target.value })}
              placeholder={t.print.phOrg}
            />,
          )}
          {row(
            t.print.header2,
            <Input
              value={cfg.header2}
              onChange={(e) => set({ header2: e.target.value })}
              placeholder={t.print.phDept}
            />,
          )}
          {row(
            t.print.header3,
            <Input
              value={cfg.header3}
              onChange={(e) => set({ header3: e.target.value })}
              placeholder={t.print.phExtra}
            />,
          )}
          {row(
            t.print.includeDate,
            <input
              type="checkbox"
              checked={cfg.includeDate}
              onChange={(e) => set({ includeDate: e.target.checked })}
            />,
          )}
          {row(
            t.print.repeatEveryPage,
            <input
              type="checkbox"
              checked={cfg.repeatHeaderOnEveryPage}
              onChange={(e) =>
                set({ repeatHeaderOnEveryPage: e.target.checked })
              }
            />,
          )}
          {row(
            t.print.logo,
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickLogo(e.target.files?.[0])}
                className="text-xs"
              />
              {cfg.logoDataUrl && (
                <img
                  src={cfg.logoDataUrl}
                  alt={t.print.logoPreview}
                  style={{ maxHeight: 28 }}
                />
              )}
              {cfg.logoDataUrl && (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    set({ logoDataUrl: undefined, includeLogo: false })
                  }
                >
                  {t.shared.remove}
                </Btn>
              )}
            </div>,
          )}
          {row(
            t.print.printLogo,
            <input
              type="checkbox"
              checked={cfg.includeLogo}
              onChange={(e) => set({ includeLogo: e.target.checked })}
              disabled={!cfg.logoDataUrl}
            />,
          )}
        </div>

        {/* Title + numbering */}
        <div className={card} style={cardStyle}>
          <div className={heading} style={{ color: "var(--muted-fg)" }}>
            {t.print.titleCard}
          </div>
          {row(
            t.print.defaultTitle,
            <Input
              value={cfg.reportTitle}
              onChange={(e) => set({ reportTitle: e.target.value })}
            />,
          )}
          {row(
            t.print.defaultSubtitle,
            <Input
              value={cfg.reportSubtitle}
              onChange={(e) => set({ reportSubtitle: e.target.value })}
            />,
          )}
          {row(
            t.print.numberPrefix,
            <Input
              value={cfg.docNumberPrefix}
              onChange={(e) => set({ docNumberPrefix: e.target.value })}
              placeholder="DOC"
            />,
          )}
          {row(
            t.print.nextAuto,
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {docNumber}
              </span>
              <Btn
                size="xs"
                variant="ghost"
                onClick={() => set({ docNumberSequence: 1 })}
              >
                {t.print.resetSequence}
              </Btn>
            </div>,
          )}
          {row(
            t.print.manualOverride,
            <Input
              value={cfg.docNumberManual}
              onChange={(e) => set({ docNumberManual: e.target.value })}
              placeholder={t.print.phAuto}
            />,
          )}
        </div>

        {/* Geometry + footer */}
        <div className={card} style={cardStyle}>
          <div className={heading} style={{ color: "var(--muted-fg)" }}>
            {t.print.geoCard}
          </div>
          {row(
            t.print.orientation,
            <Select
              value={cfg.orientation}
              onChange={(e) =>
                set({
                  orientation: e.target
                    .value as PrintHeaderConfig["orientation"],
                })
              }
              options={[
                { value: "portrait", label: t.print.portrait },
                { value: "landscape", label: t.print.landscape },
              ]}
            />,
          )}
          {row(
            t.print.pageSize,
            <Select
              value={cfg.pageSize}
              onChange={(e) =>
                set({
                  pageSize: e.target.value as PrintHeaderConfig["pageSize"],
                })
              }
              options={[
                { value: "a4", label: "A4" },
                { value: "letter", label: "Letter" },
              ]}
            />,
          )}
          {row(
            t.print.pageNumbers,
            <input
              type="checkbox"
              checked={cfg.includePageNumbers}
              onChange={(e) => set({ includePageNumbers: e.target.checked })}
            />,
          )}
          {row(
            t.print.footerText,
            <Input
              value={cfg.footerText}
              onChange={(e) => set({ footerText: e.target.value })}
              placeholder={t.print.phFooter}
            />,
          )}
        </div>

        {/* Live preview */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "2px dashed var(--border)" }}
        >
          <div
            className="px-4 py-3 text-center"
            style={{ background: "var(--card-bg)" }}
          >
            <div className="flex items-center justify-center gap-2">
              {cfg.includeLogo && cfg.logoDataUrl && (
                <img src={cfg.logoDataUrl} alt="" style={{ maxHeight: 32 }} />
              )}
              <div>
                {cfg.header1 && (
                  <div className="text-sm font-bold">{cfg.header1}</div>
                )}
                {cfg.header2 && (
                  <div className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {cfg.header2}
                  </div>
                )}
                {cfg.header3 && (
                  <div className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {cfg.header3}
                  </div>
                )}
              </div>
            </div>
            {cfg.reportTitle && (
              <div
                className="text-base font-bold mt-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cfg.reportTitle}
              </div>
            )}
            {cfg.reportSubtitle && (
              <div className="text-xs" style={{ color: "var(--muted-fg)" }}>
                {cfg.reportSubtitle}
              </div>
            )}
            <div
              className="text-[11px] mt-1"
              style={{
                color: "var(--muted-fg)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {docNumber}
              {cfg.includeDate
                ? ` · ${new Date().toISOString().slice(0, 10)}`
                : ""}
            </div>
          </div>
          <div
            className="px-4 py-1 flex justify-between text-xs"
            style={{
              background: "var(--secondary-bg)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span style={{ color: "var(--muted-fg)" }}>{cfg.footerText}</span>
            {cfg.includePageNumbers && (
              <span
                style={{
                  color: "var(--muted-fg)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {t.print.pageOf}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {dirty && (
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: "var(--warning)" }}
            >
              <Reset size="xs" />
              {t.print.unsaved}
            </span>
          )}
          <div className="flex-1" />
          <Btn
            variant="ghost"
            onClick={() => {
              setCfg({ ...DEFAULT_PRINT_CONFIG })
              setDirty(true)
            }}
            icon={<Reset size="xs" />}
          >
            {t.print.resetDefaults}
          </Btn>
          <Btn variant="ghost" onClick={onClose} icon={<Close size="xs" />}>
            {t.actions.cancel}
          </Btn>
          <Btn variant="primary" onClick={save} icon={<Save size="xs" />}>
            {t.print.saveClose}
          </Btn>
        </div>
      </div>
    </InfoModal>
  )
}
