/**
 * AttachmentField — pick a file, capture where it came from, and link it to the
 * record being edited.
 *
 * Works in two modes:
 *  • the record already exists → the file is written straight into the
 *    attachment store (IndexedDB) and the record's `attachments` list is updated;
 *  • the record is still new → files are staged in memory and the parent flushes
 *    them with {@link AttachmentFieldHandle.flush} once the record has an id.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Btn, IconButton } from "./ui"
import { Attachment, Close, Pencil, Save, UploadIcon } from "./icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import {
  describeProvenance,
  type AttachmentMeta,
  type AttachmentOrigin,
} from "../core/attachments"
import { formatBytes, timestamp } from "../core/text"

export interface StagedAttachment {
  key: string
  file: File
  origin: AttachmentOrigin
  sourceUrl: string
  note: string
}

export interface AttachmentFieldHandle {
  /** Write every staged file against `recordId`; returns the stored metadata. */
  flush: (recordId: string) => Promise<AttachmentMeta[]>
  staged: StagedAttachment[]
  clearStaged: () => void
  /** Open the native file picker (used by the "Attach file" action next to the field). */
  openPicker: () => void
}

interface Props {
  /** Record this attachment belongs to; empty while the form is creating one. */
  recordId?: string
  recordType?: "content" | "source" | "analysis"
  recordTitle?: string
  sourceId?: string
  sourceName?: string
  /** Current value of the record's `attachments` text field. */
  value?: string
  onChange?: (next: string) => void
  onToast?: (message: string) => void
  /** Compact styling when the field is embedded inside a Field slot. */
  embedded?: boolean
}

