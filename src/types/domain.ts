export type BureauName =
  | 'Regulation Bureau (RB)'
  | 'Public Grievance Redressal Cell (PGRC)'
  | 'Approval Bureau'
  | 'Academic Inspection Bureau'
  | 'Policy & Vigilance Bureau'
  | 'Faculty & Pay Redressal Cell'
  | 'Student Welfare Cell';

export type CasePriority = 'Critical' | 'High' | 'Standard' | 'Low';

export type CaseStatus =
  | 'Open'
  | 'In Progress'
  | 'Pending Bureau'
  | 'Awaiting Review'
  | 'Escalated'
  | 'Resolved'
  | 'Closed';

export type InstitutionType =
  | 'Engineering & Technology'
  | 'Management & Applied Sciences'
  | 'Architecture & Planning'
  | 'Polytechnic & Diploma';

export type InstitutionStatus =
  | 'Approved (AY 2026-27)'
  | 'Under Compliance Watch'
  | 'Extension Pending Verification';

export type UserRole =
  | 'Cross-Bureau Coordinator'
  | 'Bureau Case Officer'
  | 'Senior Review Authority'
  | 'Read-Only Auditor';

export interface DemoUser {
  id: string;
  name: string;
  designation: string;
  bureau: BureauName;
  role: UserRole;
  email: string;
  active: boolean;
}

export type UserProfile = DemoUser;

export interface Institution {
  id: string;
  aisheRef: string;
  name: string;
  city: string;
  state: string;
  region:
    | 'Southern'
    | 'South-Central'
    | 'Central'
    | 'South-Western'
    | 'Western'
    | 'Northern';
  type: InstitutionType;
  status: InstitutionStatus;
  approvedIntake: number;
  establishedYear: number;
  complianceNotes: string;
}

export interface CaseDocumentRef {
  docId: string;
  relationNote: string;
  attachedDate: string;
}

export interface CaseEvidenceLink {
  artifactId: string;
  linkedVersion: string;
  linkedBureau: BureauName;
  usagePurpose: string;
  linkedAt: string;
}

export interface CaseTimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorBureau: BureauName;
  type:
    | 'Intake'
    | 'Assignment'
    | 'Status Change'
    | 'Note'
    | 'Administrative Action'
    | 'Coordination'
    | 'Evidence'
    | 'Access Governance'
    | 'Resolution';
  summary: string;
  details?: string;
}

export type PlannedActionType =
  | 'Show-Cause Notice'
  | 'Document Demand'
  | 'Inspection Visit'
  | 'Scheduled Inspection'
  | 'Compliance Directive'
  | 'Surprise Inspection'
  | 'Payroll Audit Demand'
  | 'Fee Refund Directive'
  | 'Welfare Advisory';

export type ActionType = PlannedActionType;

export interface AdministrativeAction {
  id: string;
  caseId: string;
  institutionId: string;
  bureau: BureauName;
  ownerId: string;
  actionType: PlannedActionType;
  purpose: string;
  requestedEvidenceType?: EvidenceArtifactType;
  academicYear: string;
  scope: string;
  scheduledStart: string;
  scheduledEnd: string;
  status:
    | 'Draft'
    | 'Planned'
    | 'Issued'
    | 'In Execution'
    | 'Completed'
    | 'On Hold for Coordination'
    | 'Subscribed to Shared Evidence';
  confidentiality: 'Standard' | 'Confidential Inspection';
  linkedArtifactId?: string;
  clearanceRuleVersion?: string;
  overrideReason?: string;
  clearanceCheckRecord?: {
    checkedAt: string;
    checkedBy: string;
    highestSeverity: ClearanceSeverity;
    ruleCodesTriggered: string[];
    overrideApplied: boolean;
    overrideAuthorizer?: string;
    overrideReason?: string;
  };
  notes: string;
}

export type RelationshipTaxonomy =
  | 'Unclassified — Needs Review'
  | 'Duplicate Filing'
  | 'Cohort / Pattern Cluster'
  | 'Causal Cross-Category Link'
  | 'Operational Schedule Collision Only'
  | 'Verified Independent';

