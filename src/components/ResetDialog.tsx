import React, { useState } from 'react';
import { IconWarning } from './icons';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import { useTranslation } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResetData: () => void;
  onResetAll: () => void;
}

type Mode = 'data' | 'all';

export function ResetDialog({ isOpen, onClose, onResetData, onResetAll }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('data');
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    if (!confirming) { setConfirming(true); return; }
    if (mode === 'data') onResetData();
    else onResetAll();
    setConfirming(false);
    onClose();
  };

  return (
    <InfoModal isOpen={isOpen} title="Reset" onClose={() => { setConfirming(false); onClose(); }} size="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <span className="shrink-0 inline-flex" style={{ color: 'var(--error)' }}><IconWarning /></span>
          <p className="text-sm font-bold" style={{ color: '#dc2626' }}>WARNING: This operation cannot be undone!</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 cursor-pointer p-2 rounded" style={{ background: mode === 'data' ? 'var(--secondary-bg)' : 'transparent', border: '1px solid ' + (mode === 'data' ? 'var(--primary)' : 'var(--border)') }}
            onClick={() => setMode('data')}>
            <input type="radio" checked={mode === 'data'} onChange={() => setMode('data')} className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Reset Data Only (Delete all records)</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>Deletes every row from all three tables. Schema and configuration are untouched.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer p-2 rounded" style={{ background: mode === 'all' ? 'var(--secondary-bg)' : 'transparent', border: '1px solid ' + (mode === 'all' ? '#dc2626' : 'var(--border)') }}
            onClick={() => setMode('all')}>
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold" style={{ color: '#dc2626' }}>Reset All (Delete database and recreate)</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>Creates a safety backup, then deletes and recreates the entire database. All data and settings are lost.</div>
            </div>
          </label>
        </div>

        {confirming && (
          <div className="rounded-lg p-3 text-sm font-semibold" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            {mode === 'data'
              ? 'This will delete ALL data from the database. This cannot be undone! Click Reset again to confirm.'
              : 'This will DELETE the entire database and recreate it. This cannot be undone! Click Reset again to confirm.'}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Btn onClick={() => { setConfirming(false); onClose(); }} variant="ghost">Cancel</Btn>
          <Btn onClick={handleReset} variant="danger">
            {confirming ? t.actions.confirm : t.menus.reset}
          </Btn>
        </div>
      </div>
    </InfoModal>
  );
}
