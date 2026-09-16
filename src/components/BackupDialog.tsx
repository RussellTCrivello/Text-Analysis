/**
 * Backup & Restore — full workflow redesign.
 *
 * A deliberate system workflow rather than a generic form:
 *   1. Create — named backup with optional note and a live scope summary.
 *   2. Existing backups — selectable table with counts, size and checksum.
 *   3. Actions — restore (with confirmation), merge (policy-driven), export
 *      and delete (with confirmation), plus file-based restore that is always
 *      verified before anything is written.
 * All destructive or consequential operations keep their confirmations. Every
 * previous capability is preserved: create, restore, merge (skip/replace/
 * duplicate), export .tam.json, delete, file import with verification.
 */
import React, { useRef, useState } from 'react';
import { Modal } from './ui';
import { Btn, EmptyState, Field, Input, Select, Callout } from './ui';
import {
  IconBackup, IconClose, IconCompare, IconDatabase, IconDelete, IconError,
  IconExport, IconImport, IconInfo, IconRestore, IconShieldCheck, IconStatusX, IconWarning,
} from './icons';
import { useTranslation } from '../i18n';
import { useAppData, type MergePolicy, type VerifyResult } from '../store/AppContext';
import { downloadArtifact } from '../core/export/exporters';
import { formatBytes } from '../core/text';

