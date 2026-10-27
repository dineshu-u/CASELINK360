import {
  AdministrativeAction,
  AlertSuppressionRecord,
  CaseRecord,
  ClearanceFinding,
  CoordinationAlert,
  DemoUser,
  EvidenceArtifact,
  EvidenceArtifactType,
  PlannedActionType,
  ReadinessState,
  SystemSettings,
} from '../types/domain';
import { parseYmdToUtcMs } from './caseService';

export const CLEARANCE_RULE_VERSION = 'CLR-RULESET-v2.4';

export interface ProposedActionDraft {
  caseId: string;
  institutionId: string;
  actionType: PlannedActionType;
  purpose: string;
  requestedEvidenceType?: EvidenceArtifactType;
  academicYear: string;
  scope: string;
  scheduledStart: string;
  scheduledEnd: string;
  excludeActionId?: string;
}

export type PlannedActionDraft = ProposedActionDraft;

function daysBetweenYmd(earlier: string, later: string): number {
  return Math.round((parseYmdToUtcMs(later) - parseYmdToUtcMs(earlier)) / 86_400_000);
}

const ROUTINE_WELFARE_ACTIONS: PlannedActionType[] = ['Welfare Advisory'];

export function evaluatePreDispatchClearance(
  draft: ProposedActionDraft,
  actions: AdministrativeAction[],
  cases: CaseRecord[],
  evidenceVault: EvidenceArtifact[],
  settings: SystemSettings,
  currentUser: DemoUser,
  demoDate: string
): ClearanceFinding[] {
  const findings: ClearanceFinding[] = [];
  const sourceCase = cases.find((c) => c.id === draft.caseId);

  const sameInstActions = actions.filter(
    (act) =>
      act.institutionId === draft.institutionId &&
      act.id !== draft.excludeActionId &&
      act.status !== 'Completed'
  );

  // Check 1: Duplicate Evidence Request Check (RULE-CLR-DUP-01)
  if (draft.requestedEvidenceType) {
    const matchingPriorAction = sameInstActions.find(
      (act) =>
        act.status !== 'Draft' &&
        act.requestedEvidenceType === draft.requestedEvidenceType &&
        act.academicYear === draft.academicYear &&
        Math.abs(daysBetweenYmd(act.scheduledStart, demoDate)) <=
          settings.duplicateEvidenceWindowDays
    );

    const existingArtifact = evidenceVault.find(
      (art) =>
        art.institutionId === draft.institutionId &&
        art.artifactType === draft.requestedEvidenceType &&
        art.academicYear === draft.academicYear
    );

    if (matchingPriorAction || existingArtifact) {
      const refDate =
        matchingPriorAction?.scheduledStart ??
        existingArtifact?.submissionDate ??
        demoDate;
      const daysAgo = Math.max(0, daysBetweenYmd(refDate, demoDate));
      const artId = existingArtifact?.id ?? matchingPriorAction?.linkedArtifactId;

      findings.push({
        id: `CLR-FND-DUP-${draft.institutionId}`,
        outcomeKind: 'DUPLICATE_EVIDENCE_REQUEST',
        severity: 'Warning — Duplicate / Shared Evidence',
        ruleCode: 'RULE-CLR-DUP-01',
        ruleVersion: CLEARANCE_RULE_VERSION,
        headline: `Duplicate Evidence Demand Detected (${daysAgo} day(s) ago)`,
        explanation: matchingPriorAction
          ? `${matchingPriorAction.bureau} already requested "${draft.requestedEvidenceType}" (${draft.academicYear}) under case ${matchingPriorAction.caseId} on ${matchingPriorAction.scheduledStart} — ${daysAgo} day(s) ago.`
          : `Institution ${draft.institutionId} already submitted "${draft.requestedEvidenceType}" (${draft.academicYear}) in Shared Evidence Vault.`,
        recommendedNextStep: artId
          ? `Subscribe directly to Shared Evidence Vault artifact ${artId} (${existingArtifact?.currentVersion ?? 'v1'} — ${existingArtifact?.authenticityStatus ?? 'Available'}) instead of issuing a second demand to the institution.`
          : 'Route request to the existing active bureau demand.',
        sourceCaseId: matchingPriorAction?.caseId,
        sourceActionId: matchingPriorAction?.id,
        existingArtifactId: artId,
        reusableArtifactId: artId,
        existingRequestDate: refDate,
        daysSincePriorRequest: daysAgo,
        artifactAvailability: existingArtifact
          ? `${existingArtifact.id} (${existingArtifact.currentVersion}) — ${existingArtifact.authenticityStatus}`
          : 'Awaiting institutional upload on existing demand',
        canSubscribeToExistingEvidence: Boolean(artId || matchingPriorAction),
        requiresSeniorOverrideToIssue: false,
      });
    }
  }

  // Check 2: Confidential Inspection Sequencing Hazard (RULE-CLR-SEQ-02)
  const isAdvanceNoticeType =
    !ROUTINE_WELFARE_ACTIONS.includes(draft.actionType) &&
    sourceCase?.category !== 'Hostel & Student Amenities';

  if (isAdvanceNoticeType && draft.scheduledStart) {
    for (const act of sameInstActions) {
      if (act.confidentiality === 'Confidential Inspection' && act.status !== 'Draft') {
        const gapDays = daysBetweenYmd(draft.scheduledStart, act.scheduledStart);
        const overlapsDirectly =
          draft.scheduledStart <= act.scheduledEnd && draft.scheduledEnd >= act.scheduledStart;
        const precedesWithinHazardWindow =
          gapDays >= -3 && gapDays <= settings.clearanceSequencingWindowDays;

        if (overlapsDirectly || precedesWithinHazardWindow) {
          const userCanSeeConfidentialDetails =
            currentUser.bureau === act.bureau ||
            currentUser.role === 'Cross-Bureau Coordinator';

          findings.push({
            id: `CLR-FND-SEQ-${act.id}`,
            outcomeKind: 'SEQUENCING_HAZARD',
            severity: 'Mandatory Clearance Required',
            ruleCode: 'RULE-CLR-SEQ-02',
            ruleVersion: CLEARANCE_RULE_VERSION,
            headline:
              'Mandatory Clearance Block — Confidential Inspection Sequencing Hazard',
            explanation: userCanSeeConfidentialDetails
              ? `Dispatching "${draft.actionType}" on ${draft.scheduledStart} precedes/overlaps scheduled ${act.bureau} confidential inspection (${act.id}: ${act.scheduledStart} to ${act.scheduledEnd}) within the ${settings.clearanceSequencingWindowDays}-day hazard window.`
              : `A restricted cross-bureau field inspection is scheduled at ${draft.institutionId} within the configured ${settings.clearanceSequencingWindowDays}-day protection window. Exact inspection dates, team roster, and scope are withheld under bureau access policy.`,
            recommendedNextStep:
              'Hold draft notice in queue until physical verification concludes, or obtain Senior Review Authority / Cross-Bureau Coordinator override with mandatory logged justification.',
            sourceCaseId: userCanSeeConfidentialDetails ? act.caseId : undefined,
            sourceActionId: userCanSeeConfidentialDetails ? act.id : undefined,
            redactedConfidentialDetails: !userCanSeeConfidentialDetails,
            canSubscribeToExistingEvidence: false,
            requiresSeniorOverrideToIssue: true,
          });
        }
      }
    }
  }

  // Outcome 3: Clear to Proceed
  if (findings.length === 0) {
    const otherSameInstCount = sameInstActions.length;
    findings.push({
      id: `CLR-FND-OK-${draft.institutionId}`,
      outcomeKind: 'CLEAR_TO_PROCEED',
      severity: 'Clear to Proceed',
      ruleCode: 'RULE-CLR-PASS-00',
      ruleVersion: CLEARANCE_RULE_VERSION,
      headline: 'Clear to Proceed — No Duplicate Demand or Sequencing Conflict',
      explanation:
        otherSameInstCount > 0
          ? `Checked ${otherSameInstCount} active action(s) at ${draft.institutionId} under ${CLEARANCE_RULE_VERSION}. Unrelated actions at the same institution do not block this "${draft.actionType}".`
          : `Checked active actions and Shared Evidence Vault for ${draft.institutionId} under ${CLEARANCE_RULE_VERSION}. No overlapping evidence request or confidential inspection window applies.`,
      recommendedNextStep:
        'Authorised to transition from Draft to Issued and record Pre-Dispatch Check in Audit Register.',
      requiresSeniorOverrideToIssue: false,
    });
  }

  return findings;
}

