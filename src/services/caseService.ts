import {
  AdministrativeAction,
  AppStateData,
  AuditEvent,
  BureauName,
  CasePriority,
  CaseRecord,
  CaseStatus,
  ClearanceFinding,
  CoordinationAlert,
  DeadlineRule,
  DemoUser,
  Institution,
  RelatedCaseCandidate,
  ScopedAccessRequest,
} from '../types/domain';
import { expandQueryWithGlossary } from './glossary';
import { hasFullCaseReadAccess } from './accessService';
import { evaluatePreDispatchClearance } from './clearanceService';

export type SlaStatus = 'Overdue' | 'Approaching' | 'On Track' | 'Completed';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function parseYmdToUtcMs(ymd: string): number {
  const parts = ymd.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return 0;
  }
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  const ymd = dateStr.slice(0, 10);
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const timePart = dateStr.length > 10 ? dateStr.slice(10) : '';
  return `${String(day).padStart(2, '0')} ${MONTHS_SHORT[month - 1] ?? ''} ${year}${timePart}`;
}

export function addDaysToYmd(baseYmd: string, days: number): string {
  const ms = parseYmdToUtcMs(baseYmd) + days * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysUntilDue(dueDate: string, demoToday: string): number {
  const diffMs = parseYmdToUtcMs(dueDate) - parseYmdToUtcMs(demoToday);
  return Math.round(diffMs / 86_400_000);
}

export function isTerminalCaseStatus(status: CaseStatus): boolean {
  return status === 'Resolved' || status === 'Closed';
}

export function isOpenCoordinationAlert(alert: Pick<CoordinationAlert, 'status'>): boolean {
  return (
    alert.status !== 'Resolved' &&
    alert.status !== 'Dismissed' &&
    alert.status !== 'Suppressed (Negative Memory)'
  );
}

export interface DraftActionClearanceItem {
  action: AdministrativeAction;
  caseRecord: CaseRecord | undefined;
  institution: Institution | undefined;
  findings: ClearanceFinding[];
  primaryFinding: ClearanceFinding;
  hasConflict: boolean;
  isMandatoryBlock: boolean;
}

const CLEARANCE_SEVERITY_RANK: Record<ClearanceFinding['severity'], number> = {
  'Mandatory Clearance Required': 0,
  'Warning Requiring Review': 1,
  'Warning — Duplicate / Shared Evidence': 1,
  'Coordination Recommended': 2,
  Informational: 3,
  'Clear to Proceed': 4,
};

export function evaluateDraftActionsQueue(
  state: AppStateData,
  currentUser: DemoUser,
  institutionFilter = 'All'
): DraftActionClearanceItem[] {
  return state.actions
    .filter(
      (act) =>
        act.status === 'Draft' &&
        (institutionFilter === 'All' || act.institutionId === institutionFilter)
    )
    .map((action) => {
      const caseRecord = state.cases.find((c) => c.id === action.caseId);
      const institution = state.institutions.find((i) => i.id === action.institutionId);
      const findings = evaluatePreDispatchClearance(
        {
          caseId: action.caseId,
          institutionId: action.institutionId,
          actionType: action.actionType,
          purpose: action.purpose,
          requestedEvidenceType: action.requestedEvidenceType,
          academicYear: action.academicYear ?? caseRecord?.academicYear ?? 'AY 2026-27',
          scope: action.scope,
          scheduledStart: action.scheduledStart,
          scheduledEnd: action.scheduledEnd,
          excludeActionId: action.id,
        },
        state.actions,
        state.cases,
        state.evidenceVault,
        state.settings,
        currentUser,
        state.demoDate
      );
      const sortedFindings = [...findings].sort(
        (fa, fb) =>
          CLEARANCE_SEVERITY_RANK[fa.severity] - CLEARANCE_SEVERITY_RANK[fb.severity]
      );
      const primaryFinding = sortedFindings[0];
      return {
        action,
        caseRecord,
        institution,
        findings: sortedFindings,
        primaryFinding,
        hasConflict: primaryFinding.outcomeKind !== 'CLEAR_TO_PROCEED',
        isMandatoryBlock: sortedFindings.some(
          (f) => f.severity === 'Mandatory Clearance Required'
        ),
      };
    })
    .sort((a, b) => {
      const rankDiff =
        CLEARANCE_SEVERITY_RANK[a.primaryFinding.severity] -
        CLEARANCE_SEVERITY_RANK[b.primaryFinding.severity];
      if (rankDiff !== 0) return rankDiff;
      return a.action.scheduledStart.localeCompare(b.action.scheduledStart);
    });
}

export interface OperationalSnapshot {
  scopedCases: CaseRecord[];
  activeCases: CaseRecord[];
  myBureauActiveCases: CaseRecord[];
  myOfficerActiveCases: CaseRecord[];
  overdueCases: CaseRecord[];
  myBureauOverdueCases: CaseRecord[];
  approachingCases: CaseRecord[];
  openAlerts: CoordinationAlert[];
  myBureauOpenAlerts: CoordinationAlert[];
  draftClearanceQueue: DraftActionClearanceItem[];
  myBureauDraftClearanceQueue: DraftActionClearanceItem[];
  conflictDraftCount: number;
}

export function getOperationalSnapshot(
  state: AppStateData,
  currentUser: DemoUser,
  institutionFilter = 'All'
): OperationalSnapshot {
  const scopedCases =
    institutionFilter === 'All'
      ? state.cases
      : state.cases.filter((c) => c.institutionId === institutionFilter);

  const activeCases = scopedCases.filter((c) => !isTerminalCaseStatus(c.status));
  const myBureauActiveCases = activeCases.filter(
    (c) => c.assignedBureau === currentUser.bureau
  );
  const myOfficerActiveCases = activeCases.filter(
    (c) => c.assignedOfficerId === currentUser.id
  );

  const overdueCases = activeCases.filter(
    (c) => getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status === 'Overdue'
  );
  const myBureauOverdueCases = overdueCases.filter(
    (c) => c.assignedBureau === currentUser.bureau
  );
  const approachingCases = activeCases.filter(
    (c) =>
      getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules).status === 'Approaching'
  );

  const openAlerts = state.alerts.filter(
    (a) =>
      isOpenCoordinationAlert(a) &&
      (institutionFilter === 'All' || a.institutionId === institutionFilter)
  );
  const myBureauOpenAlerts = openAlerts.filter((a) =>
    a.involvedBureaus.includes(currentUser.bureau)
  );

  const draftClearanceQueue = evaluateDraftActionsQueue(state, currentUser, institutionFilter);
  const myBureauDraftClearanceQueue = draftClearanceQueue.filter(
    (item) => item.action.bureau === currentUser.bureau
  );
  const conflictDraftCount = draftClearanceQueue.filter((item) => item.hasConflict).length;

  return {
    scopedCases,
    activeCases,
    myBureauActiveCases,
    myOfficerActiveCases,
    overdueCases,
    myBureauOverdueCases,
    approachingCases,
    openAlerts,
    myBureauOpenAlerts,
    draftClearanceQueue,
    myBureauDraftClearanceQueue,
    conflictDraftCount,
  };
}

