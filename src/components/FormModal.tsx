import React, { type ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { Modal, Btn } from './ui';

interface Props {
  title: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  saveLabel?: string;
  saveDisabled?: boolean;
}

export function FormModal({ title, isOpen, onClose, onSave, children, size = 'lg', saveLabel, saveDisabled }: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{t.actions.cancel}</Btn>
          <Btn variant="primary" onClick={onSave} disabled={saveDisabled}>{saveLabel ?? t.actions.save}</Btn>
        </>
      }
    >
      {children}
    </Modal>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: ReactNode;
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      accent={danger ? 'danger' : undefined}
      footer={
        <>
          <Btn variant="ghost" onClick={onCancel}>{t.actions.cancel}</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{t.actions.confirm}</Btn>
        </>
      }
    >
      <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{message}</p>
    </Modal>
  );
}

interface InfoModalProps {
  isOpen: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function InfoModal({ isOpen, title, onClose, children, size = 'lg' }: InfoModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={<Btn variant="ghost" onClick={onClose}>{t.actions.close}</Btn>}
    >
      {children}
    </Modal>
  );
}
