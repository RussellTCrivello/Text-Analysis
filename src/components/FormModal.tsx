/**
 * Thin, consistent aliases over the shared <Modal /> surface in ui.tsx so
 * every form, confirmation and informational overlay in the app is built
 * from one accessible implementation (focus trap, Esc handling, labelled
 * dialog) with the same chrome.
 */
import React, { type ReactNode } from "react"
import { useTranslation } from "../i18n"
import { Modal, Btn } from "./ui"
import { Save, Trash, TriangleAlert } from "./icons"

interface Props {
  title: ReactNode
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  children: ReactNode
  size?: "md" | "lg" | "xl"
  saveLabel?: string
  saveDisabled?: boolean
  saveIcon?: ReactNode
  subtitle?: ReactNode
}

export function FormModal({
  title,
  isOpen,
  onClose,
  onSave,
  children,
  size = "lg",
  saveLabel,
  saveDisabled,
  saveIcon,
  subtitle,
}: Props) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size={size}
      footer={
        <>
          <div className="flex-1" />
          <Btn variant="ghost" onClick={onClose}>
            {t.actions.cancel}
          </Btn>
          <Btn
            variant="primary"
            onClick={onSave}
            disabled={saveDisabled}
            icon={saveIcon ?? <Save size="sm" />}
          >
            {saveLabel ?? t.actions.save}
          </Btn>
        </>
      }
    >
      {children}
    </Modal>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: ReactNode
  message: ReactNode
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
  confirmLabel?: string
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  danger,
  confirmLabel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      accent={danger ? "danger" : "primary"}
      icon={danger ? <TriangleAlert size="sm" /> : undefined}
      footer={
        <>
          <div className="flex-1" />
          <Btn variant="ghost" onClick={onCancel}>
            {t.actions.cancel}
          </Btn>
          <Btn
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            icon={danger ? <Trash size="sm" /> : undefined}
          >
            {confirmLabel ?? t.actions.confirm}
          </Btn>
        </>
      }
    >
      <div
        className="text-xs leading-relaxed"
        style={{ color: "var(--muted-fg)" }}
      >
        {message}
      </div>
    </Modal>
  )
}

interface InfoModalProps {
  isOpen: boolean
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  footer?: ReactNode
}

export function InfoModal({
  isOpen,
  title,
  subtitle,
  icon,
  onClose,
  children,
  size = "lg",
  footer,
}: InfoModalProps) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      size={size}
      footer={
        footer ?? (
          <Btn variant="ghost" onClick={onClose}>
            {t.actions.close}
          </Btn>
        )
      }
    >
      {children}
    </Modal>
  )
}