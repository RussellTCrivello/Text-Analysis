import './smoke-setup';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsProvider } from '../src/store/SettingsContext';
import { AppProvider } from '../src/store/AppContext';
import { LanguageProvider } from '../src/i18n';
import { AppShell } from '../src/components/AppShell';
import { SourcesView } from '../src/views/SourcesView';
import { DashboardView } from '../src/views/DashboardView';
import { ContentsView } from '../src/views/ContentsView';
import { AnalysisView } from '../src/views/AnalysisView';
import { AllDataView } from '../src/views/AllDataView';
import { TimelineView } from '../src/views/TimelineView';
import { ReportsView } from '../src/views/ReportsView';
import { ActivityView } from '../src/views/ActivityView';
import { DictionaryView } from '../src/views/DictionaryView';
import { ImportWizard } from '../src/components/ImportWizard';
import { ExportDialog } from '../src/components/ExportDialog';
import { BackupDialog } from '../src/components/BackupDialog';
import { AttachmentManager } from '../src/components/AttachmentManager';
import { AdvancedSearch } from '../src/components/AdvancedSearch';
import { PerformanceMonitor } from '../src/components/PerformanceMonitor';
import { PrintHeaderSettings } from '../src/components/PrintHeaderSettings';
import { ComboField } from '../src/components/ComboField';
import { AttachmentField } from '../src/components/AttachmentField';
import { HelpDialog } from '../src/components/HelpDialog';
import { ResetDialog } from '../src/components/ResetDialog';
import { SummaryDialog } from '../src/components/SummaryDialog';
import { ComparisonDialog } from '../src/components/ComparisonDialog';
import { FilterBuilder } from '../src/components/FilterBuilder';
import type { Analysis } from '../src/types';
import { DateTimeInput, Field } from '../src/components/ui';
import { sampleData } from '../src/data/sampleData';

const toast = (m: string) => { if (!m) throw new Error('empty toast'); };

const views: Record<string, React.ReactNode> = {
  dashboard: <DashboardView onToast={toast} onNavigate={() => {}} />,
  sources: <SourcesView onToast={toast} />,
  contents: <ContentsView onToast={toast} />,
  analysis: <AnalysisView onToast={toast} />,
  allData: <AllDataView onToast={toast} />,
  timeline: <TimelineView onToast={toast} />,
  reports: <ReportsView onToast={toast} />,
  activity: <ActivityView onToast={toast} />,
  dictionary: <DictionaryView onToast={toast} />,
  'activity:ar': <ActivityView onToast={toast} />,
  'dictionary:ar': <DictionaryView onToast={toast} />,
  importWizard: <ImportWizard isOpen onClose={() => {}} onToast={toast} />,
  exportDialog: <ExportDialog isOpen onClose={() => {}} data={sampleData.sources as unknown as Record<string, unknown>[]} columns={[]} defaultFilename="x" />,
  backup: <BackupDialog isOpen onClose={() => {}} onToast={toast} />,
  attachments: <AttachmentManager isOpen onClose={() => {}} onToast={toast} />,
  performanceMonitor: <PerformanceMonitor isOpen onClose={() => {}} />,
  'performanceMonitor:ar': <PerformanceMonitor isOpen onClose={() => {}} />,
  printHeader: <PrintHeaderSettings isOpen onClose={() => {}} onToast={toast} />,
  'printHeader:ar': <PrintHeaderSettings isOpen onClose={() => {}} onToast={toast} />,
  help: <HelpDialog isOpen onClose={() => {}} />,
  'help:ar': <HelpDialog isOpen onClose={() => {}} />,
  reset: <ResetDialog isOpen onClose={() => {}} onResetData={() => {}} onResetAll={() => {}} />,
  summary: <SummaryDialog isOpen onClose={() => {}} analyses={sampleData.analyses as Analysis[]} />,
  comparison: (
    <ComparisonDialog
      isOpen
      onClose={() => {}}
      analyses={sampleData.analyses as Analysis[]}
      contentTitle={(id) => id}
    />
  ),
  filterBuilder: <FilterBuilder entity="sources" onApply={() => {}} onClear={() => {}} />,
  'filterBuilder:ar': <FilterBuilder entity="sources" onApply={() => {}} onClear={() => {}} />,
  comboField: (
    <Field label="Type">
      <ComboField
        value="document"
        onChange={() => {}}
        options={[{ value: 'document' }, { value: 'media', builtin: true }]}
        usage={{ document: 3 }}
        onCreate={() => {}}
        onRemove={() => {}}
      />
    </Field>
  ),
  attachmentField: (
    <Field label="Attachments">
      <AttachmentField recordId="ct_1" recordType="content" recordTitle="Sample" value="a.pdf" onChange={() => {}} onToast={toast} />
    </Field>
  ),
  'attachmentField:ar': (
    <Field label="Attachments">
      <AttachmentField recordType="content" onToast={toast} />
    </Field>
  ),
  dateTimeInput: <DateTimeInput value="2024-03-05T14:30:00.000Z" onChange={() => {}} />,
  advancedSearch: (
    <AdvancedSearch
      isOpen
      onClose={() => {}}
      fields={[{ value: 'name', label: 'Name' }, { value: 'importance', label: 'Importance' }]}
      data={sampleData.sources as unknown as Record<string, unknown>[]}
      target="sources"
      onApply={() => {}}
    />
  ),
};

let failures = 0;
for (const [name, node] of Object.entries(views)) {
  try {
    const lang = name.endsWith(':ar') ? 'ar' : 'en';
    const html = renderToStaticMarkup(
      <SettingsProvider>
        <AppProvider>
          <LanguageProvider language={lang}>
            <AppShell activeSection={name === 'sources' ? 'sources' : 'reports'} onSectionChange={() => {}} toast="" onToastClear={() => {}}>
              {node}
            </AppShell>
          </LanguageProvider>
        </AppProvider>
      </SettingsProvider>,
    );
    if (html.length < 200) throw new Error(`rendered only ${html.length} chars`);
    console.log(`ok   ${name} (${html.length} chars)`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL ${name}: ${(err as Error).message}`);
    console.log(String((err as Error).stack).split('\n').slice(1, 4).join('\n'));
  }
}
console.log(failures === 0 ? 'SMOKE PASS' : `SMOKE FAILURES: ${failures}`);
if (failures) process.exitCode = 1;
