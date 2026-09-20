import React, { useState } from "react"
import { InfoModal } from "./FormModal"
import { APP_NAME, APP_VERSION_LABEL } from "../core/appInfo"
import { useTranslation } from "../i18n"

/** Topic ids in display order; each maps to a key in `t.help.topics`. */
const TOPIC_IDS = [
  "getting-started",
  "sources",
  "contents",
  "analysis",
  "timeline",
  "reports",
  "export",
  "search",
  "bulk",
  "activity",
  "dictionary",
] as const

const ID_TO_KEY: Record<string, keyof ReturnType<typeof useTranslation>["t"]["help"]["topics"]> = {
  "getting-started": "gettingStarted",
  sources: "sources",
  contents: "contents",
  analysis: "analysis",
  timeline: "timeline",
  reports: "reports",
  export: "export",
  search: "search",
  bulk: "bulk",
  activity: "activity",
  dictionary: "dictionary",
}

export function HelpDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string>("getting-started")
  const topic = t.help.topics[ID_TO_KEY[activeId] ?? "gettingStarted"]

  const filled = (text: string) =>
    text.replace("{app}", APP_NAME).replace("{version}", APP_VERSION_LABEL)

  return (
    <InfoModal
      isOpen={isOpen}
      title={filled(t.help.title)}
      onClose={onClose}
      size="xl"
    >
      <div className="flex gap-0 h-96">
        {/* Topics tree */}
        <div
          className="w-52 shrink-0 overflow-y-auto"
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          {TOPIC_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setActiveId(id)}
              className="w-full text-start px-3 py-2 text-xs transition-colors"
              style={{
                background:
                  activeId === id ? "var(--secondary-bg)" : "transparent",
                color: activeId === id ? "var(--fg)" : "var(--muted-fg)",
                borderInlineStart:
                  activeId === id
                    ? "3px solid var(--primary)"
                    : "3px solid transparent",
              }}
            >
              {t.help.topics[ID_TO_KEY[id]].title}
            </button>
          ))}
        </div>
        {/* Content pane */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h3
            className="text-base font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {topic.title}
          </h3>
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--fg)" }}
          >
            {filled(topic.content).split("\n").map((line, i) => {
              if (line.startsWith("**") && line.endsWith("**")) {
                return (
                  <p key={i} className="font-bold mt-3 mb-1">
                    {line.slice(2, -2)}
                  </p>
                )
              }
              if (line.startsWith("• ")) {
                return (
                  <p
                    key={i}
                    className="ml-3 text-xs"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {line}
                  </p>
                )
              }
              return (
                <p key={i} className={line ? "" : "h-2"}>
                  {line}
                </p>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="pt-3 text-xs text-center"
        style={{ color: "var(--muted-fg)" }}
      >
        {filled(t.help.footer)}
      </div>
    </InfoModal>
  )
}
