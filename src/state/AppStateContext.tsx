import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  AccessRequestStatus,
  AdministrativeAction,
  AlertStatus,
  AppStateData,
  AuditEvent,
  BureauName,
  CasePriority,
  CaseRecord,
  CaseStatus,
  ClearanceFinding,
  CoordinationTask,
  EvidenceArtifact,
  KnowledgeDocument,
  RelationshipTaxonomy,
  ScopedAccessRequest,
  SystemSettings,
  UserProfile,
} from '../types/domain';
import { loadAppState, resetAppState, saveAppState } from '../services/storage';
import { canUserModifyRecords, NewCaseInput } from '../services/caseService';
import {
  computePairFactSignature,
  evaluatePreDispatchClearance,
  PlannedActionDraft,
  reevaluateSuppressions,
} from '../services/clearanceService';

export interface CreateDocumentInput {
  title: string;
  category: KnowledgeDocument['category'];
  docType: KnowledgeDocument['docType'];
  issuingBureau: BureauName;
  version: string;
  publicationDate: string;
  effectiveFrom: string;
  effectiveTo?: string;
  supersededByDocId?: string;
  applicableScope: string;
  accessScope: KnowledgeDocument['accessScope'];
  reviewStatus: KnowledgeDocument['reviewStatus'];
  linkedInstitutionId?: string;
  summary: string;
  extractedPreview: string;
  keywordsCsv: string;
}

export interface UploadEvidenceInput {
  targetArtifactId?: string; // If provided, appends a new version (v2, v3...) instead of new artifact!
  institutionId: string;
  academicYear: string;
  artifactType: EvidenceArtifact['artifactType'];
  title: string;
  submittedBy: string;
  fileSizeLabel: string;
  summary: string;
  changeSummary: string;
  linkToCaseId?: string;
  usagePurpose?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'error';
}

interface AppContextValue {
  state: AppStateData;
  currentUser: UserProfile;
  canWrite: boolean;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  switchUser: (userId: string) => void;
  resetDemoData: () => void;
  createCase: (input: NewCaseInput) => { ok: boolean; caseId?: string; error?: string };
  updateCaseStatus: (
    caseId: string,
    nextStatus: CaseStatus,
    note: string,
    outcomeText?: string
  ) => { ok: boolean; error?: string };
  addCaseNote: (caseId: string, note: string) => { ok: boolean; error?: string };
  reassignCase: (
    caseId: string,
    bureau: BureauName,
    officerId: string,
    priority: CasePriority,
    note: string
  ) => { ok: boolean; error?: string };
  // Capability 1: Pre-Dispatch Action Clearance
  previewActionClearance: (draft: PlannedActionDraft) => ClearanceFinding[];
  submitPlannedAction: (
    draft: PlannedActionDraft,
    mode: 'save_draft' | 'issue_with_clearance',
    seniorOverrideReason?: string
  ) => { ok: boolean; actionId?: string; error?: string; findings?: ClearanceFinding[] };
  issueDraftAction: (
    actionId: string,
    seniorOverrideReason?: string
  ) => { ok: boolean; error?: string; findings?: ClearanceFinding[] };
  resolveDraftWithVaultArtifact: (
    actionId: string,
    artifactId: string
  ) => { ok: boolean; error?: string };
  // Capability 2: Redacted Cross-Bureau Scoped Access
  submitScopedAccessRequest: (
    caseId: string,
    purpose: string,
    requestedScope: ScopedAccessRequest['requestedScope']
  ) => { ok: boolean; requestId?: string; error?: string };
  decideScopedAccessRequest: (
    requestId: string,
    decision: AccessRequestStatus,
    note: string,
    approvedScope?: string,
    expiresOn?: string
  ) => { ok: boolean; error?: string };
  // Capability 3: Shared Evidence Vault
  subscribeCaseToEvidence: (
    caseId: string,
    artifactId: string,
    usagePurpose: string
  ) => { ok: boolean; error?: string };
  uploadEvidenceToVault: (
    input: UploadEvidenceInput
  ) => { ok: boolean; artifactId?: string; version?: string; error?: string };
  verifyVaultArtifact: (
    artifactId: string,
    note: string
  ) => { ok: boolean; error?: string };
  // Capability 4: Five-Part Taxonomy & Negative Memory
  updateAlertWorkflow: (
    alertId: string,
    status: AlertStatus,
    decisionNote: string,
    entryType: 'Discussion' | 'Decision' | 'Dismissal',
    taxonomyOverride?: RelationshipTaxonomy
  ) => { ok: boolean; error?: string };
  suppressAlertPair: (
    alertId: string,
    reason: string
  ) => { ok: boolean; suppressionId?: string; error?: string };
  createCoordinationTask: (
    task: Omit<CoordinationTask, 'id' | 'createdAt'>
  ) => { ok: boolean; taskId?: string; error?: string };
  updateTaskStatus: (
    taskId: string,
    status: CoordinationTask['status']
  ) => { ok: boolean; error?: string };
  addKnowledgeDocument: (
    input: CreateDocumentInput
  ) => { ok: boolean; docId?: string; error?: string };
  reindexKnowledgeDocument: (docId: string) => void;
  updateSettings: (next: Partial<SystemSettings>, changeSummary: string) => void;
  addUserRoleProfile: (user: Omit<UserProfile, 'id'>) => { ok: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AppStateContext = createContext<AppContextValue | undefined>(undefined);

function nowStamp(demoDate: string): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${demoDate} ${hh}:${mm}`;
}

function deterministicMockHash(seedText: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seedText.length; i++) {
    const ch = seedText.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const partA = (h1 >>> 0).toString(16).padStart(8, '0');
  const partB = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${partA}${partB}7f3c91a402e8b516${partB}${partA}c490d2e1`;
}

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppStateData>(() => loadAppState());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const persist = useCallback((updater: (prev: AppStateData) => AppStateData) => {
    setState((prev) => {
      const updated = updater(prev);
      // Automatically run negative memory suppression watch whenever state changes!
      const reeval = reevaluateSuppressions(
        updated.suppressions,
        updated.cases,
        updated.actions,
        updated.settings.relationshipRuleVersion,
        nowStamp(updated.demoDate)
      );
      let finalState = updated;
      if (reeval.reopenedIds.length > 0) {
        finalState = {
          ...updated,
          suppressions: reeval.updated,
          auditLog: [
            {
              id: `AUD-${1000 + updated.auditLog.length + 1}`,
              timestamp: nowStamp(updated.demoDate),
              actorName: 'Negative Memory Watcher',
              actorRole: 'Cross-Bureau Coordinator',
              actorBureau: 'Policy & Vigilance Bureau',
              entityType: 'Coordination Alert',
              entityId: reeval.reopenedIds.join(', '),
              actionType: 'Suppression Reopened',
              summary: `Automatically re-opened suppressed pair (${reeval.reopenedIds.join(', ')}) because watched case/action/version facts changed.`,
            },
            ...updated.auditLog,
          ],
        };
      }
      saveAppState(finalState);
      return finalState;
    });
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId]
  );