export function canUserModifyRecords(user: DemoUser): boolean {
  return user.role !== 'Read-Only Auditor';
}

export function getCaseSlaStatus(
  caseRecord: Pick<CaseRecord, 'status' | 'priority' | 'dueDate'>,
  demoToday: string,
  deadlineRules: DeadlineRule[]
): { status: SlaStatus; daysDelta: number; label: string } {
  const delta = daysUntilDue(caseRecord.dueDate, demoToday);
  if (isTerminalCaseStatus(caseRecord.status)) {
    return { status: 'Completed', daysDelta: delta, label: 'Completed' };
  }
  if (delta < 0) {
    return {
      status: 'Overdue',
      daysDelta: delta,
      label: `${Math.abs(delta)}d overdue`,
    };
  }
  const rule = deadlineRules.find((r) => r.priority === caseRecord.priority);
  const warningWindow = rule ? rule.warningThresholdDays : 4;
  if (delta <= warningWindow) {
    return {
      status: 'Approaching',
      daysDelta: delta,
      label: delta === 0 ? 'Due today' : `Due in ${delta}d`,
    };
  }
  return {
    status: 'On Track',
    daysDelta: delta,
    label: `Due in ${delta}d`,
  };
}

export interface CaseFilterCriteria {
  search?: string;
  bureau?: string;
  assignedBureau?: string;
  officerId?: string;
  activeOnly?: boolean;
  clearanceCaseIds?: Set<string>;
  institutionId?: string;
  status?: string;
  priority?: string;
  sla?: string;
  slaFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type CaseSortField =
  | 'id'
  | 'institution'
  | 'priority'
  | 'status'
  | 'receivedDate'
  | 'dueDate'
  | 'lastUpdated';

const PRIORITY_WEIGHT: Record<CasePriority, number> = {
  Critical: 4,
  High: 3,
  Standard: 2,
  Low: 1,
};

export interface CaseAccessContext {
  currentUser: DemoUser;
  accessRequests: ScopedAccessRequest[];
  demoDate: string;
}

export function filterAndSortCases(
  cases: CaseRecord[],
  institutions: Institution[],
  criteria: CaseFilterCriteria,
  sortField: CaseSortField,
  sortDir: 'asc' | 'desc',
  demoToday: string,
  deadlineRules: DeadlineRule[],
  accessCtx?: CaseAccessContext
): CaseRecord[] {
  const instMap = new Map(institutions.map((i) => [i.id, i]));
  const rawSearch = (criteria.search ?? '').trim();
  const q = rawSearch.toLowerCase();
  const expansion = expandQueryWithGlossary(rawSearch);

  const filtered = cases.filter((c) => {
    const inst = instMap.get(c.institutionId);
    const fullReadable = accessCtx
      ? hasFullCaseReadAccess(
          accessCtx.currentUser,
          c,
          accessCtx.accessRequests,
          accessCtx.demoDate
        )
      : c.visibility !== 'Restricted — Bureau Scoped';

    if (q) {
      const searchableNarrative = !fullReadable
        ? `${c.id} ${c.institutionId} ${c.coarseCategoryLabel ?? c.category} ${c.assignedBureau}`
        : [
            c.id,
            c.subject,
            c.description,
            c.category,
            c.institutionId,
            inst?.name ?? '',
            inst?.city ?? '',
            c.sourceBureau,
            c.assignedBureau,
          ].join(' ');
      const haystack = searchableNarrative.toLowerCase();

      const directMatch = haystack.includes(q);
      const glossaryPhraseMatch =
        expansion.matchedConcepts.length > 0 &&
        expansion.matchedConcepts.some((mc) =>
          mc.expandedTerms.some((term) => haystack.includes(term.toLowerCase()))
        );

      if (!directMatch && !glossaryPhraseMatch) {
        return false;
      }
    }

    if (criteria.bureau && criteria.bureau !== 'All') {
      if (c.assignedBureau !== criteria.bureau && c.sourceBureau !== criteria.bureau) {
        return false;
      }
    }

    if (criteria.assignedBureau && criteria.assignedBureau !== 'All') {
      if (c.assignedBureau !== criteria.assignedBureau) {
        return false;
      }
    }

    if (criteria.officerId && criteria.officerId !== 'All') {
      if (c.assignedOfficerId !== criteria.officerId) {
        return false;
      }
    }

    if (criteria.activeOnly && isTerminalCaseStatus(c.status)) {
      return false;
    }

    if (criteria.clearanceCaseIds && !criteria.clearanceCaseIds.has(c.id)) {
      return false;
    }

    if (criteria.institutionId && criteria.institutionId !== 'All') {
      if (c.institutionId !== criteria.institutionId) return false;
    }

    if (criteria.status && criteria.status !== 'All') {
      if (criteria.status === 'Active') {
        if (isTerminalCaseStatus(c.status)) return false;
      } else if (c.status !== criteria.status) {
        return false;
      }
    }

    if (criteria.priority && criteria.priority !== 'All') {
      if (c.priority !== criteria.priority) return false;
    }

    const activeSlaCriterion = criteria.slaFilter ?? criteria.sla;
    if (
      activeSlaCriterion &&
      activeSlaCriterion !== 'all' &&
      activeSlaCriterion !== 'All'
    ) {
      const sla = getCaseSlaStatus(c, demoToday, deadlineRules).status;
      const norm = activeSlaCriterion.toLowerCase();
      if (norm === 'overdue' && sla !== 'Overdue') return false;
      if (norm === 'approaching' && sla !== 'Approaching') return false;
      if (norm === 'on track' && sla !== 'On Track') return false;
      if (norm === 'active' && isTerminalCaseStatus(c.status)) return false;
    }

    if (criteria.dateFrom && c.receivedDate < criteria.dateFrom) return false;
    if (criteria.dateTo && c.receivedDate > criteria.dateTo) return false;

    return true;
  });

  const multiplier = sortDir === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'id':
        cmp = a.id.localeCompare(b.id);
        break;
      case 'institution': {
        const nameA = instMap.get(a.institutionId)?.name ?? a.institutionId;
        const nameB = instMap.get(b.institutionId)?.name ?? b.institutionId;
        cmp = nameA.localeCompare(nameB);
        break;
      }
      case 'priority':
        cmp = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'receivedDate':
        cmp = a.receivedDate.localeCompare(b.receivedDate);
        break;
      case 'dueDate':
        cmp = a.dueDate.localeCompare(b.dueDate);
        break;
      case 'lastUpdated':
        cmp = a.lastUpdated.localeCompare(b.lastUpdated);
        break;
    }
    return cmp * multiplier;
  });
}

