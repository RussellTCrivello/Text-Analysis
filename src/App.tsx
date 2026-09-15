import React, { useCallback, useState } from 'react';
import { AppShell } from './components/AppShell';
import { SourcesView } from './views/SourcesView';
import { ContentsView } from './views/ContentsView';
import { AnalysisView } from './views/AnalysisView';
import { AllDataView } from './views/AllDataView';
import { TimelineView } from './views/TimelineView';
import { ReportsView } from './views/ReportsView';
import { SettingsProvider, useSettings } from './store/SettingsContext';
import { AppProvider } from './store/AppContext';
import { LanguageProvider } from './i18n';
import type { NavSection } from './types';

function Inner() {
  const { settings } = useSettings();
  const [section, setSection] = useState<NavSection>('sources');
  const [toast, setToast] = useState('');
  const [linkedContentId, setLinkedContentId] = useState<string | undefined>();

  const handleToast = useCallback((msg: string) => setToast(msg), []);
  const clearToast = useCallback(() => setToast(''), []);

  const handleLinkToAnalysis = (contentId: string) => {
    setLinkedContentId(contentId);
    setSection('analysis');
  };

  const handleGenerateReport = (_records?: unknown) => {
    setSection('reports');
    handleToast('Data sent to Reports workspace.');
  };

  const renderSection = () => {
    switch (section) {
      case 'sources': return <SourcesView onToast={handleToast} />;
      case 'contents': return <ContentsView onToast={handleToast} onLinkToAnalysis={handleLinkToAnalysis} />;
      case 'analysis': return <AnalysisView key={linkedContentId} onToast={handleToast} initialContentId={linkedContentId} />;
      case 'allData': return <AllDataView onToast={handleToast} onGenerateReport={handleGenerateReport} />;
      case 'timeline': return <TimelineView onToast={handleToast} />;
      case 'reports': return <ReportsView onToast={handleToast} />;
    }
  };

  return (
    <LanguageProvider language={settings.language}>
      <AppShell
        activeSection={section}
        onSectionChange={s => { setSection(s); if (s !== 'analysis') setLinkedContentId(undefined); }}
        toast={toast}
        onToastClear={clearToast}
      >
        {renderSection()}
      </AppShell>
    </LanguageProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppProvider>
        <Inner />
      </AppProvider>
    </SettingsProvider>
  );
}
