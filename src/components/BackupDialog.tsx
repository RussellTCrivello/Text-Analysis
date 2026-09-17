/**
 * Backup & Restore as a deliberate system workflow (fully redesigned):
 *
 *   Overview → Create → Archive (select) → Restore / Merge / Download / Delete
 *   plus a file-based import path that always verifies before touching data.
 *
 * All previous capabilities are preserved and routed through the core backup
 * engine: versioned envelopes with record counts and checksums, verification
 * before anything touches live data, and the three merge policies (skip /
 * replace / duplicate) for id collisions. Destructive steps confirm in-app.
 */
import React, { useMemo, useRef, useState } from "react"
import {
  Modal,
  Btn,
  Field,
  Input,
  Callout,
  EmptyState,
  ProgressBar,
  Divider,
} from "./ui"
import { ConfirmDialog } from "./FormModal"
import {
  Backup,
  Check,
  CircleXIcon,
  DatabaseIcon,
  DownloadIcon,
  ErrorIcon,
  HistoryIcon,
  Restore,
  Spinner,
  Success,
  TableIcon,
  Trash,
  Close,
  UploadIcon,
  Verify,
  Warning,
} from "./icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import { downloadArtifact } from "../core/export/exporters"
import { formatDateTime, formatBytes } from "../core/text"
import type { MergePolicy, VerifyResult } from "../core/backup"

