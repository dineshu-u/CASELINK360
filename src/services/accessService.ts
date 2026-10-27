import {
  BureauName,
  CaseRecord,
  DemoUser,
  KnowledgeDocument,
  ScopedAccessRequest,
} from '../types/domain';

export interface RedactedCoordinationStub {
  caseId: string;
  institutionId: string;
  owningBureau: BureauName;
  coarseCategory: string;
  generalCategory: string;
  coarseStatus: string;
  permittedActivityPeriod: string;
  redacted: true;
  restrictedIndicator: true;
  coordinationRequestAvailable: boolean;
  activeGrantStatus?: ScopedAccessRequest['status'];
  approvedScope?: string;
  expiresOn?: string;
}

export function hasFullCaseReadAccess(
  user: DemoUser,
  caseRecord: CaseRecord,
  accessRequests: ScopedAccessRequest[],
  demoDate: string
): boolean {
  if (caseRecord.visibility !== 'Restricted — Bureau Scoped') {
    return true;
  }
  if (user.bureau === caseRecord.assignedBureau || user.bureau === caseRecord.sourceBureau) {
    return true;
  }
  const grant = accessRequests.find(
    (req) =>
      req.caseId === caseRecord.id &&
      (req.requestingUserId === user.id || req.requestingBureau === user.bureau) &&
      req.status === 'Approved' &&
      (!req.expiresOn || req.expiresOn >= demoDate)
  );
  return Boolean(grant);
}

export function canUserAccessDocument(
  user: DemoUser,
  doc: KnowledgeDocument,
  cases: CaseRecord[],
  accessRequests: ScopedAccessRequest[],
  demoDate: string
): boolean {
  if (doc.accessScope !== 'Restricted — Bureau Scoped') {
    return true;
  }
  if (user.bureau === doc.issuingBureau) {
    return true;
  }
  return doc.linkedCaseIds.some((cid) => {
    const linked = cases.find((c) => c.id === cid);
    return linked ? hasFullCaseReadAccess(user, linked, accessRequests, demoDate) : false;
  });
}

export function buildRedactedStub(
  caseRecord: CaseRecord,
  user?: DemoUser,
  accessRequests: ScopedAccessRequest[] = []
): RedactedCoordinationStub {
  const matchingReq = user
    ? accessRequests.find(
        (r) =>
          r.caseId === caseRecord.id &&
          (r.requestingUserId === user.id || r.requestingBureau === user.bureau)
      )
    : undefined;
  const coarse = caseRecord.coarseCategoryLabel ?? caseRecord.category;
  return {
    caseId: caseRecord.id,
    institutionId: caseRecord.institutionId,
    owningBureau: caseRecord.assignedBureau,
    coarseCategory: coarse,
    generalCategory: coarse,
    coarseStatus:
      caseRecord.coarseStatusLabel ??
      (caseRecord.status === 'Resolved' || caseRecord.status === 'Closed'
        ? 'Disposed'
        : 'Under Bureau Process'),
    permittedActivityPeriod:
      caseRecord.permittedActivityPeriod ?? caseRecord.academicYear,
    redacted: true,
    restrictedIndicator: true,
    coordinationRequestAvailable: caseRecord.coordinationRequestAllowed !== false,
    activeGrantStatus: matchingReq?.status,
    approvedScope: matchingReq?.approvedScope,
    expiresOn: matchingReq?.expiresOn,
  };
}
