import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  FileCheck2,
  GitCompareArrows,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Slash,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import {
  CaseSortField,
  DraftActionClearanceItem,
  filterAndSortCases,
  formatDateDisplay,
  getCaseSlaStatus,
  getOperationalSnapshot,
} from '../services/caseService';
import { CLEARANCE_RULE_VERSION } from '../services/clearanceService';
import { hasFullCaseReadAccess } from '../services/accessService';
import {
  AlertStatusBadge,
  PriorityBadge,
  SlaBadge,
  SourceBasisBadge,
  StatusBadge,
  TaxonomyBadge,
} from '../components/ui/Badges';
import { Drawer } from '../components/ui/Overlays';
import {
  BUREAU_CHART_COLORS,
  DonutChart,
  HBarChart,
  STATUS_CHART_COLORS,
} from '../components/ui/Charts';
import { ALL_BUREAUS } from '../data/seedData';
import { CaseStatus } from '../types/domain';

type WorkloadScope = 'all' | 'my_desk';

export const DashboardPage: React.FC = () => {
  const {
    state,
    currentUser,
    canWrite,
    updateSettings,
    issueDraftAction,
    resolveDraftWithVaultArtifact,
    updateAlertWorkflow,
    suppressAlertPair,
  } = useAppState();

  const [workloadScope, setWorkloadScope] = useState<WorkloadScope>('all');
  const [institutionFilter, setInstitutionFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<CaseSortField>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Interactive Review Drawers (Pre-Dispatch Clearance & Coordination Alert)
  const [selectedDraftActionId, setSelectedDraftActionId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [clearanceFeedback, setClearanceFeedback] = useState<string | null>(null);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertNote, setAlertNote] = useState('');
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  // Single canonical snapshot shared with Cases, Coordination, and AppShell badges
  const snapshot = useMemo(
    () => getOperationalSnapshot(state, currentUser, institutionFilter),
    [state, currentUser, institutionFilter]
  );

  const selectedInstitution = useMemo(
    () => state.institutions.find((i) => i.id === institutionFilter) ?? null,
    [state.institutions, institutionFilter]
  );

  const mandatoryBlockCount = useMemo(
    () => snapshot.draftClearanceQueue.filter((d) => d.isMandatoryBlock).length,
    [snapshot.draftClearanceQueue]
  );

  const visibleDraftChecks = useMemo(
    () =>
      workloadScope === 'my_desk'
        ? snapshot.myBureauDraftClearanceQueue
        : snapshot.draftClearanceQueue,
    [workloadScope, snapshot.myBureauDraftClearanceQueue, snapshot.draftClearanceQueue]
  );

  const prioritizedCases = useMemo(
    () =>
      filterAndSortCases(
        state.cases,
        state.institutions,
        {
          activeOnly: true,
          institutionId: institutionFilter,
          assignedBureau: workloadScope === 'my_desk' ? currentUser.bureau : 'All',
        },
        sortField,
        sortDir,
        state.demoDate,
        state.settings.deadlineRules,
        {
          currentUser,
          accessRequests: state.accessRequests,
          demoDate: state.demoDate,
        }
      ),
    [
      state.cases,
      state.institutions,
      state.accessRequests,
      institutionFilter,
      workloadScope,
      currentUser,
      sortField,
      sortDir,
      state.demoDate,
      state.settings.deadlineRules,
    ]
  );

  const visibleAlerts = useMemo(
    () =>
      workloadScope === 'my_desk' ? snapshot.myBureauOpenAlerts : snapshot.openAlerts,
    [workloadScope, snapshot.myBureauOpenAlerts, snapshot.openAlerts]
  );

  // Build consistent filtered destination URLs matching the exact KPI figures
  const instQuerySuffix =
    institutionFilter !== 'All' ? `&inst=${encodeURIComponent(institutionFilter)}` : '';
  const deskQuerySuffix =
    workloadScope === 'my_desk'
      ? `&assignedBureau=${encodeURIComponent(currentUser.bureau)}`
      : '';

  // Scoped record sets powering KPI cards and analytics charts (same underlying records)
  const scopedActiveCases = useMemo(
    () => (workloadScope === 'my_desk' ? snapshot.myBureauActiveCases : snapshot.activeCases),
    [workloadScope, snapshot.myBureauActiveCases, snapshot.activeCases]
  );

  const visibleApproaching = useMemo(
    () =>
      workloadScope === 'my_desk'
        ? snapshot.approachingCases.filter((c) => c.assignedBureau === currentUser.bureau)
        : snapshot.approachingCases,
    [workloadScope, snapshot.approachingCases, currentUser.bureau]
  );

  const visibleMovedCases = useMemo(
    () =>
      scopedActiveCases.filter(
        (c) => c.status === 'Escalated' || c.sourceBureau !== c.assignedBureau
      ),
    [scopedActiveCases]
  );

  const scopedAllCases = useMemo(
    () =>
      workloadScope === 'my_desk'
        ? snapshot.scopedCases.filter((c) => c.assignedBureau === currentUser.bureau)
        : snapshot.scopedCases,
    [snapshot.scopedCases, workloadScope, currentUser.bureau]
  );

  // PS SIH26264 lifecycle counters: received / pending / under process / disposed / transferred
  const lifecycleStats = useMemo(() => {
    const pending = scopedAllCases.filter(
      (c) => c.status === 'Open' || c.status === 'Pending Bureau'
    ).length;
    const underProcess = scopedAllCases.filter(
      (c) =>
        c.status === 'In Progress' || c.status === 'Awaiting Review' || c.status === 'Escalated'
    ).length;
    const disposed = scopedAllCases.filter(
      (c) => c.status === 'Resolved' || c.status === 'Closed'
    ).length;
    const transferred = scopedAllCases.filter(
      (c) => c.sourceBureau !== c.assignedBureau
    ).length;
    return { received: scopedAllCases.length, pending, underProcess, disposed, transferred };
  }, [scopedAllCases]);

  const statusSegments = useMemo(() => {
    const order: CaseStatus[] = [
      'Open',
      'In Progress',
      'Pending Bureau',
      'Awaiting Review',
      'Escalated',
      'Resolved',
      'Closed',
    ];
    return order
      .map((status) => ({
        label: status,
        value: scopedAllCases.filter((c) => c.status === status).length,
        color: STATUS_CHART_COLORS[status],
        to: `/cases?status=${encodeURIComponent(status)}${deskQuerySuffix}${instQuerySuffix}`,
      }))
      .filter((s) => s.value > 0);
  }, [scopedAllCases, deskQuerySuffix, instQuerySuffix]);

  const bureauWorkloadRows = useMemo(() => {
    return ALL_BUREAUS.map((bureau, idx) => {
      const rows = snapshot.activeCases.filter((c) => c.assignedBureau === bureau);
      const overdue = rows.filter((c) =>
        snapshot.overdueCases.some((o) => o.id === c.id)
      ).length;
      return {
        label: bureau,
        value: rows.length,
        color: BUREAU_CHART_COLORS[idx % BUREAU_CHART_COLORS.length],
        to: `/cases?scope=active&assignedBureau=${encodeURIComponent(bureau)}${instQuerySuffix}`,
        sub: overdue > 0 ? `${overdue} overdue` : undefined,
      };
    })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [snapshot.activeCases, snapshot.overdueCases, instQuerySuffix]);

  const recentActivity = useMemo(() => {
    const events: Array<{
      key: string;
      timestamp: string;
      caseId: string;
      summary: string;
      actor: string;
      type: string;
    }> = [];
    snapshot.scopedCases.forEach((c) => {
      c.timeline.forEach((ev) => {
        events.push({
          key: `${c.id}-${ev.id}`,
          timestamp: ev.timestamp,
          caseId: c.id,
          summary: ev.summary,
          actor: ev.actor,
          type: ev.type,
        });
      });
    });
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 7);
  }, [snapshot.scopedCases]);

  const upcomingDeadlines = useMemo(
    () =>
      [...scopedActiveCases]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [scopedActiveCases]
  );

  const activeCasesHref = `/cases?scope=active${deskQuerySuffix}${instQuerySuffix}`;
  const overdueCasesHref = `/cases?scope=active&sla=Overdue${deskQuerySuffix}${instQuerySuffix}`;
  const approachingCasesHref = `/cases?scope=active&sla=Approaching${deskQuerySuffix}${instQuerySuffix}`;
  const movedCasesHref = `/cases?scope=active&flow=moved${deskQuerySuffix}${instQuerySuffix}`;
  const clearanceCasesHref = `/cases?clearance=draft${deskQuerySuffix}${instQuerySuffix}`;
  const coordinationHref =
    workloadScope === 'my_desk'
      ? `/coordination?status=Active&bureau=${encodeURIComponent(currentUser.bureau)}`
      : '/coordination?status=Active';

  const activeDraftItem: DraftActionClearanceItem | null = useMemo(
    () =>
      snapshot.draftClearanceQueue.find((d) => d.action.id === selectedDraftActionId) ?? null,
    [snapshot.draftClearanceQueue, selectedDraftActionId]
  );

  const activeReviewAlert = useMemo(
    () => state.alerts.find((a) => a.id === selectedAlertId) ?? null,
    [state.alerts, selectedAlertId]
  );

  const toggleSort = (field: CaseSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'priority' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: CaseSortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const handleDispatchFromDrawer = () => {
    if (!activeDraftItem) return;
    const res = issueDraftAction(activeDraftItem.action.id, overrideReason);
    if (!res.ok) {
      setClearanceFeedback(res.error ?? 'Unable to issue action.');
      return;
    }
    setOverrideReason('');
    setClearanceFeedback(null);
    setSelectedDraftActionId(null);
  };

  const handleVaultReuseFromDrawer = (artifactId: string) => {
    if (!activeDraftItem) return;
    const res = resolveDraftWithVaultArtifact(activeDraftItem.action.id, artifactId);
    if (!res.ok) {
      setClearanceFeedback(res.error ?? 'Unable to subscribe to vault evidence.');
      return;
    }
    setClearanceFeedback(null);
    setSelectedDraftActionId(null);
  };

  const handleQuickAlertAction = (
    status: 'Coordinating' | 'In review',
    entryType: 'Decision' | 'Discussion'
  ) => {
    if (!activeReviewAlert) return;
    const res = updateAlertWorkflow(
      activeReviewAlert.id,
      status,
      alertNote.trim() || `Reviewed from operational dashboard by ${currentUser.name}.`,
      entryType
    );
    if (!res.ok) {
      setAlertFeedback(res.error ?? 'Action failed.');
      return;
    }
    setAlertNote('');
    setAlertFeedback(`Updated ${activeReviewAlert.id} to "${status}".`);
  };

  const handleQuickSuppress = () => {
    if (!activeReviewAlert) return;
    const res = suppressAlertPair(activeReviewAlert.id, alertNote);
    if (!res.ok) {
      setAlertFeedback(res.error ?? 'Enter a reason of at least 10 characters to suppress.');
      return;
    }
    setAlertNote('');
    setAlertFeedback(null);
    setSelectedAlertId(null);
  };

  const displayCases = prioritizedCases.slice(0, 5);

  return (
    <div className="stack-lg">
      {/* 1. Aligned Page Header: Title, Subtitle & Consistent Primary Action */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Operational Coordination Dashboard</h1>
          <p className="page-subtitle">
            Cross-bureau case deadlines, pre-dispatch conflict screening, and shared evidence coordination as of{' '}
            <strong className="mono">{formatDateDisplay(state.demoDate)}</strong>
          </p>
        </div>

        <div className="page-actions">
          <Link
            to={`/institutions/${
              institutionFilter !== 'All' ? institutionFilter : 'INST-MH-2040'
            }`}
            className="btn btn-secondary"
          >
            <Building2 size={15} />
            {selectedInstitution ? `${selectedInstitution.id} Profile` : 'Institution 360'}
          </Link>
          <Link to="/cases?new=1" className="btn btn-primary">
            <Plus size={15} />
            Register Case
          </Link>
        </div>
      </div>

      {/* Operational Context Bar: Active Desk, Workload Scope, Institution Context & Explicit AI Control */}
      <div className="context-bar" role="region" aria-label="Operational context and scope controls">
        <div className="context-group">
          <div className="context-pill">
            <UserCheck size={15} className="text-accent" />
            <span>
              Desk: <strong>{currentUser.bureau}</strong>
            </span>
          </div>

          <div className="context-divider" aria-hidden="true" />

          <div className="segmented-toggle" role="group" aria-label="Metrics and queue workload scope">
            <button
              type="button"
              className={`segmented-btn${workloadScope === 'all' ? ' active' : ''}`}
              onClick={() => setWorkloadScope('all')}
            >
              All bureaus ({snapshot.activeCases.length})
            </button>
            <button
              type="button"
              className={`segmented-btn${workloadScope === 'my_desk' ? ' active' : ''}`}
              onClick={() => setWorkloadScope('my_desk')}
            >
              My desk ({snapshot.myBureauActiveCases.length})
            </button>
          </div>
        </div>

        <div className="context-group">
          <label htmlFor="dash-inst-context" className="field-label" style={{ margin: 0 }}>
            Institution:
          </label>
          <select
            id="dash-inst-context"
            className="field-select"
            style={{ width: 'auto', minWidth: 165, maxWidth: 215, height: 32, minHeight: 32, fontSize: 12.5, padding: '0 8px' }}
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
          >
            <option value="All">All institutions ({state.institutions.length})</option>
            {state.institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.id} — {inst.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`ai-status-btn${state.settings.aiAssistanceEnabled ? ' enabled' : ' disabled'}`}
            style={{ height: 32 }}
            aria-pressed={state.settings.aiAssistanceEnabled}
            onClick={() =>
              updateSettings(
                { aiAssistanceEnabled: !state.settings.aiAssistanceEnabled },
                `Optional AI assistance ${
                  state.settings.aiAssistanceEnabled ? 'disabled' : 'enabled'
                } from dashboard by ${currentUser.name}.`
              )
            }
          >
            <Sparkles size={13} />
            <span>
              AI: <strong>{state.settings.aiAssistanceEnabled ? 'On (Optional)' : 'Off (Deterministic)'}</strong>
            </span>
          </button>
        </div>
      </div>

      {!state.settings.aiAssistanceEnabled && (
        <div className="alert-banner info">
          <ShieldCheck size={16} />
          <div>
            <strong>Deterministic Operations Active (AI Disabled):</strong> Disabling optional AI only
            turns off narrative passage summaries in the Knowledge Assistant. Case intake, SLA tracking,
            Pre-Dispatch Clearance rules (<span className="mono">{CLEARANCE_RULE_VERSION}</span>),
            Shared Evidence Vault reuse, 60-day Cohort detection, and audit logging operate unaffected.
          </div>
        </div>
      )}

      {/* 3 & 8. Clickable KPI Strip Distinguishing All-Bureau Totals vs Current Officer's Workload */}
      <div className="kpi-grid" role="navigation" aria-label="Operational summary metrics">
        <Link to={activeCasesHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk' ? 'Active cases (My desk)' : 'Active cases (All bureaus)'}
          </span>
          <span className="kpi-value">
            {workloadScope === 'my_desk'
              ? snapshot.myBureauActiveCases.length
              : snapshot.activeCases.length}
          </span>
          <span className="kpi-sub">
            {workloadScope === 'my_desk'
              ? `${snapshot.myOfficerActiveCases.length} assigned directly to ${currentUser.name} · ${snapshot.activeCases.length} total`
              : `${snapshot.myBureauActiveCases.length} in ${currentUser.bureau} (${snapshot.myOfficerActiveCases.length} assigned to you)`}
          </span>
          <span className="kpi-action">
            View filtered cases <ArrowRight size={12} />
          </span>
        </Link>

        <Link to={overdueCasesHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk'
              ? 'Overdue deadlines (My desk)'
              : 'Overdue deadlines (All bureaus)'}
          </span>
          <span
            className="kpi-value"
            style={{
              color:
                (workloadScope === 'my_desk'
                  ? snapshot.myBureauOverdueCases.length
                  : snapshot.overdueCases.length) > 0
                  ? 'var(--danger)'
                  : undefined,
            }}
          >
            {workloadScope === 'my_desk'
              ? snapshot.myBureauOverdueCases.length
              : snapshot.overdueCases.length}
          </span>
          <span className="kpi-sub">
            {workloadScope === 'my_desk'
              ? `${snapshot.overdueCases.length} overdue across all bureaus · ${snapshot.approachingCases.length} due soon`
              : `${snapshot.myBureauOverdueCases.length} in your desk · ${snapshot.approachingCases.length} approaching due date`}
          </span>
          <span className="kpi-action">
            Open overdue queue <ArrowRight size={12} />
          </span>
        </Link>

        <Link to={approachingCasesHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk'
              ? 'Approaching deadline (My desk)'
              : 'Approaching deadline (All bureaus)'}
          </span>
          <span
            className="kpi-value"
            style={{ color: visibleApproaching.length > 0 ? 'var(--warning)' : undefined }}
          >
            {visibleApproaching.length}
          </span>
          <span className="kpi-sub">
            Inside SLA warning window · earliest due{' '}
            {visibleApproaching.length > 0
              ? formatDateDisplay(
                  [...visibleApproaching].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
                    .dueDate
                )
              : '—'}
          </span>
          <span className="kpi-action">
            Review due-soon queue <ArrowRight size={12} />
          </span>
        </Link>

        <Link to={clearanceCasesHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk'
              ? 'Pending clearance (My desk)'
              : 'Pending clearance (All bureaus)'}
          </span>
          <span
            className="kpi-value"
            style={{
              color:
                mandatoryBlockCount > 0
                  ? 'var(--danger)'
                  : snapshot.conflictDraftCount > 0
                  ? 'var(--warning)'
                  : undefined,
            }}
          >
            {visibleDraftChecks.length}
          </span>
          <span className="kpi-sub">
            {snapshot.conflictDraftCount} with conflict/duplicate warning ({mandatoryBlockCount} mandatory block)
          </span>
          <span className="kpi-action">
            Filter draft dockets <ArrowRight size={12} />
          </span>
        </Link>

        <Link to={coordinationHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk'
              ? 'Coordination alerts (My desk)'
              : 'Coordination alerts (All bureaus)'}
          </span>
          <span
            className="kpi-value"
            style={{ color: visibleAlerts.length > 0 ? 'var(--warning)' : undefined }}
          >
            {visibleAlerts.length}
          </span>
          <span className="kpi-sub">
            {workloadScope === 'my_desk'
              ? `${snapshot.openAlerts.length} active across all bureaus · ${state.evidenceVault.length} vault records`
              : `${snapshot.myBureauOpenAlerts.length} involving your desk · ${state.evidenceVault.length} shared vault records`}
          </span>
          <span className="kpi-action">
            Open alert queue <ArrowRight size={12} />
          </span>
        </Link>

        <Link to={movedCasesHref} className="kpi-card kpi-card-link">
          <span className="kpi-label">
            {workloadScope === 'my_desk'
              ? 'Transferred / escalated (My desk)'
              : 'Transferred / escalated (All bureaus)'}
          </span>
          <span className="kpi-value">{visibleMovedCases.length}</span>
          <span className="kpi-sub">
            {visibleMovedCases.filter((c) => c.status === 'Escalated').length} escalated ·{' '}
            {visibleMovedCases.filter((c) => c.sourceBureau !== c.assignedBureau).length} routed
            across bureaus
          </span>
          <span className="kpi-action">
            Open routed dockets <ArrowRight size={12} />
          </span>
        </Link>
      </div>

      {/* Case Lifecycle Summary (received / pending / under process / disposed / transferred) */}
      <div
        className="panel"
        role="navigation"
        aria-label="Case lifecycle summary"
        style={{ padding: '10px 16px' }}
      >
        <div className="row-center" style={{ flexWrap: 'wrap', gap: 20, rowGap: 8 }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Case lifecycle{workloadScope === 'my_desk' ? ` — ${currentUser.bureau}` : ' — all bureaus'}:
          </span>
          {(
            [
              ['Total received', lifecycleStats.received, `/cases?view=all${deskQuerySuffix}${instQuerySuffix}`],
              ['Pending', lifecycleStats.pending, `/cases?lifecycle=Pending${deskQuerySuffix}${instQuerySuffix}`],
              ['Under process', lifecycleStats.underProcess, `/cases?lifecycle=${encodeURIComponent('Under Process')}${deskQuerySuffix}${instQuerySuffix}`],
              ['Disposed', lifecycleStats.disposed, `/cases?lifecycle=Disposed${deskQuerySuffix}${instQuerySuffix}`],
              ['Transferred', lifecycleStats.transferred, `/cases?lifecycle=Transferred${deskQuerySuffix}${instQuerySuffix}`],
            ] as Array<[string, number, string]>
          ).map(([label, value, href]) => (
            <Link
              key={label}
              to={href}
              className="row-center link-inline"
              style={{ gap: 6, textDecoration: 'none' }}
            >
              <span className="mono font-semibold" style={{ fontSize: '1rem' }}>
                {value}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Analytics Row: Status Distribution & Bureau Workload (same underlying records) */}
      <div className="chart-pair">
        <section className="panel" aria-labelledby="status-chart-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="status-chart-heading" className="panel-title">
                Case Status Distribution
              </h2>
              <p className="panel-subtitle">
                {workloadScope === 'my_desk'
                  ? `Dockets assigned to ${currentUser.bureau}`
                  : 'All registered dockets across bureaus'}{' '}
                — click a status to open the filtered register
              </p>
            </div>
          </div>
          <div className="panel-body">
            <DonutChart
              segments={statusSegments}
              centerValue={statusSegments.reduce((acc, s) => acc + s.value, 0)}
              centerLabel="Total cases in scope"
            />
          </div>
        </section>

        <section className="panel" aria-labelledby="bureau-chart-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="bureau-chart-heading" className="panel-title">
                Bureau-Wise Active Workload
              </h2>
              <p className="panel-subtitle">
                Active dockets per bureau / cell as of {state.demoDate} — click a bar to open that
                bureau&apos;s queue
              </p>
            </div>
          </div>
          <div className="panel-body">
            <HBarChart rows={bureauWorkloadRows} emptyLabel="No active dockets in scope" />
          </div>
        </section>
      </div>

      {/* 2. Prominent Operational Workflow: Pre-Dispatch Action Clearance Queue */}
      <section className="panel" id="pre-dispatch-queue" aria-labelledby="clearance-heading">
        <div className="panel-header">
          <div className="panel-title-group">
            <h2 id="clearance-heading" className="panel-title">
              <ShieldAlert size={16} className="text-accent" />
              Pre-Dispatch Action Clearance ({visibleDraftChecks.length} Draft{' '}
              {visibleDraftChecks.length === 1 ? 'Check' : 'Checks'})
            </h2>
            <p className="panel-subtitle">
              Synchronous rules gate (<span className="mono">{CLEARANCE_RULE_VERSION}</span>) verifying duplicate institutional demands and confidential inspection schedules before dispatch
            </p>
          </div>
          <div className="row-center" style={{ flexWrap: 'wrap' }}>
            <Link to="/evidence" className="btn btn-secondary btn-sm">
              Shared Evidence Vault ({state.evidenceVault.length})
            </Link>
            <Link to="/cases/CL-2026-0125" className="btn btn-secondary btn-sm">
              Plan New Action <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {visibleDraftChecks.length === 0 ? (
          <div className="panel-body">
            <div className="row-center" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className="text-sm text-secondary">
                No queued draft actions match the active desk/institution filter ({snapshot.draftClearanceQueue.length} pending across all bureaus).
              </span>
              {workloadScope === 'my_desk' && snapshot.draftClearanceQueue.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setWorkloadScope('all')}
                >
                  Show all {snapshot.draftClearanceQueue.length} bureau drafts
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Draft &amp; Case</th>
                  <th>Planned Action &amp; Institution</th>
                  <th>Originating Desk</th>
                  <th>Target Window</th>
                  <th>Clearance Gate Result</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleDraftChecks.map((item) => {
                  const f = item.primaryFinding;
                  return (
                    <tr key={item.action.id}>
                      <td className="mono">
                        <div className="font-semibold">{item.action.id}</div>
                        <Link to={`/cases/${item.action.caseId}`} className="link-inline text-xs">
                          {item.action.caseId}
                        </Link>
                      </td>
                      <td>
                        <div className="font-semibold">{item.action.actionType}</div>
                        <div className="text-xs text-secondary line-clamp-1">{item.action.purpose}</div>
                        <div className="text-xs text-muted">
                          <Link
                            to={`/institutions/${item.action.institutionId}`}
                            className="link-inline mono"
                          >
                            {item.action.institutionId}
                          </Link>{' '}
                          · {item.institution?.name ?? item.action.institutionId}
                        </div>
                      </td>
                      <td className="text-xs">{item.action.bureau}</td>
                      <td className="mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                        {item.action.scheduledStart}
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <div className="row-center" style={{ flexWrap: 'wrap', gap: 5 }}>
                          {f.severity === 'Mandatory Clearance Required' ? (
                            <span className="badge badge-critical">Mandatory clearance block</span>
                          ) : f.outcomeKind === 'DUPLICATE_EVIDENCE_REQUEST' ? (
                            <span className="badge badge-warning">
                              Duplicate demand ({f.daysSincePriorRequest ?? 9}d ago)
                            </span>
                          ) : (
                            <span className="badge badge-success">Clear to proceed</span>
                          )}
                          <span className="mono text-xs text-muted">{f.ruleCode}</span>
                        </div>
                        <div className="text-xs text-secondary line-clamp-1 mt-1">
                          {f.explanation}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className={
                            f.severity === 'Mandatory Clearance Required'
                              ? 'btn btn-danger btn-sm'
                              : 'btn btn-secondary btn-sm'
                          }
                          onClick={() => {
                            setClearanceFeedback(null);
                            setOverrideReason('');
                            setSelectedDraftActionId(item.action.id);
                          }}
                        >
                          Review check
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4 & 5. Two-Column Operational Split: Refined Case Queue + Compact Prioritised Coordination List */}
      <div className="detail-grid">
        {/* Left Column: Priority Case Queue */}
        <section className="panel" aria-labelledby="case-queue-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="case-queue-heading" className="panel-title">
                Priority Case Queue ({prioritizedCases.length})
              </h2>
              <p className="panel-subtitle">
                {workloadScope === 'my_desk'
                  ? `Active dockets assigned to ${currentUser.bureau}`
                  : 'Active dockets across all bureaus — sort by deadline, priority, or status'}
              </p>
            </div>
            <Link to={activeCasesHref} className="btn btn-secondary btn-sm">
              Full register ({prioritizedCases.length}) <ArrowRight size={13} />
            </Link>
          </div>

          {displayCases.length === 0 ? (
            <div className="empty-state">
              <strong>No active cases assigned to this filter scope</strong>
              <span className="text-xs text-muted">
                Switch scope back to All bureaus ({snapshot.activeCases.length}) or clear the institution filter.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort('id')}
                      >
                        Case ID {renderSortIcon('id')}
                      </button>
                    </th>
                    <th>Subject &amp; Institution</th>
                    <th>Assigned Desk</th>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort('priority')}
                      >
                        Priority {renderSortIcon('priority')}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort('status')}
                      >
                        Status {renderSortIcon('status')}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort('dueDate')}
                      >
                        Deadline &amp; SLA {renderSortIcon('dueDate')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayCases.map((c) => {
                    const inst = state.institutions.find((i) => i.id === c.institutionId);
                    const sla = getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules);
                    const readable = hasFullCaseReadAccess(
                      currentUser,
                      c,
                      state.accessRequests,
                      state.demoDate
                    );
                    const isOverdue = sla.status === 'Overdue';
                    const isMyDesk = c.assignedBureau === currentUser.bureau;

                    return (
                      <tr key={c.id} className={isOverdue ? 'row-overdue' : undefined}>
                        <td className="mono font-semibold">
                          <Link to={`/cases/${c.id}`} className="link-inline">
                            {c.id}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`/cases/${c.id}`}
                            className="font-semibold subject-clamp"
                            style={{ color: 'var(--ink-primary)' }}
                          >
                            {readable
                              ? c.subject
                              : `[Restricted Stub] ${c.coarseCategoryLabel ?? 'Bureau Scoped Inquiry'}`}
                          </Link>
                          <div className="text-xs text-muted mt-1 line-clamp-1">
                            <Link
                              to={`/institutions/${c.institutionId}`}
                              className="link-inline mono"
                            >
                              {c.institutionId}
                            </Link>{' '}
                            · {inst?.name ?? c.institutionId} ·{' '}
                            {readable ? c.category : 'Restricted scope'}
                          </div>
                        </td>
                        <td className="text-xs">
                          <div>{c.assignedBureau}</div>
                          {isMyDesk && (
                            <span className="badge badge-info mt-1" style={{ fontSize: 11, padding: '1px 6px' }}>
                              Your desk
                            </span>
                          )}
                        </td>
                        <td>
                          <PriorityBadge priority={c.priority} />
                        </td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div className="mono text-xs mb-2">{formatDateDisplay(c.dueDate)}</div>
                          <SlaBadge status={sla.status} label={sla.label} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Column: Compact Prioritised Coordination List */}
        <section className="panel" aria-labelledby="coord-list-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="coord-list-heading" className="panel-title">
                Coordination Alerts ({visibleAlerts.length})
              </h2>
              <p className="panel-subtitle">
                Prioritised cross-bureau links — open drawer to inspect facts &amp; act
              </p>
            </div>
            <Link to={coordinationHref} className="btn btn-secondary btn-sm">
              All alerts <ArrowRight size={13} />
            </Link>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="empty-state">
              <strong>No active coordination alerts in this scope</strong>
              {workloadScope === 'my_desk' && snapshot.openAlerts.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setWorkloadScope('all')}
                >
                  View all {snapshot.openAlerts.length} bureau alerts
                </button>
              )}
            </div>
          ) : (
            <div className="panel-body flush">
              <div className="compact-queue-list">
                {visibleAlerts.map((alert) => {
                  const inst = state.institutions.find((i) => i.id === alert.institutionId);
                  const reasonSummary =
                    alert.triggeredConditions[0] ?? alert.title;
                  return (
                    <div key={alert.id} className="compact-queue-item">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <TaxonomyBadge taxonomy={alert.taxonomy} />
                          <AlertStatusBadge status={alert.status} />
                        </div>
                        <div className="font-semibold text-sm mt-1 line-clamp-1">
                          {inst?.name ?? alert.institutionId}{' '}
                          <span className="mono text-xs text-muted">({alert.institutionId})</span>
                        </div>
                        <div className="text-xs text-secondary line-clamp-1 mt-1">
                          {reasonSummary}
                        </div>
                        <div className="text-xs text-muted mono mt-1">
                          {alert.id} · {alert.involvedCaseIds.length} linked cases
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ flexShrink: 0, alignSelf: 'center' }}
                        onClick={() => {
                          setAlertFeedback(null);
                          setAlertNote('');
                          setSelectedAlertId(alert.id);
                        }}
                      >
                        Review
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Row: Recent Case Activity & Upcoming Deadlines */}
      <div className="chart-pair">
        <section className="panel" aria-labelledby="recent-activity-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="recent-activity-heading" className="panel-title">
                Recent Case Activity
              </h2>
              <p className="panel-subtitle">Latest recorded events across the scoped register</p>
            </div>
            <Link to="/reports" className="btn btn-secondary btn-sm">
              Full audit trail <ArrowRight size={12} />
            </Link>
          </div>
          <div className="panel-body stack-sm">
            {recentActivity.map((ev) => (
              <div
                key={ev.key}
                className="row-center"
                style={{ alignItems: 'flex-start', gap: 10 }}
              >
                <span className="mono text-xs text-muted" style={{ whiteSpace: 'nowrap', paddingTop: 2 }}>
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
                    {ev.type} · {ev.actor}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="deadlines-heading">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 id="deadlines-heading" className="panel-title">
                Upcoming Deadlines
              </h2>
              <p className="panel-subtitle">Next statutory due dates in the scoped register</p>
            </div>
            <Link to={approachingCasesHref} className="btn btn-secondary btn-sm">
              Due-soon queue <ArrowRight size={12} />
            </Link>
          </div>
          <div className="panel-body stack-sm">
            {upcomingDeadlines.map((c) => (
              <div key={c.id} className="split-row" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    className="text-sm"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    <Link to={`/cases/${c.id}`} className="link-inline mono">
                      {c.id}
                    </Link>{' '}
                    — {c.subject}
                  </div>
                  <div className="text-xs text-muted">
                    {c.assignedBureau} · due {formatDateDisplay(c.dueDate)}
                  </div>
                </div>
                <SlaBadge
                  caseRecord={c}
                  demoToday={state.demoDate}
                  deadlineRules={state.settings.deadlineRules}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Pre-Dispatch Clearance Detail & Action Drawer */}
      <Drawer
        open={Boolean(activeDraftItem)}
        title={
          activeDraftItem
            ? `Pre-Dispatch Clearance — ${activeDraftItem.action.id}`
            : 'Pre-Dispatch Clearance'
        }
        subtitle={
          activeDraftItem
            ? `${activeDraftItem.action.actionType} on ${activeDraftItem.action.caseId} (${activeDraftItem.institution?.name ?? activeDraftItem.action.institutionId})`
            : undefined
        }
        onClose={() => setSelectedDraftActionId(null)}
        footer={
          activeDraftItem ? (
            <>
              <Link
                to={`/cases/${activeDraftItem.action.caseId}`}
                className="btn btn-secondary"
                onClick={() => setSelectedDraftActionId(null)}
              >
                Open Case {activeDraftItem.action.caseId}
              </Link>
              {activeDraftItem.primaryFinding.reusableArtifactId && canWrite && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    handleVaultReuseFromDrawer(
                      activeDraftItem.primaryFinding.reusableArtifactId!
                    )
                  }
                >
                  <FileCheck2 size={14} /> Reuse Vault{' '}
                  {activeDraftItem.primaryFinding.reusableArtifactId}
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  className={
                    activeDraftItem.isMandatoryBlock ? 'btn btn-danger' : 'btn btn-primary'
                  }
                  onClick={handleDispatchFromDrawer}
                >
                  {activeDraftItem.isMandatoryBlock
                    ? 'Authorise Override & Issue'
                    : 'Issue Action'}
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {activeDraftItem && (
          <div className="stack-md">
            {clearanceFeedback && (
              <div className="alert-banner critical">
                <AlertTriangle size={15} />
                <div>{clearanceFeedback}</div>
              </div>
            )}

            <div className="kv-grid">
              <div className="kv-item">
                <span className="kv-label">Originating Bureau</span>
                <span className="kv-value">{activeDraftItem.action.bureau}</span>
              </div>
              <div className="kv-item">
                <span className="kv-label">Scheduled Window</span>
                <span className="kv-value mono">
                  {activeDraftItem.action.scheduledStart} → {activeDraftItem.action.scheduledEnd}
                </span>
              </div>
              <div className="kv-item">
                <span className="kv-label">Scope</span>
                <span className="kv-value">{activeDraftItem.action.scope}</span>
              </div>
              <div className="kv-item">
                <span className="kv-label">Requested Evidence</span>
                <span className="kv-value">
                  {activeDraftItem.action.requestedEvidenceType ?? 'Administrative response'}
                </span>
              </div>
            </div>

            {activeDraftItem.findings.map((f) => (
              <div
                key={f.id}
                className={`callout ${
                  f.severity === 'Mandatory Clearance Required'
                    ? 'critical'
                    : f.outcomeKind === 'DUPLICATE_EVIDENCE_REQUEST'
                    ? 'warning'
                    : 'info'
                }`}
              >
                <div className="split-row">
                  <strong>{f.headline}</strong>
                  <span className="mono text-xs">{f.ruleCode}</span>
                </div>
                <p style={{ margin: 0 }}>{f.explanation}</p>
                <div className="text-xs">
                  <strong>Recommended resolution:</strong> {f.recommendedNextStep}
                </div>
                {f.artifactAvailability && (
                  <div className="text-xs">
                    <strong>Shared Vault status:</strong> {f.artifactAvailability}
                  </div>
                )}
              </div>
            ))}

            {activeDraftItem.isMandatoryBlock && (
              <div className="field-group">
                <label htmlFor="drawer-override-reason" className="field-label">
                  Senior Review / Cross-Bureau Coordinator Override Rationale *
                </label>
                <textarea
                  id="drawer-override-reason"
                  className="field-textarea"
                  rows={3}
                  placeholder="Document statutory justification (minimum 10 characters). Standard Bureau Case Officers are blocked from overriding..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <span className="field-hint">
                  Active role: <strong>{currentUser.role}</strong>. Override events are permanently logged in Reports &amp; Audit.
                </span>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Coordination Alert Supporting Details & Review Drawer */}
      <Drawer
        open={Boolean(activeReviewAlert)}
        title={
          activeReviewAlert
            ? `Coordination Review — ${activeReviewAlert.id}`
            : 'Coordination Review'
        }
        subtitle={activeReviewAlert?.title}
        onClose={() => setSelectedAlertId(null)}
        footer={
          activeReviewAlert ? (
            <>
              <Link
                to={`/coordination?alert=${activeReviewAlert.id}`}
                className="btn btn-secondary"
                onClick={() => setSelectedAlertId(null)}
              >
                <GitCompareArrows size={14} /> Open Full Workspace
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedAlertId(null)}
              >
                Done
              </button>
            </>
          ) : undefined
        }
      >
        {activeReviewAlert && (
          <div className="stack-md">
            {alertFeedback && (
              <div className="alert-banner info">
                <CheckCircle2 size={15} />
                <div>{alertFeedback}</div>
              </div>
            )}

            <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
              <TaxonomyBadge taxonomy={activeReviewAlert.taxonomy} />
              <AlertStatusBadge status={activeReviewAlert.status} />
              <SourceBasisBadge basis={activeReviewAlert.detectionSource} />
              <span className="mono text-xs text-muted">
                Rule: {activeReviewAlert.ruleCode} ({activeReviewAlert.ruleVersion})
              </span>
            </div>

            <div className="callout">
              <strong>Triggered Rule Conditions</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {activeReviewAlert.triggeredConditions.map((cond, idx) => (
                  <li key={idx}>{cond}</li>
                ))}
              </ul>
            </div>

            {activeReviewAlert.verifiedFacts && activeReviewAlert.verifiedFacts.length > 0 && (
              <div className="callout info">
                <strong>Verified Documentary Facts</strong>
                <p style={{ margin: 0 }}>{activeReviewAlert.verifiedFacts.join(' ')}</p>
              </div>
            )}

            {activeReviewAlert.hypothesisedNote && (
              <div className="callout warning">
                <strong>Hypothesised Causal Link (Separated from Verified Fact)</strong>
                <p style={{ margin: 0 }}>{activeReviewAlert.hypothesisedNote}</p>
              </div>
            )}

            <div>
              <div className="field-label mb-2">Linked Cases &amp; Vault Records</div>
              <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                {activeReviewAlert.involvedCaseIds.map((cid) => (
                  <Link
                    key={cid}
                    to={`/cases/${cid}`}
                    className="btn btn-secondary btn-sm mono"
                    onClick={() => setSelectedAlertId(null)}
                  >
                    {cid}
                  </Link>
                ))}
                {activeReviewAlert.supportingArtifactIds?.map((aid) => (
                  <Link
                    key={aid}
                    to={`/evidence?artifact=${aid}`}
                    className="btn btn-secondary btn-sm mono"
                    onClick={() => setSelectedAlertId(null)}
                  >
                    Vault {aid}
                  </Link>
                ))}
              </div>
            </div>

            {canWrite && (
              <div
                className="stack-sm"
                style={{
                  padding: 12,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <label htmlFor="quick-alert-note" className="field-label">
                  Coordinator Decision / Suppression Note
                </label>
                <input
                  id="quick-alert-note"
                  type="text"
                  className="field-input"
                  placeholder="Record rationale for coordination or Verified Independent suppression..."
                  value={alertNote}
                  onChange={(e) => setAlertNote(e.target.value)}
                />
                <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleQuickAlertAction('Coordinating', 'Decision')}
                  >
                    <CheckCircle2 size={13} /> Confirm Coordination
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuickAlertAction('In review', 'Discussion')}
                  >
                    Log Comment
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleQuickSuppress}
                  >
                    <Slash size={13} /> Suppress (Verified Independent)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
