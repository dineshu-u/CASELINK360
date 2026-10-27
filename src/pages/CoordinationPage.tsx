import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  GitCompareArrows,
  Plus,
  RefreshCw,
  ShieldAlert,
  Slash,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { ALL_BUREAUS } from '../data/seedData';
import { AlertStatus, BureauName, RelationshipTaxonomy } from '../types/domain';
import {
  AlertStatusBadge,
  PriorityBadge,
  SourceBasisBadge,
  StatusBadge,
  TaxonomyBadge,
} from '../components/ui/Badges';
import { formatDateDisplay } from '../services/caseService';
import { DocumentPreviewDrawer } from '../components/ui/DocumentPreviewDrawer';
import { evaluateCohortClusters } from '../services/clearanceService';
import { isOpenCoordinationAlert, isTerminalCaseStatus } from '../services/caseService';

const TAXONOMY_OPTIONS: RelationshipTaxonomy[] = [
  'Cohort / Pattern Cluster',
  'Duplicate Filing',
  'Causal Cross-Category Link',
  'Operational Schedule Collision Only',
  'Verified Independent',
];

export const CoordinationPage: React.FC = () => {
  const {
    state,
    currentUser,
    canWrite,
    updateAlertWorkflow,
    suppressAlertAsIndependent,
    createCoordinationTask,
    updateTaskStatus,
    updateSettings,
  } = {
    ...useAppState(),
    suppressAlertAsIndependent: useAppState().suppressAlertPair,
  };

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') ?? 'All'
  );
  const [bureauFilter, setBureauFilter] = useState<string>(
    searchParams.get('bureau') ?? 'All'
  );
  const [taxonomyFilter, setTaxonomyFilter] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string>(
    searchParams.get('alert') ?? state.alerts[0]?.id ?? ''
  );

  useEffect(() => {
    const paramStatus = searchParams.get('status');
    const paramBureau = searchParams.get('bureau');
    const paramAlert = searchParams.get('alert');
    if (paramStatus !== null) setStatusFilter(paramStatus);
    if (paramBureau !== null) setBureauFilter(paramBureau);
    if (paramAlert) setSelectedId(paramAlert);
  }, [searchParams]);

  const [decisionNote, setDecisionNote] = useState('');
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<RelationshipTaxonomy | ''>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  // Task creation state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskLeadBureau, setTaskLeadBureau] = useState<BureauName>(currentUser.bureau);
  const [taskDue, setTaskDue] = useState('2026-10-26');

  const cohortClusters = useMemo(
    () =>
      evaluateCohortClusters(
        state.cases,
        state.demoDate,
        state.settings.cohortRollingDays,
        state.settings.cohortThresholdCount
      ),
    [state.cases, state.demoDate, state.settings.cohortRollingDays, state.settings.cohortThresholdCount]
  );

  const filteredAlerts = useMemo(() => {
    return state.alerts.filter((al) => {
      if (statusFilter === 'Active' && !isOpenCoordinationAlert(al)) return false;
      if (statusFilter !== 'All' && statusFilter !== 'Active' && al.status !== statusFilter) {
        return false;
      }
      if (bureauFilter !== 'All' && !al.involvedBureaus.includes(bureauFilter as BureauName)) {
        return false;
      }
      if (taxonomyFilter !== 'All' && al.taxonomy !== taxonomyFilter) return false;
      return true;
    });
  }, [state.alerts, statusFilter, bureauFilter, taxonomyFilter]);

  const activeAlert =
    state.alerts.find((a) => a.id === selectedId) ?? filteredAlerts[0] ?? null;
  const previewDoc = state.documents.find((d) => d.id === previewDocId) ?? null;

  // Side-by-side comparison records for the opened alert (capped at three dockets)
  const comparisonCases = useMemo(() => {
    if (!activeAlert) return [];
    return activeAlert.involvedCaseIds
      .map((cid) => state.cases.find((c) => c.id === cid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .slice(0, 3);
  }, [activeAlert, state.cases]);

  // PS SIH26264: automatically identify institutions with active cases handled by
  // two or more Bureaus/Cells and surface the coordination-required banner.
  const multiBureauOverlaps = useMemo(() => {
    const byInstitution = new Map<string, typeof state.cases>();
    state.cases
      .filter((c) => !isTerminalCaseStatus(c.status))
      .forEach((c) => {
        const list = byInstitution.get(c.institutionId) ?? [];
        byInstitution.set(c.institutionId, [...list, c]);
      });
    return Array.from(byInstitution.entries())
      .map(([institutionId, rows]) => {
        const bureaus = Array.from(new Set(rows.map((c) => c.assignedBureau)));
        return {
          institutionId,
          institution: state.institutions.find((i) => i.id === institutionId),
          bureaus: bureaus.map((b) => ({
            bureau: b,
            caseIds: rows.filter((c) => c.assignedBureau === b).map((c) => c.id),
          })),
          caseIds: rows.map((c) => c.id),
          linkedAlert: state.alerts.find(
            (a) => a.institutionId === institutionId && isOpenCoordinationAlert(a)
          ),
        };
      })
      .filter((g) => g.bureaus.length >= 2)
      .sort((a, b) => b.bureaus.length - a.bureaus.length);
  }, [state.cases, state.institutions, state.alerts]);

  const allSame = (values: string[]) => values.length > 1 && values.every((v) => v === values[0]);
  const cmpInstitutionsMatch = allSame(comparisonCases.map((c) => c.institutionId));
  const cmpCategoriesMatch = allSame(comparisonCases.map((c) => c.category));
  const cmpYearsMatch = allSame(comparisonCases.map((c) => c.academicYear));

  const handleRecordFollowUp = () => {
    if (!activeAlert) return;
    setTaskTitle(`Follow-up: ${activeAlert.title}`);
    setShowTaskForm(true);
    setFeedback(
      `Follow-up action drafted from ${activeAlert.id} — complete the lead bureau and due date in the task form below.`
    );
    window.setTimeout(() => {
      document
        .getElementById('coordination-task-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const selectAlert = (id: string) => {
    setSelectedId(id);
    setSelectedTaxonomy('');
    setSearchParams({ alert: id });
    setFeedback(null);
  };

  const handleDecision = (
    nextStatus: AlertStatus,
    entryType: 'Discussion' | 'Decision' | 'Dismissal'
  ) => {
    if (!activeAlert) return;
    const res = updateAlertWorkflow(
      activeAlert.id,
      nextStatus,
      decisionNote,
      entryType,
      selectedTaxonomy || undefined
    );
    if (!res.ok) {
      setFeedback(res.error ?? 'Action could not be completed.');
      return;
    }
    setDecisionNote('');
    setSelectedTaxonomy('');
    setFeedback(
      `Recorded ${entryType.toLowerCase()} on ${activeAlert.id} (Status: ${nextStatus}). Individual case outcomes remain separate.`
    );
  };

  const handleSuppressPair = () => {
    if (!activeAlert) return;
    const res = suppressAlertAsIndependent(activeAlert.id, decisionNote);
    if (!res.ok) {
      setFeedback(res.error ?? 'Unable to record suppression.');
      return;
    }
    setDecisionNote('');
    setFeedback(
      `Recorded Negative Memory suppression ${res.suppressionId} under ${state.settings.relationshipRuleVersion}. Pair will stay silent unless new actions, documents, dates, or rule versions occur.`
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlert) return;
    const res = createCoordinationTask({
      alertId: activeAlert.id,
      caseId: activeAlert.involvedCaseIds[0],
      institutionId: activeAlert.institutionId,
      title: taskTitle,
      leadBureau: taskLeadBureau,
      participatingBureaus: activeAlert.involvedBureaus,
      assigneeId: currentUser.id,
      dueDate: taskDue,
      status: 'Awaiting Discussion',
      notes: `Created from ${activeAlert.id} [${activeAlert.taxonomy}]`,
    });
    if (!res.ok) {
      setFeedback(res.error ?? 'Could not create task.');
      return;
    }
    setTaskTitle('');
    setShowTaskForm(false);
    setFeedback(`Created cross-bureau task ${res.taskId}.`);
  };

  const bumpRuleVersionDemo = () => {
    const nextVer =
      state.settings.relationshipRuleVersion === 'REL-RULE-v2.3'
        ? 'REL-RULE-v2.4'
        : 'REL-RULE-v2.5';
    updateSettings(
      { relationshipRuleVersion: nextVer },
      `Incremented Relationship Rule Engine version to ${nextVer} — automatically triggers Negative Memory re-evaluation.`
    );
    setFeedback(
      `Incremented rule version to ${nextVer}. Watch the Negative Memory Suppression Ledger below automatically reopen suppressed pairs whose baseline signature changed!`
    );
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Cross-Bureau Coordination &amp; Relationship Taxonomy</h1>
          <p className="page-subtitle">
            Five-part regulatory relationship classification, 60-day Cohort Pattern Alerts, and stateful Negative Memory suppression
          </p>
        </div>
      </div>

      {/* Live 60-Day Cohort Threshold Banner */}
      {cohortClusters
        .filter((c) => c.exceedsThreshold)
        .map((cluster) => {
          const inst = state.institutions.find((i) => i.id === cluster.institutionId);
          return (
            <div key={`${cluster.institutionId}-${cluster.category}`} className="alert-banner critical">
              <GitCompareArrows size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="split-row" style={{ width: '100%', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>
                    Rolling {state.settings.cohortRollingDays}-Day Cohort Threshold Exceeded ({cluster.activeCaseIds.length} active &ge; {state.settings.cohortThresholdCount}):
                  </strong>{' '}
                  <Link to={`/institutions/${cluster.institutionId}`} className="link-inline mono">
                    {cluster.institutionId}
                  </Link>{' '}
                  ({inst?.name}) in category <em>{cluster.category}</em>. Individual student dockets (
                  {cluster.inWindowCaseIds.join(', ')}) remain independently trackable without forced merging.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => selectAlert('CRD-2026-004')}
                >
                  Open Cohort Alert CRD-2026-004
                </button>
              </div>
            </div>
          );
        })}

      {feedback && (
        <div className="alert-banner info">
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{feedback}</div>
        </div>
      )}

      {/* Multi-Bureau Institution Overlap Monitor (computed automatically from active cases) */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Multi-Bureau Institution Overlap Monitor ({multiBureauOverlaps.length})</h2>
            <p className="text-xs text-muted">
              Automatically identifies institutions whose active cases are being handled by two or
              more Bureaus/Cells at the same time
            </p>
          </div>
        </div>
        <div className="panel-body stack-sm">
          {multiBureauOverlaps.length === 0 ? (
            <p className="text-xs text-muted">
              No institution currently has active cases in more than one Bureau/Cell.
            </p>
          ) : (
            multiBureauOverlaps.map((g) => (
              <div
                key={g.institutionId}
                className="alert-banner warning"
                style={{ marginBottom: 0 }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>Potential Overlapping Cases — Coordination Required:</strong>{' '}
                  <Link to={`/institutions/${g.institutionId}`} className="link-inline font-semibold">
                    {g.institution?.name ?? g.institutionId}
                  </Link>{' '}
                  (<span className="mono">{g.institutionId}</span>) has {g.caseIds.length} active
                  cases across {g.bureaus.length} Bureaus/Cells.
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {g.bureaus.map((b) => (
                      <span key={b.bureau} style={{ marginRight: 14 }}>
                        <strong>{b.bureau}:</strong>{' '}
                        {b.caseIds.map((cid, i) => (
                          <React.Fragment key={cid}>
                            {i > 0 && ', '}
                            <Link to={`/cases/${cid}`} className="link-inline mono">
                              {cid}
                            </Link>
                          </React.Fragment>
                        ))}
                      </span>
                    ))}
                  </div>
                  <div className="row-center mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {g.linkedAlert ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => selectAlert(g.linkedAlert!.id)}
                      >
                        Open Linked Alert {g.linkedAlert.id}
                      </button>
                    ) : (
                      <span className="badge badge-neutral">
                        Awaiting relationship record — review manually
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/cases?ids=${g.caseIds.join(',')}`)}
                    >
                      View All Linked Cases
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="coord-grid">
        {/* Left Queue */}
        <div className="panel">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2>Coordination Alert Queue ({filteredAlerts.length})</h2>
              <p className="text-xs text-muted">Rule Engine: {state.settings.relationshipRuleVersion}</p>
            </div>
            <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
              <select
                className="field-select"
                aria-label="Filter by taxonomy"
                value={taxonomyFilter}
                onChange={(e) => setTaxonomyFilter(e.target.value)}
                style={{ maxWidth: 170 }}
              >
                <option value="All">All 5 Taxonomies</option>
                {TAXONOMY_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className="field-select"
                aria-label="Filter by alert status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ maxWidth: 150 }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Open / Active Only</option>
                <option value="Needs review">Needs review</option>
                <option value="In review">In review</option>
                <option value="Coordinating">Coordinating</option>
                <option value="Dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          <div className="panel-body stack-sm">
            {filteredAlerts.map((al) => {
              const inst = state.institutions.find((i) => i.id === al.institutionId);
              const isSelected = activeAlert?.id === al.id;
              return (
                <div
                  key={al.id}
                  onClick={() => selectAlert(al.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') selectAlert(al.id);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    <div className="row-center">
                      <span className="mono font-semibold text-xs text-accent">{al.id}</span>
                      <TaxonomyBadge taxonomy={al.taxonomy} />
                    </div>
                    <AlertStatusBadge status={al.status} />
                  </div>
                  <div className="font-semibold text-sm mt-1">{al.title}</div>
                  <div className="text-xs text-secondary mt-1">
                    <strong>{inst?.name ?? al.institutionId}</strong>{' '}
                    <span className="mono">({al.institutionId})</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Cases: <span className="mono">{al.involvedCaseIds.join(', ')}</span> •{' '}
                    <SourceBasisBadge basis={al.detectionSource} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="stack-lg">
          {activeAlert && (
            <>
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="row-center" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      <span className="mono font-semibold text-accent">{activeAlert.id}</span>
                      <TaxonomyBadge taxonomy={activeAlert.taxonomy} />
                      <AlertStatusBadge status={activeAlert.status} />
                      <SourceBasisBadge basis={activeAlert.detectionSource} />
                    </div>
                    <h2>{activeAlert.title}</h2>
                  </div>
                  <Link
                    to={`/institutions/${activeAlert.institutionId}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Institution 360 ({activeAlert.institutionId})
                  </Link>
                </div>

                <div className="panel-body stack-md">
                  {/* Explainability Box separating Verified Facts vs Hypothesis */}
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div className="split-row">
                      <h4 className="text-xs font-semibold">
                        Deterministic Rule &amp; Evidence Basis ({activeAlert.ruleCode})
                      </h4>
                      <span className="mono text-xs text-muted">
                        Engine: {activeAlert.ruleVersion}
                      </span>
                    </div>

                    <ul
                      style={{
                        paddingLeft: 18,
                        marginTop: 6,
                        fontSize: '0.84rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {activeAlert.triggeredConditions.map((cond, idx) => (
                        <li key={idx}>{cond}</li>
                      ))}
                    </ul>

                    {activeAlert.verifiedFacts && activeAlert.verifiedFacts.length > 0 && (
                      <div className="mt-2 text-xs">
                        <strong>Verified Documentary Facts:</strong>{' '}
                        {activeAlert.verifiedFacts.join(' ')}
                      </div>
                    )}

                    {activeAlert.hypothesisedNote && (
                      <div
                        className="mt-2 text-xs"
                        style={{
                          padding: '6px 8px',
                          background: 'var(--bg-surface)',
                          borderLeft: '3px solid var(--warning)',
                        }}
                      >
                        <strong>Hypothesised Causal Link (Separated from Verified Fact):</strong>{' '}
                        {activeAlert.hypothesisedNote}
                      </div>
                    )}

                    {activeAlert.primaryCaseId && (
                      <div className="mt-2 text-xs">
                        <strong>Primary Case ID for Consolidated Action:</strong>{' '}
                        <Link to={`/cases/${activeAlert.primaryCaseId}`} className="link-inline mono">
                          {activeAlert.primaryCaseId}
                        </Link>{' '}
                        (Secondary intake dockets &amp; audit trails remain preserved)
                      </div>
                    )}
                  </div>

                  {/* Review-Required Banner & Side-by-Side Case Comparison */}
                  {(activeAlert.status === 'Needs review' ||
                    activeAlert.status === 'In review') && (
                    <div className="alert-banner warning" role="status">
                      <AlertTriangle size={16} />
                      <div>
                        <strong>Potential Overlapping Cases — Coordination Required.</strong>{' '}
                        Potentially related cases — officer review required. These dockets were
                        matched because: {activeAlert.triggeredConditions.join('; ')}. The
                        relationship decision rests with the authorised reviewing officer — cases
                        are never merged automatically.
                      </div>
                    </div>
                  )}

                  {comparisonCases.length >= 2 && (
                    <div className="stack-sm">
                      <div className="split-row">
                        <h4 className="text-xs font-semibold">
                          Side-by-Side Case Comparison ({comparisonCases.length} Dockets)
                        </h4>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            navigate(`/cases?ids=${activeAlert.involvedCaseIds.join(',')}`)
                          }
                        >
                          <GitCompareArrows size={13} /> View Both Cases in Register
                        </button>
                      </div>
                      <div className="cmp-table-wrap">
                        <table className="cmp-table">
                          <tbody>
                            <tr>
                              <th scope="row">Case ID</th>
                              {comparisonCases.map((c) => (
                                <td key={c.id}>
                                  <Link to={`/cases/${c.id}`} className="link-inline mono font-semibold">
                                    {c.id}
                                  </Link>
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <th scope="row">Complaint Title</th>
                              {comparisonCases.map((c) => (
                                <td key={c.id} className="font-semibold">
                                  {c.subject}
                                </td>
                              ))}
                            </tr>
                            <tr className={cmpInstitutionsMatch ? 'cmp-match' : undefined}>
                              <th scope="row">
                                Institution
                                {cmpInstitutionsMatch && (
                                  <span className="cmp-match-flag">● Match</span>
                                )}
                              </th>
                              {comparisonCases.map((c) => {
                                const inst = state.institutions.find(
                                  (i) => i.id === c.institutionId
                                );
                                return (
                                  <td key={c.id}>
                                    <span className="mono text-xs">{c.institutionId}</span>
                                    <div className="text-xs text-secondary">{inst?.name}</div>
                                  </td>
                                );
                              })}
                            </tr>
                            <tr>
                              <th scope="row">Handling Bureau</th>
                              {comparisonCases.map((c) => (
                                <td key={c.id}>{c.assignedBureau}</td>
                              ))}
                            </tr>
                            <tr className={cmpCategoriesMatch ? 'cmp-match' : undefined}>
                              <th scope="row">
                                Complaint Category
                                {cmpCategoriesMatch && (
                                  <span className="cmp-match-flag">● Match</span>
                                )}
                              </th>
                              {comparisonCases.map((c) => (
                                <td key={c.id}>{c.category}</td>
                              ))}
                            </tr>
                            <tr>
                              <th scope="row">Status &amp; Priority</th>
                              {comparisonCases.map((c) => (
                                <td key={c.id}>
                                  <div className="row-center" style={{ gap: 6, flexWrap: 'wrap' }}>
                                    <StatusBadge status={c.status} />
                                    <PriorityBadge priority={c.priority} />
                                  </div>
                                </td>
                              ))}
                            </tr>
                            <tr className={cmpYearsMatch ? 'cmp-match' : undefined}>
                              <th scope="row">
                                Dates &amp; Window
                                {cmpYearsMatch && <span className="cmp-match-flag">● Match</span>}
                              </th>
                              {comparisonCases.map((c) => (
                                <td key={c.id} className="text-xs">
                                  <div>Incident: {formatDateDisplay(c.incidentDate)}</div>
                                  <div>Received: {formatDateDisplay(c.receivedDate)}</div>
                                  <div>Due: {formatDateDisplay(c.dueDate)}</div>
                                  <div className="text-muted">{c.academicYear}</div>
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <th scope="row">Description</th>
                              {comparisonCases.map((c) => (
                                <td key={c.id} className="text-xs text-secondary">
                                  {c.description.length > 220
                                    ? `${c.description.slice(0, 220)}…`
                                    : c.description}
                                </td>
                              ))}
                            </tr>
                            <tr className="cmp-match">
                              <th scope="row">
                                Matching Signals<span className="cmp-match-flag">● Basis</span>
                              </th>
                              <td colSpan={comparisonCases.length}>
                                <ul style={{ margin: 0, paddingLeft: 16 }} className="text-xs">
                                  {activeAlert.triggeredConditions.map((cond, idx) => (
                                    <li key={idx}>{cond}</li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {state.settings.aiAssistanceEnabled && (
                    <div
                      style={{
                        padding: 10,
                        background: 'var(--ai-soft)',
                        border: '1px solid var(--ai-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div className="row-center" style={{ marginBottom: 4 }}>
                        <Cpu size={14} style={{ color: 'var(--ai-accent)' }} />
                        <strong style={{ color: 'var(--ai-accent)' }}>
                          Optional Local Policy Context (Advisory Only)
                        </strong>
                      </div>
                      <p className="text-secondary">{activeAlert.optionalAiNote}</p>
                    </div>
                  )}

                  {/* Linked Cases & Supporting Documents */}
                  <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {activeAlert.involvedCaseIds.map((cid) => (
                      <Link key={cid} to={`/cases/${cid}`} className="btn btn-secondary btn-sm mono">
                        Case {cid}
                      </Link>
                    ))}
                    {activeAlert.supportingArtifactIds?.map((aid) => (
                      <Link
                        key={aid}
                        to={`/evidence?artifact=${aid}`}
                        className="btn btn-secondary btn-sm mono"
                      >
                        Vault {aid}
                      </Link>
                    ))}
                    {activeAlert.supportingDocIds.map((docId) => (
                      <button
                        key={docId}
                        type="button"
                        className="btn btn-secondary btn-sm mono"
                        onClick={() => setPreviewDocId(docId)}
                      >
                        <FileText size={12} /> {docId}
                      </button>
                    ))}
                  </div>

                  {/* Human Decision & Negative Memory Controls */}
                  {canWrite ? (
                    <div
                      className="stack-sm"
                      style={{
                        padding: 12,
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <h4 className="text-xs font-semibold">
                        Human Review, Taxonomy Classification &amp; Negative Memory Controls
                      </h4>
                      <div className="grid-2">
                        <select
                          className="field-select"
                          aria-label="Reclassify relationship taxonomy"
                          value={selectedTaxonomy}
                          onChange={(e) =>
                            setSelectedTaxonomy(e.target.value as RelationshipTaxonomy)
                          }
                        >
                          <option value="">Keep current taxonomy ({activeAlert.taxonomy})</option>
                          {TAXONOMY_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              Classify as: {t}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="field-input"
                          placeholder="Mandatory review / suppression rationale note..."
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                        />
                      </div>
                      <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDecision('Coordinating', 'Decision')}
                        >
                          <CheckCircle2 size={13} /> Mark as Related
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleSuppressPair}
                        >
                          <Slash size={13} /> Mark as Independent
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDecision('In review', 'Discussion')}
                        >
                          Add Coordination Note
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleRecordFollowUp}
                        >
                          <ClipboardList size={13} /> Record Follow-Up Action
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted">
                      Read-Only Auditor profile active — review decisions disabled.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* NEGATIVE MEMORY SUPPRESSION LEDGER + COORDINATION TASKS */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Negative Memory Suppression Ledger ({state.suppressions.length})</h2>
              <p className="text-xs text-muted">
                Prevents re-alerting on Verified Independent pairs until new docs, actions, dates, or rule versions arrive
              </p>
            </div>
            {canWrite && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={bumpRuleVersionDemo}
                title="Increment relationship rule version to watch suppressed pairs re-open automatically"
              >
                <RefreshCw size={13} /> Bump Rule Version (Test Re-Open)
              </button>
            )}
          </div>
          <div className="panel-body stack-sm">
            {state.suppressions.map((sup) => (
              <div key={sup.id} className="citation-card">
                <div className="split-row">
                  <span className="mono font-semibold text-xs">
                    {sup.id}: {sup.casePair[0]} ↔ {sup.casePair[1]}
                  </span>
                  <span
                    className={`badge ${
                      sup.active ? 'badge-neutral' : 'badge-warning'
                    }`}
                  >
                    {sup.active ? 'Suppressed (Active)' : 'Re-Opened on Fact Change'}
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1">
                  <strong>Reason ({sup.reviewerName}):</strong> {sup.reason}
                </p>
                <div className="text-xs text-muted mono mt-1">
                  Baseline Rule: {sup.ruleVersion} • Reviewed: {sup.lastReviewedAt}
                </div>
                {sup.reopenedReason && (
                  <div className="alert-banner warning mt-2 text-xs">
                    <div>
                      <strong>Auto Re-Opened ({sup.reopenedAt}):</strong> {sup.reopenedReason}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel" id="coordination-task-panel">
          <div className="panel-header">
            <div>
              <h2>Cross-Bureau Coordination Tasks ({state.tasks.length})</h2>
              <p className="text-xs text-muted">Shared operational follow-ups across bureaus</p>
            </div>
            {canWrite && activeAlert && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTaskForm((v) => !v)}
              >
                <Plus size={13} /> Add Task
              </button>
            )}
          </div>

          {showTaskForm && (
            <form
              onSubmit={handleCreateTask}
              style={{
                padding: 12,
                background: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
              className="stack-sm"
            >
              <input
                type="text"
                className="field-input"
                placeholder="Shared action description..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <div className="row-center" style={{ gap: 8 }}>
                <select
                  className="field-select"
                  value={taskLeadBureau}
                  onChange={(e) => setTaskLeadBureau(e.target.value as BureauName)}
                >
                  {ALL_BUREAUS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="field-input mono"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Lead Bureau</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-semibold text-xs">{t.title}</div>
                      <div className="mono text-xs text-muted">{t.id} • {t.institutionId}</div>
                    </td>
                    <td className="text-xs">{t.leadBureau}</td>
                    <td className="mono text-xs">{t.dueDate}</td>
                    <td>
                      {canWrite ? (
                        <select
                          aria-label={`Status for ${t.id}`}
                          className="field-select"
                          value={t.status}
                          onChange={(e) =>
                            updateTaskStatus(
                              t.id,
                              e.target.value as
                                | 'Awaiting Discussion'
                                | 'In Progress'
                                | 'Completed'
                            )
                          }
                        >
                          <option value="Awaiting Discussion">Awaiting Discussion</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      ) : (
                        <span className="badge badge-neutral">{t.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DocumentPreviewDrawer
        doc={previewDoc}
        onSelectDocId={(id) => setPreviewDocId(id)}
        onClose={() => setPreviewDocId(null)}
      />
    </div>
  );
};