export interface RelatedCaseCandidate {
  targetCaseId: string;
  matchBasis:
    | 'Deterministic Rule'
    | 'Keyword & Synonym Match'
    | 'Hybrid Semantic Candidate'
    | 'Cohort Threshold Engine'
    | 'AI-Assisted Retrieval';
  ruleCode?: string;
  evidenceStrength: 'Strong' | 'Moderate' | 'Insufficient Evidence';
  sharedFactors: string[];
  hypothesisedLink?: string;
  cautionNote: string;
  taxonomy: RelationshipTaxonomy;
  primaryCaseId?: string;
}

export interface CaseRecord {
  id: string;
  institutionId: string;
  subject: string;
  category:
    | 'Unapproved Intake / Admission'
    | 'Faculty Salary & Statutory Dues'
    | 'Fee Refund & Admission Cancellation'
    | 'Laboratory & Academic Infrastructure'
    | 'Faculty Roster & Attendance'
    | 'Faculty Qualifications & Appointments'
    | 'Hostel & Student Amenities';
  description: string;
  incidentDate: string;
  academicYear: string;
  sourceChannel:
    | 'Portal Grievance'
    | 'Inspection Referral'
    | 'State Directorate Note'
    | 'Vigilance Reference'
    | 'Compliance Undertaking';
  sourceBureau: BureauName;
  assignedBureau: BureauName;
  assignedOfficerId: string;
  priority: CasePriority;
  status: CaseStatus;
  receivedDate: string;
  dueDate: string;
  lastUpdated: string;
  resolvedDate?: string;
  recordedOutcome?: string;
  visibility: 'Standard Cross-Bureau' | 'Restricted — Bureau Scoped';
  coarseCategoryLabel?: string;
  coarseStatusLabel?: string;
  permittedActivityPeriod?: string;
  coordinationRequestAllowed?: boolean;
  timeline: CaseTimelineEvent[];
  documents: CaseDocumentRef[];
  evidenceLinks: CaseEvidenceLink[];
  relatedCandidates: RelatedCaseCandidate[];
}

export type ClearanceSeverity =
  | 'Clear to Proceed'
  | 'Informational'
  | 'Warning Requiring Review'
  | 'Warning — Duplicate / Shared Evidence'
  | 'Coordination Recommended'
  | 'Mandatory Clearance Required';

export type ClearanceOutcomeKind =
  | 'DUPLICATE_EVIDENCE_REQUEST'
  | 'SEQUENCING_HAZARD'
  | 'CLEAR_TO_PROCEED';

export interface ClearanceFinding {
  id: string;
  outcomeKind: ClearanceOutcomeKind;
  severity: ClearanceSeverity;
  ruleCode: string;
  ruleVersion: string;
  headline: string;
  explanation: string;
  recommendedNextStep: string;
  sourceCaseId?: string;
  sourceActionId?: string;
  existingArtifactId?: string;
  reusableArtifactId?: string;
  existingRequestDate?: string;
  daysSincePriorRequest?: number;
  artifactAvailability?: string;
  redactedConfidentialDetails?: boolean;
  canSubscribeToExistingEvidence?: boolean;
  requiresSeniorOverrideToIssue?: boolean;
}

export type AccessRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Denied'
  | 'Expired'
  | 'Revoked';

export interface AccessRequestAuditItem {
  timestamp: string;
  actor: string;
  bureau: BureauName;
  event: 'Requested' | 'Approved' | 'Accessed' | 'Denied' | 'Expired' | 'Revoked';
  note: string;
}

export interface ScopedAccessRequest {
  id: string;
  caseId: string;
  institutionId: string;
  owningBureau: BureauName;
  requestingUserId: string;
  requestingBureau: BureauName;
  coordinationPurpose: string;
  requestedScope: 'Case Summary & Timeline' | 'Summary, Actions & Evidence Metadata';
  approvedScope?: string;
  status: AccessRequestStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  expiresOn?: string;
  statusNote?: string;
  history: AccessRequestAuditItem[];
}