export function BackupDialog({ isOpen, onClose, onToast }: { isOpen: boolean; onClose: () => void; onToast: (message: string) => void }) {
  const { t } = useTranslation();
  const b = t.backup;
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
    if (!window.confirm(b.confirmRestore)) return;
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
    if (!window.confirm(b.confirmDelete)) return;
    deleteBackup(selected);
    setSelected(null);
  };

  const doExport = () => {
    if (!selected) return;
    const artifact = exportBackupFile(selected);
    if (!artifact) return;
    downloadArtifact({ ...artifact, filename: `${artifact.filename.replace(/\.json$/, '')}.tam.json` });
    onToast(b.fileDownloaded);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        onToast(b.invalidJson);
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
      onToast(result.errors[0] ?? b.importFailed);
      return;
    }
    onToast(`${t.messages.backupRestored} (${policy})`);
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const fmt = (s: string) => s.slice(0, 16).replace('T', ' ');
  const selectedBk = backups.find((bk) => bk.id === selected) ?? null;
  const policyLabel = { skip: b.mergeSkip, replace: b.mergeReplace, duplicate: b.mergeDuplicate }[policy];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={b.title}
      size="xl"
      footer={<Btn variant="ghost" onClick={onClose} icon={<IconClose size="xs" />}>{t.actions.close}</Btn>}
    >
      <div className="flex flex-col gap-4">
        {/* ── 1. Create backup ─────────────────────────────────────── */}
        <section className="rounded-[var(--radius-lg)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <header className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <span className="inline-flex" style={{ color: 'var(--primary)' }}><IconBackup size="sm" /></span>
            <h3 className="text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>{b.createBackup}</h3>
          </header>
          <div className="p-3 flex flex-col gap-2.5">
            <div className="flex items-end gap-2 flex-wrap">
              <Field label={b.backupName}>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`backup_manual_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`} className="!w-56" />
              </Field>
              <Field label={b.noteOptional}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Before the Q3 import" className="!w-52" />
              </Field>
              <Btn variant="primary" onClick={doCreate} icon={<IconBackup size="sm" />}>{b.createBackup}</Btn>
            </div>
            <p className="text-[11px] leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--muted-fg)' }}>
              <span className="shrink-0 mt-0.5 inline-flex"><IconInfo size="xs" /></span>
              <span>
                {b.workspaceNow} <strong style={{ color: 'var(--fg)' }}>{data.sources.length}</strong> {t.nav.sources.toLowerCase()} ·{' '}
                <strong style={{ color: 'var(--fg)' }}>{data.contents.length}</strong> {t.nav.contents.toLowerCase()} ·{' '}
                <strong style={{ color: 'var(--fg)' }}>{data.analyses.length}</strong> {t.nav.analysis.toLowerCase()}. {b.scopeHint}
              </span>
            </p>
          </div>
        </section>

        {/* ── 2. Existing backups ──────────────────────────────────── */}
        <section>
          {backups.length === 0 ? (
            <EmptyState variant="empty" title={b.noBackups} icon={<IconDatabase size="hero" />} compact />
          ) : (
            <div className="rounded-[var(--radius-lg)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="overflow-y-auto" style={{ maxHeight: 232 }}>
                <table className="w-full" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['', b.colName, b.colDate, b.colSources, b.colContents, b.colAnalyses, b.colSize, b.checksum].map((h, i) => (
                        <th
                          key={`${h}-${i}`}
                          className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-start"
                          style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-display)', width: i === 0 ? 30 : i === 1 ? '26%' : undefined }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((bk) => {
                      const isSel = selected === bk.id;
                      return (
                        <tr
                          key={bk.id}
                          onClick={() => setSelected(bk.id)}
                          className="cursor-pointer transition-colors"
                          style={{
                            background: isSel ? 'var(--primary-soft)' : 'var(--surface)',
                            boxShadow: isSel ? 'inset 3px 0 0 var(--primary)' : undefined,
                          }}
                          aria-selected={isSel}
                        >
                          <td className="px-2 py-1.5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
                            <input
                              type="radio"
                              name="backup-selection"
                              checked={isSel}
                              onChange={() => setSelected(bk.id)}
                              aria-label={`${b.restoreTitle}: ${bk.name}`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-xs truncate" style={{ borderBottom: '1px solid var(--border)' }} title={bk.note}>
                            <span className="font-semibold" style={{ color: isSel ? 'var(--primary)' : 'var(--fg)' }}>{bk.name}</span>
                          </td>
                          <td className="px-2 py-1.5 text-xs tnum" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                            {fmt(bk.date_creation)}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-center tnum" style={{ borderBottom: '1px solid var(--border)' }}>{bk.sourceCount}</td>
                          <td className="px-2 py-1.5 text-xs text-center tnum" style={{ borderBottom: '1px solid var(--border)' }}>{bk.contentCount}</td>
                          <td className="px-2 py-1.5 text-xs text-center tnum" style={{ borderBottom: '1px solid var(--border)' }}>{bk.analysisCount}</td>
                          <td className="px-2 py-1.5 text-xs tnum" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                            {formatBytes(bk.bytes)}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] truncate" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)' }}>
                            {bk.checksum.slice(0, 12)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── 3. Actions on the selected backup ────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="primary" onClick={doRestore} disabled={!selected} icon={<IconRestore size="sm" />}>
            {b.restoreSelected}
          </Btn>
          <Select
            value={policy}
            onChange={(e) => setPolicy(e.target.value as MergePolicy)}
            options={[
              { value: 'skip', label: b.mergeSkip },
              { value: 'replace', label: b.mergeReplace },
              { value: 'duplicate', label: b.mergeDuplicate },
            ]}
            className="!w-60"
            aria-label={t.backup.mergeSelected}
          />
          <Btn onClick={doMerge} disabled={!selected} icon={<IconCompare size="sm" />}>{b.mergeSelected}</Btn>
          <Btn onClick={doExport} disabled={!selected} icon={<IconExport size="sm" />}>{b.exportBackup}</Btn>
          <Btn variant="danger" onClick={doDelete} disabled={!selected} icon={<IconDelete size="sm" />}>{b.deleteSelected}</Btn>
          <div className="flex-1" />
          <Btn variant="subtle" onClick={() => fileRef.current?.click()} icon={<IconImport size="sm" />}>{b.fromFile}</Btn>
        </div>

        {/* ── 4. Pending file verification — nothing written until confirmed ── */}
        {pending && (
          <section className="rounded-[var(--radius-lg)] p-3" style={{ border: `1px solid ${pending.result.ok ? 'var(--success-soft)' : 'var(--error-soft)'}`, background: pending.result.ok ? 'var(--success-soft)' : 'var(--error-soft)' }}>
            <div className="flex items-center gap-2 text-xs font-bold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="inline-flex" style={{ color: pending.result.ok ? 'var(--success)' : 'var(--error)' }}>
                {pending.result.ok ? <IconShieldCheck size="sm" /> : <IconStatusX size="sm" />}
              </span>
              <span className="tnum" style={{ fontFamily: 'var(--font-mono)' }}>{pending.name}</span>
              <span style={{ color: 'var(--muted-fg)' }}>— {pending.result.ok ? b.verifyPassed : b.verifyFailed}</span>
            </div>
            {pending.result.meta && (
              <div className="text-[11px] tnum mb-1.5" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                {pending.result.meta.counts.sources} sources · {pending.result.meta.counts.contents} contents ·{' '}
                {pending.result.meta.counts.analyses} analyses · {formatBytes(pending.result.meta.bytes)} · schema v
                {pending.result.meta.version} · app {pending.result.meta.appVersion}
                {pending.result.meta.hasAudit ? ' · audit log' : ''}
              </div>
            )}
            {pending.result.errors.map((e) => (
              <div key={e} className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--error)' }}>
                <IconError size="xs" /> {e}
              </div>
            ))}
            {pending.result.warnings.map((w) => (
              <div key={w} className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
                <IconWarning size="xs" /> {w}
              </div>
            ))}
            <div className="flex gap-2 mt-2.5">
              <Btn size="xs" variant="primary" disabled={!pending.result.ok} onClick={applyPending} icon={<IconRestore size="xs" />}>
                {b.importWithPolicy.replace('{p}', policyLabel)}
              </Btn>
              <Btn size="xs" variant="ghost" onClick={() => setPending(null)} icon={<IconClose size="xs" />}>{t.actions.cancel}</Btn>
            </div>
          </section>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        aria-label={b.fromFile}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </Modal>
  );
}
