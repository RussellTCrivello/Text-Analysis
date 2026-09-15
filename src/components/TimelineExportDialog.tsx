import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import type { TimelineEvent } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filteredEvents: TimelineEvent[];
  allEvents: TimelineEvent[];
  pageEvents: TimelineEvent[];
}

type Scope = 'filtered' | 'page' | 'all';
type Format = 'csv' | 'json' | 'jsonl';

export function TimelineExportDialog({ isOpen, onClose, filteredEvents, allEvents, pageEvents }: Props) {
  const [scope, setScope] = useState<Scope>('filtered');
  const [format, setFormat] = useState<Format>('csv');
  const [filename, setFilename] = useState('timeline_export');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [openAfter, setOpenAfter] = useState(true);

  const events = scope === 'filtered' ? filteredEvents : scope === 'page' ? pageEvents : allEvents;

  const handleExport = () => {
    let content = '';
    const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : '.jsonl';
    const fname = filename + ext;

    if (format === 'csv') {
      const header = 'id,type,date,title,summary,source,classification,people,places';
      const rows = events.map(e => [e.id, e.type, e.date, `"${(e.title ?? '').replace(/"/g,'""')}"`, `"${(e.summary ?? '').replace(/"/g,'""')}"`, e.source, e.classification, e.list_names_people, e.list_names_places].join(','));
      content = includeHeader ? [header, ...rows].join('\n') : rows.join('\n');
    } else if (format === 'json') {
      content = JSON.stringify({ export_date: new Date().toISOString(), record_count: events.length, records: events }, null, 2);
    } else {
      content = events.map(e => JSON.stringify(e)).join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
    if (openAfter) onClose();
  };

  const radioOption = (label: string, val: Scope, count: number) => (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="radio" name="scope" value={val} checked={scope === val} onChange={() => setScope(val)} />
      <span>{label}</span>
      <span className="text-xs font-mono" style={{ color: 'var(--muted-fg)' }}>({count} events)</span>
    </label>
  );

  return (
    <InfoModal isOpen={isOpen} title="Export Timeline" onClose={onClose} size="md">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Export Scope</div>
          {radioOption('Filtered Data', 'filtered', filteredEvents.length)}
          {radioOption('Current Page', 'page', pageEvents.length)}
          {radioOption('All Data', 'all', allEvents.length)}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Export Format</div>
          {(['csv','json','jsonl'] as Format[]).map(f => (
            <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
              <span>{f.toUpperCase()} {f === 'csv' ? '.csv' : f === 'json' ? '.json (structured)' : '.jsonl (one object per line)'}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Options</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHeader} onChange={e => setIncludeHeader(e.target.checked)} />
            Include document header
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={openAfter} onChange={e => setOpenAfter(e.target.checked)} />
            Close dialog after export
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Filename</div>
          <div className="flex items-center gap-2">
            <input value={filename} onChange={e => setFilename(e.target.value)} className="flex-1 text-sm rounded px-2.5 py-1.5" style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }} />
            <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>.{format}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleExport} disabled={events.length === 0}>Export ({events.length} events)</Btn>
        </div>
      </div>
    </InfoModal>
  );
}
