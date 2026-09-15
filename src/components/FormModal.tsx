import React, { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '../i18n';

function useFocusTrap(isOpen: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [isOpen, ref]);
}

interface Props {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  saveLabel?: string;
  saveDisabled?: boolean;
}

const WIDTHS = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function FormModal({ title, isOpen, onClose, onSave, children, size = 'lg', saveLabel, saveDisabled }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${WIDTHS[size]} flex flex-col overflow-hidden`}
        style={{
          background: 'var(--card-bg)',
          color: 'var(--fg)',
          maxHeight: '90vh',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted-bg)' }}
        >
          <h2
            id={titleId}
            className="font-bold text-[13px] tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.actions.close}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--secondary-bg)]"
            style={{ color: 'var(--muted-fg)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--muted-bg)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded transition-all hover:bg-[var(--secondary-bg)]"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {t.actions.cancel}
          </button>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className="px-4 py-1.5 text-xs font-semibold rounded transition-all disabled:opacity-40 hover:brightness-110"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {saveLabel ?? t.actions.save}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          color: 'var(--fg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.28)',
        }}
      >
        {/* Danger accent bar */}
        {danger && <div style={{ height: 3, background: 'var(--error)', borderRadius: '10px 10px 0 0' }} />}

        <div className="px-5 py-4">
          <h3
            id={titleId}
            className="font-bold text-[13px] mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}
          >{title}</h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{message}</p>
        </div>
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--muted-bg)' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-medium rounded hover:bg-[var(--secondary-bg)] transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--fg)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)' }}
          >{t.actions.cancel}</button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs font-semibold rounded transition-all hover:brightness-110"
            style={{
              background: danger ? 'var(--error)' : 'var(--primary)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-display)',
            }}
          >{t.actions.confirm}</button>
        </div>
      </div>
    </div>
  );
}

interface InfoModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function InfoModal({ isOpen, title, onClose, children, size = 'lg' }: InfoModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${WIDTHS[size]} flex flex-col overflow-hidden`}
        style={{
          background: 'var(--card-bg)',
          color: 'var(--fg)',
          maxHeight: '90vh',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted-bg)' }}
        >
          <h2
            id={titleId}
            className="font-bold text-[13px]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}
          >{title}</h2>
          <button
            onClick={onClose}
            aria-label={t.actions.close}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--secondary-bg)]"
            style={{ color: 'var(--muted-fg)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div
          className="flex justify-end px-5 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--muted-bg)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded hover:bg-[var(--secondary-bg)] transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--fg)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)' }}
          >{t.actions.close}</button>
        </div>
      </div>
    </div>
  );
}