export interface DetectedCohortCluster {
  clusterKey: string;
  institutionId: string;
  category: CaseRecord['category'];
  eligibleCases: CaseRecord[];
  inWindowCaseIds: string[];
  activeCaseIds: string[];
  activeCount: number;
  totalInWindowCount: number;
  threshold: number;
  rollingDays: number;
  exceedsThreshold: boolean;
}

export function evaluateCohortClusters(
  cases: CaseRecord[],
  demoDate: string,
  rollingDays: number,
  threshold: number
): DetectedCohortCluster[] {
  const grouped = new Map<string, CaseRecord[]>();

  for (const c of cases) {
    const ageDays = daysBetweenYmd(c.receivedDate, demoDate);
    if (ageDays >= 0 && ageDays <= rollingDays) {
      const key = `${c.institutionId}::${c.category}`;
      const existing = grouped.get(key) ?? [];
      existing.push(c);
      grouped.set(key, existing);
    }
  }

  const results: DetectedCohortCluster[] = [];
  for (const [key, groupCases] of grouped.entries()) {
    if (groupCases.length >= 2) {
      const activeCases = groupCases.filter(
        (c) => c.status !== 'Resolved' && c.status !== 'Closed'
      );
      results.push({
        clusterKey: key,
        institutionId: groupCases[0].institutionId,
        category: groupCases[0].category,
        eligibleCases: groupCases,
        inWindowCaseIds: groupCases.map((c) => c.id),
        activeCaseIds: activeCases.map((c) => c.id),
        activeCount: activeCases.length,
        totalInWindowCount: groupCases.length,
        threshold,
        rollingDays,
        exceedsThreshold: activeCases.length >= threshold,
      });
    }
  }

  return results.sort((a, b) => b.activeCount - a.activeCount);
}

