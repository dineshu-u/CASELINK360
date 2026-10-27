import { describe, expect, it } from 'vitest';
import { createSeedState } from '../data/seedData';
import {
  evaluateDraftActionsQueue,
  filterAndSortCases,
  getCaseSlaStatus,
  getOperationalSnapshot,
  isOpenCoordinationAlert,
  isTerminalCaseStatus,
  validateNewCase,
} from '../services/caseService';
import { runLocalKnowledgeQuery } from '../services/ragAdapter';
import {
  computePairFactSignature,
  evaluateCohortClusters,
  evaluateInstitutionReadiness,
  evaluatePreDispatchClearance,
  reevaluateSuppressions,
} from '../services/clearanceService';
import { buildRedactedStub, hasFullCaseReadAccess } from '../services/accessService';
import { runReliabilityBenchmarkSuite } from '../services/benchmarkRunner';

describe('CASELINK 360 Advanced Regulatory Coordination Capabilities', () => {
  const seed = createSeedState();

  it('Capability 1: Pre-Dispatch Clearance catches 9-day duplicate evidence demand, protects confidential inspections, and passes unrelated actions', () => {
    const rbOfficer = seed.users.find((u) => u.id === 'USR-07')!;
    const approvalOfficer = seed.users.find((u) => u.id === 'USR-02')!;

    // Outcome 1: Duplicate Evidence Demand on ABC Engineering College (9 days ago by PGRC)
    const dupFindings = evaluatePreDispatchClearance(
      {
        caseId: 'CL-2026-0125',
        institutionId: 'INST-MH-2040',
        actionType: 'Document Demand',
        purpose: 'Request withdrawal & refund bank scroll',
        requestedEvidenceType: 'Certified Withdrawal & Fee Refund Scroll',
        academicYear: 'AY 2026-27',
        scope: 'Withdrawal register and NEFT scroll',
        scheduledStart: '2026-10-22',
        scheduledEnd: '2026-10-30',
      },
      seed.actions,
      seed.cases,
      seed.evidenceVault,
      seed.settings,
      rbOfficer,
      seed.demoDate
    );
    expect(dupFindings[0].outcomeKind).toBe('DUPLICATE_EVIDENCE_REQUEST');
    expect(dupFindings[0].reusableArtifactId).toBe('EVD-2026-01');
    expect(dupFindings[0].explanation).toContain('9 day(s) ago');

    // Outcome 2: Confidential Inspection Sequencing Hazard with unauthorized details redacted
    const seqFindings = evaluatePreDispatchClearance(
      {
        caseId: 'CL-2026-0114',
        institutionId: 'INST-TN-1008',
        actionType: 'Show-Cause Notice',
        purpose: 'Issue notice on CSE supernumerary intake',
        academicYear: 'AY 2026-27',
        scope: 'Admission registers',
        scheduledStart: '2026-10-25',
        scheduledEnd: '2026-10-30',
      },
      seed.actions,
      seed.cases,
      seed.evidenceVault,
      seed.settings,
      approvalOfficer,
      seed.demoDate
    );
    expect(seqFindings[0].outcomeKind).toBe('SEQUENCING_HAZARD');
    expect(seqFindings[0].severity).toBe('Mandatory Clearance Required');
    expect(seqFindings[0].redactedConfidentialDetails).toBe(true);
    expect(seqFindings[0].explanation).not.toContain('2026-10-27');

    // Outcome 3: Clear to Proceed for unrelated Hostel Welfare advisory at the SAME institution INST-TN-1008
    const clearFindings = evaluatePreDispatchClearance(
      {
        caseId: 'CL-2026-0121',
        institutionId: 'INST-TN-1008',
        actionType: 'Welfare Advisory',
        purpose: 'Servicing hostel RO filter',
        academicYear: 'AY 2026-27',
        scope: 'Hostel Block B drinking water',
        scheduledStart: '2026-10-24',
        scheduledEnd: '2026-10-30',
      },
      seed.actions,
      seed.cases,
      seed.evidenceVault,
      seed.settings,
      approvalOfficer,
      seed.demoDate
    );
    expect(clearFindings[0].outcomeKind).toBe('CLEAR_TO_PROCEED');
  });

  it('Capability 2: Enforces Redacted Cross-Bureau Visibility and Scoped Access lifecycle states', () => {
    const restrictedCase = seed.cases.find((c) => c.id === 'CL-2026-0128')!;
    const pgrcOfficer = seed.users.find((u) => u.id === 'USR-05')!;
    const owningAuthority = seed.users.find((u) => u.id === 'USR-04')!;

    // Non-owning officer without Approved grant gets denied full access and receives coarse stub
    expect(
      hasFullCaseReadAccess(pgrcOfficer, restrictedCase, seed.accessRequests, seed.demoDate)
    ).toBe(false);
    const stub = buildRedactedStub(restrictedCase);
    expect(stub.redacted).toBe(true);
    expect(stub.coarseCategory).toBe('Faculty Cadre & Qualification Compliance');

    // Owning Academic Inspection officer gets full read access
    expect(
      hasFullCaseReadAccess(owningAuthority, restrictedCase, seed.accessRequests, seed.demoDate)
    ).toBe(true);

    // Expired grant REQ-2026-04 on CL-2026-0116 denies full access to USR-05
    const vigCase = seed.cases.find((c) => c.id === 'CL-2026-0116')!;
    expect(
      hasFullCaseReadAccess(pgrcOfficer, vigCase, seed.accessRequests, seed.demoDate)
    ).toBe(false);
    // Approved non-expired grant REQ-2026-02 grants access to USR-04
    expect(
      hasFullCaseReadAccess(owningAuthority, vigCase, seed.accessRequests, seed.demoDate)
    ).toBe(true);
  });

  it('Capability 3: Shared Evidence Vault links independent bureau outcomes and detects superseded versions', () => {
    const pgrcCase = seed.cases.find((c) => c.id === 'CL-2026-0124')!;
    const rbCase = seed.cases.find((c) => c.id === 'CL-2026-0125')!;
    const vaultArt = seed.evidenceVault.find((e) => e.id === 'EVD-2026-01')!;

    expect(pgrcCase.status).toBe('Resolved');
    expect(rbCase.status).toBe('In Progress'); // Independent outcomes preserved!
    expect(vaultArt.currentVersion).toBe('v2');
    expect(pgrcCase.evidenceLinks[0].linkedVersion).toBe('v2');
    expect(rbCase.evidenceLinks[0].linkedVersion).toBe('v1'); // Triggers newer-version notice!
  });

  it('Capability 4: Detects 60-day Cohort Pattern Clusters and re-opens Negative Memory suppressions on fact change', () => {
    const cohorts = evaluateCohortClusters(
      seed.cases,
      seed.demoDate,
      seed.settings.cohortRollingDays,
      seed.settings.cohortThresholdCount
    );
    const abcCohort = cohorts.find((c) => c.institutionId === 'INST-MH-2040');
    expect(abcCohort).toBeDefined();
    expect(abcCohort!.activeCaseIds.length).toBeGreaterThanOrEqual(3);
    expect(abcCohort!.exceedsThreshold).toBe(true);

    // Negative memory stays active when signature unchanged
    const unchanged = reevaluateSuppressions(
      seed.suppressions,
      seed.cases,
      seed.actions,
      seed.settings.relationshipRuleVersion,
      '2026-10-22 10:00'
    );
    expect(unchanged.reopenedIds.length).toBe(0);

    // Bumping rule version automatically re-opens suppressed pair SUP-2026-01!
    const reopened = reevaluateSuppressions(
      seed.suppressions,
      seed.cases,
      seed.actions,
      'REL-RULE-v2.4',
      '2026-10-22 10:05'
    );
    expect(reopened.reopenedIds).toContain('SUP-2026-01');
    expect(reopened.updated[0].active).toBe(false);
    expect(
      computePairFactSignature(
        ['CL-2026-0114', 'CL-2026-0121'],
        seed.cases,
        seed.actions,
        'REL-RULE-v2.4'
      )
    ).not.toBe(seed.suppressions[0].baselineFactSignature);
  });

  it('Capability 5: Effective-Date-Aware RAG distinguishes current 2025 circular from historical 2023 circular and blocks restricted docs', () => {
    const pgrcOfficer = seed.users.find((u) => u.id === 'USR-05')!;

    // Current incident date (2026-10-08) returns DOC-POL-2025-09 as In Force
    const currentRes = runLocalKnowledgeQuery(
      'fee refund deduction limit',
      seed.documents,
      { category: 'All', asOfIncidentDate: '2026-10-08' },
      true,
      {
        currentUser: pgrcOfficer,
        cases: seed.cases,
        accessRequests: seed.accessRequests,
        demoDate: seed.demoDate,
      }
    );
    expect(currentRes.matches[0].document.id).toBe('DOC-POL-2025-09');
    expect(currentRes.matches[0].validityStatus).toBe('In Force on Target Date');

    // Historical incident date (2024-11-12) returns DOC-POL-2023-02 as Historically Applicable
    const histRes = runLocalKnowledgeQuery(
      'fee refund deduction 2500 historical',
      seed.documents,
      { category: 'All', asOfIncidentDate: '2024-11-12' },
      true,
      {
        currentUser: pgrcOfficer,
        cases: seed.cases,
        accessRequests: seed.accessRequests,
        demoDate: seed.demoDate,
      }
    );
    expect(histRes.matches[0].document.id).toBe('DOC-POL-2023-02');
    expect(histRes.matches[0].validityStatus).toBe('Historically Applicable');

    // Unauthorized officer cannot retrieve restricted annexure DOC-CASE-2026-11
    const restrictedAttempt = runLocalKnowledgeQuery(
      'forged phd degree ece qualification',
      seed.documents,
      { category: 'All' },
      true,
      {
        currentUser: pgrcOfficer,
        cases: seed.cases,
        accessRequests: seed.accessRequests,
        demoDate: seed.demoDate,
      }
    );
    expect(restrictedAttempt.restrictedDocsExcludedCount).toBeGreaterThanOrEqual(1);
    expect(restrictedAttempt.matches.some((m) => m.document.id === 'DOC-CASE-2026-11')).toBe(false);
  });

  it('Capability 6 & 7: Evaluates non-blocking Readiness Checkpoints and runs 60-scenario Degraded vs Hybrid benchmark cleanly', () => {
    const readiness = evaluateInstitutionReadiness(
      'INST-MH-2040',
      seed.cases,
      seed.actions,
      seed.alerts,
      seed.evidenceVault,
      seed.demoDate
    );
    expect(readiness).toHaveLength(3);
    expect(readiness.some((r) => r.state === 'Outstanding items')).toBe(true);

    // Glossary search works with AI completely disabled
    const glossarySearch = filterAndSortCases(
      seed.cases,
      seed.institutions,
      { search: 'caution money' },
      'id',
      'asc',
      seed.demoDate,
      seed.settings.deadlineRules
    );
    expect(glossarySearch.length).toBeGreaterThanOrEqual(3);

    // 60-scenario live reliability benchmark
    const bench = runReliabilityBenchmarkSuite(seed);
    expect(bench.hybridMetrics.totalScenarios).toBe(60);
    expect(bench.degradedMetrics.falsePositiveRatePct).toBe(0);
    expect(bench.hybridMetrics.falsePositiveRatePct).toBe(0);
    expect(bench.hybridMetrics.recallPct).toBeGreaterThan(bench.degradedMetrics.recallPct);
    expect(bench.fallbackCheckPassed).toBe(true);
    expect(bench.deterministicChecks.every((c) => c.passed)).toBe(true);

    // Preserve core SLA & RBAC validation checks
    const overdueCase = seed.cases.find((c) => c.id === 'CL-2026-0102')!;
    expect(getCaseSlaStatus(overdueCase, seed.demoDate, seed.settings.deadlineRules).status).toBe(
      'Overdue'
    );
    const auditor = seed.users.find((u) => u.role === 'Read-Only Auditor')!;
    expect(
      validateNewCase(
        {
          institutionId: 'INST-MH-2040',
          subject: 'Auditor write test subject',
          category: 'Fee Refund & Admission Cancellation',
          description: 'Verifies Read-Only Auditor cannot write records.',
          sourceChannel: 'Portal Grievance',
          sourceBureau: 'Student Welfare Cell',
          assignedBureau: 'Student Welfare Cell',
          assignedOfficerId: 'USR-05',
          priority: 'Standard',
          receivedDate: '2026-10-22',
          dueDate: '2026-11-12',
        },
        seed.institutions,
        auditor
      ).form
    ).toContain('Read-Only Auditor');
  });

  it('Operational Dashboard Consistency: KPI counts, desk scopes, pre-dispatch queue, and AI-disabled mode match underlying dataset', () => {
    for (const user of seed.users) {
      const snap = getOperationalSnapshot(seed, user, 'All');

      // Sidebar active cases count == Dashboard All-Bureau KPI == Cases register ?scope=active
      const navActiveCount = seed.cases.filter((c) => !isTerminalCaseStatus(c.status)).length;
      const filteredAllActive = filterAndSortCases(
        seed.cases,
        seed.institutions,
        { activeOnly: true },
        'dueDate',
        'asc',
        seed.demoDate,
        seed.settings.deadlineRules,
        { currentUser: user, accessRequests: seed.accessRequests, demoDate: seed.demoDate }
      );
      expect(snap.activeCases.length).toBe(navActiveCount);
      expect(filteredAllActive.length).toBe(snap.activeCases.length);

      // My Desk active cases == Cases register ?scope=active&assignedBureau=<user.bureau>
      const filteredMyDesk = filterAndSortCases(
        seed.cases,
        seed.institutions,
        { activeOnly: true, assignedBureau: user.bureau },
        'dueDate',
        'asc',
        seed.demoDate,
        seed.settings.deadlineRules,
        { currentUser: user, accessRequests: seed.accessRequests, demoDate: seed.demoDate }
      );
      expect(filteredMyDesk.length).toBe(snap.myBureauActiveCases.length);

      // Overdue KPI == Cases register ?scope=active&sla=Overdue
      const filteredOverdue = filterAndSortCases(
        seed.cases,
        seed.institutions,
        { activeOnly: true, slaFilter: 'Overdue' },
        'dueDate',
        'asc',
        seed.demoDate,
        seed.settings.deadlineRules,
        { currentUser: user, accessRequests: seed.accessRequests, demoDate: seed.demoDate }
      );
      expect(filteredOverdue.length).toBe(snap.overdueCases.length);

      // Sidebar alert badge == Dashboard open alerts == Coordination ?status=Active
      const navAlerts = seed.alerts.filter((a) => isOpenCoordinationAlert(a));
      expect(snap.openAlerts.length).toBe(navAlerts.length);
    }

    // Queued draft pre-dispatch checks order conflicts ahead of routine clear items
    const approvalOfficer = seed.users.find((u) => u.id === 'USR-02')!;
    const queue = evaluateDraftActionsQueue(seed, approvalOfficer, 'All');
    expect(queue.length).toBe(3);
    expect(queue[0].action.id).toBe('ACT-2026-01');
    expect(queue[0].primaryFinding.severity).toBe('Mandatory Clearance Required');
    expect(queue[0].primaryFinding.redactedConfidentialDetails).toBe(true);
    expect(queue[1].action.id).toBe('ACT-2026-06');
    expect(queue[1].primaryFinding.outcomeKind).toBe('DUPLICATE_EVIDENCE_REQUEST');
    expect(queue[2].action.id).toBe('ACT-2026-08');
    expect(queue[2].primaryFinding.outcomeKind).toBe('CLEAR_TO_PROCEED');

    // Disabling AI leaves every deterministic operational metric untouched
    const coordinator = seed.users[0];
    const aiOnSnap = getOperationalSnapshot(seed, coordinator, 'All');
    const aiOffSnap = getOperationalSnapshot(
      { ...seed, settings: { ...seed.settings, aiAssistanceEnabled: false } },
      coordinator,
      'All'
    );
    expect(aiOffSnap.activeCases.length).toBe(aiOnSnap.activeCases.length);
    expect(aiOffSnap.overdueCases.length).toBe(aiOnSnap.overdueCases.length);
    expect(aiOffSnap.draftClearanceQueue.length).toBe(aiOnSnap.draftClearanceQueue.length);
    expect(aiOffSnap.openAlerts.length).toBe(aiOnSnap.openAlerts.length);
  });
});