  const canWrite = canUserModifyRecords(currentUser);

  const makeAudit = useCallback(
    (
      prev: AppStateData,
      entityType: AuditEvent['entityType'],
      entityId: string,
      actionType: AuditEvent['actionType'],
      summary: string,
      previousValue?: string,
      newValue?: string
    ): AuditEvent => ({
      id: `AUD-${1000 + prev.auditLog.length + 1}`,
      timestamp: nowStamp(prev.demoDate),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      actorBureau: currentUser.bureau,
      entityType,
      entityId,
      actionType,
      summary,
      previousValue,
      newValue,
    }),
    [currentUser]
  );

  const switchUser = useCallback(
    (userId: string) => {
      persist((prev) => ({ ...prev, currentUserId: userId }));
    },
    [persist]
  );

  const resetDemoData = useCallback(() => {
    const fresh = resetAppState();
    setState(fresh);
  }, []);

  const createCase = useCallback(
    (input: NewCaseInput) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot create case records.' };
      }
      const nextNum = 130 + state.cases.length;
      const newCaseId = `CL-2026-0${nextNum}`;
      const stamp = nowStamp(state.demoDate);

      const sameInstCases = state.cases.filter((c) => c.institutionId === input.institutionId);
      const relatedCandidates: CaseRecord['relatedCandidates'] = sameInstCases.map((existing) => {
        const sameCategory = existing.category === input.category;
        return {
          targetCaseId: existing.id,
          matchBasis: sameCategory ? 'Deterministic Rule' : 'Keyword & Synonym Match',
          ruleCode: sameCategory ? 'RULE-COHORT-INST-02' : undefined,
          evidenceStrength: sameCategory ? 'Strong' : 'Insufficient Evidence',
          sharedFactors: sameCategory
            ? [`Exact AICTE Institution ID (${input.institutionId})`, `Shared category: ${input.category}`]
            : [`Same AICTE Institution ID (${input.institutionId}) — distinct issue scope`],
          cautionNote: sameCategory
            ? 'Human coordinator review required before linking under 60-day cohort check.'
            : 'Same institution alone does not establish an operational relationship.',
          taxonomy: sameCategory ? 'Cohort / Pattern Cluster' : 'Verified Independent',
        };
      });

      const created: CaseRecord = {
        id: newCaseId,
        institutionId: input.institutionId,
        subject: input.subject.trim(),
        category: input.category,
        description: input.description.trim(),
        incidentDate: input.receivedDate,
        academicYear: 'AY 2026-27',
        sourceChannel: input.sourceChannel,
        sourceBureau: input.sourceBureau,
        assignedBureau: input.assignedBureau,
        assignedOfficerId: input.assignedOfficerId,
        priority: input.priority,
        status: 'Open',
        receivedDate: input.receivedDate,
        dueDate: input.dueDate,
        lastUpdated: stamp,
        visibility: 'Standard Cross-Bureau',
        timeline: [
          {
            id: `TL-${newCaseId}-1`,
            timestamp: stamp,
            actor: currentUser.name,
            actorBureau: currentUser.bureau,
            type: 'Intake',
            summary: `Case registered via ${input.sourceChannel} and assigned to ${input.assignedBureau}.`,
          },
        ],
        documents: [],
        evidenceLinks: [],
        relatedCandidates,
      };

