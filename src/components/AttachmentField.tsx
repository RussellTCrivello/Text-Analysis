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
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Btn } from './ui';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';
import { describeProvenance, type AttachmentMeta, type AttachmentOrigin } from '../core/attachments';
import { IconAttach, IconClose } from './icons';
import { formatBytes, timestamp } from '../core/text';

export interface StagedAttachment {
  key: string;
  file: File;
  origin: AttachmentOrigin;
  sourceUrl: string;
  note: string;
}

export interface AttachmentFieldHandle {
  /** Write every staged file against `recordId`; returns the stored metadata. */
  flush: (recordId: string) => Promise<AttachmentMeta[]>;
  staged: StagedAttachment[];
  clearStaged: () => void;
}

interface Props {
  /** Record this attachment belongs to; empty while the form is creating one. */
  recordId?: string;
  recordType?: 'content' | 'source' | 'analysis';
  recordTitle?: string;
  sourceId?: string;
  sourceName?: string;
  /** Current value of the record's `attachments` text field. */
  value?: string;
  onChange?: (next: string) => void;
  onToast?: (message: string) => void;
}

export const AttachmentField = forwardRef<AttachmentFieldHandle, Props>(function AttachmentField(
  { recordId, recordType = 'content', recordTitle, sourceId, sourceName, value = '', onChange, onToast },
  ref,
) {
  const { t } = useTranslation();
  const { attachments } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stored, setStored] = useState<AttachmentMeta[]>([]);
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!recordId) {
      setStored([]);
      return;
    }
    setStored(await attachments.list(recordId));
  }, [attachments, recordId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const names = (extra: string[] = []) =>
    [...new Set([...value.split(';').map((s) => s.trim()).filter(Boolean), ...extra])].join('; ');

  const stage = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    if (!list.length) return;
    if (!recordId) {
      setStaged((prev) => [
        ...prev,
        ...list.map((file, i) => ({
          key: `${timestamp()}-${i}-${file.name}`,
          file,
          origin: 'file' as AttachmentOrigin,
          sourceUrl: sourceUrl.trim() || file.name,
          note: note.trim(),
        })),
      ]);
      onToast?.(`${list.length} file(s) staged — they will be attached when the record is saved`);
      return;
    }
    void storeNow(list);
  };

  const storeNow = async (list: File[]) => {
    if (!recordId) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of list) {
        await attachments.put(recordId, {
          name: file.name,
          mime: file.type || 'application/octet-stream',
          data: file,
          recordType,
          recordTitle,
          sourceId,
          sourceName,
          origin: 'file',
          sourceUrl: sourceUrl.trim() || file.name,
          note: note.trim(),
        });
        added.push(file.name);
      }
      onChange?.(names(added));
      await refresh();
      setSourceUrl('');
      setNote('');
      onToast?.(`Attached ${added.length} file(s) to ${recordTitle ?? recordId}`);
    } finally {
      setBusy(false);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      staged,
      clearStaged: () => setStaged([]),
      flush: async (newRecordId: string) => {
        const saved: AttachmentMeta[] = [];
        for (const item of staged) {
          saved.push(
            await attachments.put(newRecordId, {
              name: item.file.name,
              mime: item.file.type || 'application/octet-stream',
              data: item.file,
              recordType,
              recordTitle,
              sourceId,
              sourceName,
              origin: item.origin,
              sourceUrl: item.sourceUrl,
              note: item.note,
            }),
          );
        }
        setStaged([]);
        return saved;
      },
    }),
    [staged, attachments, recordType, recordTitle, sourceId, sourceName],
  );

  const removeStored = async (id: string, name: string) => {
    await attachments.remove(id);
    onChange?.(
      value
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && s !== name)
        .join('; '),
    );
    await refresh();
  };

  const inputBase = {
    background: 'var(--card-bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-lg p-3 flex flex-col gap-2"
        style={{
          background: 'var(--secondary-bg)',
          border: dragging ? '2px dashed var(--primary)' : '1px solid var(--border)',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          stage(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Btn size="xs" onClick={() => fileRef.current?.click()} disabled={busy} icon={<IconAttach size="sm" />}>
            {recordId ? t.sections.attachments.attachFile : t.sections.attachments.attachFile}
          </Btn>
          <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
            {recordId ? t.sections.attachments.stored : t.sections.attachments.staged}
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
            stage(e.target.files);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </div>

      {/* staged (record not saved yet) */}
      {staged.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-fg)' }}>
            {t.sections.attachments.staged}
          </div>
          {staged.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: 'var(--secondary-bg)' }}>
              <span className="truncate" style={{ flex: '1 1 auto' }}>
                <IconAttach size="xs" /> {item.file.name}
                <span style={{ color: 'var(--muted-fg)' }}> · {formatBytes(item.file.size)}</span>
              </span>
              <Btn
                size="xs"
                variant="ghost"
                onClick={() => setStaged((prev) => prev.filter((s) => s.key !== item.key))}
                aria-label={t.actions.delete}
                title={t.actions.delete}
              >
                <IconClose size="xs" />
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* already stored against this record */}
      {stored.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-fg)' }}>
            {t.sections.attachments.title} ({stored.length})
          </div>
          {stored.map((meta) => (
            <div key={meta.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: 'var(--secondary-bg)' }}>
              <span className="truncate" style={{ flex: '1 1 auto' }} title={describeProvenance(meta)}>
                <IconAttach size="xs" /> {meta.name}
                <span style={{ color: 'var(--muted-fg)' }}>
                  {' '}
                  · {formatBytes(meta.size)} · {meta.origin ?? 'file'} · {meta.addedAt.slice(0, 16).replace('T', ' ')}
                </span>
              </span>
              <Btn size="xs" variant="danger" onClick={() => void removeStored(meta.id, meta.name)} aria-label={t.actions.delete} title={t.actions.delete}>
                <IconClose size="xs" />
              </Btn>
            </div>
          ))}
        </div>
      )}

      {value && (
        <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
          {t.fields.attachments}: <span style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
        </div>
      )}
    </div>
  );
});
