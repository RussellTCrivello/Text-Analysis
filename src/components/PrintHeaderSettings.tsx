import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input } from './ui';

export interface PrintHeaderConfig {
  header1: string; header2: string; header3: string;
  showDate: boolean; dateFormat: string;
  footerLeft: string; footerCenter: string; footerRight: string;
  showPageNumbers: boolean; pageNumberFormat: string; pageNumberPosition: string;
  docNumberPrefix: string; docNumberAuto: boolean; docNumberManual: string;
}

const DEFAULT_CONFIG: PrintHeaderConfig = {
  header1: '', header2: '', header3: '',
  showDate: true, dateFormat: 'yyyy-MM-dd',
  footerLeft: '', footerCenter: '', footerRight: '',
  showPageNumbers: true, pageNumberFormat: 'page X of Y', pageNumberPosition: 'center',
  docNumberPrefix: 'DOC', docNumberAuto: true, docNumberManual: '',
};

const STORAGE_KEY = 'tam_print_header';

export function loadPrintHeader(): PrintHeaderConfig {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }; } catch {}
  return { ...DEFAULT_CONFIG };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintHeaderSettings({ isOpen, onClose }: Props) {
  const [cfg, setCfg] = useState<PrintHeaderConfig>(loadPrintHeader);
  const set = (patch: Partial<PrintHeaderConfig>) => setCfg(c => ({ ...c, ...patch }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    onClose();
  };

  const row = (label: string, el: React.ReactNode) => (
    <div className="flex items-center gap-3">
      <span className="text-xs w-36 shrink-0" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      <div className="flex-1">{el}</div>
    </div>
  );

  const dateFormats = ['yyyy-MM-dd','dd/MM/yyyy','MM/dd/yyyy','MMMM d, yyyy'];
  const pageNumFormats = ['page X of Y','X of Y','X / Y','X only'];
  const positions = ['left','center','right'];

  if (!isOpen) return null;

  return (
    <InfoModal isOpen={isOpen} title="Print & Export Header Settings" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Header lines */}
        <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>Document Header</div>
          {row('Header line 1', <Input value={cfg.header1} onChange={e => set({ header1: e.target.value })} placeholder="Organization name" />)}
          {row('Header line 2', <Input value={cfg.header2} onChange={e => set({ header2: e.target.value })} placeholder="Department" />)}
          {row('Header line 3', <Input value={cfg.header3} onChange={e => set({ header3: e.target.value })} placeholder="Additional info" />)}
          {row('Show date', <input type="checkbox" checked={cfg.showDate} onChange={e => set({ showDate: e.target.checked })} />)}
          {row('Date format', (
            <select value={cfg.dateFormat} onChange={e => set({ dateFormat: e.target.value })} className="text-xs rounded px-2 py-1 w-full" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
              {dateFormats.map(f => <option key={f}>{f}</option>)}
            </select>
          ))}
        </div>

        {/* Document number */}
        <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>Document Numbering</div>
          {row('Auto numbering', <input type="checkbox" checked={cfg.docNumberAuto} onChange={e => set({ docNumberAuto: e.target.checked })} />)}
          {row('Number prefix', <Input value={cfg.docNumberPrefix} onChange={e => set({ docNumberPrefix: e.target.value })} placeholder="DOC" />)}
          {row('Manual override', <Input value={cfg.docNumberManual} onChange={e => set({ docNumberManual: e.target.value })} placeholder="Leave empty for auto" />)}
        </div>

        {/* Footer */}
        <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>Footer</div>
          {row('Footer left', <Input value={cfg.footerLeft} onChange={e => set({ footerLeft: e.target.value })} />)}
          {row('Footer center', <Input value={cfg.footerCenter} onChange={e => set({ footerCenter: e.target.value })} />)}
          {row('Footer right', <Input value={cfg.footerRight} onChange={e => set({ footerRight: e.target.value })} />)}
          {row('Show page numbers', <input type="checkbox" checked={cfg.showPageNumbers} onChange={e => set({ showPageNumbers: e.target.checked })} />)}
          {row('Page number format', (
            <select value={cfg.pageNumberFormat} onChange={e => set({ pageNumberFormat: e.target.value })} className="text-xs rounded px-2 py-1 w-full" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
              {pageNumFormats.map(f => <option key={f}>{f}</option>)}
            </select>
          ))}
          {row('Page number position', (
            <select value={cfg.pageNumberPosition} onChange={e => set({ pageNumberPosition: e.target.value })} className="text-xs rounded px-2 py-1 w-full" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
              {positions.map(p => <option key={p}>{p}</option>)}
            </select>
          ))}
        </div>

        {/* Live preview */}
        <div className="rounded-xl overflow-hidden" style={{ border: '2px dashed var(--border)' }}>
          <div className="px-4 py-3 text-center" style={{ background: 'var(--card-bg)' }}>
            {cfg.header1 && <div className="text-sm font-bold">{cfg.header1}</div>}
            {cfg.header2 && <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>{cfg.header2}</div>}
            {cfg.header3 && <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>{cfg.header3}</div>}
            {cfg.showDate && <div className="text-xs mt-1" style={{ color: 'var(--muted-fg)' }}>{new Date().toLocaleDateString()}</div>}
          </div>
          <div className="px-4 py-1 flex justify-between text-xs" style={{ background: 'var(--secondary-bg)', borderTop: '1px solid var(--border)' }}>
            <span>{cfg.footerLeft}</span>
            <span>{cfg.footerCenter}</span>
            <span>{cfg.showPageNumbers ? `${cfg.pageNumberFormat}` : cfg.footerRight}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={() => { setCfg({ ...DEFAULT_CONFIG }); }}>Reset to Defaults</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save}>Save & Close</Btn>
        </div>
      </div>
    </InfoModal>
  );
}
