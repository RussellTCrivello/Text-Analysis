/**
 * Top-level crash barrier.
 *
 * Without this, any render-time exception unmounts the whole React tree and
 * leaves the user staring at a blank window — especially bad in the packaged
 * desktop build, where there is no browser UI, no console in the user's face
 * and no address bar to reload from.
 *
 * The boundary is deliberately dependency-free: it must not itself rely on the
 * contexts (settings, data, i18n) that may have just thrown. Translations are
 * passed in as plain strings by the caller, with English fallbacks, and the
 * layout uses the design-system CSS custom properties that live on :root.
 */
import React from "react"
import { Alert, Refresh, CopyIcon } from "./icons"

export type ErrorBoundaryStrings = {
  title: string
  description: string
  reload: string
  retry: string
  details: string
  copy: string
  copied: string
}

const FALLBACK_STRINGS: ErrorBoundaryStrings = {
  title: "Something went wrong",
  description:
    "An unexpected error interrupted this view. Your saved records are untouched — reloading is safe.",
  reload: "Reload the app",
  retry: "Try again",
  details: "Technical details",
  copy: "Copy details",
  copied: "Error details copied.",
}

type Props = {
  children: React.ReactNode
  /** Localized copy; falls back to English when the i18n layer is unavailable. */
  strings?: Partial<ErrorBoundaryStrings>
  /** Text direction, so the fallback still reads correctly under Arabic/RTL. */
  dir?: "ltr" | "rtl"
  /** Escape hatch for tests/host apps that want their own reporting. */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

type State = {
  error: Error | null
  componentStack: string
  copied: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: "", copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? "" })
    // Surfacing the crash is the whole point; this is the one place in the app
    // where writing to the console is correct.
    console.error("[TextAnalysis] Unhandled render error:", error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private reset = () => {
    this.setState({ error: null, componentStack: "", copied: false })
  }

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload()
  }

  private report() {
    const { error, componentStack } = this.state
    return [
      `Error: ${error?.message ?? "unknown"}`,
      error?.stack ? `\nStack:\n${error.stack}` : "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
      typeof navigator !== "undefined" ? `\nUser agent: ${navigator.userAgent}` : "",
    ]
      .filter(Boolean)
      .join("")
  }

  private copy = () => {
    const text = this.report()
    const done = () => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    }
    try {
      void navigator.clipboard?.writeText(text).then(done, () => {})
    } catch {
      /* clipboard unavailable — the details are on screen and selectable */
    }
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children

    const s = { ...FALLBACK_STRINGS, ...(this.props.strings ?? {}) }
    const dir = this.props.dir ?? "ltr"

    return (
      <div
        dir={dir}
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "var(--bg, #0f1115)",
          color: "var(--fg, #e6e8ee)",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            maxWidth: "36rem",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1.75rem",
            borderRadius: "var(--radius-lg, 12px)",
            background: "var(--surface, #171a21)",
            border: "1px solid var(--border, #2a2f3a)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{ color: "var(--color-danger, #e5484d)", display: "inline-flex" }}>
              <Alert />
            </span>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{s.title}</h1>
          </div>

          <p style={{ margin: 0, color: "var(--muted-fg, #9aa3b2)", lineHeight: 1.6 }}>{s.description}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" onClick={this.reload} style={primaryButton}>
              <Refresh />
              {s.reload}
            </button>
            <button type="button" onClick={this.reset} style={secondaryButton}>
              {s.retry}
            </button>
            <button type="button" onClick={this.copy} style={secondaryButton}>
              <CopyIcon />
              {copied ? s.copied : s.copy}
            </button>
          </div>

          <details style={{ marginTop: "0.25rem" }}>
            <summary
              style={{
                cursor: "pointer",
                color: "var(--muted-fg, #9aa3b2)",
                fontSize: "0.875rem",
              }}
            >
              {s.details}
            </summary>
            <pre
              style={{
                marginTop: "0.625rem",
                maxHeight: "14rem",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                direction: "ltr",
                textAlign: "left",
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: "0.75rem",
                lineHeight: 1.5,
                color: "var(--muted-fg, #9aa3b2)",
                background: "var(--bg, #0f1115)",
                border: "1px solid var(--border, #2a2f3a)",
                borderRadius: "var(--radius-sm, 6px)",
                padding: "0.75rem",
              }}
            >
              {this.report()}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

const baseButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 0.9rem",
  borderRadius: "var(--radius-sm, 6px)",
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
}

const primaryButton: React.CSSProperties = {
  ...baseButton,
  background: "var(--accent, #5b4fd6)",
  color: "var(--accent-fg, #ffffff)",
}

const secondaryButton: React.CSSProperties = {
  ...baseButton,
  background: "transparent",
  color: "var(--fg, #e6e8ee)",
  borderColor: "var(--border, #2a2f3a)",
}

export default ErrorBoundary
