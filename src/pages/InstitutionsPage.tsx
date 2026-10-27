import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  GitCompareArrows,
  FileText,
  Lock,
  Archive,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { getCaseSlaStatus } from '../services/caseService';
import {
  AccessStatusBadge,
  AlertStatusBadge,
  AuthenticityBadge,
  PriorityBadge,
  ReadinessBadge,
  SlaBadge,
  StatusBadge,
  TaxonomyBadge,
} from '../components/ui/Badges';
import { DocumentPreviewDrawer } from '../components/ui/DocumentPreviewDrawer';
import { buildRedactedStub, hasFullCaseReadAccess } from '../services/accessService';
import { evaluateInstitutionReadiness } from '../services/clearanceService';
import { AccessRequestStatus } from '../types/domain';
import { BUREAU_CHART_COLORS, HBarChart } from '../components/ui/Charts';
import { ALL_BUREAUS } from '../data/seedData';
import { formatDateDisplay, isTerminalCaseStatus } from '../services/caseService';

type InstitutionTab = 'overview' | 'cases' | 'activity' | 'coordination';

export const InstitutionsPage: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const {
    state,
    currentUser,
    canWrite,
    submitScopedAccessRequest,
    decideScopedAccessRequest,
  } = useAppState();

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [accessDrawerCaseId, setAccessDrawerCaseId] = useState<string | null>(null);
  const [reqPurpose, setReqPurpose] = useState('');
  const [reqScope, setReqScope] = useState<
    'Case Summary & Timeline' | 'Summary, Actions & Evidence Metadata'
  >('Case Summary & Timeline');
  const [decisionNote, setDecisionNote] = useState('');
  const [expiresOn, setExpiresOn] = useState('2026-11-12');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [instTab, setInstTab] = useState<InstitutionTab>('overview');

  useEffect(() => {
    setInstTab('overview');
  }, [institutionId]);

  const selectedInstitution = institutionId
    ? state.institutions.find((i) => i.id === institutionId)
    : null;

  const filteredInstitutions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.institutions.filter((inst) => {
      if (regionFilter !== 'All' && inst.region !== regionFilter) return false;
      if (!q) return true;
      return (
        inst.id.toLowerCase().includes(q) ||
        inst.aisheRef.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.city.toLowerCase().includes(q) ||
        inst.state.toLowerCase().includes(q)
      );
    });
  }, [state.institutions, search, regionFilter]);

  const regions = Array.from(new Set(state.institutions.map((i) => i.region)));
  const previewDoc = state.documents.find((d) => d.id === previewDocId) ?? null;

  if (institutionId && !selectedInstitution) {
    return (
      <div className="panel">
        <div className="empty-state">
          <h3>Institution Profile Not Found</h3>
          <p className="text-sm text-secondary mt-1">
            No institution matching permanent identifier <span className="mono">{institutionId}</span>.
          </p>
          <Link to="/institutions" className="btn btn-primary btn-sm mt-3">
            Back to Institution Directory
          </Link>
        </div>
      </div>
    );
  }

  // Detail View: Institution 360
  if (selectedInstitution) {
    const instCases = state.cases.filter((c) => c.institutionId === selectedInstitution.id);
    const instActions = state.actions.filter((a) => a.institutionId === selectedInstitution.id);
    const instAlerts = state.alerts.filter((al) => al.institutionId === selectedInstitution.id);
    const instVault = state.evidenceVault.filter((e) => e.institutionId === selectedInstitution.id);
    const instAccessReqs = state.accessRequests.filter(
      (r) => r.institutionId === selectedInstitution.id
    );
    const instDocs = state.documents.filter(
      (d) =>
        d.linkedInstitutionId === selectedInstitution.id ||
        instCases.some((c) => d.linkedCaseIds.includes(c.id))
    );

    const readinessCheckpoints = evaluateInstitutionReadiness(
      selectedInstitution.id,
      state.cases,
      state.actions,
      state.alerts,
      state.evidenceVault,
      state.demoDate
    );

    const drawerCase = state.cases.find((c) => c.id === accessDrawerCaseId) ?? null;
    const isCoordinatorOrOwner = (owningBureau: string) =>
      currentUser.role === 'Cross-Bureau Coordinator' ||
      currentUser.role === 'Senior Review Authority' ||
      currentUser.bureau === owningBureau;

    const handleCreateAccessRequest = (e: React.FormEvent) => {
      e.preventDefault();
      if (!drawerCase) return;
      const res = submitScopedAccessRequest(drawerCase.id, reqPurpose, reqScope);
      if (!res.ok) {
        setFeedback(res.error ?? 'Unable to submit request.');
        return;
      }
      setReqPurpose('');
      setFeedback(`Submitted Scoped Access Request ${res.requestId} for ${drawerCase.id}.`);
    };

    const handleAdjudicate = (reqId: string, decision: AccessRequestStatus) => {
      const note =
        decisionNote.trim() ||
        `${decision} recorded under cross-bureau access governance protocol.`;
      const res = decideScopedAccessRequest(
        reqId,
        decision,
        note,
        reqScope,
        expiresOn
      );
      if (!res.ok) {
        setFeedback(res.error ?? 'Action failed.');
        return;
      }
      setDecisionNote('');
      setFeedback(`Updated request ${reqId} to status "${decision}" and recorded audit event.`);
    };

    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <Link to="/institutions" className="btn btn-ghost btn-sm" style={{ marginBottom: 6 }}>
              <ArrowLeft size={14} /> Institution Directory
            </Link>
            <div className="row-center" style={{ flexWrap: 'wrap', gap: 10 }}>
              <h1>{selectedInstitution.name}</h1>
              <span className="badge badge-info mono">{selectedInstitution.id}</span>
              <span
                className={`badge ${
                  selectedInstitution.status === 'Under Compliance Watch'
                    ? 'badge-critical'
                    : selectedInstitution.status === 'Extension Pending Verification'
                    ? 'badge-warning'
                    : 'badge-success'
                }`}
              >
                {selectedInstitution.status}
              </span>
            </div>
            <p className="page-subtitle">
              {selectedInstitution.city}, {selectedInstitution.state} ({selectedInstitution.region} Region) •{' '}
              {selectedInstitution.type} • AISHE Ref: <span className="mono">{selectedInstitution.aisheRef}</span>
            </p>
          </div>

          <div className="page-actions">
            <Link
              to={`/evidence?inst=${selectedInstitution.id}`}
              className="btn btn-secondary"
            >
              <Archive size={15} /> Shared Evidence Vault ({instVault.length})
            </Link>
            <Link
              to={`/knowledge?inst=${selectedInstitution.id}&q=${encodeURIComponent(
                `Summarize all documented actions on ${selectedInstitution.id}`
              )}`}
              className="btn btn-primary"
            >
              Query Institution Documents
            </Link>
          </div>
        </div>

        {feedback && (
          <div className="alert-banner info">
            <ShieldCheck size={16} />
            <div>{feedback}</div>
          </div>
        )}

        {/* Consolidated complaint metrics (same records across all tabs) */}
        <div className="kpi-grid" role="navigation" aria-label="Institution complaint metrics">
          <Link to={`/cases?inst=${selectedInstitution.id}`} className="kpi-card kpi-card-link">
            <span className="kpi-label">Total complaints</span>
            <span className="kpi-value">{instCases.length}</span>
            <span className="kpi-sub">All registered dockets on this institution</span>
            <span className="kpi-action">Open full register →</span>
          </Link>
          <Link
            to={`/cases?scope=active&inst=${selectedInstitution.id}`}
            className="kpi-card kpi-card-link"
          >
            <span className="kpi-label">Active</span>
            <span className="kpi-value">
              {instCases.filter((c) => !isTerminalCaseStatus(c.status)).length}
            </span>
            <span className="kpi-sub">
              {
                instCases.filter(
                  (c) => c.status === 'Pending Bureau' || c.status === 'Awaiting Review'
                ).length
              }{' '}
              pending bureau / review
            </span>
            <span className="kpi-action">Open active queue →</span>
          </Link>
          <Link
            to={`/cases?scope=active&sla=Overdue&inst=${selectedInstitution.id}`}
            className="kpi-card kpi-card-link"
          >
            <span className="kpi-label">Overdue</span>
            <span
              className="kpi-value"
              style={{
                color:
                  instCases.filter(
                    (c) =>
                      !isTerminalCaseStatus(c.status) &&
                      getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status ===
                        'Overdue'
                  ).length > 0
                    ? 'var(--danger)'
                    : undefined,
              }}
            >
              {
                instCases.filter(
                  (c) =>
                    !isTerminalCaseStatus(c.status) &&
                    getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status ===
                      'Overdue'
                ).length
              }
            </span>
            <span className="kpi-sub">Past statutory due date</span>
            <span className="kpi-action">Open overdue queue →</span>
          </Link>
          <div className="kpi-card">
            <span className="kpi-label">Disposed</span>
            <span className="kpi-value">
              {instCases.filter((c) => isTerminalCaseStatus(c.status)).length}
            </span>
            <span className="kpi-sub">Resolved or closed with recorded outcome</span>
          </div>
          <Link to="/coordination" className="kpi-card kpi-card-link">
            <span className="kpi-label">Coordination alerts</span>
            <span
              className="kpi-value"
              style={{
                color:
                  instAlerts.filter((a) => a.status !== 'Resolved' && a.status !== 'Dismissed')
                    .length > 0
                    ? 'var(--warning)'
                    : undefined,
              }}
            >
              {instAlerts.filter((a) => a.status !== 'Resolved' && a.status !== 'Dismissed').length}
            </span>
            <span className="kpi-sub">{instAlerts.length} total relationship records</span>
            <span className="kpi-action">Open Coordination Centre →</span>
          </Link>
          <Link to={`/evidence?inst=${selectedInstitution.id}`} className="kpi-card kpi-card-link">
            <span className="kpi-label">Vault artifacts</span>
            <span className="kpi-value">{instVault.length}</span>
            <span className="kpi-sub">Shared evidence records on file</span>
            <span className="kpi-action">Open Evidence Vault →</span>
          </Link>
        </div>

        {/* Institution 360 tabs */}
        <div className="tab-bar" role="tablist" aria-label="Institution 360 sections">
          {(
            [
              ['overview', 'Overview'],
              ['cases', `All Cases (${instCases.length})`],
              ['activity', 'Activity'],
              ['coordination', 'Coordination'],
            ] as Array<[InstitutionTab, string]>
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={instTab === tab}
              className={`tab-btn${instTab === tab ? ' active' : ''}`}
              onClick={() => setInstTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {instTab === 'overview' && (
          <div className="grid-2">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Bureau-Wise Complaint Distribution</h2>
                  <p className="text-xs text-muted">
                    Registered dockets by handling bureau — click to open the filtered register
                  </p>
                </div>
              </div>
              <div className="panel-body">
                <HBarChart
                  rows={ALL_BUREAUS.map((bureau, idx) => ({
                    label: bureau,
                    value: instCases.filter((c) => c.assignedBureau === bureau).length,
                    color: BUREAU_CHART_COLORS[idx % BUREAU_CHART_COLORS.length],
                    to: `/cases?inst=${selectedInstitution.id}&assignedBureau=${encodeURIComponent(bureau)}`,
                  })).filter((r) => r.value > 0)}
                  emptyLabel="No dockets registered"
                />
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Pending Actions &amp; Deadlines</h2>
                  <p className="text-xs text-muted">
                    Open administrative actions and nearest statutory due dates
                  </p>
                </div>
              </div>
              <div className="panel-body stack-sm">
                {instActions
                  .filter((a) => a.status !== 'Completed')
                  .slice(0, 4)
                  .map((a) => (
                    <div key={a.id} className="split-row" style={{ gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="text-sm font-semibold">{a.actionType}</div>
                        <div className="text-xs text-muted">
                          {a.id} · {a.bureau}
                        </div>
                      </div>
                      <span className="badge badge-neutral">{a.status}</span>
                    </div>
                  ))}
                {instCases
                  .filter((c) => !isTerminalCaseStatus(c.status))
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 4)
                  .map((c) => (
                    <div key={c.id} className="split-row" style={{ gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="text-sm">
                          <Link to={`/cases/${c.id}`} className="link-inline mono">
                            {c.id}
                          </Link>{' '}
                          — due {formatDateDisplay(c.dueDate)}
                        </div>
                        <div className="text-xs text-muted">{c.assignedBureau}</div>
                      </div>
                      <SlaBadge
                        caseRecord={c}
                        demoToday={state.demoDate}
                        deadlineRules={state.settings.deadlineRules}
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {instTab === 'activity' && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Activity Timeline</h2>
                <p className="text-xs text-muted">
                  Latest recorded events across every docket on this institution
                </p>
              </div>
            </div>
            <div className="panel-body stack-sm">
              {instCases
                .flatMap((c) =>
                  c.timeline.map((ev) => ({
                    key: `${c.id}-${ev.id}`,
                    caseId: c.id,
                    ...ev,
                  }))
                )
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 15)
                .map((ev) => (
                  <div key={ev.key} className="row-center" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span
                      className="mono text-xs text-muted"
                      style={{ whiteSpace: 'nowrap', paddingTop: 2 }}
                    >
                      {ev.timestamp.slice(0, 10)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="text-sm">
                        <Link to={`/cases/${ev.caseId}`} className="link-inline mono">
                          {ev.caseId}
                        </Link>{' '}
                        — {ev.summary}
                      </div>
                      <div className="text-xs text-muted">
                        {ev.type} · {ev.actor} ({ev.actorBureau})
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CAPABILITY 6: INSTITUTION READINESS & REGULATORY CYCLE CHECKPOINTS */}
        {instTab === 'overview' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Institution Readiness &amp; Regulatory Cycle Checkpoints</h2>
              <p className="text-xs text-muted">
                Advisory cross-bureau synthesis across annual regulatory windows — never invents numeric scores or auto-blocks statutory approval
              </p>
            </div>
            <span className="badge badge-neutral">Advisory Only</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Regulatory Cycle Window</th>
                  <th>Advisory Readiness State</th>
                  <th>Cross-Bureau Basis &amp; Open Factors</th>
                  <th>Supporting Records</th>
                </tr>
              </thead>
              <tbody>
                {readinessCheckpoints.map((cp) => (
                  <tr key={cp.cycleId}>
                    <td style={{ minWidth: 210 }}>
                      <div className="font-semibold">{cp.cycleLabel}</div>
                      <div className="text-xs text-muted">{cp.windowDescription}</div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <ReadinessBadge state={cp.state} />
                    </td>
                    <td className="text-sm text-secondary">{cp.advisoryBasis}</td>
                    <td>
                      <div className="row-center" style={{ flexWrap: 'wrap', gap: 4 }}>
                        {cp.supportingCaseIds.map((cid) => (
                          <Link key={cid} to={`/cases/${cid}`} className="badge badge-neutral mono">
                            {cid}
                          </Link>
                        ))}
                        {cp.supportingArtifactIds.map((aid) => (
                          <Link
                            key={aid}
                            to={`/evidence?artifact=${aid}`}
                            className="badge badge-info mono"
                          >
                            {aid}
                          </Link>
                        ))}
                        {cp.supportingCaseIds.length === 0 &&
                          cp.supportingArtifactIds.length === 0 && (
                            <span className="text-xs text-muted">None recorded</span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--bg-subtle)',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong>Governance Boundary:</strong> Checkpoints surface open grievances, active compliance directives, shared vault status, and coordination alerts so bureaus do not decide in isolation; final statutory orders rest exclusively with the competent authority.
          </div>
        </div>
        )}

        {/* CAPABILITY 2: CROSS-BUREAU CASE REGISTER WITH REDACTED STUBS & SCOPED ACCESS */}
        {instTab === 'cases' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Cross-Bureau Activity &amp; Scoped Visibility ({instCases.length} Cases)</h2>
              <p className="text-xs text-muted">
                Restricted dockets display redacted coordination stubs to non-owning bureaus until scoped access is granted
              </p>
            </div>
            {instAccessReqs.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const firstRestricted =
                    instCases.find((c) => c.visibility !== 'Standard Cross-Bureau') ?? instCases[0];
                  if (firstRestricted) setAccessDrawerCaseId(firstRestricted.id);
                }}
              >
                <Lock size={13} /> Access Governance Log ({instAccessReqs.length})
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Visibility Scope</th>
                  <th>Subject / Permitted Coarse Stub</th>
                  <th>Owning Bureau</th>
                  <th>Status</th>
                  <th>Target Window / SLA</th>
                  <th>Coordination Action</th>
                </tr>
              </thead>
              <tbody>
                {instCases.map((c) => {
                  const fullAccess = hasFullCaseReadAccess(
                    currentUser,
                    c,
                    state.accessRequests,
                    state.demoDate
                  );
                  const sla = getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules);

                  if (!fullAccess) {
                    const stub = buildRedactedStub(c);
                    return (
                      <tr key={c.id} style={{ background: 'var(--bg-subtle)' }}>
                        <td className="mono font-semibold">{stub.caseId}</td>
                        <td>
                          <span className="badge badge-critical">Redacted Stub</span>
                        </td>
                        <td>
                          <div className="font-semibold">
                            {stub.coarseCategory} <span className="text-xs text-muted">[Subject Withheld]</span>
                          </div>
                          <div className="text-xs text-muted">
                            Complainant identity, allegations, and annexures restricted to {stub.owningBureau}
                          </div>
                        </td>
                        <td>{stub.owningBureau}</td>
                        <td>
                          <span className="badge badge-neutral">{stub.coarseStatus}</span>
                        </td>
                        <td className="mono text-xs">{stub.permittedActivityPeriod}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setAccessDrawerCaseId(c.id)}
                          >
                            <Lock size={12} /> Request Access
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={c.id}>
                      <td className="mono font-semibold">
                        <Link to={`/cases/${c.id}`} className="link-inline">
                          {c.id}
                        </Link>
                      </td>
                      <td>
                        {c.visibility === 'Standard Cross-Bureau' ? (
                          <span className="badge badge-neutral">Standard</span>
                        ) : (
                          <span className="badge badge-success">Scoped Authorized</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/cases/${c.id}`}
                          className="font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {c.subject}
                        </Link>
                        <div className="text-xs text-muted">
                          {c.category} • Incident: {c.incidentDate ?? c.receivedDate}
                        </div>
                      </td>
                      <td>{c.assignedBureau}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={c.priority} />{' '}
                        <SlaBadge status={sla.status} label={sla.label} />
                      </td>
                      <td>
                        <div className="row-center" style={{ gap: 6 }}>
                          <Link to={`/cases/${c.id}`} className="btn btn-secondary btn-sm">
                            Open Docket
                          </Link>
                          {c.visibility !== 'Standard Cross-Bureau' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setAccessDrawerCaseId(c.id)}
                            >
                              Grants
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Shared Evidence Vault & Active Alerts Side-by-Side */}
        {instTab === 'coordination' && (
        <div className="grid-2">
          <div className="panel">
            <div className="panel-header">
              <h2>Shared Evidence Vault ({instVault.length})</h2>
              <Link to={`/evidence?inst=${selectedInstitution.id}`} className="btn btn-secondary btn-sm">
                Full Vault View
              </Link>
            </div>
            <div className="panel-body stack-sm">
              {instVault.length === 0 ? (
                <p className="text-sm text-muted">No Shared Evidence Vault artifacts registered yet.</p>
              ) : (
                instVault.map((ev) => {
                  const referencingCases = state.cases.filter((c) =>
                    c.evidenceLinks.some((l) => l.artifactId === ev.id)
                  );
                  return (
                    <div key={ev.id} className="citation-card">
                      <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <Link
                          to={`/evidence?artifact=${ev.id}`}
                          className="mono font-semibold link-inline"
                        >
                          {ev.id} ({ev.currentVersion})
                        </Link>
                        <AuthenticityBadge status={ev.authenticityStatus} />
                      </div>
                      <div className="font-semibold text-sm mt-1">{ev.title}</div>
                      <p className="text-xs text-secondary mt-1">{ev.summary}</p>
                      <div className="text-xs text-muted mt-1">
                        Referenced independently by:{' '}
                        {referencingCases.map((rc) => {
                          const lnk = rc.evidenceLinks.find((l) => l.artifactId === ev.id);
                          return (
                            <span key={rc.id} style={{ marginRight: 8 }}>
                              <Link to={`/cases/${rc.id}`} className="link-inline mono">
                                {rc.id}
                              </Link>{' '}
                              ({lnk?.linkedVersion}, {rc.status})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Coordination Alerts &amp; Scheduled Actions</h2>
            </div>
            <div className="panel-body stack-sm">
              {instAlerts.map((al) => (
                <div key={al.id} className="citation-card">
                  <div className="split-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                    <Link
                      to={`/coordination?alert=${al.id}`}
                      className="mono font-semibold link-inline"
                    >
                      {al.id}
                    </Link>
                    <div className="row-center">
                      <TaxonomyBadge taxonomy={al.taxonomy} />
                      <AlertStatusBadge status={al.status} />
                    </div>
                  </div>
                  <div className="font-semibold text-sm mt-1">{al.title}</div>
                  <div className="text-xs text-secondary mt-1">{al.recommendedNextStep}</div>
                </div>
              ))}

              {instActions.map((act) => {
                const hideConf =
                  act.confidentiality === 'Confidential Inspection' &&
                  currentUser.bureau !== act.bureau &&
                  currentUser.role !== 'Cross-Bureau Coordinator' &&
                  currentUser.role !== 'Senior Review Authority';
                return (
                  <div key={act.id} className="citation-card">
                    <div className="split-row">
                      <span className="mono font-semibold text-xs">{act.id}</span>
                      <span className="badge badge-neutral">{act.status}</span>
                    </div>
                    <div className="font-semibold text-sm mt-1">
                      {hideConf
                        ? '[Redacted Active Inspection Activity Window]'
                        : `${act.actionType}: ${act.scope}`}
                    </div>
                    <div className="text-xs text-muted mono mt-1">
                      {act.bureau} • {hideConf ? 'Window Protected' : `${act.scheduledStart} → ${act.scheduledEnd}`}
                    </div>
                  </div>
                );
              })}

              {instDocs.slice(0, 2).map((doc) => (
                <div key={doc.id} className="citation-card">
                  <div className="split-row">
                    <span className="mono font-semibold text-xs text-accent">{doc.id}</span>
                    <button
                      type="button"
                      className="btn-link text-xs"
                      onClick={() => setPreviewDocId(doc.id)}
                    >
                      <FileText size={12} style={{ display: 'inline' }} /> Preview
                    </button>
                  </div>
                  <div className="text-xs font-semibold mt-1">{doc.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* SCOPED ACCESS REQUEST & LIFECYCLE DRAWER (Capability 2) */}
        {drawerCase && (
          <div
            className="drawer-backdrop"
            onClick={() => setAccessDrawerCaseId(null)}
            role="presentation"
          >
            <aside
              className="drawer-panel"
              onClick={(e) => e.stopPropagation()}
              aria-label="Scoped Cross-Bureau Access Governance"
            >
              <div className="drawer-head">
                <div>
                  <div className="row-center" style={{ marginBottom: 4 }}>
                    <span className="mono font-semibold text-accent">{drawerCase.id}</span>
                    <span className="badge badge-warning">{drawerCase.visibility}</span>
                  </div>
                  <h3>Scoped Cross-Bureau Access Governance</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setAccessDrawerCaseId(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="drawer-body stack-md">
                <div className="alert-banner info">
                  <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Security Architecture Boundary Note:</strong> In this browser prototype, redaction and pre-retrieval RAG filtering are enforced consistently across UI and local search adapters. In production deployment, field-level redaction, time-bounded token expiry, and pre-retrieval vector/keyword permissions MUST be enforced server-side in backend APIs and the retrieval index before any payload reaches the client.
                  </div>
                </div>

                {/* Request Form */}
                <form
                  onSubmit={handleCreateAccessRequest}
                  className="panel"
                  style={{ background: 'var(--bg-subtle)' }}
                >
                  <div className="panel-body stack-sm">
                    <h4 className="text-sm font-semibold">
                      Submit New Scoped Access Request (as {currentUser.name} — {currentUser.bureau})
                    </h4>
                    <div className="field-group">
                      <label className="field-label" htmlFor="drw-scope">
                        Minimum Required Data Scope
                      </label>
                      <select
                        id="drw-scope"
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
                      <label className="field-label" htmlFor="drw-purpose">
                        Coordination Justification *
                      </label>
                      <textarea
                        id="drw-purpose"
                        className="field-textarea"
                        rows={2}
                        placeholder="Document why cross-bureau coordination requires read visibility..."
                        value={reqPurpose}
                        onChange={(e) => setReqPurpose(e.target.value)}
                      />
                    </div>
                    <div>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Submit Access Request
                      </button>
                    </div>
                  </div>
                </form>

                {/* Lifecycle Records across all 5 states: Pending, Approved, Denied, Expired, Revoked */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Institution Access Request &amp; Audit Lifecycle ({instAccessReqs.length} Records)
                  </h4>
                  {canWrite && (
                    <div className="grid-2 mb-3">
                      <input
                        type="text"
                        className="field-input"
                        placeholder="Optional decision/revocation reason note..."
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                      />
                      <input
                        type="date"
                        className="field-input mono"
                        aria-label="Grant expiry date"
                        value={expiresOn}
                        onChange={(e) => setExpiresOn(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="stack-sm">
                    {instAccessReqs.map((req) => {
                      const canAdjudicate = canWrite && isCoordinatorOrOwner(req.owningBureau);
                      return (
                        <div key={req.id} className="citation-card">
                          <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                            <span className="mono font-semibold text-xs">
                              {req.id} • Case {req.caseId}
                            </span>
                            <AccessStatusBadge status={req.status} />
                          </div>
                          <div className="text-xs font-semibold mt-1">
                            Requester: {req.requestingBureau} → Owner: {req.owningBureau}
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            Purpose: {req.coordinationPurpose}
                          </p>
                          <div className="text-xs text-muted mono mt-1">
                            Scope: {req.approvedScope ?? req.requestedScope}
                            {req.expiresOn ? ` • Expires: ${req.expiresOn}` : ''}
                          </div>

                          {/* History log */}
                          <div className="mt-2" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {req.history.map((h, i) => (
                              <div key={i}>
                                [{h.timestamp}] <strong>{h.event}</strong> by {h.actor}: {h.note}
                              </div>
                            ))}
                          </div>

                          {canAdjudicate && (
                            <div className="row-center mt-2" style={{ flexWrap: 'wrap', gap: 6 }}>
                              {req.status === 'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAdjudicate(req.id, 'Approved')}
                                  >
                                    Approve Scoped Grant
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleAdjudicate(req.id, 'Denied')}
                                  >
                                    Deny
                                  </button>
                                </>
                              )}
                              {req.status === 'Approved' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleAdjudicate(req.id, 'Revoked')}
                                  >
                                    Revoke Access Now
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleAdjudicate(req.id, 'Expired')}
                                  >
                                    Simulate Expiry
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        <DocumentPreviewDrawer
          doc={previewDoc}
          onSelectDocId={(id) => setPreviewDocId(id)}
          onClose={() => setPreviewDocId(null)}
        />
      </div>
    );
  }

  // Directory List View
  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Institution 360 Registry</h1>
          <p className="page-subtitle">
            Keyed by AICTE Permanent ID — includes Readiness Checkpoints, Shared Evidence Vault counts, and Redacted Cross-Bureau Visibility
          </p>
        </div>
      </div>

      <div className="alert-banner info">
        <Building2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Identity Disambiguation Rule:</strong> Open{' '}
          <Link to="/institutions/INST-MH-2040" className="link-inline mono">
            INST-MH-2040 (ABC Engineering College)
          </Link>{' '}
          to inspect the SIH PS 26264 cross-bureau fee-refund cohort, Shared Evidence Vault reuse, Readiness Checkpoints, and Redacted Scoped Access stubs. Notice also that{' '}
          <span className="mono">INST-TN-1008</span> and <span className="mono">INST-KA-4012</span> never merge despite sharing the name prefix &ldquo;Cauvery&rdquo;.
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <input
            type="search"
            className="field-input search-wide"
            placeholder="Search by Institution ID (INST-MH-2040), AISHE ref, name, city, or state..."
            aria-label="Search institutions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-select"
            aria-label="Filter by region"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="All">All AICTE Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r} Region
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institution ID</th>
                <th>Institution Name &amp; Location</th>
                <th>Approval Status</th>
                <th>Cases (Std / Restricted)</th>
                <th>Vault Artifacts</th>
                <th>Open Alerts</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutions.map((inst) => {
                const instCases = state.cases.filter((c) => c.institutionId === inst.id);
                const restrictedCount = instCases.filter(
                  (c) => c.visibility !== 'Standard Cross-Bureau'
                ).length;
                const vaultCount = state.evidenceVault.filter(
                  (e) => e.institutionId === inst.id
                ).length;
                const openAlerts = state.alerts.filter(
                  (al) =>
                    al.institutionId === inst.id &&
                    al.status !== 'Resolved' &&
                    al.status !== 'Dismissed'
                );

                return (
                  <tr key={inst.id}>
                    <td className="mono font-semibold" style={{ whiteSpace: 'nowrap' }}>
                      <Link to={`/institutions/${inst.id}`} className="link-inline">
                        {inst.id}
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {inst.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {inst.city}, {inst.state} • {inst.region} Region
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inst.status === 'Under Compliance Watch'
                            ? 'badge-critical'
                            : inst.status === 'Extension Pending Verification'
                            ? 'badge-warning'
                            : 'badge-success'
                        }`}
                      >
                        {inst.status}
                      </span>
                    </td>
                    <td className="mono">
                      {instCases.length} total
                      {restrictedCount > 0 && (
                        <span className="text-xs text-muted"> ({restrictedCount} restricted)</span>
                      )}
                    </td>
                    <td className="mono">{vaultCount}</td>
                    <td>
                      {openAlerts.length > 0 ? (
                        <span className="badge badge-warning">
                          <GitCompareArrows size={11} /> {openAlerts.length} active
                        </span>
                      ) : (
                        <span className="text-xs text-muted">None</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/institutions/${inst.id}`} className="btn btn-secondary btn-sm">
                        Open 360 View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