export function computePairFactSignature(
  pair: [string, string],
  cases: CaseRecord[],
  actions: AdministrativeAction[],
  ruleVersion: string
): string {
  const sortedIds = [...pair].sort();
  const parts = sortedIds.map((cid) => {
    const c = cases.find((item) => item.id === cid);
    const acts = actions
      .filter((a) => a.caseId === cid)
      .map((a) => `${a.id}:${a.scheduledStart}:${a.scheduledEnd}`)
      .sort()
      .join(',');
    if (!c) return `${cid}:missing`;
    return `${cid}|docs:${c.documents.length}|evd:${c.evidenceLinks.length}|due:${c.dueDate}|acts:[${acts}]`;
  });
  return `rule:${ruleVersion}||${parts.join('||')}`;
}

export function reevaluateSuppressions(
  suppressions: AlertSuppressionRecord[],
  cases: CaseRecord[],
  actions: AdministrativeAction[],
  currentRuleVersion: string,
  reopenedStamp?: string
): { updated: AlertSuppressionRecord[]; reopenedIds: string[] } {
  const reopenedIds: string[] = [];
  const updated = suppressions.map((sup) => {
    const latestSig = computePairFactSignature(
      sup.casePair,
      cases,
      actions,
      currentRuleVersion
    );
    if (sup.active && sup.baselineFactSignature !== latestSig) {
      reopenedIds.push(sup.id);
      const reason =
        sup.ruleVersion !== currentRuleVersion
          ? `Rule version incremented (${sup.ruleVersion} → ${currentRuleVersion}); re-evaluation triggered.`
          : 'Material case facts changed (new action, attached document/evidence, or modified schedule dates).';
      return {
        ...sup,
        active: false,
        reopenedAt: reopenedStamp ?? currentRuleVersion,
        reopenedReason: reason,
      };
    }
    return sup;
  });
  return { updated, reopenedIds };
}

export interface ReadinessCheckpointSummary {
  cycleId: string;
  cycleLabel: string;
  windowDescription: string;
  state: ReadinessState;
  advisoryBasis: string;
  supportingCaseIds: string[];
  supportingArtifactIds: string[];
}

