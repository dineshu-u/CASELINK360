import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './state/AppStateContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { InstitutionsPage } from './pages/InstitutionsPage';
import { EvidenceVaultPage } from './pages/EvidenceVaultPage';
import { CoordinationPage } from './pages/CoordinationPage';
import { KnowledgeAssistantPage } from './pages/KnowledgeAssistantPage';
import { KnowledgeSourcesPage } from './pages/KnowledgeSourcesPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { ReportsAuditPage } from './pages/ReportsAuditPage';
import { AdminPage } from './pages/AdminPage';
import { AlertsPage } from './pages/AlertsPage';

export const App: React.FC = () => {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:caseId" element={<CaseDetailPage />} />
            <Route path="/institutions" element={<InstitutionsPage />} />
            <Route path="/institutions/:institutionId" element={<InstitutionsPage />} />
            <Route path="/evidence" element={<EvidenceVaultPage />} />
            <Route path="/coordination" element={<CoordinationPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/knowledge" element={<KnowledgeAssistantPage />} />
            <Route path="/assistant" element={<KnowledgeAssistantPage />} />
            <Route path="/knowledge/sources" element={<KnowledgeSourcesPage />} />
            <Route path="/sources" element={<KnowledgeSourcesPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/reports" element={<ReportsAuditPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppStateProvider>
  );
};

export default App;