export function BackupDialog({
  isOpen,
  onClose,
  onToast,
}: {
  isOpen: boolean
  onClose: () => void
  onToast: (m: string) => void
}) {
  const { t } = useTranslation()
  const {
    backups,
    createBackup,
    restoreBackup,
    mergeBackup,
    deleteBackup,
    importBackupFile,
    exportBackupFile,
    verifyBackupFile,
    data,
  } = useAppData()
  const bk = t.backup

  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [note, setNote] = useState("")
  const [policy, setPolicy] = useState<MergePolicy>("skip")
  const [confirm, setConfirm] = useState<"restore" | "delete" | null>(null)
  const [pending, setPending] = useState<{
    name: string
    result: VerifyResult
    text: string
  } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [created, setCreated] = useState<{ name: string; bytes: number } | null>(
    null,
  )
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedBackup = useMemo(
    () => backups.find((b) => b.id === selected) ?? null,
    [backups, selected],
  )
  const totalRecords =
    data.sources.length + data.contents.length + data.analyses.length
  const policyOpts: { value: MergePolicy; label: string }[] = [
    { value: "skip", label: bk.policySkip },
    { value: "replace", label: bk.policyReplace },
    { value: "duplicate", label: bk.policyDuplicate },
  ]

  const doCreate = () => {
    const entry = createBackup(newName || undefined, note || undefined)
    setNewName("")
    setNote("")
    setCreated({ name: entry.name, bytes: entry.bytes })
    onToast(`${bk.createDone} · ${formatBytes(entry.bytes)}`)
  }

  const doRestore = () => {
    if (!selected) return
    restoreBackup(selected)
    setConfirm(null)
    setSelected(null)
    onToast(bk.restoreDone)
  }

  const doMerge = () => {
    if (!selected) return
    mergeBackup(selected, policy)
    onToast(`${bk.mergeDone} (${policy})`)
  }

  const doDelete = () => {
    if (!selected) return
    deleteBackup(selected)
    setConfirm(null)
    setSelected(null)
  }

  const doDownload = () => {
    if (!selected) return
    const artifact = exportBackupFile(selected)
    if (!artifact) return
    downloadArtifact({
      ...artifact,
      filename: `${artifact.filename.replace(/\.json$/, "")}.tam.json`,
    })
    onToast(bk.downloadDone)
  }

  const readFile = (file: File) => {
    setVerifying(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "")
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        setVerifying(false)
        setPending({
          name: file.name,
          result: { ok: false, errors: [bk.invalidJson], warnings: [] },
          text,
        })
        return
      }
      // Verify first — never write unverified data.
      const result = verifyBackupFile(JSON.stringify(parsed))
      setPending({ name: file.name, result, text })
      setVerifying(false)
    }
    reader.onerror = () => {
      setVerifying(false)
      setPending({
        name: file.name,
        result: { ok: false, errors: [bk.verifyFailed], warnings: [] },
        text: "",
      })
    }
    reader.readAsText(file)
  }

  const applyPending = () => {
    if (!pending) return
    const result = importBackupFile(pending.text, policy)
    if (!result.ok) {
      onToast(result.errors[0] ?? bk.verifyFailed)
      return
    }
    onToast(bk.fileImportDone)
    setPending(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        icon={<Backup size="sm" />}
        title={bk.title}
        subtitle={`${totalRecords} ${t.messages.records} · ${backups.length} ${bk.archiveHeading.toLowerCase()}`}
        footer={
          <>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) readFile(file)
                }}
              />
              <Btn
                onClick={() => fileRef.current?.click()}
                icon={<UploadIcon size="sm" />}
              >
                {bk.restoreFromFile}
              </Btn>
              <span
                className="text-[11px] hidden sm:inline truncate"
                style={{ color: "var(--muted-fg-2)" }}
              >
                {bk.dropHint}
              </span>
            </div>
            <Btn variant="primary" onClick={onClose} icon={<Check size="sm" />}>
              {t.actions.close}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Overview strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                label: t.fields.name === "Name" ? "Sources" : t.nav.sources,
                value: data.sources.length,
                color: "var(--color-source)",
                icon: <DatabaseIcon size="sm" />,
              },
              {
                label: t.nav.contents,
                value: data.contents.length,
                color: "var(--color-content)",
                icon: <TableIcon size="sm" />,
              },
              {
                label: t.nav.analysis,
                value: data.analyses.length,
                color: "var(--color-analysis)",
                icon: <HistoryIcon size="sm" />,
              },
              {
                label: bk.lastBackup,
                value: backups[0]
                  ? formatDateTime(backups[0].date_creation).slice(0, 16)
                  : bk.neverBackedUp,
                color: "var(--muted-fg)",
                icon: <Verify size="sm" />,
                small: true,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-[var(--radius)] px-3 py-2 flex flex-col gap-0.5"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em]"
                  style={{ color: "var(--muted-fg)" }}
                >
                  <span style={{ color: tile.color }}>{tile.icon}</span>
                  {tile.label}
                </span>
                <span
                  className={`font-bold ${
                    tile.small ? "text-[11px]" : "text-lg tnum"
                  }`}
                  style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}
                >
                  {tile.value}
                </span>
              </div>
            ))}
          </div>

          {/* Create */}
          <section
            className="rounded-[var(--radius-lg)] p-3 flex flex-col gap-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--primary)" }}>
                <Backup size="sm" />
              </span>
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {bk.createHeading}
              </h3>
            </div>
            <p className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {bk.createDesc}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={bk.backupName}>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={bk.namePlaceholder}
                  className="!w-56"
                />
              </Field>
              <Field label={bk.noteLabel}>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={bk.notePlaceholder}
                  className="!w-56"
                />
              </Field>
              <Btn
                variant="primary"
                onClick={doCreate}
                icon={<Backup size="sm" />}
              >
                {bk.createBackup}
              </Btn>
            </div>
            {created && (
              <Callout
                variant="success"
                title={`${bk.createDone} — ${created.name}`}
                onClose={() => setCreated(null)}
              >
                {formatBytes(created.bytes)} · {bk.checksumLabel}{" "}
                {backups[0]?.checksum.slice(0, 12)}…
              </Callout>
            )}
          </section>

          {/* Archive table */}
          <section>
            <div className="flex items-center gap-2 mb-1.5">
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {bk.archiveHeading}
              </h3>
              <span
                className="text-[11px]"
                style={{ color: "var(--muted-fg)" }}
              >
                {bk.archiveDesc}
              </span>
              <div className="flex-1" />
              <span
                className="text-[10px] tnum"
                style={{
                  color: "var(--muted-fg-2)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {backups.length}
              </span>
            </div>
            {backups.length === 0 ? (
              <div
                className="rounded-[var(--radius-lg)]"
                style={{ border: "1px dashed var(--border-strong)" }}
              >
                <EmptyState
                  compact
                  title={bk.emptyArchive}
                  description={bk.createDesc}
                  icon={<Backup size="xl" />}
                />
              </div>
            ) : (
              <div
                className="rounded-[var(--radius-lg)] overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                  <table className="w-full" style={{ tableLayout: "fixed" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        {[
                          bk.colName,
                          bk.colDate,
                          t.nav.sources,
                          t.nav.contents,
                          t.nav.analysis,
                          bk.sizeLabel,
                          bk.checksumLabel,
                        ].map((h, i) => (
                          <th
                            key={`${h}-${i}`}
                            className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-start border-b"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--muted-fg)",
                              width:
                                i === 0 ? "24%" : i === 1 ? "17%" : undefined,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((entry) => {
                        const sel = selected === entry.id
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setSelected(entry.id)}
                            className="cursor-pointer transition-colors"
                            style={{
                              background: sel
                                ? "var(--primary-soft)"
                                : "var(--surface)",
                              boxShadow: sel
                                ? "inset 2px 0 0 var(--primary)"
                                : undefined,
                            }}
                            aria-selected={sel}
                          >
                            <td
                              className="px-2 py-1.5 text-xs border-b truncate font-semibold"
                              style={{ borderColor: "var(--border)" }}
                              title={entry.note || undefined}
                            >
                              {entry.name}
                              {entry.note && (
                                <span
                                  className="font-normal ms-1.5"
                                  style={{ color: "var(--muted-fg-2)" }}
                                >
                                  · {entry.note}
                                </span>
                              )}
                            </td>
                            <td
                              className="px-2 py-1.5 text-xs border-b tnum"
                              style={{
                                borderColor: "var(--border)",
                                fontFamily: "var(--font-mono)",
                                color: "var(--muted-fg)",
                              }}
                            >
                              {formatDateTime(entry.date_creation)}
                            </td>
                            <td
                              className="px-2 py-1.5 text-xs border-b text-center tnum"
                              style={{ borderColor: "var(--border)" }}
                            >
                              {entry.sourceCount}
                            </td>
                            <td
                              className="px-2 py-1.5 text-xs border-b text-center tnum"
                              style={{ borderColor: "var(--border)" }}
                            >
                              {entry.contentCount}
                            </td>
                            <td
                              className="px-2 py-1.5 text-xs border-b text-center tnum"
                              style={{ borderColor: "var(--border)" }}
                            >
                              {entry.analysisCount}
                            </td>
                            <td
                              className="px-2 py-1.5 text-xs border-b tnum"
                              style={{
                                borderColor: "var(--border)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {formatBytes(entry.bytes)}
                            </td>
                            <td
                              className="px-2 py-1.5 text-[10px] border-b truncate tnum"
                              title={entry.checksum}
                              style={{
                                borderColor: "var(--border)",
                                fontFamily: "var(--font-mono)",
                                color: "var(--muted-fg)",
                              }}
                            >
                              {entry.checksum.slice(0, 12)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Selected backup actions */}
          <section
            className="rounded-[var(--radius-lg)] p-3 flex flex-col gap-2"
            style={{
              background: "var(--surface-2)",
              border: `1px solid ${
                selectedBackup ? "var(--primary-soft-2)" : "var(--border)"
              }`,
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--primary)" }}>
                <Restore size="sm" />
              </span>
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {bk.restoreHeading}
              </h3>
              {selectedBackup && (
                <span
                  className="text-xs font-semibold tnum"
                  style={{ color: "var(--primary)" }}
                >
                  {selectedBackup.name}
                </span>
              )}
            </div>
            <p className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {bk.restoreDesc}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Field label={bk.policyLabel}>
                <div
                  className="flex items-center rounded-[var(--radius)] p-0.5"
                  role="radiogroup"
                  aria-label={bk.policyLabel}
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  {policyOpts.map((o) => (
                    <button
                      key={o.value}
                      role="radio"
                      aria-checked={policy === o.value}
                      onClick={() => setPolicy(o.value)}
                      className="px-2 py-1 text-[10px] font-semibold rounded-[5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      style={{
                        background:
                          policy === o.value ? "var(--primary)" : "transparent",
                        color:
                          policy === o.value
                            ? "var(--primary-fg)"
                            : "var(--muted-fg)",
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex-1" />
              <Btn
                variant="primary"
                onClick={() => selected && setConfirm("restore")}
                disabled={!selected}
                icon={<Restore size="sm" />}
              >
                {bk.restoreSelected}
              </Btn>
              <Btn
                onClick={doMerge}
                disabled={!selected}
                icon={<TableIcon size="sm" />}
              >
                {bk.mergeSelected}
              </Btn>
              <Btn
                onClick={doDownload}
                disabled={!selected}
                icon={<DownloadIcon size="sm" />}
              >
                {bk.exportBackup}
              </Btn>
              <Btn
                variant="danger"
                onClick={() => selected && setConfirm("delete")}
                disabled={!selected}
                icon={<Trash size="sm" />}
              >
                {bk.deleteSelected}
              </Btn>
            </div>
            {selectedBackup && (
              <p
                className="text-[11px] inline-flex items-center gap-1.5"
                style={{ color: "var(--muted-fg-2)" }}
              >
                <Warning size="xs" /> {bk.restoreHint}
              </p>
            )}
          </section>

          {/* File verification panel */}
          {(verifying || pending) && <Divider label={bk.verifyHeading} />}
          {verifying && (
            <div
              className="flex items-center gap-2 text-xs py-2"
              style={{ color: "var(--muted-fg)" }}
            >
              <Spinner size="sm" className="animate-spin-slow" />{" "}
              {bk.verifyChecking}
              <div className="flex-1 max-w-40">
                <ProgressBar indeterminate label={bk.verifyChecking} />
              </div>
            </div>
          )}
          {pending && (
            <div
              className="rounded-[var(--radius-lg)] p-3 flex flex-col gap-2 text-xs"
              style={{
                background: pending.result.ok
                  ? "var(--success-soft)"
                  : "var(--error-soft)",
                border: `1px solid ${
                  pending.result.ok ? "var(--success)" : "var(--error)"
                }40`,
              }}
            >
              <div className="flex items-center gap-2">
                {pending.result.ok ? (
                  <Success size="sm" />
                ) : (
                  <ErrorIcon size="sm" />
                )}
                <span
                  className="font-bold"
                  style={{
                    color: pending.result.ok
                      ? "var(--success)"
                      : "var(--error)",
                  }}
                >
                  {pending.result.ok ? bk.verifyPassed : bk.verifyFailed}
                </span>
                <span
                  className="tnum truncate"
                  style={{
                    color: "var(--muted-fg)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {pending.name}
                </span>
                <div className="flex-1" />
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setPending(null)
                    if (fileRef.current) fileRef.current.value = ""
                  }}
                  icon={<Close size="xs" />}
                >
                  {t.actions.cancel}
                </Btn>
              </div>
              {pending.result.meta && (
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
                  style={{ color: "var(--fg-soft)" }}
                >
                  {[
                    `${pending.result.meta.counts.sources} ${t.nav.sources}`,
                    `${pending.result.meta.counts.contents} ${t.nav.contents}`,
                    `${pending.result.meta.counts.analyses} ${t.nav.analysis}`,
                    formatBytes(pending.result.meta.bytes),
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="tnum px-2 py-1 rounded-[var(--radius-sm)]"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              {pending.result.meta && (
                <div
                  className="tnum"
                  style={{
                    color: "var(--muted-fg)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                  }}
                >
                  {bk.schemaLabel} v{pending.result.meta.version} ·{" "}
                  {bk.appVersionLabel} {pending.result.meta.appVersion}
                  {pending.result.meta.hasAudit ? ` · ${bk.auditIncluded}` : ""}
                </div>
              )}
              {pending.result.errors.map((e) => (
                <div
                  key={e}
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "var(--error)" }}
                >
                  <CircleXIcon size="xs" /> {e}
                </div>
              ))}
              {pending.result.warnings.map((w) => (
                <div
                  key={w}
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "var(--warning)" }}
                >
                  <Warning size="xs" /> {w}
                </div>
              ))}
              {pending.result.ok && (
                <div className="flex items-center gap-2 pt-1">
                  <span style={{ color: "var(--muted-fg)" }}>
                    {bk.applyPolicy}:
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--fg)" }}
                  >
                    {policyOpts.find((o) => o.value === policy)?.label}
                  </span>
                  <div className="flex-1" />
                  <Btn
                    size="xs"
                    variant="primary"
                    onClick={applyPending}
                    icon={<Check size="xs" />}
                  >
                    {t.actions.apply}
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirm === "restore"}
        title={bk.restoreSelected}
        message={`${bk.confirmRestore}${
          selectedBackup
            ? ` ${bk.recordsAtRisk.replace("{n}", String(selectedBackup.sourceCount + selectedBackup.contentCount + selectedBackup.analysisCount))}`
            : ""
        }`}
        onConfirm={doRestore}
        onCancel={() => setConfirm(null)}
        danger
        confirmLabel={bk.confirmScaffold}
      />
      <ConfirmDialog
        isOpen={confirm === "delete"}
        title={bk.deleteSelected}
        message={`${bk.confirmDelete} ${bk.deleteHint}`}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
        danger
        confirmLabel={bk.confirmScaffold}
      />
    </>
  )
}