import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  Calendar,
  Cpu,
  FileText,
  HelpCircle,
  Search,
  ShieldCheck,
  ZapOff,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { EXAMPLE_ASSISTANT_QUERIES, runLocalKnowledgeQuery } from '../services/ragAdapter';
import { DocumentPreviewDrawer } from '../components/ui/DocumentPreviewDrawer';
import { GLOSSARY_VERSION } from '../services/glossary';

export const KnowledgeAssistantPage: React.FC = () => {
  const { state, currentUser, updateSettings } = useAppState();
  const [searchParams] = useSearchParams();

  const initialCaseId = searchParams.get('caseId') ?? '';
  const initialCase = state.cases.find((c) => c.id === initialCaseId);

  const [queryInput, setQueryInput] = useState(
    searchParams.get('q') ?? EXAMPLE_ASSISTANT_QUERIES[0].query
  );
  const [submittedQuery, setSubmittedQuery] = useState(
    searchParams.get('q') ?? EXAMPLE_ASSISTANT_QUERIES[0].query
  );
  const [docCategory, setDocCategory] = useState<'All' | 'Approved Policy' | 'Historical Case Record'>('All');
  const [institutionScope, setInstitutionScope] = useState<string>(
    searchParams.get('inst') ?? ''
  );
  const [selectedCaseContextId, setSelectedCaseContextId] = useState<string>(initialCaseId);
  const [asOfIncidentDate, setAsOfIncidentDate] = useState<string>(
    initialCase?.incidentDate ?? state.demoDate
  );
  const [includeSupersededComparison, setIncludeSupersededComparison] = useState<boolean>(false);
  const [showPipelineTrace, setShowPipelineTrace] = useState<boolean>(true);

  const [previewState, setPreviewState] = useState<{
    docId: string;
    section?: string;
  } | null>(null);

  const handleSelectCaseContext = (cid: string) => {
    setSelectedCaseContextId(cid);
    const found = state.cases.find((c) => c.id === cid);
    if (found) {
      setAsOfIncidentDate(found.incidentDate ?? found.receivedDate);
      setInstitutionScope('');
    }
  };

  const response = useMemo(
    () =>
      runLocalKnowledgeQuery(
        submittedQuery,
        state.documents,
        {
          category: docCategory,
          institutionId: institutionScope || undefined,
          asOfIncidentDate,
          includeSupersededComparison,
        },
        state.settings.aiAssistanceEnabled,
        {
          currentUser,
          cases: state.cases,
          accessRequests: state.accessRequests,
          demoDate: state.demoDate,
          aiSimulatedFailure: state.settings.aiSimulatedFailureMode,
        }
      ),
    [
      submittedQuery,
      state.documents,
      state.cases,
      state.accessRequests,
      state.demoDate,
      docCategory,
      institutionScope,
      asOfIncidentDate,
      includeSupersededComparison,
      state.settings.aiAssistanceEnabled,
      state.settings.aiSimulatedFailureMode,
      currentUser,
    ]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(queryInput);
  };

  const runExample = (q: string, cid?: string) => {
    setQueryInput(q);
    setSubmittedQuery(q);
    setInstitutionScope('');
    if (cid) {
      handleSelectCaseContext(cid);
    } else {
      setSelectedCaseContextId('');
      setAsOfIncidentDate(state.demoDate);
    }
  };

  const previewDoc =
    state.documents.find((d) => d.id === previewState?.docId) ?? null;

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Regulatory Knowledge Assistant</h1>
          <p className="page-subtitle">
            Effective-date-aware, permission-scoped policy retrieval with Hinglish glossary expansion ({GLOSSARY_VERSION}) and deterministic fallback
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={`btn btn-sm ${
              state.settings.aiSimulatedFailureMode ? 'btn-danger' : 'btn-secondary'
            }`}
            onClick={() =>
              updateSettings(
                { aiSimulatedFailureMode: !state.settings.aiSimulatedFailureMode },
                `Toggled Simulated AI Failure Mode to ${!state.settings.aiSimulatedFailureMode}`
              )
            }
            title="Test circuit-breaker fallback when external AI/LLM service times out"
          >
            <ZapOff size={14} />
            {state.settings.aiSimulatedFailureMode
              ? 'Simulated AI Failure: ON'
              : 'Test AI Timeout Fallback'}
          </button>
          <Link to="/knowledge/sources" className="btn btn-secondary">
            Manage Knowledge Sources ({state.documents.length})
          </Link>
        </div>
      </div>

      {/* Mode Banner */}
      {state.settings.aiSimulatedFailureMode ? (
        <div className="alert-banner warning">
          <ZapOff size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Circuit-Breaker Fallback Active (Simulated AI Service Timeout):</strong> LLM synthesis is suppressed instead of hanging or guessing; deterministic glossary + effective-date passage search remains 100% available below.
          </div>
        </div>
      ) : state.settings.aiAssistanceEnabled ? (
        <div className="alert-banner info">
          <Cpu size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Hybrid Retrieval Mode:</strong> Pre-filters restricted sources by active role (<strong>{currentUser.bureau}</strong>), evaluates temporal policy validity as of <span className="mono">{asOfIncidentDate}</span>, and abstains cleanly when evidence is insufficient.
          </div>
        </div>
      ) : (
        <div className="alert-banner warning">
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Degraded Mode Active (AI Assistance Disabled):</strong> Generative synthesis is turned off. Full deterministic keyword + Hinglish glossary search, effective-date filtering, and source previews continue normally.
          </div>
        </div>
      )}

      {/* Search & Effective-Date Time-Travel Controls */}
      <div className="panel">
        <div className="panel-body stack-md">
          <form onSubmit={handleSearch} className="stack-sm">
            <label className="field-label" htmlFor="rag-query">
              Ask a Policy, Hinglish Synonym, Case, or Institution History Question
            </label>
            <div className="row-center" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                id="rag-query"
                type="search"
                className="field-input"
                style={{ flex: 1, minWidth: 260 }}
                placeholder='e.g., "caution money and original TC deduction limit" or "fees wapas rule"'
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <Search size={15} />
                Run Grounded Query
              </button>
            </div>

            {/* Effective-Date ("Time-Travel") & Scope Bar */}
            <div
              className="row-center mt-2"
              style={{
                flexWrap: 'wrap',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Calendar size={14} className="text-accent" />
              <span className="text-xs font-semibold">Case / Incident-Date Context:</span>

              <select
                className="field-select"
                aria-label="Bind case incident date"
                value={selectedCaseContextId}
                onChange={(e) => handleSelectCaseContext(e.target.value)}
              >
                <option value="">Manual Date Selection</option>
                {state.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — Incident: {c.incidentDate ?? c.receivedDate} ({c.academicYear ?? 'AY'})
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="field-input mono"
                aria-label="Effective as-of incident date"
                value={asOfIncidentDate}
                onChange={(e) => {
                  setSelectedCaseContextId('');
                  setAsOfIncidentDate(e.target.value);
                }}
              />

              <label className="row-center text-xs" style={{ cursor: 'pointer', gap: 5 }}>
                <input
                  type="checkbox"
                  checked={includeSupersededComparison}
                  onChange={(e) => setIncludeSupersededComparison(e.target.checked)}
                />
                Include superseded policies for historical comparison
              </label>

              <select
                className="field-select"
                aria-label="Filter source category"
                value={docCategory}
                onChange={(e) =>
                  setDocCategory(
                    e.target.value as 'All' | 'Approved Policy' | 'Historical Case Record'
                  )
                }
              >
                <option value="All">All Approved Sources</option>
                <option value="Approved Policy">Circulars &amp; SOPs</option>
                <option value="Historical Case Record">Historical Case Filings</option>
              </select>
            </div>
          </form>

          {/* Example Query Chips */}
          <div>
            <div className="text-xs font-semibold text-muted mb-2">
              Required Verification Queries (Click to execute live):
            </div>
            <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
              {EXAMPLE_ASSISTANT_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => runExample(item.query, item.caseId)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results & 6-Stage RAG Governance Trace */}
      <div className="detail-grid">
        <div className="stack-lg">
          {/* Answer / Abstention Card */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Grounded Response (As of Incident Date: {response.effectiveAsOfDate})</h2>
                <p className="text-xs text-muted">
                  Query: &ldquo;{response.query}&rdquo; • Elapsed: {response.measuredLatencyMs} ms
                </p>
              </div>
              <span
                className={`badge ${
                  response.hasSufficientEvidence ? 'badge-success' : 'badge-warning'
                }`}
              >
                {response.hasSufficientEvidence
                  ? `${response.matches.length} Grounded Passage(s)`
                  : 'Insufficient Evidence — Abstained'}
              </span>
            </div>

            <div className="panel-body stack-md">
              {!response.hasSufficientEvidence ? (
                <div className="alert-banner warning">
                  <HelpCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Explicit Abstention (No Fabricated Policy Claims):</strong>{' '}
                    {response.abstentionReason}
                  </div>
                </div>
              ) : response.aiSynthesisIncluded ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--ai-soft)',
                    border: '1px solid var(--ai-border)',
                  }}
                >
                  <div className="split-row mb-2">
                    <span className="badge badge-ai">Optional AI Summary (Grounded Citations Only)</span>
                    <span className="text-xs text-muted">Verify clauses &amp; dates directly below</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {response.synthesizedAnswer}
                  </p>
                </div>
              ) : (
                <div className="alert-banner info">
                  <BookOpenCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Deterministic Verbatim Passage Retrieval:</strong> Synthesis summary disabled or suppressed by fallback; review exact clauses below.
                  </div>
                </div>
              )}

              {/* Retrieved Passages with Prominent Supersession Warnings */}
              {response.matches.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>
                    Retrieved Source Passages ({response.matches.length})
                  </h3>
                  <div className="stack-sm">
                    {response.matches.map(({ document, passage, score, matchedTerms, validityStatus }) => (
                      <div key={passage.id} className="citation-card">
                        {document.supersededByDocId && (
                          <div className="alert-banner warning mb-2">
                            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div className="text-xs">
                              <strong>
                                {validityStatus === 'Historically Applicable'
                                  ? `Historically Applicable on ${response.effectiveAsOfDate} (Subsequently Superseded):`
                                  : 'WARNING — Superseded Circular:'}
                              </strong>{' '}
                              Valid <span className="mono">{document.effectiveFrom}</span> to{' '}
                              <span className="mono">{document.effectiveTo}</span>. Superseded from 01 Jul 2025 by{' '}
                              <button
                                type="button"
                                className="btn-link mono font-semibold"
                                onClick={() => setPreviewState({ docId: document.supersededByDocId! })}
                              >
                                {document.supersededByDocId} (Open Current Circular)
                              </button>
                              .
                            </div>
                          </div>
                        )}

                        <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                            <span className="mono font-semibold text-xs text-accent">
                              {document.id}
                            </span>
                            <span
                              className={`badge ${
                                validityStatus === 'In Force on Target Date'
                                  ? 'badge-success'
                                  : 'badge-warning'
                              }`}
                            >
                              {validityStatus}
                            </span>
                            <span className="font-semibold text-sm">{document.title}</span>
                          </div>
                          <span className="mono text-xs text-muted">
                            Eff. {document.effectiveFrom} • Page {passage.page} • Score {score}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-secondary mt-1">
                          {passage.section}
                        </div>

                        <p className="text-sm mt-2" style={{ color: 'var(--text-primary)' }}>
                          &ldquo;{passage.text}&rdquo;
                        </p>

                        <div
                          className="split-row mt-2"
                          style={{ flexWrap: 'wrap', gap: 8 }}
                        >
                          <span className="text-xs text-muted">
                            Matched terms: <span className="mono">{matchedTerms.join(', ')}</span>
                          </span>
                          <button
                            type="button"
                            className="btn-link text-xs"
                            onClick={() =>
                              setPreviewState({
                                docId: document.id,
                                section: passage.section,
                              })
                            }
                          >
                            <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
                            Open Source Document &amp; Validity Metadata
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: 6-Stage RAG Governance Trace */}
        <div className="stack-lg">
          <div className="panel">
            <div className="panel-header">
              <h2>6-Stage RAG Governance Trace</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPipelineTrace((v) => !v)}
              >
                {showPipelineTrace ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPipelineTrace && (
              <div className="panel-body stack-sm">
                <div className="text-xs text-muted mb-2">
                  Pre-filtered restricted docs before context assembly:{' '}
                  <strong className="mono">{response.restrictedDocsExcludedCount}</strong>
                </div>
                {response.pipelineStages.map((st, idx) => (
                  <div key={st.stage} className="citation-card">
                    <div className="split-row">
                      <span className="font-semibold text-xs">
                        {idx + 1}. {st.stage}
                      </span>
                      <span
                        className={`badge ${
                          st.status === 'Fallback Active' || st.status === 'Abstained'
                            ? 'badge-warning'
                            : st.status === 'Passed'
                            ? 'badge-success'
                            : 'badge-neutral'
                        }`}
                      >
                        {st.status}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-1">{st.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DocumentPreviewDrawer
        doc={previewDoc}
        highlightSection={previewState?.section}
        onSelectDocId={(id) => setPreviewState({ docId: id })}
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
};