export const AttachmentField = forwardRef<AttachmentFieldHandle, Props>(
  function AttachmentField(
    {
      recordId,
      recordType = "content",
      recordTitle,
      sourceId,
      sourceName,
      value = "",
      onChange,
      onToast,
      embedded = false,
    },
    ref,
  ) {
    const { t } = useTranslation()
    const { attachments } = useAppData()
    const fileRef = useRef<HTMLInputElement>(null)

    const [stored, setStored] = useState<AttachmentMeta[]>([])
    const [staged, setStaged] = useState<StagedAttachment[]>([])
    const [sourceUrl, setSourceUrl] = useState("")
    const [note, setNote] = useState("")
    const [dragging, setDragging] = useState(false)
    const [busy, setBusy] = useState(false)
    /** Inline editor for one stored attachment (id -> draft). */
    const [editStored, setEditStored] = useState<{
      id: string
      name: string
      sourceUrl: string
      note: string
    } | null>(null)
    /** Inline editor for one staged attachment (key -> draft). */
    const [editStaged, setEditStaged] = useState<{
      key: string
      name: string
      sourceUrl: string
      note: string
    } | null>(null)

    const refresh = useCallback(async () => {
      if (!recordId) {
        setStored([])
        return
      }
      setStored(await attachments.list(recordId))
    }, [attachments, recordId])

    useEffect(() => {
      void refresh()
    }, [refresh])

    const names = (extra: string[] = []) =>
      [
        ...new Set([
          ...value
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
          ...extra,
        ]),
      ].join("; ")

    const stage = (files: FileList | File[] | null) => {
      if (!files) return
      const list = Array.from(files)
      if (!list.length) return
      if (!recordId) {
        setStaged((prev) => [
          ...prev,
          ...list.map((file, i) => ({
            key: `${timestamp()}-${i}-${file.name}`,
            file,
            origin: "file" as AttachmentOrigin,
            sourceUrl: sourceUrl.trim() || file.name,
            note: note.trim(),
          })),
        ])
        onToast?.(
          `${list.length} file(s) staged — they will be attached when the record is saved`,
        )
        return
      }
      void storeNow(list)
    }

    const storeNow = async (list: File[]) => {
      if (!recordId) return
      setBusy(true)
      try {
        const added: string[] = []
        for (const file of list) {
          await attachments.put(recordId, {
            name: file.name,
            mime: file.type || "application/octet-stream",
            data: file,
            recordType,
            recordTitle,
            sourceId,
            sourceName,
            origin: "file",
            sourceUrl: sourceUrl.trim() || file.name,
            note: note.trim(),
          })
          added.push(file.name)
        }
        onChange?.(names(added))
        await refresh()
        setSourceUrl("")
        setNote("")
        onToast?.(
          `Attached ${added.length} file(s) to ${recordTitle ?? recordId}`,
        )
      } finally {
        setBusy(false)
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        staged,
        clearStaged: () => setStaged([]),
        openPicker: () => fileRef.current?.click(),
        flush: async (newRecordId: string) => {
          const saved: AttachmentMeta[] = []
          for (const item of staged) {
            saved.push(
              await attachments.put(newRecordId, {
                name: item.file.name,
                mime: item.file.type || "application/octet-stream",
                data: item.file,
                recordType,
                recordTitle,
                sourceId,
                sourceName,
                origin: item.origin,
                sourceUrl: item.sourceUrl,
                note: item.note,
              }),
            )
          }
          setStaged([])
          return saved
        },
      }),
      [staged, attachments, recordType, recordTitle, sourceId, sourceName],
    )

    const removeStored = async (id: string, name: string) => {
      await attachments.remove(id)
      onChange?.(
        value
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s && s !== name)
          .join("; "),
      )
      await refresh()
    }

    const saveStoredEdit = async () => {
      if (!editStored) return
      const patch: Partial<AttachmentMeta> = {
        sourceUrl: editStored.sourceUrl.trim(),
        note: editStored.note.trim(),
      }
      if (editStored.name.trim()) patch.name = editStored.name.trim()
      await attachments.update(editStored.id, patch)
      setEditStored(null)
      await refresh()
      onToast?.(t.sections.attachments.updated)
    }

    const saveStagedEdit = () => {
      if (!editStaged) return
      setStaged((prev) =>
        prev.map((item) =>
          item.key === editStaged.key
            ? {
                ...item,
                sourceUrl: editStaged.sourceUrl.trim() || editStaged.name,
                note: editStaged.note.trim(),
              }
            : item,
        ),
      )
      setEditStaged(null)
    }

    const inputBase = {
      background: "var(--card-bg)",
      color: "var(--fg)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    } as React.CSSProperties

    return (
      <div className="flex flex-col gap-2">
        <div
          className={`rounded-lg flex flex-col gap-2 ${embedded ? "p-2" : "p-3"}`}
          style={{
            background: "var(--secondary-bg)",
            border: dragging
              ? "2px dashed var(--primary)"
              : "1px solid var(--border)",
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            stage(e.dataTransfer.files)
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Btn
              size="xs"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              icon={<UploadIcon size="xs" />}
            >
              {t.sections.attachments.addFiles}
            </Btn>
            <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {recordId
                ? t.sections.attachments.stored
                : t.sections.attachments.needsRecord}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={t.sections.attachments.sourcePlaceholder}
              className="px-2 py-1.5 text-xs outline-none"
              style={inputBase}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.sections.attachments.notePlaceholder}
              className="px-2 py-1.5 text-xs outline-none"
              style={inputBase}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              stage(e.target.files)
              if (fileRef.current) fileRef.current.value = ""
            }}
          />
        </div>

        {/* staged (record not saved yet) */}
        {staged.length > 0 && (
          <div className="flex flex-col gap-1">
            <div
              className="text-[10px] uppercase tracking-wide font-semibold"
              style={{ color: "var(--muted-fg)" }}
            >
              {t.sections.attachments.stagedCount.replace(
                "{n}",
                String(staged.length),
              )}
            </div>
            {staged.map((item) => (
              <React.Fragment key={item.key}>
              <div
                className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                style={{ background: "var(--secondary-bg)" }}
              >
                <span
                  className="truncate inline-flex items-center gap-1.5"
                  style={{ flex: "1 1 auto" }}
                >
                  <Attachment size="xs" /> {item.file.name}
                  <span style={{ color: "var(--muted-fg)" }}>
                    {" "}
                    · {formatBytes(item.file.size)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <IconButton
                    label={`${t.actions.edit} ${item.file.name}`}
                    onClick={() =>
                      setEditStaged(
                        editStaged?.key === item.key
                          ? null
                          : {
                              key: item.key,
                              name: item.file.name,
                              sourceUrl: item.sourceUrl,
                              note: item.note,
                            },
                      )
                    }
                  >
                    <Pencil size="xs" />
                  </IconButton>
                  <IconButton
                    label={`${t.actions.delete} ${item.file.name}`}
                    onClick={() =>
                      setStaged((prev) =>
                        prev.filter((s2) => s2.key !== item.key),
                      )
                    }
                  >
                    <Close size="xs" />
                  </IconButton>
                </span>
              </div>
              {editStaged?.key === item.key && (
                <div
                  className="grid gap-1.5 px-2 pb-1"
                  style={{ gridTemplateColumns: "1fr 1fr auto" }}
                >
                  <input
                    value={editStaged.name}
                    onChange={(e) =>
                      setEditStaged({ ...editStaged, name: e.target.value })
                    }
                    placeholder={t.fields.title}
                    className="px-2 py-1 text-xs outline-none"
                    style={inputBase}
                  />
                  <input
                    value={editStaged.note}
                    onChange={(e) =>
                      setEditStaged({ ...editStaged, note: e.target.value })
                    }
                    placeholder={t.sections.attachments.notePlaceholder}
                    className="px-2 py-1 text-xs outline-none"
                    style={inputBase}
                  />
                  <Btn
                    size="xs"
                    variant="primary"
                    icon={<Save size="xs" />}
                    onClick={saveStagedEdit}
                  >
                    {t.actions.save}
                  </Btn>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* already stored against this record */}
        {stored.length > 0 && (
          <div className="flex flex-col gap-1">
            <div
              className="text-[10px] uppercase tracking-wide font-semibold"
              style={{ color: "var(--muted-fg)" }}
            >
              {t.sections.attachments.title} ({stored.length})
            </div>
            {stored.map((meta) => (
              <React.Fragment key={meta.id}>
              <div
                className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                style={{ background: "var(--secondary-bg)" }}
              >
                <span
                  className="truncate inline-flex items-center gap-1.5"
                  style={{ flex: "1 1 auto" }}
                  title={describeProvenance(meta)}
                >
                  <Attachment size="xs" /> {meta.name}
                  <span style={{ color: "var(--muted-fg)" }}>
                    {" "}
                    · {formatBytes(meta.size)} · {meta.origin ?? "file"} ·{" "}
                    {meta.addedAt.slice(0, 16).replace("T", " ")}
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <IconButton
                    label={t.sections.attachments.editDetails}
                    onClick={() =>
                      setEditStored(
                        editStored?.id === meta.id
                          ? null
                          : {
                              id: meta.id,
                              name: meta.name,
                              sourceUrl: meta.sourceUrl ?? "",
                              note: meta.note ?? "",
                            },
                      )
                    }
                  >
                    <Pencil size="xs" />
                  </IconButton>
                  <IconButton
                    label={`${t.actions.delete} ${meta.name}`}
                    danger
                    onClick={() => void removeStored(meta.id, meta.name)}
                  >
                    <Close size="xs" />
                  </IconButton>
                </span>
              </div>
              {editStored?.id === meta.id && (
                <div
                  className="grid gap-1.5 px-2 pb-1"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}
                >
                  <input
                    value={editStored.name}
                    onChange={(e) =>
                      setEditStored({ ...editStored, name: e.target.value })
                    }
                    placeholder={t.fields.name}
                    className="px-2 py-1 text-xs outline-none"
                    style={inputBase}
                  />
                  <input
                    value={editStored.sourceUrl}
                    onChange={(e) =>
                      setEditStored({ ...editStored, sourceUrl: e.target.value })
                    }
                    placeholder={t.sections.attachments.sourcePlaceholder}
                    className="px-2 py-1 text-xs outline-none"
                    style={inputBase}
                  />
                  <input
                    value={editStored.note}
                    onChange={(e) =>
                      setEditStored({ ...editStored, note: e.target.value })
                    }
                    placeholder={t.sections.attachments.notePlaceholder}
                    className="px-2 py-1 text-xs outline-none"
                    style={inputBase}
                  />
                  <Btn
                    size="xs"
                    variant="primary"
                    icon={<Save size="xs" />}
                    onClick={() => void saveStoredEdit()}
                  >
                    {t.actions.save}
                  </Btn>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        )}

        {!embedded && value && (
          <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
            {t.fields.attachments}:{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
          </div>
        )}
      </div>
    )
  },
)