export type EvidenceArtifactType =
  | 'Certified Withdrawal & Fee Refund Scroll'
  | 'Bank Salary & EPF TRRN Scroll'
  | 'Authenticated University Enrolment Roll'
  | 'Compliance Undertaking Affidavit'
  | 'Laboratory Stock & Calibration Register'
  | 'Faculty Appointment & PhD Verification File';

export type AuthenticityStatus =
  | 'Verified by Authority'
  | 'Pending Official Verification'
  | 'Returned for Clarification';

export interface EvidenceArtifactVersion {
  version: string;
  submittedDate: string;
  submittedBy: string;
  sha256Hash: string;
  fileSizeLabel: string;
  integrityCheck: 'SHA-256 Verified (Unaltered File)' | 'Checksum Pending';
  changeSummary: string;
}

export interface EvidenceArtifact {
  id: string;
  institutionId: string;
  academicYear: string;
  artifactType: EvidenceArtifactType;
  title: string;
  currentVersion: string;
  submissionDate: string;
  authenticityStatus: AuthenticityStatus;
  verifiedBy?: string;
  verifiedBureau?: BureauName;
  verifiedAt?: string;
  accessPolicy: 'Authorised Cross-Bureau Reference' | 'Owning Bureau Restricted';
  summary: string;
  versions: EvidenceArtifactVersion[];
}

export interface AlertSuppressionRecord {
  id: string;
  casePair: [string, string];
  institutionId: string;
  reviewerName: string;
  reviewerRole: UserRole;
  reason: string;
  ruleVersion: string;
  lastReviewedAt: string;
  baselineFactSignature: string;
  changeConditionsWatched: string[];
  active: boolean;
  reopenedAt?: string;
  reopenedReason?: string;
}

export type CoordinationAlertStatus =
  | 'Needs review'
  | 'In review'
  | 'Coordinating'
  | 'Resolved'
  | 'Dismissed'
  | 'Suppressed (Negative Memory)';

export type AlertStatus = CoordinationAlertStatus;

export interface CoordinationDiscussionEntry {
  id: string;
  timestamp: string;
  authorName: string;
  authorBureau: BureauName;
  entryType: 'Discussion' | 'Decision' | 'Dismissal';
  message: string;
}

export interface CoordinationAlert {
  id: string;
  title: string;
  institutionId: string;
  involvedCaseIds: string[];
  involvedActionIds: string[];
  involvedBureaus: BureauName[];
  coordinatorId?: string;
  detectionSource:
    | 'Deterministic Rule'
    | 'Cohort Threshold Engine'
    | 'Heuristic Suggestion'
    | 'Keyword & Synonym Match'
    | 'AI-Assisted Retrieval';
  ruleCode: string;
  ruleVersion: string;
  taxonomy: RelationshipTaxonomy;
  primaryCaseId?: string;
  cohortWindowStats?: {
    windowDays: number;
    threshold: number;
    matchedCount: number;
    category: string;
  };
  triggeredConditions: string[];
  verifiedFacts: string[];
  hypothesisedNote?: string;
  overlappingWindow: string;
  overlappingScope: string;
  evidenceStrength: 'High Operational Overlap' | 'Moderate Scope Overlap' | 'Insufficient Evidence';
  supportingDocIds: string[];
  supportingArtifactIds?: string[];
  status: CoordinationAlertStatus;
  detectedDate: string;
  recommendedNextStep: string;
  optionalAiNote: string;
  resolutionReason?: string;
  confirmedDecision?: string;
  discussions: CoordinationDiscussionEntry[];
}

export interface CoordinationTask {
  id: string;
  alertId?: string;
  caseId: string;
  institutionId: string;
  title: string;
  leadBureau: BureauName;
  participatingBureaus: BureauName[];
  assigneeId: string;
  dueDate: string;
  status: 'Awaiting Discussion' | 'In Progress' | 'Completed';
  createdAt: string;
  notes: string;
}

