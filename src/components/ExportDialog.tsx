/**
 * Unified export dialog: column selection plus every format the core supports
 * (CSV/TSV, JSON/JSONL, XML, HTML, Markdown, XLSX, XLS, DOCX, DOC, PDF, TXT),
 * with a live preview and the global print header applied to document formats.
 */
import React, { useMemo, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useTranslation } from '../i18n';
import { useAppData } from '../store/AppContext';
import {
  downloadArtifact,
  exportData,
  FORMAT_META,
  type ExportFormat,
} from '../core/export/exporters';
import { formatBytes } from '../core/text';
import { nextDocumentNumber } from '../core/print';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, unknown>[];
  columns: { key: string; label: string; format?: 'percent' | 'date' | 'datetime' | 'text' }[];
  defaultFilename?: string;
  onToast?: (message: string) => void;
}

const FORMAT_GROUPS: { group: string; formats: ExportFormat[] }[] = [
  { group: 'Spreadsheet', formats: ['xlsx', 'xls', 'csv', 'tsv'] },
  { group: 'Document', formats: ['docx', 'doc', 'pdf', 'html', 'markdown'] },
  { group: 'Data interchange', formats: ['json', 'jsonl', 'xml', 'txt'] },
];

export function ExportDialog({ isOpen, onClose, data, columns, defaultFilename = 'export', onToast }: ExportDialogProps) {
  const { t } = useTranslation();
  const { printConfig } = useAppData();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [filename, setFilename] = useState(defaultFilename);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeId, setIncludeId] = useState(false);
  const [bom, setBom] = useState(true);
  const [lastResult, setLastResult] = useState<string>('');

  const activeCols = useMemo(
    () => columns.filter((c) => selectedCols.has(c.key) && (includeId || c.key !== 'id')),
    [columns, selectedCols, includeId],
  );

  const previewRows = data.slice(0, 6);
  const isDocument = ['docx', 'doc', 'pdf', 'html'].includes(format);

  const buildOptions = () => ({
    columns: activeCols.map((c) => ({ key: c.key, label: c.label, format: c.format })),
    format,
    filename,
    includeHeaders,
    bom,
    sheetName: t.dialogs.exportDialog.title,
    title: printConfig.reportTitle || t.dialogs.exportDialog.title,
    subtitle: printConfig.reportSubtitle,
    headerLines: [printConfig.header1, printConfig.header2, printConfig.header3].filter(Boolean),
    footerText: printConfig.footerText,
    docNumber: nextDocumentNumber(printConfig),
    pageSize: printConfig.pageSize,
    orientation: printConfig.orientation,
  });

  const estimated = useMemo(() => {
    if (!activeCols.length || !data.length) return null;
    try {
      const artifact = exportData(data.slice(0, 25), buildOptions());
      const perRow = artifact.bytes / Math.min(25, data.length);
      return formatBytes(Math.max(artifact.bytes, perRow * data.length));
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeCols, format, filename, includeHeaders, includeId, bom, printConfig]);

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const doExport = () => {
    if (!data.length) {
      window.alert(t.messages.nothingToExport);
      return;
    }
    if (!activeCols.length) return;
    const artifact = exportData(data, buildOptions());
    downloadArtifact(artifact);
    setLastResult(`${artifact.filename} · ${formatBytes(artifact.bytes)} · ${artifact.rows} rows`);
    if (artifact.warnings.length && onToast) onToast(artifact.warnings[0]);
    else if (onToast) onToast(t.messages.exportSuccess);
  };

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.exportDialog.title} onClose={onClose} size="lg">
      <div className="flex gap-4" style={{ minHeight: 360 }}>
        {/* Settings */}
        <div className="flex flex-col gap-3" style={{ width: 232, flexShrink: 0 }}>
          <Field label={t.dialogs.exportDialog.format}>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="w-full rounded border px-2 py-1 text-xs outline-none"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
            >
              {FORMAT_GROUPS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.formats.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_META[f].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={t.dialogs.exportDialog.filename} hint={`${filename || 'export'}.${FORMAT_META[format].ext}`}>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
              {t.dialogs.exportDialog.options}
            </span>
            {[
              { label: t.dialogs.exportDialog.includeHeaders, value: includeHeaders, set: setIncludeHeaders },
              { label: t.dialogs.exportDialog.includeId, value: includeId, set: setIncludeId },
              { label: 'UTF-8 BOM (Excel)', value: bom, set: setBom },
            ].map((opt) => (
              <label key={opt.label} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={opt.value} onChange={(e) => opt.set(e.target.checked)} />
                {opt.label}
              </label>
            ))}
          </div>

          {isDocument && (
            <div className="rounded p-2 text-[11px] leading-snug" style={{ background: 'var(--secondary-bg)', color: 'var(--muted-fg)' }}>
              Document formats use the print header from Settings → Print Settings
              {printConfig.header1 ? ` (“${printConfig.header1}”)` : ''} and document number{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{nextDocumentNumber(printConfig)}</span>.
            </div>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
                {t.dialogs.exportDialog.columns}
              </span>
              <button
                className="text-[10px] underline"
                style={{ color: 'var(--primary)' }}
                onClick={() =>
                  setSelectedCols((prev) => (prev.size === columns.length ? new Set() : new Set(columns.map((c) => c.key))))
                }
              >
                {selectedCols.size === columns.length ? 'none' : 'all'}
              </button>
            </div>
            <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 150 }}>
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {estimated && (
            <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
              ≈ {estimated} · {data.length} rows × {activeCols.length} cols
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
            {t.dialogs.exportDialog.preview} · {data.length} {t.messages.records}
          </span>
          <div className="flex-1 overflow-auto border rounded" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--secondary-bg)' }}>
                  {activeCols.map((c) => (
                    <th
                      key={c.key}
                      className="px-2 py-1 text-xs font-semibold text-start border-b whitespace-nowrap"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--secondary-bg)' }}>
                    {activeCols.map((c) => (
                      <td
                        key={c.key}
                        className="px-2 py-1 text-xs border-b truncate"
                        style={{ borderColor: 'var(--border)', maxWidth: 130 }}
                      >
                        {String(row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {!previewRows.length && (
                  <tr>
                    <td colSpan={Math.max(1, activeCols.length)} className="px-2 py-6 text-center text-xs" style={{ color: 'var(--muted-fg)' }}>
                      {t.messages.noRecords}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lastResult && (
            <div className="text-[11px]" style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
              ✓ {lastResult}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn onClick={onClose}>{t.actions.cancel}</Btn>
        <Btn variant="primary" onClick={doExport} disabled={!activeCols.length || !data.length}>
          {t.dialogs.exportDialog.exportBtn}
        </Btn>
      </div>
    </InfoModal>
  );
}
