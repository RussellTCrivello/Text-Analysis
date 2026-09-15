import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import { useTranslation } from '../i18n';

interface BulkOperationsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  data: { id: string; label: string }[];
  onBulkDelete: (ids: string[]) => void;
}

type Mode = 'delete' | 'edit';

export function BulkOperations({ isOpen, onClose, selectedIds, data, onBulkDelete }: BulkOperationsProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('delete');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const execute = () => {
    if (mode === 'delete') {
      if (!confirm(t.dialogs.bulkOps.confirmDelete.replace('{n}', String(checked.size)))) return;
      setProcessing(true);
      setTimeout(() => {
        onBulkDelete([...checked]);
        setCount(checked.size);
        setDone(true);
        setProcessing(false);
      }, 500);
    }
  };

  const reset = () => { setDone(false); setProcessing(false); setChecked(new Set(selectedIds)); onClose(); };

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.bulkOps.title} onClose={reset} size="md">
      <div className="flex flex-col gap-4" style={{ minHeight: 320 }}>
        {/* Mode tabs */}
        <div className="flex gap-2">
          {(['delete', 'edit'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1 rounded text-xs font-semibold transition-colors"
              style={{
                background: mode === m ? (m === 'delete' ? '#dc2626' : 'var(--primary)') : 'var(--secondary-bg)',
                color: mode === m ? '#fff' : 'var(--fg)',
              }}
            >
              {m === 'delete' ? t.dialogs.bulkOps.modeDelete : t.dialogs.bulkOps.modeEdit}
            </button>
          ))}
        </div>

        {!done ? (
          <>
            <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
              {t.dialogs.bulkOps.selectedCount.replace('{n}', String(checked.size))}
            </p>
            <div className="border rounded overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: 220 }}>
              {data.map(item => (
                <label key={item.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--secondary-bg)]">
                  <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
                  <span className="text-xs">{item.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Btn size="xs" onClick={() => setChecked(new Set(data.map(d => d.id)))}>Select All</Btn>
                <Btn size="xs" onClick={() => setChecked(new Set())}>Clear</Btn>
              </div>
              {processing ? (
                <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{t.dialogs.bulkOps.progress}</span>
              ) : (
                <Btn variant={mode === 'delete' ? 'danger' : 'primary'} onClick={execute} disabled={checked.size === 0}>
                  {mode === 'delete' ? `Delete ${checked.size} records` : `Edit ${checked.size} records`}
                </Btn>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="text-3xl">✅</div>
            <p className="text-sm font-semibold">{t.dialogs.bulkOps.done.replace('{n}', String(count))}</p>
            <Btn variant="primary" onClick={reset}>{t.actions.close}</Btn>
          </div>
        )}
      </div>
    </InfoModal>
  );
}
