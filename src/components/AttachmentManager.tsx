/**
 * Attachment manager backed by the core attachment store (IndexedDB in the
 * browser, in-memory under test). Files are real bytes: they can be added,
 * previewed, downloaded and removed, and each one is linked to a content record.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { InfoModal } from "./FormModal"
import { Btn, IconButton, EmptyState } from "./ui"
import {
  Attachment,
  Close,
  DownloadIcon,
  ExternalLinkIcon,
  Pencil,
  Refresh,
  Spinner,
  UploadIcon,
} from "./icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import {
  describeAttachments,
  describeProvenance,
  downloadAttachment,
  groupByRecord,
  openAttachment,
  type AttachmentMeta,
} from "../core/attachments"
import { formatBytes, timestamp } from "../core/text"

interface Props {
  isOpen: boolean
  onClose: () => void
  onToast?: (message: string) => void
  /** Open directly on this content record (deep link from a workspace view). */
  initialContentId?: string
}

export function AttachmentManager({
  isOpen,
  onClose,
  onToast,
  initialContentId,
}: Props) {
  const { t } = useTranslation()
  const { data, attachments, updateContent } = useAppData()

  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null,
  )
  const [metas, setMetas] = useState<AttachmentMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setMetas(await attachments.list())
    } finally {
      setLoading(false)
    }
  }, [attachments])

  useEffect(() => {
    if (isOpen) {
      void refresh()
      if (initialContentId) setSelectedContentId(initialContentId)
    }
  }, [isOpen, refresh, initialContentId])

  const contents = useMemo(() => data.contents, [data.contents])
  const selectedContent =
    contents.find((c) => c.id === selectedContentId) ?? null
  const filesForSelection = selectedContentId
    ? metas.filter((m) => m.contentId === selectedContentId)
    : []
  const countFor = (id: string) =>
    metas.filter((m) => m.contentId === id).length
  const totalBytes = metas.reduce((n, m) => n + m.size, 0)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    if (!selectedContentId) {
      onToast?.(t.sections.attachments.selectRecordFirst)
      return
    }
    const content = contents.find((c) => c.id === selectedContentId)
    const source = data.sources.find((s) => s.id === content?.sources_id)
    for (const file of Array.from(files)) {
      await attachments.put(selectedContentId, {
        name: file.name,
        mime: file.type || "application/octet-stream",
        data: file,
        recordType: "content",
        recordTitle: content?.title,
        sourceId: source?.id,
        sourceName: source?.name,
        origin: "file",
        sourceUrl: file.name,
        note: noteDraft.trim() || undefined,
      })
    }
    // Keep the content record's `attachments` list in sync with the stored files.
    const stored = await attachments.list(selectedContentId)
    const names = stored.map((m) => m.name)
    updateContent({ id: selectedContentId, attachments: names.join("; ") })
    setNoteDraft("")
    await refresh()
    onToast?.(
      t.sections.attachments.attachedTo
        .replace("{n}", String(files.length))
        .replace("{t}", content?.title ?? selectedContentId),
    )
  }

  const [noteDraft, setNoteDraft] = useState("")
  const [editingNote, setEditingNote] = useState<{
    id: string
    note: string
  } | null>(null)

  const removeFile = async (id: string) => {
    if (!selectedContentId) return
    await attachments.remove(id)
    const stored = await attachments.list(selectedContentId)
    updateContent({
      id: selectedContentId,
      attachments: stored.map((m) => m.name).join("; "),
    })
    await refresh()
  }

  const legacyNames = useMemo(() => {
    if (!selectedContent?.attachments) return []
    return selectedContent.attachments
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter((name) => name && !filesForSelection.some((m) => m.name === name))
  }, [selectedContent, filesForSelection])

  return (
    <InfoModal
      isOpen={isOpen}
      title={t.ops.attachments}
      onClose={onClose}
      size="lg"
    >
      <div className="flex gap-0" style={{ height: 360 }}>
        {/* Content records */}
        <div
          className="w-60 shrink-0 flex flex-col overflow-hidden"
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          <div
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide flex items-center justify-between"
            style={{
              color: "var(--muted-fg)",
              background: "var(--secondary-bg)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span>{t.nav.contents}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {formatBytes(totalBytes)}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contents.length === 0 && (
              <div
                className="px-3 py-4 text-xs text-center"
                style={{ color: "var(--muted-fg)" }}
              >
                {t.sections.contents.noData}
              </div>
            )}
            {contents.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedContentId(c.id)}
                className="w-full text-start px-3 py-2 text-xs transition-colors hover:bg-[var(--secondary-bg)]"
                style={{
                  background:
                    selectedContentId === c.id
                      ? "var(--secondary-bg)"
                      : "transparent",
                  borderInlineStart:
                    selectedContentId === c.id
                      ? "3px solid var(--primary)"
                      : "3px solid transparent",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="font-medium truncate">
                  {c.title || "(untitled)"}
                </div>
                <div style={{ color: "var(--muted-fg)", fontSize: 10 }}>
                  {t.sections.attachments.storedCount.replace(
                    "{n}",
                    String(countFor(c.id)),
                  )}
                  {c.attachments
                    ? ` · list: ${c.attachments.split(";").filter(Boolean).length}`
                    : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Files */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              color: "var(--muted-fg)",
              background: "var(--secondary-bg)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {selectedContent
              ? `Files — ${selectedContent.title || selectedContent.id}`
              : "Files"}
          </div>

          <div
            className="flex-1 overflow-y-auto"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void addFiles(e.dataTransfer.files)
            }}
            style={{
              outline: dragging ? "2px dashed var(--primary)" : "none",
              outlineOffset: -6,
            }}
          >
            {!selectedContentId ? (
              <EmptyState
                compact
                variant="empty"
                title={t.sections.attachments.selectRecordFirst}
                description={t.sections.attachments.pickRecordHint}
                icon={<Attachment size="xl" />}
              />
            ) : loading ? (
              <div
                className="flex items-center justify-center h-full gap-2 text-xs"
                style={{ color: "var(--muted-fg)" }}
              >
                <Spinner size="md" className="animate-spin-slow" />{" "}
                {t.sections.attachments.loadingFiles}
              </div>
            ) : filesForSelection.length === 0 && legacyNames.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full gap-2 text-xs"
                style={{ color: "var(--muted-fg)" }}
              >
                <span>{t.sections.attachments.noFilesYet}</span>
                <span style={{ fontSize: 10 }}>
                  {t.sections.attachments.dropOrAdd}
                </span>
              </div>
            ) : (
              <>
                {filesForSelection.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--secondary-bg)] transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span
                      className="text-xs truncate flex-1"
                      title={describeProvenance(m)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Attachment size="xs" /> {m.name}
                      </span>
                      <span style={{ color: "var(--muted-fg)", fontSize: 10 }}>
                        {" "}
                        · {formatBytes(m.size)} ·{" "}
                        {m.addedAt.slice(0, 16).replace("T", " ")} ·{" "}
                        {m.origin ?? "file"}
                        {m.sourceUrl && m.sourceUrl !== m.name
                          ? ` · ${m.sourceUrl}`
                          : ""}
                        {m.note ? ` · ${m.note}` : ""}
                      </span>
                    </span>
                    <IconButton
                      label={t.sections.attachments.editDetails}
                      onClick={() =>
                        setEditingNote({ id: m.id, note: m.note ?? "" })
                      }
                    >
                      <Pencil size="xs" />
                    </IconButton>
                    <IconButton
                      label={t.sections.attachments.openFile}
                      onClick={() => void openAttachment(attachments, m.id)}
                    >
                      <ExternalLinkIcon size="xs" />
                    </IconButton>
                    <Btn
                      size="xs"
                      variant="ghost"
                      onClick={() => void downloadAttachment(attachments, m.id)}
                      icon={<DownloadIcon size="xs" />}
                    >
                      {t.actions.download}
                    </Btn>
                    <IconButton
                      label={`${t.actions.delete} ${m.name}`}
                      danger
                      onClick={() => void removeFile(m.id)}
                    >
                      <Close size="xs" />
                    </IconButton>
                  </div>
                ))}
                {legacyNames.length > 0 && (
                  <div
                    className="px-3 py-2 text-[11px]"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    Referenced in the record but not stored in this browser:{" "}
                    {legacyNames.join(", ")}
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className="flex items-center gap-2 p-2"
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--secondary-bg)",
            }}
          >
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t.sections.attachments.sourcePlaceholder}
              className="px-2 py-1 text-[11px] outline-none rounded"
              style={{
                background: "var(--card-bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                width: 240,
              }}
            />
            <Btn
              size="xs"
              onClick={() => fileRef.current?.click()}
              disabled={!selectedContentId}
              icon={<UploadIcon size="xs" />}
            >
              {t.sections.attachments.addFiles}
            </Btn>
            <Btn
              size="xs"
              variant="ghost"
              onClick={() => void refresh()}
              icon={<Refresh size="xs" />}
            >
              {t.actions.refresh}
            </Btn>
            <div className="flex-1" />
            <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {describeAttachments(metas)}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files)
              if (fileRef.current) fileRef.current.value = ""
            }}
          />
        </div>
      </div>

      {editingNote && (
        <div className="flex items-center gap-2 pt-2">
          <input
            autoFocus
            value={editingNote.note}
            onChange={(e) =>
              setEditingNote({ ...editingNote, note: e.target.value })
            }
            placeholder={t.sections.attachments.notePlaceholder}
            className="flex-1 px-2 py-1.5 text-xs outline-none rounded"
            style={{
              background: "var(--card-bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
            }}
          />
          <Btn
            size="xs"
            variant="primary"
            onClick={async () => {
              await attachments.update(editingNote.id, {
                note: editingNote.note,
              })
              setEditingNote(null)
              await refresh()
              onToast?.(t.sections.attachments.updated)
            }}
          >
            {t.actions.save}
          </Btn>
          <Btn size="xs" onClick={() => setEditingNote(null)}>
            {t.actions.cancel}
          </Btn>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3">
        <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
          {t.sections.attachments.stored} ·{" "}
          {t.sections.attachments.linkedRecords.replace(
            "{n}",
            String(groupByRecord(metas).length),
          )}{" "}
          · refreshed {timestamp().slice(11, 19)}
        </span>
        <div className="flex-1" />
        <Btn onClick={onClose}>{t.actions.close}</Btn>
      </div>
    </InfoModal>
  )
}