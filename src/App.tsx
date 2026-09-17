import React, { useCallback, useState } from "react"
import { AppShell } from "./components/AppShell"
import { DashboardView } from "./views/DashboardView"
import { SourcesView } from "./views/SourcesView"
import { ContentsView } from "./views/ContentsView"
import { AnalysisView } from "./views/AnalysisView"
import { AllDataView } from "./views/AllDataView"
import { TimelineView } from "./views/TimelineView"
import { ReportsView } from "./views/ReportsView"
import { ActivityView } from "./views/ActivityView"
import { DictionaryView } from "./views/DictionaryView"
import { SettingsProvider, useSettings } from "./store/SettingsContext"
import { AppProvider } from "./store/AppContext"
import { LanguageProvider } from "./i18n"
import type { NavSection } from "./types"

/** Sections that own a "create record" flow and accept the quick-add flag. */
type CreatableSection = "sources" | "contents" | "analysis"

function Inner() {
  const { settings } = useSettings()
  const [section, setSection] = useState<NavSection>("dashboard")
  const [toast, setToast] = useState("")
  const [linkedContentId, setLinkedContentId] = useState<string | undefined>()
  const [globalSearch, setGlobalSearch] = useState("")
  const [quickAdd, setQuickAdd] = useState<{
    section: CreatableSection
    nonce: number
  } | null>(null)

  const handleToast = useCallback((msg: string) => setToast(msg), [])
  const clearToast = useCallback(() => setToast(""), [])

  const handleLinkToAnalysis = (contentId: string) => {
    setLinkedContentId(contentId)
    setSection("analysis")
  }

  const handleGenerateReport = (_records?: unknown) => {
    setSection("reports")
    handleToast("Data sent to Reports workspace.")
  }

  /** The command bar search feeds the unified All Data view in real time. */
  const handleGlobalSearch = useCallback(
    (v: string) => {
      setGlobalSearch(v)
      if (v && section !== "allData") setSection("allData")
    },
    [section],
  )

  /** Quick Add opens the real "Add …" dialog inside the target workspace. */
  const handleQuickAdd = useCallback((target: CreatableSection) => {
    setSection(target)
    setQuickAdd({ section: target, nonce: Date.now() })
  }, [])

  const renderSection = () => {
    const openAdd = quickAdd ? quickAdd.section : undefined
    const openAddNonce = quickAdd ? quickAdd.nonce : 0
    switch (section) {
      case "dashboard":
        return <DashboardView onToast={handleToast} onNavigate={setSection} />
      case "sources":
        return (
          <SourcesView
            onToast={handleToast}
            autoOpenAdd={openAdd === "sources" ? openAddNonce : 0}
          />
        )
      case "contents":
        return (
          <ContentsView
            onToast={handleToast}
            onLinkToAnalysis={handleLinkToAnalysis}
            autoOpenAdd={openAdd === "contents" ? openAddNonce : 0}
          />
        )
      case "analysis":
        return (
          <AnalysisView
            key={`${linkedContentId ?? ""}:${openAdd ?? ""}:${openAddNonce}`}
            onToast={handleToast}
            initialContentId={linkedContentId}
            autoOpenAdd={openAdd === "analysis" ? openAddNonce : 0}
          />
        )
      case "allData":
        return (
          <AllDataView
            onToast={handleToast}
            onGenerateReport={handleGenerateReport}
            initialSearch={globalSearch}
          />
        )
      case "timeline":
        return <TimelineView onToast={handleToast} />
      case "reports":
        return <ReportsView onToast={handleToast} />
      case "activity":
        return <ActivityView onToast={handleToast} />
      case "dictionary":
        return <DictionaryView onToast={handleToast} />
    }
  }

  return (
    <LanguageProvider language={settings.language}>
      <AppShell
        activeSection={section}
        onSectionChange={(s) => {
          setSection(s)
          if (s !== "analysis") setLinkedContentId(undefined)
        }}
        toast={toast}
        onToastClear={clearToast}
        globalSearch={globalSearch}
        onGlobalSearch={handleGlobalSearch}
        onQuickAdd={handleQuickAdd}
      >
        {renderSection()}
      </AppShell>
    </LanguageProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AppProvider>
        <Inner />
      </AppProvider>
    </SettingsProvider>
  )
}