export function evaluateInstitutionReadiness(
  institutionId: string,
  cases: CaseRecord[],
  actions: AdministrativeAction[],
  alerts: CoordinationAlert[],
  evidenceVault: EvidenceArtifact[],
  demoDate: string
): ReadinessCheckpointSummary[] {
  const instCases = cases.filter((c) => c.institutionId === institutionId);
  const instActions = actions.filter((a) => a.institutionId === institutionId);
  const instAlerts = alerts.filter(
    (al) =>
      al.institutionId === institutionId &&
      al.status !== 'Resolved' &&
      al.status !== 'Dismissed'
  );
  const instVault = evidenceVault.filter((e) => e.institutionId === institutionId);

  const overdueCases = instCases.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Closed' && c.dueDate < demoDate
  );
  const unverifiedVault = instVault.filter(
    (e) => e.authenticityStatus !== 'Verified by Authority'
  );

  // 1. Extension of Approval (EoA) Review Window
  const eoaCases = [...overdueCases, ...instCases.filter((c) => c.priority === 'Critical')];
  const uniqueEoaIds = Array.from(new Set(eoaCases.map((c) => c.id)));
  const eoaState: ReadinessState =
    overdueCases.length > 0 || unverifiedVault.length > 0 || instAlerts.length >= 2
      ? 'Outstanding items'
      : instAlerts.length === 1
      ? 'Review recommended'
      : 'No recorded flag';

  // 2. Intake Expansion & Academic Cadre Review Window
  const intakeCases = instCases.filter(
    (c) =>
      (c.category === 'Unapproved Intake / Admission' ||
        c.category === 'Faculty Roster & Attendance' ||
        c.category === 'Faculty Qualifications & Appointments' ||
        c.category === 'Laboratory & Academic Infrastructure') &&
      c.status !== 'Resolved' &&
      c.status !== 'Closed'
  );
  const intakeState: ReadinessState =
    instCases.length === 0
      ? 'Evidence unavailable'
      : intakeCases.length >= 2 ||
        instActions.some((a) => a.confidentiality === 'Confidential Inspection')
      ? 'Outstanding items'
      : intakeCases.length === 1
      ? 'Review recommended'
      : 'No recorded flag';

  // 3. Counselling & Student Fee/Document Readiness Window
  const openFeeCases = instCases.filter(
    (c) =>
      c.category === 'Fee Refund & Admission Cancellation' &&
      c.status !== 'Resolved' &&
      c.status !== 'Closed'
  );
  const resolvedFeeCases = instCases.filter(
    (c) =>
      c.category === 'Fee Refund & Admission Cancellation' &&
      (c.status === 'Resolved' || c.status === 'Closed')
  );
  const counsellingState: ReadinessState =
    openFeeCases.length > 0
      ? 'Outstanding items'
      : resolvedFeeCases.length > 0
      ? 'No recorded flag'
      : 'No recorded flag';

  return [
    {
      cycleId: 'CYC-EOA',
      cycleLabel: 'Extension of Approval (EoA) Window',
      windowDescription: 'Annual compliance directives, SLA overdue status & shared vault verification',
      state: eoaState,
      advisoryBasis:
        eoaState === 'Outstanding items'
          ? `${overdueCases.length} overdue docket(s), ${instAlerts.length} active cross-bureau coordination alert(s), and ${unverifiedVault.length} unverified vault submission(s) recorded.`
          : eoaState === 'Review recommended'
          ? 'Active cross-bureau alert flagged for coordinator review prior to annual cycle sign-off.'
          : 'No overdue directives or pending vault verifications recorded.',
      supportingCaseIds:
        uniqueEoaIds.length > 0 ? uniqueEoaIds : instCases.slice(0, 2).map((c) => c.id),
      supportingArtifactIds: instVault.map((v) => v.id),
    },
    {
      cycleId: 'CYC-INTAKE',
      cycleLabel: 'Intake Expansion & Faculty Cadre Window',
      windowDescription: 'Seat matrix adherence, faculty qualifications & laboratory readiness',
      state: intakeState,
      advisoryBasis:
        intakeCases.length > 0
          ? `${intakeCases.length} open academic/intake inquiry docket(s) (${intakeCases
              .map((c) => c.assignedBureau)
              .join(', ')}) require bureau review.`
          : 'No open intake excess or faculty cadre shortfall dockets recorded.',
      supportingCaseIds: intakeCases.map((c) => c.id),
      supportingArtifactIds: instVault
        .filter((v) => v.artifactType !== 'Certified Withdrawal & Fee Refund Scroll')
        .map((v) => v.id),
    },
    {
      cycleId: 'CYC-COUNSELLING',
      cycleLabel: 'Counselling & Fee/Document Return Window',
      windowDescription: '7-day fee refund rule, caution money & original certificate compliance',
      state: counsellingState,
      advisoryBasis:
        openFeeCases.length > 0
          ? `${openFeeCases.length} active student fee-refund / certificate retention docket(s) open (${resolvedFeeCases.length} prior individual refund docket(s) closed independently).`
          : resolvedFeeCases.length > 0
          ? `${resolvedFeeCases.length} historical refund docket verified & closed on record; zero open student refund complaints.`
          : 'No open student fee-refund or certificate retention complaints recorded.',
      supportingCaseIds: [...openFeeCases, ...resolvedFeeCases].map((c) => c.id),
      supportingArtifactIds: instVault
        .filter((v) => v.artifactType === 'Certified Withdrawal & Fee Refund Scroll')
        .map((v) => v.id),
    },
  ];
}
