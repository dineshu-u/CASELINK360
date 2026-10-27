import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { ALL_BUREAUS } from '../data/seedData';
import {
  exportAuditLogToCsv,
  exportCasesToCsv,
  getCaseSlaStatus,
  isTerminalCaseStatus,
} from '../services/caseService';
import {
  BUREAU_CHART_COLORS,
  DonutChart,
  HBarChart,
  STATUS_CHART_COLORS,
} from '../components/ui/Charts';
import { CaseStatus } from '../types/domain';

export const ReportsAuditPage: React.FC = () => {
  const { state, currentUser } = useAppState();
  const [bureauFilter, setBureauFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [reportBureau, setReportBureau] = useState('All');

  const bureauMetrics = useMemo(() => {
    return ALL_BUREAUS.map((bureau) => {
      const bCases = state.cases.filter((c) => c.assignedBureau === bureau);
      const open = bCases.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed');
      const overdue = open.filter(
        (c) => getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status === 'Overdue'
      );
      const alerts = state.alerts.filter(
        (al) =>
          al.involvedBureaus.includes(bureau) &&
          al.status !== 'Resolved' &&
          al.status !== 'Dismissed'
      );
      return {
        bureau,
        total: bCases.length,
        open: open.length,
        overdue: overdue.length,
        resolved: bCases.length - open.length,
        alerts: alerts.length,
      };
    });
  }, [state.cases, state.alerts, state.demoDate, state.settings.deadlineRules]);

  // Case register scoped by the report bureau filter — powers charts, tables, and CSV export
  const reportCases = useMemo(
    () =>
      reportBureau === 'All'
        ? state.cases
        : state.cases.filter((c) => c.assignedBureau === reportBureau),
    [state.cases, reportBureau]
  );

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
        value: reportCases.filter((c) => c.status === status).length,
        color: STATUS_CHART_COLORS[status],
        to: `/cases?status=${encodeURIComponent(status)}${
          reportBureau !== 'All' ? `&assignedBureau=${encodeURIComponent(reportBureau)}` : ''
        }`,
      }))
      .filter((s) => s.value > 0);
  }, [reportCases, reportBureau]);

  const bureauChartRows = useMemo(
    () =>
      bureauMetrics
        .filter((m) => m.total > 0)
        .map((m, idx) => ({
          label: m.bureau,
          value: m.open,
          color: BUREAU_CHART_COLORS[idx % BUREAU_CHART_COLORS.length],
          to: `/cases?scope=active&assignedBureau=${encodeURIComponent(m.bureau)}`,
          sub: `${m.total} total · ${m.overdue} overdue · ${m.resolved} resolved`,
        }))
        .sort((a, b) => b.value - a.value),
    [bureauMetrics]
  );

  const institutionMetrics = useMemo(() => {
    return state.institutions
      .map((inst) => {
        const rows = reportCases.filter((c) => c.institutionId === inst.id);
        const active = rows.filter((c) => !isTerminalCaseStatus(c.status));
        const overdue = active.filter(
          (c) =>
            getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status === 'Overdue'
        );
        const alerts = state.alerts.filter(
          (al) =>
            al.institutionId === inst.id && al.status !== 'Resolved' && al.status !== 'Dismissed'
        );
        return {
          inst,
          total: rows.length,
          active: active.length,
          overdue: overdue.length,
          disposed: rows.length - active.length,
          alerts: alerts.length,
        };
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [state.institutions, reportCases, state.alerts, state.demoDate, state.settings.deadlineRules]);

  const regionMetrics = useMemo(() => {
    const regions = Array.from(new Set(state.institutions.map((i) => i.region)));
    return regions
      .map((region) => {
        const instIds = new Set(
          state.institutions.filter((i) => i.region === region).map((i) => i.id)
        );
        const rows = reportCases.filter((c) => instIds.has(c.institutionId));
        const active = rows.filter((c) => !isTerminalCaseStatus(c.status));
        const overdue = active.filter(
          (c) =>
            getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status === 'Overdue'
        );
        const alerts = state.alerts.filter(
          (al) =>
            instIds.has(al.institutionId) &&
            al.status !== 'Resolved' &&
            al.status !== 'Dismissed'
        );
        return {
          region,
          institutionsWithCases: new Set(rows.map((c) => c.institutionId)).size,
          total: rows.length,
          active: active.length,
          overdue: overdue.length,
          disposed: rows.length - active.length,
          alerts: alerts.length,
        };
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [state.institutions, reportCases, state.alerts, state.demoDate, state.settings.deadlineRules]);

  const flowStats = useMemo(() => {
    const escalated = state.cases.filter((c) => c.status === 'Escalated');
    const transferred = state.cases.filter((c) => c.sourceBureau !== c.assignedBureau);
    const relationDecisions = state.alerts.filter(
      (a) => a.status === 'Coordinating' || a.status === 'Resolved'
    );
    const pendingReviews = state.alerts.filter(
      (a) => a.status === 'Needs review' || a.status === 'In review'
    );
    const taxonomyCounts = new Map<string, number>();
    state.alerts.forEach((a) => {
      taxonomyCounts.set(a.taxonomy, (taxonomyCounts.get(a.taxonomy) ?? 0) + 1);
    });
    return {
      escalated: escalated.length,
      transferred: transferred.length,
      relationDecisions: relationDecisions.length,
      pendingReviews: pendingReviews.length,
      suppressions: state.suppressions.filter((s) => s.active).length,
      taxonomyRows: Array.from(taxonomyCounts.entries())
        .map(([label, value], idx) => ({
          label,
          value,
          color: BUREAU_CHART_COLORS[idx % BUREAU_CHART_COLORS.length],
          to: '/coordination',
        }))
        .sort((a, b) => b.value - a.value),
    };
  }, [state.cases, state.alerts, state.suppressions]);

  const handleDownloadCaseCsv = () => {
    const csv = exportCasesToCsv(
      reportCases,
      state.institutions,
      state.demoDate,
      state.settings.deadlineRules,
      {
        currentUser,
        accessRequests: state.accessRequests,
        demoDate: state.demoDate,
      }
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caselink360-case-report-${state.demoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAudit = useMemo(() => {
    return state.auditLog.filter((entry) => {
      if (bureauFilter !== 'All' && entry.actorBureau !== bureauFilter) return false;
      if (actionFilter !== 'All' && entry.actionType !== actionFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        entry.entityId.toLowerCase().includes(q) ||
        entry.actorName.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q)
      );
    });
  }, [state.auditLog, bureauFilter, actionFilter, search]);

  const handleDownloadAuditCsv = () => {
    const csv = exportAuditLogToCsv(filteredAudit);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caselink360-audit-log-${state.demoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Operational Reports &amp; Immutable Audit Register</h1>
          <p className="page-subtitle">
            Tracks Pre-Dispatch Clearance decisions, Senior Overrides, Scoped Access grants/revocations, Vault certifications, and Negative Memory suppressions
          </p>
        </div>
        <div className="page-actions">
          <select
            className="field-select"
            aria-label="Scope report to a bureau"
            value={reportBureau}
            onChange={(e) => setReportBureau(e.target.value)}
            style={{ height: 34, maxWidth: 280 }}
          >
            <option value="All">All Bureaus</option>
            {ALL_BUREAUS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={15} />
            Print Report View
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDownloadCaseCsv}>
            <Download size={15} />
            Export Case Report CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={handleDownloadAuditCsv}>
            <Download size={15} />
            Export Audit CSV
          </button>
        </div>
      </div>

      {/* Analytics Charts — computed from the same case register records */}
      <div className="chart-pair">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Status-Wise Distribution</h2>
              <p className="text-xs text-muted">
                {reportBureau === 'All' ? 'All bureaus' : reportBureau} · {reportCases.length}{' '}
                registered dockets
              </p>
            </div>
          </div>
          <div className="panel-body">
            <DonutChart
              segments={statusSegments}
              centerValue={reportCases.length}
              centerLabel="Cases in report scope"
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Bureau-Wise Active Workload</h2>
              <p className="text-xs text-muted">
                Active open dockets per bureau / cell as of {state.demoDate}
              </p>
            </div>
          </div>
          <div className="panel-body">
            <HBarChart rows={bureauChartRows} emptyLabel="No active dockets recorded" />
          </div>
        </div>
      </div>

      {/* Transfer, Escalation & Cross-Bureau Relationship Statistics */}
      <div className="chart-pair">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Transfer &amp; Escalation Statistics</h2>
              <p className="text-xs text-muted">Docket movement across the register</p>
            </div>
          </div>
          <div className="panel-body stack-sm">
            <div className="split-row">
              <span className="text-sm">Dockets routed across bureaus (transfers)</span>
              <Link to="/cases?scope=active&flow=moved" className="mono font-semibold link-inline">
                {flowStats.transferred}
              </Link>
            </div>
            <div className="split-row">
              <span className="text-sm">Currently escalated dockets</span>
              <Link to="/cases?status=Escalated" className="mono font-semibold link-inline">
                {flowStats.escalated}
              </Link>
            </div>
            <div className="split-row">
              <span className="text-sm">Relationship decisions recorded</span>
              <Link to="/coordination" className="mono font-semibold link-inline">
                {flowStats.relationDecisions}
              </Link>
            </div>
            <div className="split-row">
              <span className="text-sm">Relationship reviews still pending</span>
              <Link to="/coordination?status=Active" className="mono font-semibold link-inline">
                {flowStats.pendingReviews}
              </Link>
            </div>
            <div className="split-row">
              <span className="text-sm">Verified-independent suppressions in force</span>
              <Link to="/coordination" className="mono font-semibold link-inline">
                {flowStats.suppressions}
              </Link>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Cross-Bureau Relationship Taxonomy</h2>
              <p className="text-xs text-muted">
                Classification of detected relationships across bureaus
              </p>
            </div>
          </div>
          <div className="panel-body">
            <HBarChart rows={flowStats.taxonomyRows} emptyLabel="No relationship records" />
          </div>
        </div>
      </div>

      {/* Institution-Wise Complaint Report */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Institution-Wise Complaint Report</h2>
            <p className="text-xs text-muted">
              Consolidated counts per institution{' '}
              {reportBureau !== 'All' ? `· scoped to ${reportBureau}` : '· all bureaus'}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Type &amp; Region</th>
                <th>Total</th>
                <th>Active</th>
                <th>Overdue</th>
                <th>Disposed</th>
                <th>Open Alerts</th>
              </tr>
            </thead>
            <tbody>
              {institutionMetrics.map((m) => (
                <tr key={m.inst.id}>
                  <td>
                    <Link to={`/institutions/${m.inst.id}`} className="link-inline font-semibold">
                      {m.inst.name}
                    </Link>
                    <div className="mono text-xs text-muted">{m.inst.id}</div>
                  </td>
                  <td className="text-xs text-secondary">
                    {m.inst.type}
                    <div>{m.inst.region} Region</div>
                  </td>
                  <td className="mono">{m.total}</td>
                  <td className="mono">{m.active}</td>
                  <td className="mono">
                    {m.overdue > 0 ? (
                      <span className="badge badge-critical">{m.overdue}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="mono">{m.disposed}</td>
                  <td className="mono">
                    {m.alerts > 0 ? (
                      <span className="badge badge-warning">{m.alerts}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Region-Wise Complaint Report */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Region-Wise Complaint Report</h2>
            <p className="text-xs text-muted">
              Consolidated counts per AICTE region{' '}
              {reportBureau !== 'All' ? `· scoped to ${reportBureau}` : '· all bureaus'}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Institutions With Cases</th>
                <th>Total</th>
                <th>Active</th>
                <th>Overdue</th>
                <th>Disposed</th>
                <th>Open Alerts</th>
              </tr>
            </thead>
            <tbody>
              {regionMetrics.map((m) => (
                <tr key={m.region}>
                  <td>
                    <Link
                      to={`/cases?region=${encodeURIComponent(m.region)}`}
                      className="link-inline font-semibold"
                    >
                      {m.region} Region
                    </Link>
                  </td>
                  <td className="mono">{m.institutionsWithCases}</td>
                  <td className="mono">{m.total}</td>
                  <td className="mono">{m.active}</td>
                  <td className="mono">
                    {m.overdue > 0 ? (
                      <span className="badge badge-critical">{m.overdue}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="mono">{m.disposed}</td>
                  <td className="mono">
                    {m.alerts > 0 ? (
                      <span className="badge badge-warning">{m.alerts}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bureau Summary Table */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Bureau Workload &amp; SLA Compliance Summary</h2>
            <p className="text-xs text-muted">Computed deterministically as of {state.demoDate}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bureau / Cell</th>
                <th>Total Cases</th>
                <th>Active Open</th>
                <th>Overdue SLA</th>
                <th>Resolved / Closed</th>
                <th>Active Coordination Alerts</th>
              </tr>
            </thead>
            <tbody>
              {bureauMetrics.map((m) => (
                <tr key={m.bureau}>
                  <td className="font-semibold">{m.bureau}</td>
                  <td className="mono">{m.total}</td>
                  <td className="mono">{m.open}</td>
                  <td className="mono">
                    {m.overdue > 0 ? (
                      <span className="badge badge-critical">{m.overdue} overdue</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="mono">{m.resolved}</td>
                  <td className="mono">{m.alerts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Audit Trail ({filteredAudit.length} Events)</h2>
            <p className="text-xs text-muted">
              Every action clearance, override, scoped access grant, vault verification, and taxonomy decision records actor, role, and state change
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="search"
            className="field-input search-wide"
            placeholder="Filter by Entity ID (REQ-2026-01, EVD-2026-01, SUP-2026-01), actor, or text..."
            aria-label="Search audit log"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-select"
            aria-label="Filter audit log by bureau"
            value={bureauFilter}
            onChange={(e) => setBureauFilter(e.target.value)}
          >
            <option value="All">All Bureaus</option>
            {ALL_BUREAUS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            className="field-select"
            aria-label="Filter audit log by action type"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="All">All Event Types</option>
            <option value="Pre-Dispatch Check">Pre-Dispatch Check</option>
            <option value="Clearance Override">Clearance Override</option>
            <option value="Access Requested">Access Requested</option>
            <option value="Access Updated">Access Updated</option>
            <option value="Evidence Submitted">Evidence Submitted</option>
            <option value="Evidence Verified">Evidence Verified</option>
            <option value="Evidence Linked">Evidence Linked</option>
            <option value="Taxonomy Classified">Taxonomy Classified</option>
            <option value="Alert Suppressed">Alert Suppressed</option>
            <option value="Suppression Reopened">Suppression Reopened</option>
            <option value="Case Created">Case Created</option>
            <option value="Status Changed">Status Changed</option>
            <option value="Settings Modified">Settings Modified</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor &amp; Role</th>
                <th>Event Type</th>
                <th>Entity</th>
                <th>Action Summary &amp; State Delta</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                    {entry.timestamp}
                  </td>
                  <td>
                    <div className="font-semibold">{entry.actorName}</div>
                    <div className="text-xs text-muted">
                      {entry.actorBureau} ({entry.actorRole})
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        entry.actionType === 'Clearance Override'
                          ? 'badge-critical'
                          : 'badge-neutral'
                      }`}
                    >
                      {entry.actionType}
                    </span>
                  </td>
                  <td className="mono font-semibold text-xs">{entry.entityId}</td>
                  <td>
                    <div>{entry.summary}</div>
                    {(entry.previousValue || entry.newValue) && (
                      <div className="text-xs text-muted mono mt-1">
                        {entry.previousValue ? `${entry.previousValue} → ` : ''}
                        {entry.newValue}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
