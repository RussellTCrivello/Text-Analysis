import React, { useState } from "react"
import { InfoModal } from "./FormModal"
import { Btn } from "./ui"
import { Trash, TriangleAlert } from "./icons"
import { useTranslation } from "../i18n"

interface Props {
  isOpen: boolean
  onClose: () => void
  onResetData: () => void
  onResetAll: () => void
}

type Mode = "data" | "all"

export function ResetDialog({
  isOpen,
  onClose,
  onResetData,
  onResetAll,
}: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("data")
  const [confirming, setConfirming] = useState(false)

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    if (mode === "data") onResetData()
    else onResetAll()
    setConfirming(false)
    onClose()
  }

  return (
    <InfoModal
      isOpen={isOpen}
      title={t.dialogs.reset.title}
      onClose={() => {
        setConfirming(false)
        onClose()
      }}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] p-3"
          style={{
            background: "var(--error-soft)",
            border: "1px solid var(--error)40",
          }}
        >
          <span
            className="inline-flex mt-0.5"
            style={{ color: "var(--error)" }}
          >
            <TriangleAlert size="md" />
          </span>
          <p className="text-sm font-bold" style={{ color: "var(--error)" }}>
            {t.dialogs.reset.warning}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="flex items-start gap-2 cursor-pointer p-2 rounded"
            style={{
              background:
                mode === "data" ? "var(--secondary-bg)" : "transparent",
              border:
                "1px solid " +
                (mode === "data" ? "var(--primary)" : "var(--border)"),
            }}
            onClick={() => setMode("data")}
          >
            <input
              type="radio"
              checked={mode === "data"}
              onChange={() => setMode("data")}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-semibold">
                {t.dialogs.reset.dataTitle}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--muted-fg)" }}
              >
                {t.dialogs.reset.dataDesc}
              </div>
            </div>
          </label>
          <label
            className="flex items-start gap-2 cursor-pointer p-2 rounded"
            style={{
              background:
                mode === "all" ? "var(--secondary-bg)" : "transparent",
              border:
                "1px solid " + (mode === "all" ? "#dc2626" : "var(--border)"),
            }}
            onClick={() => setMode("all")}
          >
            <input
              type="radio"
              checked={mode === "all"}
              onChange={() => setMode("all")}
              className="mt-0.5"
            />
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "#dc2626" }}
              >
                {t.dialogs.reset.allTitle}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--muted-fg)" }}
              >
                {t.dialogs.reset.allDesc}
              </div>
            </div>
          </label>
        </div>

        {confirming && (
          <div
            className="rounded-lg p-3 text-sm font-semibold"
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
            }}
          >
            {mode === "data" ? t.dialogs.reset.confirmData : t.dialogs.reset.confirmAll}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Btn
            onClick={() => {
              setConfirming(false)
              onClose()
            }}
            variant="ghost"
          >
            {t.actions.cancel}
          </Btn>
          <Btn
            onClick={handleReset}
            variant="danger"
            icon={
              confirming ? <TriangleAlert size="xs" /> : <Trash size="xs" />
            }
          >
            {confirming ? t.dialogs.reset.confirmReset : t.actions.reset}
          </Btn>
        </div>
      </div>
    </InfoModal>
  )
}