/**
 * Unified export dialog — full workflow redesign.
 *
 * Layout: a summary strip (what is being exported), a configuration column
 * (format, destination, options, column scope with progressive disclosure) and
 * a live preview pane. States are deliberate: empty scope (nothing to export),
 * invalid scope (no columns selected), success (Callout with the produced
 * artifact) and warnings surface through the toast system. Every capability of
 * the core exporters remains available: CSV/TSV, JSON/JSONL, XML, HTML,
 * Markdown, XLSX, XLS, DOCX, DOC, PDF, TXT, BOM control, header/ID inclusion,
 * live size estimation and the global print header for document formats.
 */
import React, { useMemo, useState } from 'react';
import { Modal } from './ui';
import { Btn, Checkbox, EmptyState, Field, Input, Select, Callout } from './ui';
import { IconClose, IconExport, IconFileCode, IconFileDoc, IconFileJson, IconFileSheet, IconSearch, IconSuccess, IconWarning } from './icons';
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

const FORMAT_GROUPS: { group: 'groupSpreadsheet' | 'groupDocument' | 'groupInterchange'; icon: React.ReactNode; formats: ExportFormat[] }[] = [
  { group: 'groupSpreadsheet', icon: <IconFileSheet size="sm" />, formats: ['xlsx', 'xls', 'csv', 'tsv'] },
  { group: 'groupDocument', icon: <IconFileDoc size="sm" />, formats: ['docx', 'doc', 'pdf', 'html', 'markdown'] },
  { group: 'groupInterchange', icon: <IconFileJson size="sm" />, formats: ['json', 'jsonl', 'xml', 'txt'] },
];

