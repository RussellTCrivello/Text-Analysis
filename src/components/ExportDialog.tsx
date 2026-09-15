import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useTranslation } from '../i18n';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  defaultFilename?: string;
}

type ExportFormat = 'csv' | 'json' | 'jsonl' | 'xml';

export function ExportDialog({ isOpen, onClose, data, columns, defaultFilename = 'export' }: ExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState(defaultFilename);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set(columns.map(c => c.key)));
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeId, setIncludeId] = useState(false);

  const toggleCol = (key: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const activeCols = columns.filter(c => selectedCols.has(c.key) && (includeId || c.key !== 'id'));
  const previewRows = data.slice(0, 5);

  const doExport = () => {
    if (data.length === 0) { alert(t.messages.nothingToExport); return; }
    let content = '';
    const fname = `${filename || 'export'}.${format}`;
    const mimeTypes: Record<ExportFormat, string> = {
      csv: 'text/csv', json: 'application/json', jsonl: 'application/jsonlines', xml: 'application/xml',
    };

    if (format === 'csv') {
      const rows: string[] = [];
      if (includeHeaders) rows.push(activeCols.map(c => `"${c.label}"`).join(','));
      data.forEach(row => rows.push(activeCols.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')));
      content = rows.join('\n');
    } else if (format === 'json') {
      content = JSON.stringify(data.map(row => Object.fromEntries(activeCols.map(c => [c.key, row[c.key]]))), null, 2);
    } else if (format === 'jsonl') {
      content = data.map(row => JSON.stringify(Object.fromEntries(activeCols.map(c => [c.key, row[c.key]])))).join('\n');
    } else if (format === 'xml') {
      const rows = data.map(row => {
        const fields = activeCols.map(c => `  <${c.key}>${String(row[c.key] ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</${c.key}>`).join('\n');
        return `<record>\n${fields}\n</record>`;
      });
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rows.join('\n')}\n</records>`;
    }

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const formatOpts: { value: ExportFormat; label: string }[] = [
    { value: 'csv', label: t.dialogs.exportDialog.csv },
    { value: 'json', label: t.dialogs.exportDialog.json },
    { value: 'jsonl', label: t.dialogs.exportDialog.jsonl },
    { value: 'xml', label: t.dialogs.exportDialog.xml },
  ];

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.exportDialog.title} onClose={onClose} size="lg">
      <div className="flex gap-4" style={{ minHeight: 340 }}>
        {/* Left: settings */}
        <div className="flex flex-col gap-3" style={{ width: 220, shrink: 0 } as React.CSSProperties}>
          <Field label={t.dialogs.exportDialog.format}>
            <Select value={format} onChange={e => setFormat(e.target.value as ExportFormat)} options={formatOpts} />
          </Field>
          <Field label={t.dialogs.exportDialog.filename}>
            <Input value={filename} onChange={e => setFilename(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>{t.dialogs.exportDialog.options}</span>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={includeHeaders} onChange={e => setIncludeHeaders(e.target.checked)} />
              {t.dialogs.exportDialog.includeHeaders}
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={includeId} onChange={e => setIncludeId(e.target.checked)} />
              {t.dialogs.exportDialog.includeId}
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>{t.dialogs.exportDialog.columns}</span>
            <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 140 }}>
              {columns.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
            {t.dialogs.exportDialog.preview} · {data.length} {t.messages.records}
          </span>
          <div className="flex-1 overflow-auto border rounded" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--muted-bg)' }}>
                  {activeCols.map(c => (
                    <th key={c.key} className="px-2 py-1 text-xs font-semibold text-start border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                    {activeCols.map(c => (
                      <td key={c.key} className="px-2 py-1 text-xs border-b truncate" style={{ borderColor: 'var(--border)', maxWidth: 120 }}>
                        {String(row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn onClick={onClose}>{t.actions.cancel}</Btn>
        <Btn variant="primary" onClick={doExport}>{t.dialogs.exportDialog.exportBtn}</Btn>
      </div>
    </InfoModal>
  );
}
