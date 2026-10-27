import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  GitCompareArrows,
  ShieldAlert,
  ShieldCheck,
  Archive,
  Lock,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { getCaseSlaStatus } from '../services/caseService';
import { ALL_BUREAUS } from '../data/seedData';
import {
  ActionType,
  BureauName,
  CasePriority,
  CaseStatus,
  EvidenceArtifact,
} from '../types/domain';
import {
  AuthenticityBadge,
  ClearanceBadge,
  PriorityBadge,
  SlaBadge,
  SourceBasisBadge,
  StatusBadge,
  TaxonomyBadge,
} from '../components/ui/Badges';
import { DocumentPreviewDrawer } from '../components/ui/DocumentPreviewDrawer';
import { buildRedactedStub, hasFullCaseReadAccess } from '../services/accessService';
import { PlannedActionDraft } from '../services/clearanceService';

const EVIDENCE_TYPES: EvidenceArtifact['artifactType'][] = [
  'Certified Withdrawal & Fee Refund Scroll',
  'Authenticated University Enrolment Roll',
  'Bank Salary & EPF TRRN Scroll',
  'Compliance Undertaking Affidavit',
  'Laboratory Stock & Calibration Register',
  'Faculty Appointment & PhD Verification File',
];

const ACTION_TYPES: ActionType[] = [
  'Document Demand',
  'Show-Cause Notice',
  'Compliance Directive',
  'Welfare Advisory',
  'Payroll Audit Demand',
  'Scheduled Inspection',
  'Surprise Inspection',
];

