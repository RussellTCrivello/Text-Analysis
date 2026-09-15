import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import { useAppData } from '../store/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AttachmentManager({ isOpen, onClose }: Props) {
  const { data } = useAppData();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const sourcesWithAttachments = data.sources.filter(s => {
    return data.contents.some(c => c.sources_id === s.id && c.attachments.trim());
  });

  const attachmentsForSource = selectedSourceId
    ? data.contents
        .filter(c => c.sources_id === selectedSourceId && c.attachments.trim())
        .flatMap(c => c.attachments.split(';').map(f => f.trim()).filter(Boolean))
    : [];

  const uniqueFiles = [...new Set(attachmentsForSource)];

  const toggleFile = (f: string) =>
    setSelectedFiles(files => files.includes(f) ? files.filter(x => x !== f) : [...files, f]);

  return (
    <InfoModal isOpen={isOpen} title="Attachment Manager" onClose={onClose} size="lg">
      <div className="flex gap-0 h-80">
        {/* Sources list */}
        <div className="w-56 shrink-0 overflow-y-auto" style={{ borderInlineEnd: '1px solid var(--border)' }}>
          <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)', background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>Sources</div>
          {sourcesWithAttachments.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--muted-fg)' }}>No sources with attachments</div>
          ) : sourcesWithAttachments.map(s => {
            const count = [...new Set(data.contents.filter(c => c.sources_id === s.id).flatMap(c => c.attachments.split(';').filter(Boolean)))].length;
            return (
              <button key={s.id} onClick={() => { setSelectedSourceId(s.id); setSelectedFiles([]); }}
                className="w-full text-start px-3 py-2 text-xs transition-colors hover:bg-[var(--secondary-bg)]"
                style={{ background: selectedSourceId === s.id ? 'var(--secondary-bg)' : 'transparent', borderInlineStart: selectedSourceId === s.id ? '3px solid var(--primary)' : '3px solid transparent' }}>
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>{count} file{count !== 1 ? 's' : ''}</div>
              </button>
            );
          })}
        </div>

        {/* File list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted-fg)', background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>Files</div>
          <div className="flex-1 overflow-y-auto">
            {!selectedSourceId ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>Select a source to view its files</div>
            ) : uniqueFiles.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>No attachment files found</div>
            ) : uniqueFiles.map(f => (
              <label key={f} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--secondary-bg)] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selectedFiles.includes(f)} onChange={() => toggleFile(f)} />
                <span className="text-xs truncate flex-1" title={f}>📎 {f}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 p-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--secondary-bg)' }}>
            <Btn size="xs" variant="ghost" disabled={!selectedFiles.length} onClick={() => alert(`Open: ${selectedFiles.join(', ')} (not available in browser)`)}>Open</Btn>
            <Btn size="xs" variant="ghost" onClick={() => setSelectedFiles(uniqueFiles.map(f => f))}>Select All</Btn>
            <Btn size="xs" variant="ghost" onClick={() => setSelectedFiles([])}>Deselect All</Btn>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </InfoModal>
  );
}