export function ExportDialog({ isOpen, onClose, data, columns, defaultFilename = 'export', onToast }: ExportDialogProps) {
  const { t } = useTranslation();
  const d = t.dialogs.exportDialog;
  const { printConfig } = useAppData();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [filename, setFilename] = useState(defaultFilename);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeId, setIncludeId] = useState(false);
  const [bom, setBom] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');

  const activeCols = useMemo(
    () => columns.filter((c) => selectedCols.has(c.key) && (includeId || c.key !== 'id')),
    [columns, selectedCols, includeId],
  );

  const previewRows = data.slice(0, 6);
  const isDocument = ['docx', 'doc', 'pdf', 'html'].includes(format);
  const allSelected = selectedCols.size === columns.length;

  const buildOptions = () => ({
    columns: activeCols.map((c) => ({ key: c.key, label: c.label, format: c.format })),
    format,
    filename,
    includeHeaders,
    bom,
    sheetName: d.title,
    title: printConfig.reportTitle || d.title,
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

  const canExport = data.length > 0 && activeCols.length > 0 && !exporting;

  const doExport = () => {
    if (!data.length || !activeCols.length) return;
    setExporting(true);
    setLastResult('');
    // Give the spinner one frame so the pressed state is perceivable on fast exports.
    window.setTimeout(() => {
      try {
        const artifact = exportData(data, buildOptions());
        downloadArtifact(artifact);
        setLastResult(`${artifact.filename} · ${formatBytes(artifact.bytes)} · ${artifact.rows} rows`);
        if (artifact.warnings.length && onToast) onToast(artifact.warnings[0]);
        else if (onToast) onToast(t.messages.exportSuccess);
      } finally {
        setExporting(false);
      }
    }, 30);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={d.title}
      size="xl"
      footer={
        <>
          <span className="me-auto text-[11px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
            {estimated ? `${d.estimateLabel}: ${estimated}` : ''}
          </span>
          <Btn variant="ghost" onClick={onClose} icon={<IconClose size="xs" />}>{t.actions.close}</Btn>
          <Btn variant="primary" onClick={doExport} disabled={!canExport} icon={<IconExport size="sm" />}>
            {exporting ? `${d.exportBtn}…` : d.exportBtn}
          </Btn>
        </>
      }
    >
      {/* Summary strip — what is being exported, right under the title */}
      <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-[var(--radius)] flex-wrap" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>{d.scope}</span>
        <span className="text-xs font-bold tnum" style={{ fontFamily: 'var(--font-mono)' }}>{data.length}</span>
        <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{t.messages.records}</span>
        <span style={{ color: 'var(--border-strong)' }}>·</span>
        <span className="text-xs font-bold tnum" style={{ fontFamily: 'var(--font-mono)' }}>{activeCols.length}</span>
        <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{d.columns}</span>
        <span style={{ color: 'var(--border-strong)' }}>·</span>
        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
          {FORMAT_GROUPS.find((g) => g.formats.includes(format))?.icon}
          {FORMAT_META[format].label}
        </span>
      </div>

      {data.length === 0 ? (
        <EmptyState variant="noResults" title={t.messages.nothingToExport} description={d.nothingToExportHint} />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Configuration ──────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={{ width: 250, flexShrink: 0 }}>
            <Field label={d.format}>
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                options={FORMAT_GROUPS.flatMap((g) => g.formats.map((f) => ({ value: f, label: FORMAT_META[f].label, group: g.group as string })))}
                grouped
              />
            </Field>
            <Field label={d.filename} hint={`${filename || 'export'}.${FORMAT_META[format].ext}`}>
              <Input value={filename} onChange={(e) => setFilename(e.target.value)} />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                {d.options}
              </span>
              <Checkbox checked={includeHeaders} onChange={setIncludeHeaders} label={d.includeHeaders} />
              <Checkbox checked={includeId} onChange={setIncludeId} label={d.includeId} />
              <Checkbox checked={bom} onChange={setBom} label={d.bom} />
            </div>

            {isDocument && (
              <Callout variant="info" icon={<IconFileDoc size="sm" />}>
                {d.docHeaderNote} <span style={{ fontFamily: 'var(--font-mono)' }}>{nextDocumentNumber(printConfig)}</span>
              </Callout>
            )}

            {/* Column scope */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                  {d.columns}
                </span>
                <button
                  className="text-[10px] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-sm"
                  style={{ color: 'var(--primary)' }}
                  onClick={() => setSelectedCols((prev) => (allSelected ? new Set() : new Set(columns.map((c) => c.key))))}
                >
                  {allSelected ? d.selectNone : d.selectAll}
                </button>
              </div>
              <div className="overflow-y-auto flex flex-col gap-0.5 p-1 rounded-[var(--radius)]" style={{ maxHeight: 148, background: 'var(--surface-2)' }}>
                {columns.map((col) => (
                  <Checkbox key={col.key} checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} label={col.label} />
                ))}
              </div>
            </div>

            {activeCols.length === 0 && (
              <Callout variant="warning" icon={<IconWarning size="sm" />}>{d.needColumn}</Callout>
            )}
          </div>

          {/* ── Preview ────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-2 overflow-hidden" style={{ minWidth: 0 }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
              {d.preview} · {data.length} {t.messages.records}
            </span>
            <div className="flex-1 overflow-auto rounded-[var(--radius)]" style={{ border: '1px solid var(--border)', minHeight: 260 }}>
              {previewRows.length === 0 ? (
                <EmptyState variant="noResults" title={t.messages.noRecords} compact />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {activeCols.map((c) => (
                        <th
                          key={c.key}
                          className="px-2 py-1.5 text-[10px] font-semibold text-start whitespace-nowrap"
                          style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        {activeCols.map((c) => (
                          <td
                            key={c.key}
                            className="px-2 py-1 text-xs truncate"
                            style={{ borderBottom: '1px solid var(--border)', maxWidth: 130 }}
                          >
                            {String(row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {lastResult && (
              <Callout variant="success" icon={<IconSuccess size="sm" />} title={d.exportDone}>
                <span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{lastResult}</span>
              </Callout>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