export const CaseDetailPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const {
    state,
    currentUser,
    canWrite,
    updateCaseStatus,
    addCaseNote,
    reassignCase,
    previewActionClearance,
    submitPlannedAction,
    subscribeCaseToEvidence,
    submitScopedAccessRequest,
  } = useAppState();

  const caseRecord = state.cases.find((c) => c.id === caseId);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ tone: 'info' | 'critical' | 'success'; text: string } | null>(null);

  // Status transition form state
  const [nextStatus, setNextStatus] = useState<CaseStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState('');
  const [outcomeText, setOutcomeText] = useState('');

  // Note form state
  const [noteText, setNoteText] = useState('');

  // Reassignment form state
  const [showReassign, setShowReassign] = useState(false);
  const [targetBureau, setTargetBureau] = useState<BureauName>(
    caseRecord?.assignedBureau ?? 'Approval Bureau'
  );
  const [targetOfficer, setTargetOfficer] = useState<string>(
    caseRecord?.assignedOfficerId ?? 'USR-02'
  );
  const [targetPriority, setTargetPriority] = useState<CasePriority>(
    caseRecord?.priority ?? 'Standard'
  );
  const [reassignNote, setReassignNote] = useState('');

  // Pre-Dispatch Action Clearance Drawer State (Capability 1)
  const [clearanceFormOpen, setClearanceFormOpen] = useState(false);
  const defaultDraftForCase = useMemo<PlannedActionDraft>(() => {
    if (!caseRecord) {
      return {
        caseId: '',
        institutionId: '',
        actionType: 'Document Demand',
        purpose: '',
        academicYear: 'AY 2026-27',
        scope: '',
        scheduledStart: state.demoDate,
        scheduledEnd: '2026-10-30',
      };
    }
    if (caseRecord.id === 'CL-2026-0125') {
      return {
        caseId: caseRecord.id,
        institutionId: caseRecord.institutionId,
        actionType: 'Document Demand',
        purpose: 'Demand certified AY 2026-27 admission withdrawal & fee-refund bank scroll',
        requestedEvidenceType: 'Certified Withdrawal & Fee Refund Scroll',
        academicYear: 'AY 2026-27',
        scope: 'All cancelled admissions and bank NEFT scrolls for AY 2026-27',
        scheduledStart: state.demoDate,
        scheduledEnd: '2026-10-31',
      };
    }
    if (caseRecord.id === 'CL-2026-0114') {
      return {
        caseId: caseRecord.id,
        institutionId: caseRecord.institutionId,
        actionType: 'Show-Cause Notice',
        purpose: 'Issue advance Show-Cause Notice on 42 excess CSE admissions',
        requestedEvidenceType: 'Authenticated University Enrolment Roll',
        academicYear: 'AY 2026-27',
        scope: 'Original B.Tech CSE admission roll & merit register',
        scheduledStart: '2026-10-25',
        scheduledEnd: '2026-10-30',
      };
    }
    if (caseRecord.category === 'Hostel & Student Amenities') {
      return {
        caseId: caseRecord.id,
        institutionId: caseRecord.institutionId,
        actionType: 'Welfare Advisory',
        purpose: 'Direct Hostel Warden to replace Block B RO purification membranes',
        academicYear: 'AY 2026-27',
        scope: 'Potable water RO filter servicing report',
        scheduledStart: '2026-10-24',
        scheduledEnd: '2026-10-31',
      };
    }
    return {
      caseId: caseRecord.id,
      institutionId: caseRecord.institutionId,
      actionType: 'Compliance Directive',
      purpose: `Compliance verification notice for ${caseRecord.subject}`,
      academicYear: caseRecord.academicYear || 'AY 2026-27',
      scope: caseRecord.category,
      scheduledStart: '2026-10-24',
      scheduledEnd: '2026-11-04',
    };
  }, [caseRecord, state.demoDate]);

  const [actionDraft, setActionDraft] = useState<PlannedActionDraft>(defaultDraftForCase);
  const [overrideReason, setOverrideReason] = useState('');

  // Scoped Access Request Form for Redacted Cases (Capability 2)
  const [reqPurpose, setReqPurpose] = useState('');
  const [reqScope, setReqScope] = useState<
    'Case Summary & Timeline' | 'Summary, Actions & Evidence Metadata'
  >('Case Summary & Timeline');

  React.useEffect(() => {
    setActionDraft(defaultDraftForCase);
  }, [defaultDraftForCase]);

  if (!caseRecord) {
    return (
      <div className="panel">
        <div className="empty-state">
          <h3>Case Record Not Found</h3>
          <p className="text-sm text-secondary mt-1">
            No case matching identifier <span className="mono">{caseId}</span> exists in the register.
          </p>
          <Link to="/cases" className="btn btn-primary btn-sm mt-3">
            Return to Case Register
          </Link>
        </div>
      </div>
    );
  }

  const hasAccess = hasFullCaseReadAccess(
    currentUser,
    caseRecord,
    state.accessRequests,
    state.demoDate
  );

  const inst = state.institutions.find((i) => i.id === caseRecord.institutionId);

  // Redacted Cross-Bureau View when user lacks access to Restricted case!
  if (!hasAccess) {
    const stub = buildRedactedStub(caseRecord);
    const caseRequests = state.accessRequests.filter((r) => r.caseId === caseRecord.id);

    const handleAccessSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const res = submitScopedAccessRequest(caseRecord.id, reqPurpose, reqScope);
      if (!res.ok) {
        setStatusMsg({ tone: 'critical', text: res.error ?? 'Request failed.' });
        return;
      }
      setReqPurpose('');
      setStatusMsg({
        tone: 'success',
        text: `Scoped Access Request ${res.requestId} submitted to ${stub.owningBureau}. Logged in Audit Register.`,
      });
    };

    return (
      <div className="stack-lg">
        <div>
          <Link to={`/institutions/${caseRecord.institutionId}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 6 }}>
            <ArrowLeft size={14} /> Institution 360 ({caseRecord.institutionId})
          </Link>
          <div className="row-center" style={{ gap: 10 }}>
            <h1 className="mono">{stub.caseId}</h1>
            <span className="badge badge-critical">Restricted — Scoped Stub Only</span>
          </div>
          <p className="page-subtitle">
            Redacted Cross-Bureau Coordination Stub • Owning Bureau: <strong>{stub.owningBureau}</strong>
          </p>
        </div>

        {statusMsg && (
          <div className={`alert-banner ${statusMsg.tone}`}>
            <ShieldCheck size={16} />
            <div>{statusMsg.text}</div>
          </div>
        )}

        <div className="alert-banner warning">
          <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Confidential / Scoped Access Boundary Active:</strong> Your active role profile (
            <strong>{currentUser.name}</strong> — {currentUser.bureau}) does not hold an active read grant on this restricted file. Sensitive allegations, complainant identities, and unredacted documents are withheld both here and in Knowledge Assistant retrieval.
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-header">
              <h2>Permitted Coordination Metadata</h2>
            </div>
            <div className="panel-body">
              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Institution ID</span>
                  <span className="meta-value mono">{stub.institutionId}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Owning Bureau</span>
                  <span className="meta-value">{stub.owningBureau}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Coarse Category</span>
                  <span className="meta-value">{stub.coarseCategory}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Coarse Status</span>
                  <span className="meta-value">{stub.coarseStatus}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Permitted Activity Window</span>
                  <span className="meta-value mono">{stub.permittedActivityPeriod}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Subject &amp; Complainant Details</span>
                  <span className="meta-value text-muted">[Withheld under Bureau Scope]</span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Request Scoped Coordination Access</h2>
            </div>
            <div className="panel-body stack-md">
              <form onSubmit={handleAccessSubmit} className="stack-sm">
                <div className="field-group">
                  <label className="field-label" htmlFor="req-scope">
                    Requested Minimum Scope
                  </label>
                  <select
                    id="req-scope"
                    className="field-select"
                    value={reqScope}
                    onChange={(e) =>
                      setReqScope(
                        e.target.value as
                          | 'Case Summary & Timeline'
                          | 'Summary, Actions & Evidence Metadata'
                      )
                    }
                  >
                    <option value="Case Summary & Timeline">Case Summary &amp; Timeline</option>
                    <option value="Summary, Actions & Evidence Metadata">
                      Summary, Actions &amp; Evidence Metadata
                    </option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="req-purpose">
                    Official Cross-Bureau Coordination Purpose *
                  </label>
                  <textarea
                    id="req-purpose"
                    className="field-textarea"
                    rows={3}
                    placeholder="State why your case/action requires visibility into this restricted docket..."
                    value={reqPurpose}
                    onChange={(e) => setReqPurpose(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  Submit Scoped Access Request
                </button>
              </form>

              {caseRequests.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">Prior Access History ({caseRequests.length})</h4>
                  <div className="stack-xs">
                    {caseRequests.map((r) => (
                      <div key={r.id} className="citation-card">
                        <div className="split-row">
                          <span className="mono font-semibold text-xs">{r.id} — {r.requestingBureau}</span>
                          <span className="badge badge-neutral">{r.status}</span>
                        </div>
                        <div className="text-xs text-secondary mt-1">{r.statusNote ?? r.coordinationPurpose}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full Authorized View
  const assignedOfficer = state.users.find((u) => u.id === caseRecord.assignedOfficerId);
  const sla = getCaseSlaStatus(caseRecord, state.demoDate, state.settings.deadlineRules);
  const transitionRule = state.settings.transitionRules.find((r) => r.from === caseRecord.status);
  const isSenior =
    currentUser.role === 'Senior Review Authority' ||
    currentUser.role === 'Cross-Bureau Coordinator';

  const caseActions = state.actions.filter((a) => a.caseId === caseRecord.id);
  const caseAlerts = state.alerts.filter((al) => al.involvedCaseIds.includes(caseRecord.id));
  const previewDoc = state.documents.find((d) => d.id === previewDocId) ?? null;

  // Live synchronous Pre-Dispatch Clearance evaluation
  const liveFindings = previewActionClearance(actionDraft);
  const mandatoryBlockFinding = liveFindings.find(
    (f) => f.severity === 'Mandatory Clearance Required'
  );

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextStatus) return;
    if (transitionRule?.restrictedToSenior && !isSenior) {
      setStatusMsg({
        tone: 'critical',
        text: `Transition from "${caseRecord.status}" requires Senior Review Authority or Cross-Bureau Coordinator role.`,
      });
      return;
    }
    const res = updateCaseStatus(caseRecord.id, nextStatus, transitionNote, outcomeText);
    if (!res.ok) {
      setStatusMsg({ tone: 'critical', text: res.error ?? 'Unable to update status.' });
      return;
    }
    setStatusMsg({
      tone: 'success',
      text: `Status updated to "${nextStatus}" and logged in Audit Register. Linked cases retain independent outcomes.`,
    });
    setTransitionNote('');
    setOutcomeText('');
    setNextStatus('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addCaseNote(caseRecord.id, noteText);
    if (!res.ok) {
      setStatusMsg({ tone: 'critical', text: res.error ?? 'Unable to save note.' });
      return;
    }
    setNoteText('');
    setStatusMsg({ tone: 'success', text: 'Case note appended to timeline and audit log.' });
  };

  const handleReassign = (e: React.FormEvent) => {
    e.preventDefault();
    const res = reassignCase(
      caseRecord.id,
      targetBureau,
      targetOfficer,
      targetPriority,
      reassignNote
    );
    if (!res.ok) {
      setStatusMsg({ tone: 'critical', text: res.error ?? 'Unable to reassign case.' });
      return;
    }
    setReassignNote('');
    setShowReassign(false);
    setStatusMsg({ tone: 'success', text: `Case routing updated to ${targetBureau}.` });
  };

  const handleDispatchSubmit = (mode: 'save_draft' | 'issue_with_clearance') => {
    const res = submitPlannedAction(actionDraft, mode, overrideReason);
    if (!res.ok) {
      setStatusMsg({ tone: 'critical', text: res.error ?? 'Clearance gate blocked issuance.' });
      return;
    }
    setOverrideReason('');
    setClearanceFormOpen(false);
    setStatusMsg({
      tone: 'success',
      text:
        mode === 'save_draft'
          ? `Saved ${res.actionId} in Draft status.`
          : `Issued ${res.actionId} (${actionDraft.actionType}) following Pre-Dispatch Clearance check.`,
    });
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <Link to="/cases" className="btn btn-ghost btn-sm" style={{ marginBottom: 6 }}>
            <ArrowLeft size={14} /> Case Register
          </Link>
          <div className="row-center" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h1 className="mono">{caseRecord.id}</h1>
            <StatusBadge status={caseRecord.status} />
            <PriorityBadge priority={caseRecord.priority} />
            <SlaBadge status={sla.status} label={sla.label} />
            {caseRecord.visibility !== 'Standard Cross-Bureau' && (
              <span className="badge badge-warning">{caseRecord.visibility}</span>
            )}
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>
            {caseRecord.subject}
          </p>
        </div>

        <div className="page-actions">
          <Link to={`/institutions/${caseRecord.institutionId}`} className="btn btn-secondary">
            Institution 360 ({caseRecord.institutionId})
          </Link>
          <Link
            to={`/knowledge?caseId=${caseRecord.id}&q=${encodeURIComponent(
              `Which policy provisions govern ${caseRecord.id}?`
            )}`}
            className="btn btn-secondary"
          >
            Effective-Date Policy Check
          </Link>
          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setClearanceFormOpen((v) => !v)}
            >
              <ShieldCheck size={15} />
              {clearanceFormOpen ? 'Close Pre-Dispatch Check' : 'Plan / Clear Action'}
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className={`alert-banner ${statusMsg.tone}`}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{statusMsg.text}</div>
        </div>
      )}

      {/* CAPABILITY 1: SYNCHRONOUS PRE-DISPATCH ACTION CLEARANCE PANEL */}
      {clearanceFormOpen && (
        <div className="panel" style={{ border: '2px solid var(--accent)' }}>
          <div className="panel-header" style={{ background: 'var(--accent-soft)' }}>
            <div>
              <h2>Pre-Dispatch Action Clearance Gate (Draft → Issued)</h2>
              <p className="text-xs text-secondary">
                Synchronous deterministic rules check (<span className="mono">CLR-RULESET-v2.4</span>) across{' '}
                <span className="mono">{caseRecord.institutionId}</span> — Zero LLM/RAG dependency on critical path
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setClearanceFormOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="panel-body stack-md">
            <div className="grid-3">
              <div className="field-group">
                <label className="field-label" htmlFor="act-type">
                  Planned Action Type
                </label>
                <select
                  id="act-type"
                  className="field-select"
                  value={actionDraft.actionType}
                  onChange={(e) =>
                    setActionDraft((p) => ({ ...p, actionType: e.target.value as ActionType }))
                  }
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="act-evd-type">
                  Requested Document / Evidence Type
                </label>
                <select
                  id="act-evd-type"
                  className="field-select"
                  value={actionDraft.requestedEvidenceType ?? ''}
                  onChange={(e) =>
                    setActionDraft((p) => ({
                      ...p,
                      requestedEvidenceType: e.target.value
                        ? (e.target.value as EvidenceArtifact['artifactType'])
                        : undefined,
                    }))
                  }
                >
                  <option value="">None (Advisory / General Order)</option>
                  {EVIDENCE_TYPES.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="act-ay">
                  Academic Year Scope
                </label>
                <select
                  id="act-ay"
                  className="field-select"
                  value={actionDraft.academicYear}
                  onChange={(e) => setActionDraft((p) => ({ ...p, academicYear: e.target.value }))}
                >
                  <option value="AY 2026-27">AY 2026-27</option>
                  <option value="AY 2025-26">AY 2025-26</option>
                  <option value="AY 2024-25">AY 2024-25</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label" htmlFor="act-purpose">
                  Action Purpose *
                </label>
                <input
                  id="act-purpose"
                  type="text"
                  className="field-input"
                  value={actionDraft.purpose}
                  onChange={(e) => setActionDraft((p) => ({ ...p, purpose: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="act-scope">
                  Specific Records / Departmental Scope *
                </label>
                <input
                  id="act-scope"
                  type="text"
                  className="field-input"
                  value={actionDraft.scope}
                  onChange={(e) => setActionDraft((p) => ({ ...p, scope: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label" htmlFor="act-start">
                  Scheduled Dispatch / Start Date
                </label>
                <input
                  id="act-start"
                  type="date"
                  className="field-input mono"
                  value={actionDraft.scheduledStart}
                  onChange={(e) =>
                    setActionDraft((p) => ({ ...p, scheduledStart: e.target.value }))
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="act-end">
                  Compliance Window End Date
                </label>
                <input
                  id="act-end"
                  type="date"
                  className="field-input mono"
                  value={actionDraft.scheduledEnd}
                  onChange={(e) => setActionDraft((p) => ({ ...p, scheduledEnd: e.target.value }))}
                />
              </div>
            </div>

            {/* LIVE CLEARANCE FINDINGS OUTPUT */}
            <div className="stack-sm">
              <h4 className="text-xs font-semibold">
                Synchronous Pre-Dispatch Clearance Verdict ({liveFindings.length})
              </h4>
              {liveFindings.map((finding, idx) => (
                <div
                  key={`${finding.ruleCode}-${idx}`}
                  className={`alert-banner ${
                    finding.severity === 'Mandatory Clearance Required'
                      ? 'critical'
                      : finding.severity === 'Clear to Proceed'
                      ? 'success'
                      : 'warning'
                  }`}
                >
                  <div style={{ width: '100%' }}>
                    <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <strong>{finding.headline}</strong>
                      <div className="row-center">
                        <span className="mono text-xs">{finding.ruleCode}</span>
                        <ClearanceBadge severity={finding.severity} />
                      </div>
                    </div>
                    <p className="text-xs mt-1">{finding.explanation}</p>
                    <p className="text-xs mt-1">
                      <strong>Recommended Protocol:</strong> {finding.recommendedNextStep}
                    </p>

                    {/* Duplicate Evidence One-Click Reuse Action */}
                    {finding.outcomeKind === 'DUPLICATE_EVIDENCE_REQUEST' &&
                      finding.reusableArtifactId && (
                        <div className="row-center mt-2" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              subscribeCaseToEvidence(
                                caseRecord.id,
                                finding.reusableArtifactId!,
                                `Subscribed via Pre-Dispatch Clearance (${finding.ruleCode}) instead of sending duplicate demand`
                              );
                              setClearanceFormOpen(false);
                              setStatusMsg({
                                tone: 'success',
                                text: `Subscribed ${caseRecord.id} to existing Shared Evidence Vault artifact ${finding.reusableArtifactId} without re-demanding from institution.`,
                              });
                            }}
                          >
                            <Archive size={13} /> Subscribe to {finding.reusableArtifactId} Instead of Dispatching
                          </button>
                          <Link
                            to={`/evidence?artifact=${finding.reusableArtifactId}`}
                            className="btn btn-secondary btn-sm"
                          >
                            Inspect Vault Artifact
                          </Link>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mandatory Clearance Block & Senior Override Gate */}
            {mandatoryBlockFinding ? (
              <div
                className="panel"
                style={{
                  background: 'var(--bg-subtle)',
                  borderColor: 'var(--danger)',
                }}
              >
                <div className="panel-body stack-sm">
                  <div className="row-center">
                    <Lock size={15} className="text-danger" />
                    <strong className="text-xs">
                      Standard Officer Dispatch Disabled by Mandatory Sequencing Gate ({mandatoryBlockFinding.ruleCode})
                    </strong>
                  </div>

                  {isSenior ? (
                    <>
                      <p className="text-xs text-secondary">
                        Active profile <strong>{currentUser.name}</strong> ({currentUser.role}) holds Senior Override authority. To authorise immediate dispatch despite the active inspection hazard, record a mandatory justification for the audit trail:
                      </p>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="Mandatory Senior Override justification (min 10 chars, e.g., Joint notice cleared with Vigilance team)..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                      />
                      <div className="row-center" style={{ gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDispatchSubmit('save_draft')}
                        >
                          Hold as Draft
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDispatchSubmit('issue_with_clearance')}
                        >
                          Authorise Senior Override &amp; Issue Notice
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="row-center" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span className="text-xs text-secondary">
                        Your current role (<strong>{currentUser.role}</strong>) cannot bypass a Mandatory Clearance block. Hold in Draft or switch to a <em>Senior Review Authority / Cross-Bureau Coordinator</em> profile in the header bar.
                      </span>
                      <div className="row-center" style={{ gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDispatchSubmit('save_draft')}
                        >
                          Save in Draft Status
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" disabled>
                          Issue Action (Blocked)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="row-center" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDispatchSubmit('save_draft')}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDispatchSubmit('issue_with_clearance')}
                >
                  <CheckCircle2 size={14} /> Clear &amp; Issue Action
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {caseAlerts.length > 0 && (
        <div className="alert-banner warning">
          <GitCompareArrows size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Cross-Bureau Coordination Classification ({caseAlerts.length}):</strong>{' '}
            {caseAlerts.map((al) => (
              <span key={al.id} style={{ marginRight: 10 }}>
                <Link to={`/coordination?alert=${al.id}`} className="link-inline mono">
                  {al.id}
                </Link>{' '}
                [{al.taxonomy}]
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="stack-lg">
          {/* Case Metadata & Summary */}
          <div className="panel">
            <div className="panel-header">
              <h2>Case Metadata &amp; Scope</h2>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowReassign((v) => !v)}
                >
                  {showReassign ? 'Cancel Routing Edit' : 'Reassign / Adjust Priority'}
                </button>
              )}
            </div>
            <div className="panel-body stack-md">
              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Institution</span>
                  <span className="meta-value">
                    <Link to={`/institutions/${caseRecord.institutionId}`} className="link-inline">
                      {inst?.name ?? caseRecord.institutionId}
                    </Link>
                    <div className="mono text-xs text-muted">{caseRecord.institutionId}</div>
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Issue Category</span>
                  <span className="meta-value">{caseRecord.category}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Incident Date &amp; AY</span>
                  <span className="meta-value mono">
                    {caseRecord.incidentDate ?? caseRecord.receivedDate} ({caseRecord.academicYear ?? 'AY 2026-27'})
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Assigned Bureau</span>
                  <span className="meta-value">{caseRecord.assignedBureau}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Case Owner</span>
                  <span className="meta-value">
                    {assignedOfficer ? `${assignedOfficer.name}` : 'Unassigned'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Received / Expected Disposal (SLA)</span>
                  <span className="meta-value mono">
                    {caseRecord.receivedDate} → {caseRecord.dueDate}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Case Narrative</h4>
                <p className="text-sm text-secondary">{caseRecord.description}</p>
              </div>

              {caseRecord.recordedOutcome && (
                <div className="alert-banner success">
                  <div>
                    <strong>Independent Statutory Case Outcome:</strong> {caseRecord.recordedOutcome}
                  </div>
                </div>
              )}

              {showReassign && (
                <form
                  onSubmit={handleReassign}
                  className="stack-md"
                  style={{
                    padding: 12,
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <h4 style={{ fontSize: '0.85rem' }}>Update Bureau Routing or Priority</h4>
                  <div className="grid-3">
                    <div className="field-group">
                      <label className="field-label" htmlFor="re-bureau">
                        Assigned Bureau
                      </label>
                      <select
                        id="re-bureau"
                        className="field-select"
                        value={targetBureau}
                        onChange={(e) => setTargetBureau(e.target.value as BureauName)}
                      >
                        {ALL_BUREAUS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="re-officer">
                        Case Officer
                      </label>
                      <select
                        id="re-officer"
                        className="field-select"
                        value={targetOfficer}
                        onChange={(e) => setTargetOfficer(e.target.value)}
                      >
                        {state.users
                          .filter((u) => u.role !== 'Read-Only Auditor')
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.bureau})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="re-priority">
                        Priority Level
                      </label>
                      <select
                        id="re-priority"
                        className="field-select"
                        value={targetPriority}
                        onChange={(e) => setTargetPriority(e.target.value as CasePriority)}
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Standard">Standard</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="re-note">
                      Routing Rationale Note *
                    </label>
                    <input
                      id="re-note"
                      type="text"
                      className="field-input"
                      placeholder="State reason for bureau routing or priority adjustment..."
                      value={reassignNote}
                      onChange={(e) => setReassignNote(e.target.value)}
                    />
                  </div>
                  <div>
                    <button type="submit" className="btn btn-primary btn-sm">
                      Save Routing Update
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* CAPABILITY 3: SHARED EVIDENCE VAULT REFERENCES */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Shared Evidence Vault References ({caseRecord.evidenceLinks.length})</h2>
                <p className="text-xs text-muted">
                  Reusable institutional artifacts referenced across bureaus without merging case outcomes
                </p>
              </div>
              <Link
                to={`/evidence?inst=${caseRecord.institutionId}`}
                className="btn btn-secondary btn-sm"
              >
                <Archive size={13} /> Open Evidence Vault
              </Link>
            </div>
            <div className="panel-body stack-sm">
              {caseRecord.evidenceLinks.length === 0 ? (
                <p className="text-sm text-muted">
                  No Shared Evidence Vault artifacts referenced on this docket yet. Use{' '}
                  <strong>Plan / Clear Action</strong> or open the{' '}
                  <Link to={`/evidence?inst=${caseRecord.institutionId}`} className="link-inline">
                    Shared Evidence Vault
                  </Link>{' '}
                  to subscribe to existing institutional submissions.
                </p>
              ) : (
                caseRecord.evidenceLinks.map((link) => {
                  const art = state.evidenceVault.find((e) => e.id === link.artifactId);
                  if (!art) return null;
                  const outdatedVersion = link.linkedVersion !== art.currentVersion;
                  const alsoUsedBy = state.cases.filter(
                    (c) =>
                      c.id !== caseRecord.id &&
                      c.evidenceLinks.some((el) => el.artifactId === art.id)
                  );

                  return (
                    <div
                      key={art.id}
                      className="citation-card"
                      style={
                        outdatedVersion ? { borderColor: 'var(--warning)' } : undefined
                      }
                    >
                      <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <div className="row-center">
                          <Link
                            to={`/evidence?artifact=${art.id}`}
                            className="mono font-semibold link-inline"
                          >
                            {art.id}
                          </Link>
                          <span className="badge badge-neutral mono">
                            Linked: {link.linkedVersion}
                          </span>
                          <AuthenticityBadge status={art.authenticityStatus} />
                        </div>
                        <span className="text-xs text-muted">{art.artifactType}</span>
                      </div>

                      <div className="font-semibold text-sm mt-1">{art.title}</div>
                      <p className="text-xs text-secondary mt-1">
                        Purpose on this docket: {link.usagePurpose}
                      </p>

                      {alsoUsedBy.length > 0 && (
                        <div className="text-xs text-muted mt-1">
                          Simultaneously referenced by:{' '}
                          {alsoUsedBy.map((other) => (
                            <span key={other.id} style={{ marginRight: 8 }}>
                              <Link to={`/cases/${other.id}`} className="link-inline mono">
                                {other.id}
                              </Link>{' '}
                              ({other.assignedBureau} — {other.status})
                            </span>
                          ))}
                        </div>
                      )}

                      {outdatedVersion && (
                        <div className="alert-banner warning mt-2">
                          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div className="split-row" style={{ width: '100%', gap: 8, flexWrap: 'wrap' }}>
                            <span className="text-xs">
                              <strong>Newer Version Available:</strong> This case still points to{' '}
                              <span className="mono">{link.linkedVersion}</span>, whereas{' '}
                              <span className="mono">{art.currentVersion}</span> ({art.authenticityStatus}) was submitted on{' '}
                              <span className="mono">{art.submissionDate}</span>.
                            </span>
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  subscribeCaseToEvidence(
                                    caseRecord.id,
                                    art.id,
                                    `Upgraded reference from ${link.linkedVersion} to ${art.currentVersion}`
                                  );
                                  setStatusMsg({
                                    tone: 'success',
                                    text: `Upgraded ${caseRecord.id} evidence link to ${art.id} (${art.currentVersion}).`,
                                  });
                                }}
                              >
                                Upgrade Link to {art.currentVersion}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Administrative Actions */}
          <div className="panel">
            <div className="panel-header">
              <h2>Planned &amp; Active Administrative Actions ({caseActions.length})</h2>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setClearanceFormOpen(true)}
                >
                  <Plus size={13} /> New Action Check
                </button>
              )}
            </div>
            <div className="panel-body">
              {caseActions.length === 0 ? (
                <p className="text-sm text-muted">
                  No formal notices or inspections scheduled directly under this case record.
                </p>
              ) : (
                <div className="stack-sm">
                  {caseActions.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        padding: 12,
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <div className="row-center">
                          <span className="mono font-semibold text-xs">{act.id}</span>
                          <span className="badge badge-info">{act.actionType}</span>
                          {act.confidentiality === 'Confidential Inspection' && (
                            <span className="badge badge-critical">Confidential Schedule</span>
                          )}
                        </div>
                        <span className="badge badge-neutral">{act.status}</span>
                      </div>
                      <div className="font-semibold text-sm mt-1">{act.scope}</div>
                      <div className="text-xs text-muted mono mt-1">
                        <CalendarClock size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Window: {act.scheduledStart} to {act.scheduledEnd} ({act.bureau})
                      </div>
                      <p className="text-xs text-secondary mt-1">{act.notes}</p>
                      {act.clearanceCheckRecord && (
                        <div className="text-xs text-muted mt-1 mono">
                          Clearance: {act.clearanceCheckRecord.highestSeverity} [
                          {act.clearanceCheckRecord.ruleCodesTriggered.join(', ')}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chronological Timeline */}
          <div className="panel">
            <div className="panel-header">
              <h2>Chronological Case Timeline &amp; Notes</h2>
              <span className="text-xs text-muted">{caseRecord.timeline.length} entries</span>
            </div>
            <div className="panel-body stack-md">
              <div className="timeline">
                {caseRecord.timeline.map((entry) => (
                  <div key={entry.id} className="timeline-item">
                    <div className="timeline-meta">
                      <span className="mono">{entry.timestamp}</span>
                      <span>•</span>
                      <strong>{entry.actor}</strong>
                      <span>({entry.actorBureau})</span>
                      <span className="badge badge-neutral">{entry.type}</span>
                    </div>
                    <div className="timeline-body">{entry.summary}</div>
                    {entry.details && (
                      <div className="text-xs text-secondary mt-1">{entry.details}</div>
                    )}
                  </div>
                ))}
              </div>

              {canWrite ? (
                <form onSubmit={handleAddNote} className="stack-sm">
                  <label className="field-label" htmlFor="case-note">
                    Add Official Case Note
                  </label>
                  <textarea
                    id="case-note"
                    className="field-textarea"
                    rows={2}
                    placeholder="Record verification note, telephone confirmation, or document reference..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <div>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Append Note to Timeline
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-xs text-muted">
                  Read-Only Auditor profile active — note entry disabled.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Rail */}
        <div className="stack-lg">
          {/* Workflow Status Transition Box */}
          <div className="panel">
            <div className="panel-header">
              <h2>Workflow Transition</h2>
            </div>
            <div className="panel-body">
              {canWrite && transitionRule ? (
                <form onSubmit={handleStatusSubmit} className="stack-md">
                  <div className="field-group">
                    <label className="field-label" htmlFor="next-status">
                      Permitted Next Status (from {caseRecord.status})
                    </label>
                    <select
                      id="next-status"
                      className="field-select"
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as CaseStatus)}
                    >
                      <option value="">Select next status...</option>
                      {transitionRule.allowedTo.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(nextStatus === 'Resolved' || nextStatus === 'Closed') && (
                    <div className="field-group">
                      <label className="field-label" htmlFor="outcome-summary">
                        Recorded Outcome Summary (Independent of linked cases)
                      </label>
                      <textarea
                        id="outcome-summary"
                        className="field-textarea"
                        rows={2}
                        placeholder="Summarize verified compliance or order reference..."
                        value={outcomeText}
                        onChange={(e) => setOutcomeText(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="field-group">
                    <label className="field-label" htmlFor="transition-note">
                      Audit Rationale Note *
                    </label>
                    <textarea
                      id="transition-note"
                      className="field-textarea"
                      rows={2}
                      placeholder="Mandatory rationale logged to Audit Register..."
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={!nextStatus}>
                    Record Status Transition
                  </button>
                </form>
              ) : (
                <p className="text-sm text-muted">
                  Read-Only Auditor mode active: status transitions are disabled.
                </p>
              )}
            </div>
          </div>

          {/* Linked Source Documents */}
          <div className="panel">
            <div className="panel-header">
              <h2>Policy &amp; Case Documents ({caseRecord.documents.length})</h2>
            </div>
            <div className="panel-body stack-sm">
              {caseRecord.documents.map((att) => {
                const doc = state.documents.find((d) => d.id === att.docId);
                if (!doc) return null;
                return (
                  <div key={att.docId} className="citation-card">
                    <div className="split-row">
                      <span className="mono font-semibold text-xs text-accent">{doc.id}</span>
                      <span
                        className={`badge ${
                          doc.supersededByDocId ? 'badge-warning' : 'badge-neutral'
                        }`}
                      >
                        {doc.supersededByDocId ? 'Superseded (Historical)' : `Eff. ${doc.effectiveFrom}`}
                      </span>
                    </div>
                    <div className="font-semibold text-sm mt-1">{doc.title}</div>
                    <p className="text-xs text-secondary mt-1">{att.relationNote}</p>
                    <button
                      type="button"
                      className="btn-link text-xs mt-2"
                      onClick={() => setPreviewDocId(doc.id)}
                    >
                      <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Open source text &amp; validity dates
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Related Case Candidates (5-Part Taxonomy Grounded) */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Related Case Candidates</h2>
                <p className="text-xs text-muted">
                  Five-Part Taxonomy — never auto-merged without human review
                </p>
              </div>
            </div>
            <div className="panel-body stack-sm">
              {caseRecord.relatedCandidates.length === 0 ? (
                <p className="text-sm text-muted">
                  No candidate related cases flagged for this record.
                </p>
              ) : (
                caseRecord.relatedCandidates.map((cand) => {
                  const target = state.cases.find((c) => c.id === cand.targetCaseId);
                  if (!target) return null;
                  const targetReadable = hasFullCaseReadAccess(
                    currentUser,
                    target,
                    state.accessRequests,
                    state.demoDate
                  );
                  return (
                    <div key={cand.targetCaseId} className="citation-card">
                      <div className="split-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                        <Link
                          to={`/cases/${target.id}`}
                          className="mono font-semibold link-inline"
                        >
                          {target.id}
                        </Link>
                        <div className="row-center">
                          {cand.taxonomy && <TaxonomyBadge taxonomy={cand.taxonomy} />}
                          <SourceBasisBadge basis={cand.matchBasis} />
                        </div>
                      </div>
                      <div className="font-semibold text-sm mt-1">
                        {targetReadable
                          ? target.subject
                          : `[Restricted Stub — ${target.coarseCategoryLabel ?? target.assignedBureau}]`}
                      </div>
                      <div className="text-xs text-secondary mt-1">
                        <strong>Verified Factors:</strong> {cand.sharedFactors.join(' • ')}
                      </div>
                      {cand.hypothesisedLink && (
                        <div className="text-xs text-secondary mt-1">
                          <strong>Hypothesised Link:</strong> {cand.hypothesisedLink}
                        </div>
                      )}
                      <div className="text-xs text-muted mt-1">{cand.cautionNote}</div>
                    </div>
                  );
                })
              )}
            </div>
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
