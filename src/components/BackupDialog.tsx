import React, { useRef, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input } from './ui';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';

export function BackupDialog({ isOpen, onClose, onToast }: { isOpen: boolean; onClose: () => void; onToast: (m: string) => void }) {
  const { t } = useTranslation();
  const { backups, createBackup, restoreBackup, mergeBackup, deleteBackup, restoreFromRaw } = useAppData();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doCreate = () => {
    createBackup(newName || undefined);
    setNewName('');
    onToast(t.messages.backupCreated);
  };

  const doRestore = () => {
    if (!selected) return;
    if (!confirm(t.backup.confirmRestore)) return;
    restoreBackup(selected);
    onToast(t.messages.backupRestored);
  };

  const doMerge = () => {
    if (!selected) return;
    mergeBackup(selected);
    onToast(t.messages.dataMerged);
  };

  const doDelete = () => {
    if (!selected) return;
    if (!confirm(t.backup.confirmDelete)) return;
    deleteBackup(selected);
    setSelected(null);
  };

  const doExport = () => {
    const bk = backups.find(b => b.id === selected);
    if (!bk) return;
    const blob = new Blob([JSON.stringify(bk.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${bk.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const doImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        restoreFromRaw(parsed, false);
        onToast(t.messages.backupRestored);
      } catch { alert('Invalid file.'); }
      finally { if (fileRef.current) fileRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const fmt = (s: string) => s.slice(0, 16).replace('T', ' ');
  const sizeKb = (bk: typeof backups[0]) => Math.round(JSON.stringify(bk).length / 1024);

  return (
    <InfoModal isOpen={isOpen} title={t.backup.title} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Create new */}
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t.backup.backupName}
            className="flex-1"
          />
          <Btn variant="primary" onClick={doCreate}>{t.backup.createBackup}</Btn>
        </div>

        {/* Table */}
        <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--border)', maxHeight: 280 }}>
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--muted-bg)' }}>
                  {['', t.backup.colName, t.backup.colDate, t.backup.colSources, t.backup.colContents, t.backup.colAnalyses, t.backup.colSize].map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-xs font-semibold text-start border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)', width: i === 0 ? 28 : i === 1 ? '35%' : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-xs" style={{ color: 'var(--muted-fg)' }}>{t.backup.noBackups}</td></tr>
                )}
                {backups.map(bk => (
                  <tr
                    key={bk.id}
                    onClick={() => setSelected(bk.id)}
                    className="cursor-pointer transition-colors"
                    style={{ background: selected === bk.id ? 'var(--primary)' : 'var(--card-bg)', color: selected === bk.id ? 'var(--primary-fg)' : 'var(--fg)' }}
                  >
                    <td className="px-2 py-1.5 text-center border-b" style={{ borderColor: 'var(--border)' }}>
                      <input type="radio" checked={selected === bk.id} onChange={() => setSelected(bk.id)} />
                    </td>
                    <td className="px-2 py-1.5 text-xs border-b truncate" style={{ borderColor: 'var(--border)' }}>{bk.name}</td>
                    <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>{fmt(bk.date_creation)}</td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.sourceCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.contentCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.analysisCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>{sizeKb(bk)}KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="primary" onClick={doRestore} disabled={!selected}>{t.backup.restoreSelected}</Btn>
          <Btn onClick={doMerge} disabled={!selected}>{t.backup.mergeSelected}</Btn>
          <Btn onClick={doExport} disabled={!selected}>{t.backup.exportBackup}</Btn>
          <Btn variant="danger" onClick={doDelete} disabled={!selected}>{t.backup.deleteSelected}</Btn>
          <div className="flex-1" />
          <Btn onClick={() => fileRef.current?.click()}>{t.backup.restoreFromFile}</Btn>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={doImportFile} />
    </InfoModal>
  );
}