export interface NewCaseInput {
  institutionId: string;
  subject: string;
  category: CaseRecord['category'];
  description: string;
  sourceChannel: CaseRecord['sourceChannel'];
  sourceBureau: BureauName;
  assignedBureau: BureauName;
  assignedOfficerId: string;
  priority: CasePriority;
  receivedDate: string;
  dueDate: string;
  incidentDate?: string;
  academicYear?: string;
}

export function validateNewCase(
  input: NewCaseInput,
  institutions: Institution[],
  currentUser: DemoUser
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (currentUser.role === 'Read-Only Auditor') {
    errors.form =
      'Read-Only Auditor role cannot register new cases. Switch to an operational role in the top bar.';
  }
  if (!input.institutionId || !institutions.some((i) => i.id === input.institutionId)) {
    errors.institutionId = 'Select a valid AICTE Institution ID from the registry.';
  }
  if (!input.subject || input.subject.trim().length < 10) {
    errors.subject = 'Enter a descriptive complaint subject (at least 10 characters).';
  }
  if (!input.description || input.description.trim().length < 20) {
    errors.description = 'Provide factual complaint details (at least 20 characters).';
  }
  if (!input.receivedDate) {
    errors.receivedDate = 'Select the complaint receipt date.';
  }
  if (!input.dueDate) {
    errors.dueDate = 'Specify a target SLA due date.';
  } else if (input.receivedDate && input.dueDate < input.receivedDate) {
    errors.dueDate = 'Target due date cannot precede the complaint received date.';
  }
  if (!input.assignedOfficerId) {
    errors.assignedOfficerId = 'Assign an officer responsible for initial examination.';
  }

  return errors;
}

