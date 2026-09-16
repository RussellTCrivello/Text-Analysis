/**
 * Backup & Restore over the core backup engine: versioned envelopes with record
 * counts and checksums, verification before anything touches live data, and the
 * three merge policies (skip / replace / duplicate) for id collisions.
 */
import React, { useRef, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';
import { downloadArtifact } from '../core/export/exporters';
import { formatBytes } from '../core/text';
import type { MergePolicy, VerifyResult } from '../core/backup';

export function BackupDialog({ isOpen, onClose, onToast }: { isOpen: boolean; onClose: () => void; onToast: (m: string) => void }) {
  const { t } = useTranslation();
  const { backups, createBackup, restoreBackup, mergeBackup, deleteBackup, importBackupFile, exportBackupFile, verifyBackupFile, data } =
    useAppData();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState('');
  const [policy, setPolicy] = useState<MergePolicy>('skip');
  const [pending, setPending] = useState<{ name: string; result: VerifyResult; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doCreate = () => {
    const entry = createBackup(newName || undefined, note || undefined);
    setNewName('');
    setNote('');
    onToast(`${t.messages.backupCreated} · ${formatBytes(entry.bytes)}`);
  };

  const doRestore = () => {
    if (!selected) return;
    if (!window.confirm(t.backup.confirmRestore)) return;
    restoreBackup(selected);
    onToast(t.messages.backupRestored);
  };

  const doMerge = () => {
    if (!selected) return;
    mergeBackup(selected, policy);
    onToast(`${t.messages.dataMerged} (${policy})`);
  };

  const doDelete = () => {
    if (!selected) return;
    if (!window.confirm(t.backup.confirmDelete)) return;
    deleteBackup(selected);
    setSelected(null);
  };

  const doExport = () => {
    if (!selected) return;
    const artifact = exportBackupFile(selected);
    if (!artifact) return;
    downloadArtifact({ ...artifact, filename: `${artifact.filename.replace(/\.json$/, '')}.tam.json` });
    onToast('Backup file downloaded');
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        onToast('That file is not valid JSON.');
        return;
      }
      // Verify first — never write unverified data.
      const result = verifyBackupFile(JSON.stringify(parsed));
      setPending({ name: file.name, result, text });
    };
    reader.readAsText(file);
  };

  const applyPending = () => {
    if (!pending) return;
    const result = importBackupFile(pending.text, policy);
    if (!result.ok) {
      onToast(result.errors[0] ?? 'Import failed');
      return;
    }
    onToast(`${t.messages.backupRestored} (${policy})`);
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const fmt = (s: string) => s.slice(0, 16).replace('T', ' ');

  return (
    <InfoModal isOpen={isOpen} title={t.backup.title} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Create */}
        <div className="flex items-end gap-2">
          <Field label={t.backup.backupName}>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`backup_manual_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`} />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Before the Q3 import" />
          </Field>
          <Btn variant="primary" onClick={doCreate}>
            {t.backup.createBackup}
          </Btn>
        </div>

        <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
          Current workspace: {data.sources.length} sources · {data.contents.length} contents · {data.analyses.length} analyses.
          Each backup stores a schema version, record counts and a checksum, plus the audit log, gazetteer and taxonomy.
        </div>

        {/* Table */}
        <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--secondary-bg)' }}>
                  {['', t.backup.colName, t.backup.colDate, t.backup.colSources, t.backup.colContents, t.backup.colAnalyses, t.backup.colSize, 'Checksum'].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-start border-b"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)', width: i === 0 ? 28 : i === 1 ? '26%' : undefined }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs" style={{ color: 'var(--muted-fg)' }}>
                      {t.backup.noBackups}
                    </td>
                  </tr>
                )}
                {backups.map((bk) => (
                  <tr
                    key={bk.id}
                    onClick={() => setSelected(bk.id)}
                    className="cursor-pointer transition-colors"
                    style={{
                      background: selected === bk.id ? 'var(--primary)' : 'var(--card-bg)',
                      color: selected === bk.id ? 'var(--primary-fg)' : 'var(--fg)',
                    }}
                  >
                    <td className="px-2 py-1.5 text-center border-b" style={{ borderColor: 'var(--border)' }}>
                      <input type="radio" checked={selected === bk.id} onChange={() => setSelected(bk.id)} />
                    </td>
                    <td className="px-2 py-1.5 text-xs border-b truncate" style={{ borderColor: 'var(--border)' }} title={bk.note}>
                      {bk.name}
                    </td>
                    <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                      {fmt(bk.date_creation)}
                    </td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.sourceCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.contentCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b text-center" style={{ borderColor: 'var(--border)' }}>{bk.analysisCount}</td>
                    <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(bk.bytes)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] border-b truncate" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                      {bk.checksum.slice(0, 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="primary" onClick={doRestore} disabled={!selected}>
            {t.backup.restoreSelected}
          </Btn>
          <Select
            value={policy}
            onChange={(e) => setPolicy(e.target.value as MergePolicy)}
            options={[
              { value: 'skip', label: 'Merge: keep current on conflict' },
              { value: 'replace', label: 'Merge: overwrite on conflict' },
              { value: 'duplicate', label: 'Merge: insert as new record' },
            ]}
            className="!w-64"
          />
          <Btn onClick={doMerge} disabled={!selected}>
            {t.backup.mergeSelected}
          </Btn>
          <Btn onClick={doExport} disabled={!selected}>
            {t.backup.exportBackup}
          </Btn>
          <Btn variant="danger" onClick={doDelete} disabled={!selected}>
            {t.backup.deleteSelected}
          </Btn>
          <div className="flex-1" />
          <Btn onClick={() => fileRef.current?.click()}>{t.backup.restoreFromFile}</Btn>
        </div>

        {/* Pending file verification */}
        {pending && (
          <div className="rounded p-3 text-xs" style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)' }}>
            <div className="font-semibold mb-1">
              {pending.name} — {pending.result.ok ? 'verification passed' : 'verification failed'}
            </div>
            {pending.result.meta && (
              <div style={{ color: 'var(--muted-fg)' }}>
                {pending.result.meta.counts.sources} sources · {pending.result.meta.counts.contents} contents ·{' '}
                {pending.result.meta.counts.analyses} analyses · {formatBytes(pending.result.meta.bytes)} · schema v
                {pending.result.meta.version} · app {pending.result.meta.appVersion}
                {pending.result.meta.hasAudit ? ' · includes audit log' : ''}
              </div>
            )}
            {pending.result.errors.map((e) => (
              <div key={e} style={{ color: '#b91c1c' }}>
                ✕ {e}
              </div>
            ))}
            {pending.result.warnings.map((w) => (
              <div key={w} style={{ color: '#b45309' }}>
                ⚠ {w}
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <Btn size="xs" variant="primary" disabled={!pending.result.ok} onClick={applyPending}>
                Import with “{policy}” policy
              </Btn>
              <Btn size="xs" onClick={() => setPending(null)}>
                {t.actions.cancel}
              </Btn>
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </InfoModal>
  );
}
