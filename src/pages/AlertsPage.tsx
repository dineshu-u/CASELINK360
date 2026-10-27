import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCheck, Inbox } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import {
  daysUntilDue,
  formatDateDisplay,
  getOperationalSnapshot,
  isTerminalCaseStatus,
} from '../services/caseService';

type FeedSeverity = 'critical' | 'warning' | 'info';

type FeedCategory =
  | 'Inbox'
  | 'Overdue Case'
  | 'Deadline Approaching'
  | 'Related-Case Review'
  | 'Coordination Decision Pending'
  | 'Transfer / Escalation'
  | 'Clearance Hold';

interface FeedItem {
  id: string;
  category: FeedCategory;
  severity: FeedSeverity;
  title: string;
  body: string;
  metaLeft: string;
  metaRight?: string;
  linkTo: string;
  unread: boolean;
  inboxId?: string;
  sortKey: number;
}

const SEVERITY_RANK: Record<FeedSeverity, number> = { critical: 0, warning: 1, info: 2 };

const CATEGORY_OPTIONS: FeedCategory[] = [
  'Inbox',
  'Overdue Case',
  'Deadline Approaching',
  'Related-Case Review',
  'Coordination Decision Pending',
  'Transfer / Escalation',
  'Clearance Hold',
];

export const AlertsPage: React.FC = () => {
  const { state, currentUser, markNotificationRead, markAllNotificationsRead } = useAppState();
  const navigate = useNavigate();

  const [severityFilter, setSeverityFilter] = useState<'All' | FeedSeverity>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | FeedCategory>('All');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const snapshot = useMemo(
    () => getOperationalSnapshot(state, currentUser),
    [state, currentUser]
  );

  const feed = useMemo<FeedItem[]>(() => {
    const instName = (id: string) =>
      state.institutions.find((i) => i.id === id)?.name ?? id;
    const items: FeedItem[] = [];

    // 1. Notification inbox (explicit routed notifications)
    state.notifications.forEach((n) => {
      items.push({
        id: `inbox-${n.id}`,
        category: 'Inbox',
        severity: n.severity === 'critical' ? 'critical' : n.severity === 'warning' ? 'warning' : 'info',
        title: n.title,
        body: n.body,
        metaLeft: n.timestamp,
        linkTo: n.linkTo,
        unread: !n.read,
        inboxId: n.id,
        sortKey: 0,
      });
    });

    // 2. Overdue cases
    snapshot.overdueCases.forEach((c) => {
      const overdueDays = Math.abs(daysUntilDue(c.dueDate, state.demoDate));
      items.push({
        id: `ovd-${c.id}`,
        category: 'Overdue Case',
        severity: 'critical',
        title: `Overdue by ${overdueDays}d — ${c.id}: ${c.subject}`,
        body: `${instName(c.institutionId)} · ${c.assignedBureau} · Priority ${c.priority}`,
        metaLeft: `Due ${formatDateDisplay(c.dueDate)}`,
        metaRight: c.status,
        linkTo: `/cases/${c.id}`,
        unread: false,
        sortKey: overdueDays * -1,
      });
    });

    // 3. Approaching deadlines
    snapshot.approachingCases.forEach((c) => {
      const dueIn = daysUntilDue(c.dueDate, state.demoDate);
      items.push({
        id: `app-${c.id}`,
        category: 'Deadline Approaching',
        severity: 'warning',
        title: `Due in ${dueIn}d — ${c.id}: ${c.subject}`,
        body: `${instName(c.institutionId)} · ${c.assignedBureau} · Priority ${c.priority}`,
        metaLeft: `Due ${formatDateDisplay(c.dueDate)}`,
        metaRight: c.status,
        linkTo: `/cases/${c.id}`,
        unread: false,
        sortKey: dueIn,
      });
    });

    // 4. Related-case / coordination review alerts
    state.alerts
      .filter((a) => a.status === 'Needs review' || a.status === 'In review')
      .forEach((a) => {
        items.push({
          id: `crd-${a.id}`,
          category: 'Related-Case Review',
          severity: 'warning',
          title: `Potentially related cases — ${a.id}: ${a.title}`,
          body: `${instName(a.institutionId)} · Cases ${a.involvedCaseIds.join(', ')} · Rule ${a.ruleCode}`,
          metaLeft: `Detected ${formatDateDisplay(a.detectedDate)}`,
          metaRight: a.status,
          linkTo: `/coordination?alert=${a.id}`,
          unread: false,
          sortKey: 0,
        });
      });

    // 5. Pending coordination decisions (alerts in active coordination + pending access requests)
    state.alerts
      .filter((a) => a.status === 'Coordinating')
      .forEach((a) => {
        items.push({
          id: `dec-${a.id}`,
          category: 'Coordination Decision Pending',
          severity: 'info',
          title: `Coordination in progress — ${a.id}: ${a.title}`,
          body: `${a.involvedBureaus.join(' + ')} · ${a.recommendedNextStep}`,
          metaLeft: `Detected ${formatDateDisplay(a.detectedDate)}`,
          metaRight: a.taxonomy,
          linkTo: `/coordination?alert=${a.id}`,
          unread: false,
          sortKey: 1,
        });
      });
    state.accessRequests
      .filter((r) => r.status === 'Pending')
      .forEach((r) => {
        items.push({
          id: `req-${r.id}`,
          category: 'Coordination Decision Pending',
          severity: 'info',
          title: `Scoped access request awaiting decision — ${r.id}`,
          body: `${r.requestingBureau} requested "${r.requestedScope}" on ${r.caseId} (${instName(r.institutionId)})`,
          metaLeft: `Requested ${r.requestedAt}`,
          metaRight: r.status,
          linkTo: `/institutions/${r.institutionId}`,
          unread: false,
          sortKey: 0,
        });
      });

    // 6. Transfers & escalations
    state.cases
      .filter(
        (c) =>
          !isTerminalCaseStatus(c.status) &&
          (c.status === 'Escalated' || c.sourceBureau !== c.assignedBureau)
      )
      .forEach((c) => {
        const escalated = c.status === 'Escalated';
        items.push({
          id: `mov-${c.id}`,
          category: 'Transfer / Escalation',
          severity: escalated ? 'warning' : 'info',
          title: escalated
            ? `Escalated docket — ${c.id}: ${c.subject}`
            : `Transferred docket — ${c.id}: ${c.subject}`,
          body: escalated
            ? `${instName(c.institutionId)} · escalated within ${c.assignedBureau}`
            : `${instName(c.institutionId)} · routed ${c.sourceBureau} → ${c.assignedBureau}`,
          metaLeft: `Updated ${formatDateDisplay(c.lastUpdated)}`,
          metaRight: c.priority,
          linkTo: `/cases/${c.id}`,
          unread: false,
          sortKey: escalated ? 0 : 1,
        });
      });

    // 7. Pre-dispatch clearance holds (mandatory blocks and conflicts)
    snapshot.draftClearanceQueue
      .filter((item) => item.hasConflict)
      .forEach((item) => {
        items.push({
          id: `clr-${item.action.id}`,
          category: 'Clearance Hold',
          severity: item.isMandatoryBlock ? 'critical' : 'warning',
          title: `${item.primaryFinding.severity} — draft ${item.action.actionType} (${item.action.id})`,
          body: `${instName(item.action.institutionId)} · case ${item.action.caseId} · ${item.action.bureau}`,
          metaLeft: `Target window ${formatDateDisplay(item.action.scheduledStart)}`,
          metaRight: item.primaryFinding.ruleCode,
          linkTo: `/cases/${item.action.caseId}`,
          unread: false,
          sortKey: item.isMandatoryBlock ? 0 : 1,
        });
      });

    return items.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      }
      return a.sortKey - b.sortKey;
    });
  }, [state, snapshot]);

  const filtered = feed.filter((item) => {
    if (severityFilter !== 'All' && item.severity !== severityFilter) return false;
    if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
    if (unreadOnly && !(item.unread || item.category !== 'Inbox')) {
      // "Unread / actionable only": unread inbox items plus all live operational conditions.
      return false;
    }
    return true;
  });

  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const categoryCounts = CATEGORY_OPTIONS.map((cat) => ({
    cat,
    count: feed.filter((i) => i.category === cat).length,
  }));

  const openItem = (item: FeedItem) => {
    if (item.inboxId) markNotificationRead(item.inboxId);
    navigate(item.linkTo);
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Alerts &amp; Notification Centre</h1>
          <p className="page-subtitle">
            Overdue deadlines, approaching SLA windows, related-case review alerts, pending
            coordination decisions, and transfer/escalation notices — computed as of {state.demoDate}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} /> Mark All Inbox Read ({unreadCount})
          </button>
        </div>
      </div>

      <div className="row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          className={`btn btn-sm ${categoryFilter === 'All' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCategoryFilter('All')}
        >
          All ({feed.length})
        </button>
        {categoryCounts.map(({ cat, count }) => (
          <button
            key={cat}
            type="button"
            className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <h2 className="panel-title">
              <BellRing size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              Alert Feed ({filtered.length})
            </h2>
            <p className="panel-subtitle">
              Click any entry to open the related case, institution, or coordination record
            </p>
          </div>
          <div className="row-center" style={{ gap: 8 }}>
            <select
              className="field-select"
              aria-label="Filter by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as 'All' | FeedSeverity)}
              style={{ height: 32 }}
            >
              <option value="All">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Informational</option>
            </select>
            <label className="row-center text-xs" style={{ gap: 5, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Actionable only
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <Inbox size={28} style={{ color: 'var(--text-muted)' }} />
            <h3>No alerts match the current filters</h3>
            <p className="text-sm text-secondary mt-1">
              Adjust the severity or category filters to review earlier notices.
            </p>
          </div>
        ) : (
          <div className="alert-feed">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`alert-feed-item${item.unread ? ' unread' : ''}`}
                onClick={() => openItem(item)}
              >
                <span className={`alert-sev-dot alert-sev-${item.severity}`} aria-hidden="true" />
                <span className="alert-feed-body">
                  <span className="alert-feed-title">{item.title}</span>
                  <span className="alert-feed-text" style={{ display: 'block' }}>
                    {item.body}
                  </span>
                  <span className="alert-feed-meta">
                    <span
                      className={`badge ${
                        item.severity === 'critical'
                          ? 'badge-critical'
                          : item.severity === 'warning'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span>{item.metaLeft}</span>
                    {item.metaRight && <span className="mono">{item.metaRight}</span>}
                    {item.unread && <span className="badge badge-info">Unread</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