export function buildDeterministicRelatedCandidatesForNewCase(
  newCase: Pick<CaseRecord, 'institutionId' | 'category' | 'assignedBureau'>,
  existingCases: CaseRecord[]
): RelatedCaseCandidate[] {
  return existingCases
    .filter(
      (existing) =>
        existing.institutionId === newCase.institutionId &&
        !isTerminalCaseStatus(existing.status)
    )
    .map((existing) => {
      if (existing.category === newCase.category) {
        return {
          targetCaseId: existing.id,
          matchBasis: 'Deterministic Rule',
          ruleCode: 'RULE-COHORT-INST-02',
          evidenceStrength: 'Strong',
          sharedFactors: [
            `Exact Institution ID match (${newCase.institutionId})`,
            `Matching complaint category (${newCase.category})`,
          ],
          cautionNote:
            'Classify under Five-Part Relationship Taxonomy before consolidating demands.',
          taxonomy: 'Cohort / Pattern Cluster',
        };
      }
      return {
        targetCaseId: existing.id,
        matchBasis: 'Keyword & Synonym Match',
        evidenceStrength: 'Insufficient Evidence',
        sharedFactors: [
          `Same Institution ID (${newCase.institutionId})`,
          'Distinct statutory complaint categories',
        ],
        cautionNote:
          'Shared institution only; different complaint categories. Do not merge without shared evidentiary basis.',
        taxonomy: 'Unclassified — Needs Review',
      };
    });
}

function escapeCsvCell(val: string | number | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCasesToCsv(
  cases: CaseRecord[],
  institutions: Institution[],
  demoToday: string,
  deadlineRules: DeadlineRule[],
  accessCtx?: CaseAccessContext
): string {
  const instMap = new Map(institutions.map((i) => [i.id, i]));
  const headers = [
    'Case ID',
    'Institution ID',
    'Institution Name',
    'Subject',
    'Category',
    'Assigned Bureau',
    'Priority',
    'Status',
    'SLA Window',
    'Incident Date',
    'Due Date',
  ];

  const rows = cases.map((c) => {
    const readable = accessCtx
      ? hasFullCaseReadAccess(
          accessCtx.currentUser,
          c,
          accessCtx.accessRequests,
          accessCtx.demoDate
        )
      : c.visibility !== 'Restricted — Bureau Scoped';
    const sla = getCaseSlaStatus(c, demoToday, deadlineRules);
    return [
      c.id,
      c.institutionId,
      instMap.get(c.institutionId)?.name ?? c.institutionId,
      readable ? c.subject : `[Restricted Stub] ${c.coarseCategoryLabel ?? c.category}`,
      readable ? c.category : c.coarseCategoryLabel ?? 'Restricted',
      c.assignedBureau,
      c.priority,
      c.status,
      sla.label,
      c.incidentDate,
      c.dueDate,
    ];
  });

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function exportAuditLogToCsv(events: AuditEvent[]): string {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Actor',
    'Role',
    'Bureau',
    'Entity Type',
    'Entity ID',
    'Action Type',
    'Summary',
    'Previous Value',
    'New Value',
  ];
  const rows = events.map((e) => [
    e.id,
    e.timestamp,
    e.actorName,
    e.actorRole,
    e.actorBureau,
    e.entityType,
    e.entityId,
    e.actionType,
    e.summary,
    e.previousValue ?? '',
    e.newValue ?? '',
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