      persist((prev) => ({
        ...prev,
        cases: [created, ...prev.cases],
        auditLog: [
          makeAudit(
            prev,
            'Case',
            newCaseId,
            'Case Created',
            `Registered case "${created.subject}" for ${created.institutionId} (${created.assignedBureau}).`,
            undefined,
            `Status: Open | Priority: ${created.priority}`
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, caseId: newCaseId };
    },
    [canWrite, currentUser, makeAudit, persist, state.cases, state.demoDate]
  );

  const updateCaseStatus = useCallback(
    (caseId: string, nextStatus: CaseStatus, note: string, outcomeText?: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot change workflow status.' };
      }
      if (!note.trim()) {
        return { ok: false, error: 'A rationale note is mandatory for status changes.' };
      }
      const target = state.cases.find((c) => c.id === caseId);
      if (!target) return { ok: false, error: 'Case not found.' };

      const stamp = nowStamp(state.demoDate);
      persist((prev) => ({
        ...prev,
        cases: prev.cases.map((c) => {
          if (c.id !== caseId) return c;
          const isClosing = nextStatus === 'Resolved' || nextStatus === 'Closed';
          return {
            ...c,
            status: nextStatus,
            resolvedDate: isClosing ? prev.demoDate : c.resolvedDate,
            recordedOutcome: outcomeText?.trim() ? outcomeText.trim() : c.recordedOutcome,
            lastUpdated: stamp,
            timeline: [
              ...c.timeline,
              {
                id: `TL-${Date.now()}`,
                timestamp: stamp,
                actor: currentUser.name,
                actorBureau: currentUser.bureau,
                type: isClosing ? 'Resolution' : 'Status Change',
                summary: `Status updated from "${c.status}" to "${nextStatus}".`,
                details: note.trim(),
              },
            ],
          };
        }),
        auditLog: [
          makeAudit(
            prev,
            'Case',
            caseId,
            'Status Changed',
            `Updated status of ${caseId}: ${note.trim()}`,
            target.status,
            nextStatus
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.cases, state.demoDate]
  );

  const addCaseNote = useCallback(
    (caseId: string, note: string) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor role cannot add case notes.' };
      if (!note.trim()) return { ok: false, error: 'Note text cannot be empty.' };
      const stamp = nowStamp(state.demoDate);
      persist((prev) => ({
        ...prev,
        cases: prev.cases.map((c) =>
          c.id === caseId
            ? {
                ...c,
                lastUpdated: stamp,
                timeline: [
                  ...c.timeline,
                  {
                    id: `TL-${Date.now()}`,
                    timestamp: stamp,
                    actor: currentUser.name,
                    actorBureau: currentUser.bureau,
                    type: 'Note',
                    summary: note.trim(),
                  },
                ],
              }
            : c
        ),
        auditLog: [
          makeAudit(prev, 'Case', caseId, 'Note Added', `Added note on ${caseId}: "${note.trim()}"`),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.demoDate]
  );

  const reassignCase = useCallback(
    (caseId: string, bureau: BureauName, officerId: string, priority: CasePriority, note: string) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor role cannot reassign cases.' };
      if (!note.trim()) return { ok: false, error: 'Please record a brief routing note.' };
      const existing = state.cases.find((c) => c.id === caseId);
      if (!existing) return { ok: false, error: 'Case not found.' };
      const stamp = nowStamp(state.demoDate);
      persist((prev) => ({
        ...prev,
        cases: prev.cases.map((c) =>
          c.id === caseId
            ? {
                ...c,
                assignedBureau: bureau,
                assignedOfficerId: officerId,
                priority,
                lastUpdated: stamp,
                timeline: [
                  ...c.timeline,
                  {
                    id: `TL-${Date.now()}`,
                    timestamp: stamp,
                    actor: currentUser.name,
                    actorBureau: currentUser.bureau,
                    type: 'Assignment',
                    summary: `Routed to ${bureau} (Priority: ${priority}).`,
                    details: note.trim(),
                  },
                ],
              }
            : c
        ),
        auditLog: [
          makeAudit(
            prev,
            'Case',
            caseId,
            'Assignment Updated',
            `Routed ${caseId} to ${bureau}: ${note.trim()}`,
            `${existing.assignedBureau} (${existing.priority})`,
            `${bureau} (${priority})`
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.cases, state.demoDate]
  );

  // Capability 1: Synchronous Pre-Dispatch Clearance Preview & Enforcement
  const previewActionClearance = useCallback(
    (draft: PlannedActionDraft): ClearanceFinding[] => {
      return evaluatePreDispatchClearance(
        draft,
        state.actions,
        state.cases,
        state.evidenceVault,
        state.settings,
        currentUser,
        state.demoDate
      );
    },
    [currentUser, state.actions, state.cases, state.demoDate, state.evidenceVault, state.settings]
  );

  const submitPlannedAction = useCallback(
    (
      draft: PlannedActionDraft,
      mode: 'save_draft' | 'issue_with_clearance',
      seniorOverrideReason?: string
    ) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot dispatch or draft actions.' };
      }
      if (!draft.purpose.trim() || !draft.scope.trim()) {
        return { ok: false, error: 'Action purpose and scope description are required.' };
      }

      const findings = evaluatePreDispatchClearance(
        draft,
        state.actions,
        state.cases,
        state.evidenceVault,
        state.settings,
        currentUser,
        state.demoDate
      );

      const mandatoryBlock = findings.find(
        (f) => f.severity === 'Mandatory Clearance Required'
      );

      if (mode === 'issue_with_clearance' && mandatoryBlock) {
        const isSenior =
          currentUser.role === 'Senior Review Authority' ||
          currentUser.role === 'Cross-Bureau Coordinator';
        if (!isSenior) {
          return {
            ok: false,
            findings,
            error:
              'Mandatory Pre-Dispatch Clearance block active: Only a Senior Review Authority or Cross-Bureau Coordinator may authorise override dispatch.',
          };
        }
        if (!seniorOverrideReason || seniorOverrideReason.trim().length < 10) {
          return {
            ok: false,
            findings,
            error:
              'Authorised override requires a documented reason (minimum 10 characters) for the audit trail.',
          };
        }
      }

      const actionId = `ACT-2026-0${state.actions.length + 8}`;
      const stamp = nowStamp(state.demoDate);
      const isOverride = Boolean(mode === 'issue_with_clearance' && mandatoryBlock);

      const newAction: AdministrativeAction = {
        id: actionId,
        caseId: draft.caseId,
        institutionId: draft.institutionId,
        bureau: currentUser.bureau,
        ownerId: currentUser.id,
        actionType: draft.actionType,
        purpose: draft.purpose.trim(),
        requestedEvidenceType: draft.requestedEvidenceType,
        academicYear: draft.academicYear,
        scope: draft.scope.trim(),
        scheduledStart: draft.scheduledStart,
        scheduledEnd: draft.scheduledEnd,
        status: mode === 'save_draft' ? 'Draft' : 'Issued',
        confidentiality:
          draft.actionType === 'Surprise Inspection' ? 'Confidential Inspection' : 'Standard',
        notes: isOverride
          ? `Dispatched with Senior Override: ${seniorOverrideReason!.trim()}`
          : `${draft.purpose.trim()} (${findings[0]?.ruleCode ?? 'CLR'})`,
        clearanceCheckRecord: {
          checkedAt: stamp,
          checkedBy: currentUser.name,
          highestSeverity: mandatoryBlock
            ? 'Mandatory Clearance Required'
            : findings[0]?.severity ?? 'Clear to Proceed',
          ruleCodesTriggered: findings.map((f) => f.ruleCode),
          overrideApplied: isOverride,
          overrideAuthorizer: isOverride ? `${currentUser.name} (${currentUser.role})` : undefined,
          overrideReason: isOverride ? seniorOverrideReason!.trim() : undefined,
        },
      };

      persist((prev) => ({
        ...prev,
        actions: [newAction, ...prev.actions],
        cases: prev.cases.map((c) =>
          c.id === draft.caseId
            ? {
                ...c,
                lastUpdated: stamp,
                timeline: [
                  ...c.timeline,
                  {
                    id: `TL-${Date.now()}`,
                    timestamp: stamp,
                    actor: currentUser.name,
                    actorBureau: currentUser.bureau,
                    type: 'Administrative Action',
                    summary:
                      mode === 'save_draft'
                        ? `Saved planned ${draft.actionType} (${actionId}) in Draft.`
                        : isOverride
                        ? `Issued ${draft.actionType} (${actionId}) with Senior Override.`
                        : `Issued ${draft.actionType} (${actionId}) following Pre-Dispatch Clearance.`,
                    details: isOverride
                      ? `Override Reason: ${seniorOverrideReason!.trim()}`
                      : `Clearance check: ${findings.map((f) => f.ruleCode).join(', ')}`,
                  },
                ],
              }
            : c
        ),
        auditLog: [
          makeAudit(
            prev,
            'Action Clearance',
            actionId,
            isOverride ? 'Clearance Override' : 'Pre-Dispatch Check',
            isOverride
              ? `Issued ${actionId} (${draft.actionType}) on ${draft.institutionId} with Senior Override: "${seniorOverrideReason!.trim()}"`
              : `${mode === 'save_draft' ? 'Saved draft' : 'Cleared & issued'} ${actionId} (${draft.actionType}) on ${draft.institutionId} [${findings.map((f) => f.ruleCode).join(', ')}].`,
            'Draft',
            newAction.status
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, actionId, findings };
    },
    [canWrite, currentUser, makeAudit, persist, state.actions, state.cases, state.demoDate, state.evidenceVault, state.settings]
  );

  const issueDraftAction = useCallback(
    (actionId: string, seniorOverrideReason?: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot dispatch queued draft actions.' };
      }
      const existing = state.actions.find((a) => a.id === actionId);
      if (!existing) return { ok: false, error: 'Draft action not found.' };

      const caseRec = state.cases.find((c) => c.id === existing.caseId);
      const findings = evaluatePreDispatchClearance(
        {
          caseId: existing.caseId,
          institutionId: existing.institutionId,
          actionType: existing.actionType,
          purpose: existing.purpose,
          requestedEvidenceType: existing.requestedEvidenceType,
          academicYear: existing.academicYear ?? caseRec?.academicYear ?? 'AY 2026-27',
          scope: existing.scope,
          scheduledStart: existing.scheduledStart,
          scheduledEnd: existing.scheduledEnd,
          excludeActionId: existing.id,
        },
        state.actions,
        state.cases,
        state.evidenceVault,
        state.settings,
        currentUser,
        state.demoDate
      );

      const mandatoryBlock = findings.find((f) => f.severity === 'Mandatory Clearance Required');
      if (mandatoryBlock) {
        const isSenior =
          currentUser.role === 'Senior Review Authority' ||
          currentUser.role === 'Cross-Bureau Coordinator';
        if (!isSenior) {
          return {
            ok: false,
            findings,
            error:
              'Mandatory Pre-Dispatch Clearance block active: Only a Senior Review Authority or Cross-Bureau Coordinator may authorise override dispatch.',
          };
        }
        if (!seniorOverrideReason || seniorOverrideReason.trim().length < 10) {
          return {
            ok: false,
            findings,
            error:
              'Authorised override requires a documented reason (minimum 10 characters) for the audit trail.',
          };
        }
      }

      const stamp = nowStamp(state.demoDate);
      const isOverride = Boolean(mandatoryBlock);

      persist((prev) => ({
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === actionId
            ? {
                ...a,
                status: 'Issued',
                notes: isOverride
                  ? `Dispatched with Senior Override: ${seniorOverrideReason!.trim()}`
                  : `${a.purpose} (${findings[0]?.ruleCode ?? 'CLR'})`,
                clearanceCheckRecord: {
                  checkedAt: stamp,
                  checkedBy: currentUser.name,
                  highestSeverity: mandatoryBlock
                    ? 'Mandatory Clearance Required'
                    : findings[0]?.severity ?? 'Clear to Proceed',
                  ruleCodesTriggered: findings.map((f) => f.ruleCode),
                  overrideApplied: isOverride,
                  overrideAuthorizer: isOverride
                    ? `${currentUser.name} (${currentUser.role})`
                    : undefined,
                  overrideReason: isOverride ? seniorOverrideReason!.trim() : undefined,
                },
              }
            : a
        ),
        cases: prev.cases.map((c) =>
          c.id === existing.caseId
            ? {
                ...c,
                lastUpdated: stamp,
                timeline: [
                  ...c.timeline,
                  {
                    id: `TL-${Date.now()}`,
                    timestamp: stamp,
                    actor: currentUser.name,
                    actorBureau: currentUser.bureau,
                    type: 'Administrative Action',
                    summary: isOverride
                      ? `Issued queued ${existing.actionType} (${actionId}) with Senior Override.`
                      : `Cleared & issued queued ${existing.actionType} (${actionId}).`,
                    details: isOverride
                      ? `Override Reason: ${seniorOverrideReason!.trim()}`
                      : `Clearance rules evaluated: ${findings.map((f) => f.ruleCode).join(', ')}`,
                  },
                ],
              }
            : c
        ),
        auditLog: [
          makeAudit(
            prev,
            'Action Clearance',
            actionId,
            isOverride ? 'Clearance Override' : 'Pre-Dispatch Check',
            isOverride
              ? `Issued queued draft ${actionId} (${existing.actionType}) on ${existing.institutionId} with Senior Override: "${seniorOverrideReason!.trim()}"`
              : `Cleared & dispatched queued draft ${actionId} (${existing.actionType}) on ${existing.institutionId} [${findings.map((f) => f.ruleCode).join(', ')}].`,
            'Draft',
            'Issued'
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, findings };
    },
    [canWrite, currentUser, makeAudit, persist, state.actions, state.cases, state.demoDate, state.evidenceVault, state.settings]
  );

  const resolveDraftWithVaultArtifact = useCallback(
    (actionId: string, artifactId: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot modify draft actions.' };
      }
      const existing = state.actions.find((a) => a.id === actionId);
      const artifact = state.evidenceVault.find((e) => e.id === artifactId);
      if (!existing || !artifact) {
        return { ok: false, error: 'Draft action or vault artifact not found.' };
      }
      const stamp = nowStamp(state.demoDate);

      persist((prev) => ({
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === actionId
            ? {
                ...a,
                status: 'Completed',
                linkedArtifactId: artifactId,
                notes: `Duplicate demand avoided via Pre-Dispatch Clearance; linked Shared Vault ${artifactId} (${artifact.currentVersion}).`,
              }
            : a
        ),
        cases: prev.cases.map((c) => {
          if (c.id !== existing.caseId) return c;
          const otherLinks = c.evidenceLinks.filter((l) => l.artifactId !== artifactId);
          return {
            ...c,
            lastUpdated: stamp,
            evidenceLinks: [
              ...otherLinks,
              {
                artifactId,
                linkedVersion: artifact.currentVersion,
                linkedBureau: currentUser.bureau,
                usagePurpose: `Reused verified Shared Vault artifact instead of duplicate ${existing.actionType} (${actionId})`,
                linkedAt: prev.demoDate,
              },
            ],
            timeline: [
              ...c.timeline,
              {
                id: `TL-${Date.now()}`,
                timestamp: stamp,
                actor: currentUser.name,
                actorBureau: currentUser.bureau,
                type: 'Evidence',
                summary: `Reused Shared Evidence Vault ${artifactId} (${artifact.currentVersion}); retired duplicate draft ${actionId}.`,
              },
            ],
          };
        }),
        auditLog: [
          makeAudit(
            prev,
            'Action Clearance',
            actionId,
            'Evidence Linked',
            `Retired duplicate draft ${actionId} on ${existing.caseId} and linked verified Shared Vault ${artifactId} (${artifact.currentVersion}).`,
            'Draft',
            `Reused ${artifactId} (${artifact.currentVersion})`
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.actions, state.demoDate, state.evidenceVault]
  );

  // Capability 2: Scoped Cross-Bureau Access Requests & Lifecycle Transitions
  const submitScopedAccessRequest = useCallback(
    (
      caseId: string,
      purpose: string,
      requestedScope: ScopedAccessRequest['requestedScope']
    ) => {
      if (!purpose.trim() || purpose.trim().length < 10) {
        return {
          ok: false,
          error: 'Please state a clear official coordination purpose (at least 10 characters).',
        };
      }
      const target = state.cases.find((c) => c.id === caseId);
      if (!target) return { ok: false, error: 'Case not found.' };

      const reqId = `REQ-2026-0${state.accessRequests.length + 1}`;
      const stamp = nowStamp(state.demoDate);

      const newReq: ScopedAccessRequest = {
        id: reqId,
        caseId,
        institutionId: target.institutionId,
        owningBureau: target.assignedBureau,
        requestingUserId: currentUser.id,
        requestingBureau: currentUser.bureau,
        coordinationPurpose: purpose.trim(),
        requestedScope,
        status: 'Pending',
        requestedAt: stamp,
        history: [
          {
            timestamp: stamp,
            actor: currentUser.name,
            bureau: currentUser.bureau,
            event: 'Requested',
            note: `Requested "${requestedScope}": ${purpose.trim()}`,
          },
        ],
      };

      persist((prev) => ({
        ...prev,
        accessRequests: [newReq, ...prev.accessRequests],
        auditLog: [
          makeAudit(
            prev,
            'Access Governance',
            reqId,
            'Access Requested',
            `${currentUser.bureau} requested scoped access (${requestedScope}) on ${caseId}: "${purpose.trim()}"`,
            undefined,
            'Pending'
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, requestId: reqId };
    },
    [currentUser, makeAudit, persist, state.accessRequests.length, state.cases, state.demoDate]
  );

  const decideScopedAccessRequest = useCallback(
    (
      requestId: string,
      decision: AccessRequestStatus,
      note: string,
      approvedScope?: string,
      expiresOn?: string
    ) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot adjudicate access requests.' };
      }
      if (!note.trim()) {
        return { ok: false, error: 'Please record a governance reason note.' };
      }
      const existing = state.accessRequests.find((r) => r.id === requestId);
      if (!existing) return { ok: false, error: 'Request not found.' };

      const stamp = nowStamp(state.demoDate);
      persist((prev) => ({
        ...prev,
        accessRequests: prev.accessRequests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: decision,
                decidedAt: stamp,
                decidedBy: currentUser.name,
                approvedScope: decision === 'Approved' ? approvedScope ?? r.requestedScope : r.approvedScope,
                expiresOn: decision === 'Approved' ? expiresOn ?? '2026-11-15' : r.expiresOn,
                statusNote: note.trim(),
                history: [
                  ...r.history,
                  {
                    timestamp: stamp,
                    actor: currentUser.name,
                    bureau: currentUser.bureau,
                    event: decision === 'Pending' ? 'Requested' : decision,
                    note: note.trim(),
                  },
                ],
              }
            : r
        ),
        auditLog: [
          makeAudit(
            prev,
            'Access Governance',
            requestId,
            'Access Updated',
            `Marked scoped access request ${requestId} on ${existing.caseId} as "${decision}": ${note.trim()}`,
            existing.status,
            decision
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.accessRequests, state.demoDate]
  );

  // Capability 3: Shared Evidence Vault Subscription, Upload, & Verification
  const subscribeCaseToEvidence = useCallback(
    (caseId: string, artifactId: string, usagePurpose: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot modify case evidence links.' };
      }
      const artifact = state.evidenceVault.find((e) => e.id === artifactId);
      if (!artifact) return { ok: false, error: 'Evidence artifact not found.' };
      const stamp = nowStamp(state.demoDate);

      persist((prev) => ({
        ...prev,
        cases: prev.cases.map((c) => {
          if (c.id !== caseId) return c;
          const otherLinks = c.evidenceLinks.filter((l) => l.artifactId !== artifactId);
          return {
            ...c,
            lastUpdated: stamp,
            evidenceLinks: [
              ...otherLinks,
              {
                artifactId,
                linkedVersion: artifact.currentVersion,
                linkedBureau: currentUser.bureau,
                usagePurpose: usagePurpose.trim() || 'Cross-bureau shared evidence subscription',
                linkedAt: prev.demoDate,
              },
            ],
            timeline: [
              ...c.timeline,
              {
                id: `TL-${Date.now()}`,
                timestamp: stamp,
                actor: currentUser.name,
                actorBureau: currentUser.bureau,
                type: 'Evidence',
                summary: `Referenced Shared Evidence Vault artifact ${artifactId} (${artifact.currentVersion} — ${artifact.authenticityStatus}).`,
                details: usagePurpose.trim(),
              },
            ],
          };
        }),
        auditLog: [
          makeAudit(
            prev,
            'Evidence Vault',
            artifactId,
            'Evidence Linked',
            `Linked ${artifactId} (${artifact.currentVersion}) to ${caseId} without merging statutory case outcomes.`
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.demoDate, state.evidenceVault]
  );

  const uploadEvidenceToVault = useCallback(
    (input: UploadEvidenceInput) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot submit vault artifacts.' };
      }
      if (!input.title.trim() || !input.changeSummary.trim()) {
        return { ok: false, error: 'Artifact title and submission/version summary are required.' };
      }
      const stamp = nowStamp(state.demoDate);
      const mockHash = deterministicMockHash(`${input.institutionId}|${input.title}|${stamp}`);

      if (input.targetArtifactId) {
        const existing = state.evidenceVault.find((e) => e.id === input.targetArtifactId);
        if (!existing) return { ok: false, error: 'Target artifact not found.' };
        const nextVer = `v${existing.versions.length + 1}`;
        persist((prev) => ({
          ...prev,
          evidenceVault: prev.evidenceVault.map((e) =>
            e.id === input.targetArtifactId
              ? {
                  ...e,
                  currentVersion: nextVer,
                  submissionDate: prev.demoDate,
                  authenticityStatus: 'Pending Official Verification',
                  versions: [
                    {
                      version: nextVer,
                      submittedDate: prev.demoDate,
                      submittedBy: input.submittedBy.trim() || 'Institutional Nodal Officer',
                      sha256Hash: mockHash,
                      fileSizeLabel: input.fileSizeLabel || '2.2 MB Signed PDF',
                      integrityCheck: 'SHA-256 Verified (Unaltered File)',
                      changeSummary: input.changeSummary.trim(),
                    },
                    ...e.versions,
                  ],
                }
              : e
          ),
          auditLog: [
            makeAudit(
              prev,
              'Evidence Vault',
              existing.id,
              'Evidence Submitted',
              `Appended version ${nextVer} to ${existing.id} (SHA-256 recorded; official authenticity verification pending).`,
              existing.currentVersion,
              nextVer
            ),
            ...prev.auditLog,
          ],
        }));
        return { ok: true, artifactId: existing.id, version: nextVer };
      }

      const newId = `EVD-2026-0${state.evidenceVault.length + 1}`;
      const newArt: EvidenceArtifact = {
        id: newId,
        institutionId: input.institutionId,
        academicYear: input.academicYear,
        artifactType: input.artifactType,
        title: input.title.trim(),
        currentVersion: 'v1',
        submissionDate: state.demoDate,
        authenticityStatus: 'Pending Official Verification',
        accessPolicy: 'Authorised Cross-Bureau Reference',
        summary: input.summary.trim() || input.changeSummary.trim(),
        versions: [
          {
            version: 'v1',
            submittedDate: state.demoDate,
            submittedBy: input.submittedBy.trim() || 'Institutional Nodal Officer',
            sha256Hash: mockHash,
            fileSizeLabel: input.fileSizeLabel || '1.9 MB PDF',
            integrityCheck: 'SHA-256 Verified (Unaltered File)',
            changeSummary: input.changeSummary.trim(),
          },
        ],
      };

      persist((prev) => ({
        ...prev,
        evidenceVault: [newArt, ...prev.evidenceVault],
        cases: input.linkToCaseId
          ? prev.cases.map((c) =>
              c.id === input.linkToCaseId
                ? {
                    ...c,
                    evidenceLinks: [
                      ...c.evidenceLinks,
                      {
                        artifactId: newId,
                        linkedVersion: 'v1',
                        linkedBureau: currentUser.bureau,
                        usagePurpose: input.usagePurpose || 'Initial evidence filing',
                        linkedAt: prev.demoDate,
                      },
                    ],
                  }
                : c
            )
          : prev.cases,
        auditLog: [
          makeAudit(
            prev,
            'Evidence Vault',
            newId,
            'Evidence Submitted',
            `Registered Shared Evidence Vault artifact ${newId} (v1) for ${input.institutionId}; SHA-256 checksum recorded, awaiting official authenticity verification.`
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, artifactId: newId, version: 'v1' };
    },
    [canWrite, currentUser, makeAudit, persist, state.demoDate, state.evidenceVault]
  );

  const verifyVaultArtifact = useCallback(
    (artifactId: string, note: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot certify evidence authenticity.' };
      }
      const existing = state.evidenceVault.find((e) => e.id === artifactId);
      if (!existing) return { ok: false, error: 'Artifact not found.' };
      const stamp = nowStamp(state.demoDate);

      persist((prev) => ({
        ...prev,
        evidenceVault: prev.evidenceVault.map((e) =>
          e.id === artifactId
            ? {
                ...e,
                authenticityStatus: 'Verified by Authority',
                verifiedBy: `${currentUser.name} (${currentUser.role})`,
                verifiedBureau: currentUser.bureau,
                verifiedAt: stamp,
              }
            : e
        ),
        auditLog: [
          makeAudit(
            prev,
            'Evidence Vault',
            artifactId,
            'Evidence Verified',
            `Verified official authenticity of ${artifactId} (${existing.currentVersion}): ${note.trim() || 'Cross-checked against issuing bank/registrar scroll.'}`,
            existing.authenticityStatus,
            'Verified by Authority'
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.demoDate, state.evidenceVault]
  );

  // Capability 4: Five-Part Taxonomy Update & Negative Memory Suppression
  const updateAlertWorkflow = useCallback(
    (
      alertId: string,
      status: AlertStatus,
      decisionNote: string,
      entryType: 'Discussion' | 'Decision' | 'Dismissal',
      taxonomyOverride?: RelationshipTaxonomy
    ) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot modify coordination alerts.' };
      }
      if (!decisionNote.trim()) {
        return { ok: false, error: 'Please record a note or rationale for the audit log.' };
      }
      const target = state.alerts.find((a) => a.id === alertId);
      if (!target) return { ok: false, error: 'Alert not found.' };
      const stamp = nowStamp(state.demoDate);

      persist((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status,
                taxonomy: taxonomyOverride ?? a.taxonomy,
                confirmedDecision:
                  entryType === 'Decision' || entryType === 'Dismissal'
                    ? `${status} (${currentUser.name}, ${prev.demoDate}): ${decisionNote.trim()}`
                    : a.confirmedDecision,
                discussions: [
                  ...a.discussions,
                  {
                    id: `DSC-${Date.now()}`,
                    timestamp: stamp,
                    authorName: currentUser.name,
                    authorBureau: currentUser.bureau,
                    entryType,
                    message: decisionNote.trim(),
                  },
                ],
              }
            : a
        ),
        auditLog: [
          makeAudit(
            prev,
            'Coordination Alert',
            alertId,
            taxonomyOverride ? 'Taxonomy Classified' : 'Alert Reviewed',
            `Updated ${alertId} [${taxonomyOverride ?? target.taxonomy}] to "${status}": ${decisionNote.trim()}`,
            `${target.status} (${target.taxonomy})`,
            `${status} (${taxonomyOverride ?? target.taxonomy})`
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, currentUser, makeAudit, persist, state.alerts, state.demoDate]
  );

  const suppressAlertPair = useCallback(
    (alertId: string, reason: string) => {
      if (!canWrite) {
        return { ok: false, error: 'Read-Only Auditor role cannot suppress alerts.' };
      }
      if (!reason.trim() || reason.trim().length < 10) {
        return {
          ok: false,
          error: 'Please enter a specific justification (at least 10 characters) for Verified Independent suppression.',
        };
      }
      const alert = state.alerts.find((a) => a.id === alertId);
      if (!alert || alert.involvedCaseIds.length < 2) {
        return { ok: false, error: 'Target alert pair not found.' };
      }
      const pair: [string, string] = [alert.involvedCaseIds[0], alert.involvedCaseIds[1]];
      const sig = computePairFactSignature(
        pair,
        state.cases,
        state.actions,
        state.settings.relationshipRuleVersion
      );
      const supId = `SUP-2026-0${state.suppressions.length + 1}`;
      const stamp = nowStamp(state.demoDate);

      persist((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status: 'Dismissed',
                taxonomy: 'Verified Independent',
                confirmedDecision: `Suppressed as Verified Independent (${supId}) on ${prev.demoDate}: ${reason.trim()}`,
                discussions: [
                  ...a.discussions,
                  {
                    id: `DSC-${Date.now()}`,
                    timestamp: stamp,
                    authorName: currentUser.name,
                    authorBureau: currentUser.bureau,
                    entryType: 'Dismissal',
                    message: `Recorded Verified Independent suppression (${supId}): ${reason.trim()}`,
                  },
                ],
              }
            : a
        ),
        suppressions: [
          {
            id: supId,
            casePair: pair,
            institutionId: alert.institutionId,
            reviewerName: currentUser.name,
            reviewerRole: currentUser.role,
            reason: reason.trim(),
            ruleVersion: prev.settings.relationshipRuleVersion,
            lastReviewedAt: stamp,
            baselineFactSignature: sig,
            changeConditionsWatched: [
              'New administrative action scheduled on either case',
              'New source document or Shared Evidence Vault link attached',
              'Target due date modified',
              'Relationship rule version incremented',
            ],
            active: true,
          },
          ...prev.suppressions,
        ],
        auditLog: [
          makeAudit(
            prev,
            'Coordination Alert',
            supId,
            'Alert Suppressed',
            `Recorded Negative Memory suppression ${supId} for ${pair[0]} ↔ ${pair[1]} under ${state.settings.relationshipRuleVersion}: "${reason.trim()}"`
          ),
          ...prev.auditLog,
        ],
      }));

      return { ok: true, suppressionId: supId };
    },
    [canWrite, currentUser, makeAudit, persist, state.actions, state.alerts, state.cases, state.demoDate, state.settings.relationshipRuleVersion, state.suppressions.length]
  );

  const createCoordinationTask = useCallback(
    (taskInput: Omit<CoordinationTask, 'id' | 'createdAt'>) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor role cannot create tasks.' };
      if (!taskInput.title.trim()) return { ok: false, error: 'Task title is required.' };
      const taskId = `TSK-2026-0${state.tasks.length + 5}`;
      const newTask: CoordinationTask = { ...taskInput, id: taskId, createdAt: state.demoDate };
      persist((prev) => ({
        ...prev,
        tasks: [newTask, ...prev.tasks],
        auditLog: [
          makeAudit(prev, 'Coordination Task', taskId, 'Task Updated', `Created task "${newTask.title}" (${newTask.leadBureau}).`, undefined, newTask.status),
          ...prev.auditLog,
        ],
      }));
      return { ok: true, taskId };
    },
    [canWrite, makeAudit, persist, state.demoDate, state.tasks.length]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: CoordinationTask['status']) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor role cannot update tasks.' };
      const existing = state.tasks.find((t) => t.id === taskId);
      if (!existing) return { ok: false, error: 'Task not found.' };
      persist((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        auditLog: [
          makeAudit(prev, 'Coordination Task', taskId, 'Task Updated', `Task "${existing.title}" marked "${status}".`, existing.status, status),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, makeAudit, persist, state.tasks]
  );

  const addKnowledgeDocument = useCallback(
    (input: CreateDocumentInput) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor role cannot register documents.' };
      if (!input.title.trim() || !input.extractedPreview.trim()) {
        return { ok: false, error: 'Document title and extracted text preview are required.' };
      }
      const docId = `DOC-POL-2026-0${state.documents.length + 2}`;
      const stamp = nowStamp(state.demoDate);
      const keywords = input.keywordsCsv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const newDoc: KnowledgeDocument = {
        id: docId,
        title: input.title.trim(),
        category: input.category,
        docType: input.docType,
        issuingBureau: input.issuingBureau,
        version: input.version.trim() || 'v1.0',
        publicationDate: input.publicationDate,
        effectiveDate: input.effectiveFrom,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo || undefined,
        supersededByDocId: input.supersededByDocId || undefined,
        applicableScope: input.applicableScope.trim() || 'AY 2026-27 onwards',
        accessScope: input.accessScope,
        reviewStatus: input.reviewStatus,
        indexingStatus: 'Indexed',
        lastIndexedAt: stamp,
        linkedInstitutionId: input.linkedInstitutionId || undefined,
        linkedCaseIds: [],
        summary: input.summary.trim() || input.title.trim(),
        extractedPreview: input.extractedPreview.trim(),
        passages: [
          {
            id: `PSG-NEW-${Date.now()}`,
            docId,
            section: 'Section 1 — Uploaded Reference Extract',
            page: 1,
            text: input.extractedPreview.trim(),
            keywords: keywords.length > 0 ? keywords : ['policy', 'reference'],
          },
        ],
      };

      persist((prev) => ({
        ...prev,
        documents: [newDoc, ...prev.documents],
        auditLog: [
          makeAudit(
            prev,
            'Knowledge Document',
            docId,
            'Document Indexed',
            `Registered knowledge source "${newDoc.title}" (Effective from ${newDoc.effectiveFrom}).`,
            undefined,
            `${newDoc.indexingStatus} (${newDoc.reviewStatus})`
          ),
          ...prev.auditLog,
        ],
      }));
      return { ok: true, docId };
    },
    [canWrite, makeAudit, persist, state.demoDate, state.documents.length]
  );

  const reindexKnowledgeDocument = useCallback(
    (docId: string) => {
      const stamp = nowStamp(state.demoDate);
      persist((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, indexingStatus: 'Indexed', lastIndexedAt: stamp } : d
        ),
        auditLog: [
          makeAudit(prev, 'Knowledge Document', docId, 'Document Indexed', `Re-indexed passage metadata & validity dates for ${docId}.`),
          ...prev.auditLog,
        ],
      }));
    },
    [makeAudit, persist, state.demoDate]
  );

  const updateSettings = useCallback(
    (next: Partial<SystemSettings>, changeSummary: string) => {
      persist((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...next },
        auditLog: [
          makeAudit(prev, 'System Settings', 'SYS-CFG', 'Settings Modified', changeSummary),
          ...prev.auditLog,
        ],
      }));
    },
    [makeAudit, persist]
  );

  const addUserRoleProfile = useCallback(
    (userInput: Omit<UserProfile, 'id'>) => {
      if (!canWrite) return { ok: false, error: 'Read-Only Auditor cannot add role profiles.' };
      const id = `USR-0${state.users.length + 1}`;
      persist((prev) => ({
        ...prev,
        users: [...prev.users, { ...userInput, id }],
        auditLog: [
          makeAudit(prev, 'System Settings', id, 'Settings Modified', `Added officer profile "${userInput.name}" (${userInput.role}).`),
          ...prev.auditLog,
        ],
      }));
      return { ok: true };
    },
    [canWrite, makeAudit, persist, state.users.length]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [persist]
  );

  const markAllNotificationsRead = useCallback(() => {
    persist((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [persist]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      currentUser,
      canWrite,
      toasts,
      dismissToast,
      switchUser,
      resetDemoData,
      createCase,
      updateCaseStatus,
      addCaseNote,
      reassignCase,
      previewActionClearance,
      submitPlannedAction,
      issueDraftAction,
      resolveDraftWithVaultArtifact,
      submitScopedAccessRequest,
      decideScopedAccessRequest,
      subscribeCaseToEvidence,
      uploadEvidenceToVault,
      verifyVaultArtifact,
      updateAlertWorkflow,
      suppressAlertPair,
      createCoordinationTask,
      updateTaskStatus,
      addKnowledgeDocument,
      reindexKnowledgeDocument,
      updateSettings,
      addUserRoleProfile,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      state,
      currentUser,
      canWrite,
      toasts,
      dismissToast,
      switchUser,
      resetDemoData,
      createCase,
      updateCaseStatus,
      addCaseNote,
      reassignCase,
      previewActionClearance,
      submitPlannedAction,
      issueDraftAction,
      resolveDraftWithVaultArtifact,
      submitScopedAccessRequest,
      decideScopedAccessRequest,
      subscribeCaseToEvidence,
      uploadEvidenceToVault,
      verifyVaultArtifact,
      updateAlertWorkflow,
      suppressAlertPair,
      createCoordinationTask,
      updateTaskStatus,
      addKnowledgeDocument,
      reindexKnowledgeDocument,
      updateSettings,
      addUserRoleProfile,
      markNotificationRead,
      markAllNotificationsRead,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export function useAppState(): AppContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