export type DocumentCategory = 'Approved Policy' | 'Historical Case Record';

export interface DocumentPassage {
  id: string;
  docId: string;
  section: string;
  page: number;
  text: string;
  keywords: string[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  docType: 'Regulatory Circular' | 'SOP / Guideline' | 'Inspection Report' | 'Compliance Undertaking';
  issuingBureau: BureauName;
  version: string;
  publicationDate: string;
  effectiveDate?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  supersededByDocId?: string;
  supersedesDocId?: string;
  applicableScope: string;
  accessScope: 'All Authorised Officials' | 'Restricted — Bureau Scoped';
  reviewStatus:
    | 'Approved'
    | 'Superseded (Historical)'
    | 'Pending Review'
    | 'Draft (Excluded from RAG)';
  indexingStatus: 'Indexed' | 'Re-indexing' | 'Pending Index';
  lastIndexedAt: string;
  linkedInstitutionId?: string;
  linkedCaseIds: string[];
  summary: string;
  extractedPreview: string;
  passages: DocumentPassage[];
}

export type ReadinessState =
  | 'No recorded flag'
  | 'Review recommended'
  | 'Outstanding items'
  | 'Evidence unavailable';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  actorBureau: BureauName;
  entityType:
    | 'Case'
    | 'Action Clearance'
    | 'Coordination Alert'
    | 'Coordination Task'
    | 'Evidence Vault'
    | 'Access Governance'
    | 'Knowledge Source'
    | 'Knowledge Document'
    | 'System Settings'
    | 'Administration';
  entityId: string;
  actionType:
    | 'Case Created'
    | 'Status Transition'
    | 'Status Changed'
    | 'Note Added'
    | 'Assignment Updated'
    | 'Action Recorded'
    | 'Pre-Dispatch Check'
    | 'Clearance Override'
    | 'Evidence Subscribed'
    | 'Evidence Linked'
    | 'Evidence Submitted'
    | 'Evidence Verified'
    | 'Access Requested'
    | 'Access Updated'
    | 'Alert Reviewed'
    | 'Taxonomy Classified'
    | 'Alert Suppressed'
    | 'Suppression Reopened'
    | 'Decision Recorded'
    | 'Alert Resolved'
    | 'Task Updated'
    | 'Document Indexed'
    | 'Settings Modified'
    | 'Settings Updated';
  summary: string;
  previousValue?: string;
  newValue?: string;
}

export interface DeadlineRule {
  priority: CasePriority;
  targetDays: number;
  warningThresholdDays: number;
  escalationBureau: BureauName;
  description: string;
}

export interface StatusTransitionRule {
  from: CaseStatus;
  allowedTo: CaseStatus[];
  requiresNote: boolean;
  restrictedToSenior?: boolean;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  linkTo: string;
  read: boolean;
}

export interface SystemSettings {
  aiAssistanceEnabled: boolean;
  aiSimulatedFailureMode: boolean;
  aiShowCaseContextPanel: boolean;
  clearanceSequencingWindowDays: number;
  duplicateEvidenceWindowDays: number;
  cohortThresholdCount: number;
  cohortRollingDays: number;
  relationshipRuleVersion: string;
  notifyOnOverdue: boolean;
  notifyOnCrossBureauAlert: boolean;
  notifyOnStatusChange: boolean;
  deadlineRules: DeadlineRule[];
  transitionRules: StatusTransitionRule[];
}

export interface AppStateData {
  demoDate: string;
  currentUserId: string;
  users: DemoUser[];
  institutions: Institution[];
  cases: CaseRecord[];
  actions: AdministrativeAction[];
  alerts: CoordinationAlert[];
  suppressions: AlertSuppressionRecord[];
  accessRequests: ScopedAccessRequest[];
  evidenceVault: EvidenceArtifact[];
  tasks: CoordinationTask[];
  documents: KnowledgeDocument[];
  auditLog: AuditEvent[];
  notifications: NotificationItem[];
  settings: SystemSettings;
}
