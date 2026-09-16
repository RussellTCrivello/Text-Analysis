/**
 * Timeline range export. Scope (current page / filtered / all) × any of the 13
 * core export formats, produced by the same exporter used everywhere else.
 */
import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useTranslation } from '../i18n';
import { useAppData } from '../store/AppContext';
import { downloadArtifact, exportData, FORMAT_META, type ExportFormat } from '../core/export/exporters';
import { timelineRows } from '../core/timeline';
import type { TimelineEvent } from '../core/timeline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filteredEvents: TimelineEvent[];
  allEvents: TimelineEvent[];
  pageEvents: TimelineEvent[];
  onToast?: (message: string) => void;
}

type Scope = 'filtered' | 'page' | 'all';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'title', label: 'Title' },
  { key: 'summary', label: 'Summary' },
  { key: 'source', label: 'Source' },
  { key: 'people', label: 'People' },
  { key: 'places', label: 'Places' },
  { key: 'classification', label: 'Classification' },
  { key: 'importance', label: 'Importance' },
  { key: 'recordId', label: 'Record ID' },
];

export function TimelineExportDialog({ isOpen, onClose, filteredEvents, allEvents, pageEvents, onToast }: Props) {
  const { t } = useTranslation();
  const { printConfig } = useAppData();
  const [scope, setScope] = useState<Scope>('filtered');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState('timeline_export');
  const [columns, setColumns] = useState<string[]>(COLUMNS.slice(0, 7).map((c) => c.key));
  const [bom, setBom] = useState(true);

  const events = scope === 'filtered' ? filteredEvents : scope === 'page' ? pageEvents : allEvents;

  const doExport = () => {
    if (!events.length) {
      onToast?.('Nothing to export.');
      return;
    }
    const artifact = exportData(timelineRows(events), {
      columns: COLUMNS.filter((c) => columns.includes(c.key)),
      format,
      filename,
      title: 'Timeline',
      subtitle: `${events.length} events · scope ${scope}`,
      headerLines: [printConfig.header1, printConfig.header2, printConfig.header3].filter(Boolean),
      footerText: printConfig.footerText,
      bom,
    });
    downloadArtifact(artifact);
    onToast?.(`${artifact.filename} exported`);
    onClose();
  };

  const toggleColumn = (key: string) =>
    setColumns((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.exportDialog.title} onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        <Field label="Scope">
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            options={[
              { value: 'page', label: `Current page (${pageEvents.length})` },
              { value: 'filtered', label: `Filtered (${filteredEvents.length})` },
              { value: 'all', label: `All events (${allEvents.length})` },
            ]}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.dialogs.exportDialog.format}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              options={Object.entries(FORMAT_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
          </Field>
          <Field label={t.dialogs.exportDialog.filename} error={filename ? undefined : 'Required'}>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} />
          </Field>
        </div>

        <Field label={t.dialogs.exportDialog.columns}>
          <div className="flex flex-wrap gap-2">
            {COLUMNS.map((c) => (
              <label
                key={c.key}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs cursor-pointer"
                style={{ background: columns.includes(c.key) ? 'var(--primary)' : 'var(--secondary-bg)', color: columns.includes(c.key) ? 'var(--primary-fg)' : 'var(--fg)' }}
              >
                <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} className="accent-current" />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={bom} onChange={() => setBom(!bom)} />
          Include UTF-8 BOM (Arabic/Excel safety)
        </label>

        <div className="text-xs rounded p-2" style={{ background: 'var(--secondary-bg)', color: 'var(--muted-fg)' }}>
          {events.length} events will be written as {FORMAT_META[format].label}. Document formats (PDF/DOCX/HTML) use the
          print header configured in settings.
        </div>

        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>{t.actions.cancel}</Btn>
          <Btn variant="primary" onClick={doExport} disabled={!events.length || !filename.trim() || !columns.length}>
            {t.actions.export}
          </Btn>
        </div>
      </div>
    </InfoModal>
  );
}
