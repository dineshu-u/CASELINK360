import React from 'react';
import { ShieldCheck, Sparkles, GitCompare, AlertTriangle, Clock } from 'lucide-react';
import {
  AccessRequestStatus,
  AuthenticityStatus,
  CasePriority,
  CaseRecord,
  CaseStatus,
  ClearanceSeverity,
  CoordinationAlertStatus,
  DeadlineRule,
  ReadinessState,
  RelationshipTaxonomy,
} from '../../types/domain';
import { getCaseSlaStatus, SlaStatus } from '../../services/caseService';

export const StatusBadge: React.FC<{ status: CaseStatus }> = ({ status }) => {
  const toneMap: Record<CaseStatus, string> = {
    Open: 'badge-info',
    'In Progress': 'badge-info',
    'Pending Bureau': 'badge-warning',
    'Awaiting Review': 'badge-warning',
    Escalated: 'badge-critical',
    Resolved: 'badge-success',
    Closed: 'badge-neutral',
  };
  return <span className={`badge ${toneMap[status]}`}>{status}</span>;
};

export const PriorityBadge: React.FC<{ priority: CasePriority }> = ({ priority }) => {
  const toneMap: Record<CasePriority, string> = {
    Critical: 'badge-critical',
    High: 'badge-warning',
    Standard: 'badge-neutral',
    Low: 'badge-neutral',
  };
  return <span className={`badge ${toneMap[priority]}`}>{priority}</span>;
};

export const SlaBadge: React.FC<
  | {
      status: SlaStatus;
      label: string;
    }
  | {
      caseRecord: Pick<CaseRecord, 'status' | 'priority' | 'dueDate'>;
      demoToday: string;
      deadlineRules: DeadlineRule[];
    }
> = (props) => {
  if ('status' in props) {
    const tone =
      props.status === 'Overdue'
        ? 'badge-critical'
        : props.status === 'Approaching'
        ? 'badge-warning'
        : props.status === 'Completed'
        ? 'badge-success'
        : 'badge-neutral';
    return (
      <span className={`badge ${tone} mono`}>
        {props.status === 'Overdue' && <AlertTriangle size={12} />}
        {props.status === 'Approaching' && <Clock size={12} />}
        {props.label}
      </span>
    );
  }

  const { status, daysDelta, label } = getCaseSlaStatus(
    props.caseRecord,
    props.demoToday,
    props.deadlineRules
  );
  if (status === 'Completed') {
    return <span className="badge badge-success">Completed</span>;
  }
  if (status === 'Overdue') {
    return (
      <span className="badge badge-critical mono">
        <AlertTriangle size={12} />
        {Math.abs(daysDelta)}d overdue
      </span>
    );
  }
  if (status === 'Approaching') {
    return (
      <span className="badge badge-warning mono">
        <Clock size={12} />
        {label}
      </span>
    );
  }
  return <span className="badge badge-neutral mono">{label}</span>;
};

export const AlertStatusBadge: React.FC<{ status: CoordinationAlertStatus }> = ({ status }) => {
  const toneMap: Record<CoordinationAlertStatus, string> = {
    'Needs review': 'badge-critical',
    'In review': 'badge-warning',
    Coordinating: 'badge-info',
    Resolved: 'badge-success',
    Dismissed: 'badge-neutral',
    'Suppressed (Negative Memory)': 'badge-neutral',
  };
  return <span className={`badge ${toneMap[status]}`}>{status}</span>;
};

export const ClearanceBadge: React.FC<{ severity: ClearanceSeverity }> = ({ severity }) => {
  const tone =
    severity === 'Mandatory Clearance Required'
      ? 'badge-critical'
      : severity === 'Warning — Duplicate / Shared Evidence' ||
        severity === 'Warning Requiring Review' ||
        severity === 'Coordination Recommended'
      ? 'badge-warning'
      : 'badge-success';
  return <span className={`badge ${tone}`}>{severity}</span>;
};

export const TaxonomyBadge: React.FC<{ taxonomy: RelationshipTaxonomy }> = ({ taxonomy }) => {
  const tone =
    taxonomy === 'Cohort / Pattern Cluster'
      ? 'badge-critical'
      : taxonomy === 'Operational Schedule Collision Only' ||
        taxonomy === 'Causal Cross-Category Link'
      ? 'badge-warning'
      : taxonomy === 'Duplicate Filing'
      ? 'badge-info'
      : 'badge-neutral';
  return <span className={`badge ${tone}`}>{taxonomy}</span>;
};

export const AccessStatusBadge: React.FC<{ status: AccessRequestStatus }> = ({ status }) => {
  const tone =
    status === 'Approved'
      ? 'badge-success'
      : status === 'Pending'
      ? 'badge-warning'
      : status === 'Denied' || status === 'Revoked'
      ? 'badge-critical'
      : 'badge-neutral';
  return <span className={`badge ${tone}`}>{status}</span>;
};

export const AuthenticityBadge: React.FC<{ status: AuthenticityStatus }> = ({ status }) => {
  const tone =
    status === 'Verified by Authority'
      ? 'badge-success'
      : status === 'Pending Official Verification'
      ? 'badge-warning'
      : 'badge-critical';
  return <span className={`badge ${tone}`}>{status}</span>;
};

export const ReadinessBadge: React.FC<{ state: ReadinessState }> = ({ state }) => {
  const tone =
    state === 'Outstanding items'
      ? 'badge-critical'
      : state === 'Review recommended'
      ? 'badge-warning'
      : state === 'No recorded flag'
      ? 'badge-success'
      : 'badge-neutral';
  return <span className={`badge ${tone}`}>{state}</span>;
};

export const SourceBasisBadge: React.FC<{
  basis:
    | 'Deterministic Rule'
    | 'Keyword & Synonym Match'
    | 'Hybrid Semantic Candidate'
    | 'Heuristic Suggestion'
    | 'Cohort Threshold Engine'
    | 'AI-Assisted Retrieval';
}> = ({ basis }) => {
  if (basis === 'Deterministic Rule' || basis === 'Cohort Threshold Engine') {
    return (
      <span className="badge badge-info">
        <ShieldCheck size={11} /> {basis}
      </span>
    );
  }
  if (basis === 'Keyword & Synonym Match' || basis === 'Heuristic Suggestion') {
    return (
      <span className="badge badge-neutral">
        <GitCompare size={11} /> {basis === 'Keyword & Synonym Match' ? 'Keyword / Glossary' : basis}
      </span>
    );
  }
  return (
    <span className="badge badge-info">
      <Sparkles size={11} /> Optional AI Layer
    </span>
  );
};

export const ProvenanceTag: React.FC<{
  kind: 'deterministic' | 'heuristic' | 'rag';
  code?: string;
}> = ({ kind, code }) => {
  if (kind === 'deterministic') {
    return (
      <span className="badge badge-neutral mono" title="Triggered by deterministic rule logic">
        <ShieldCheck size={12} />
        Rule{code ? ` · ${code}` : ''}
      </span>
    );
  }
  if (kind === 'heuristic') {
    return (
      <span className="badge badge-warning mono" title="Keyword/entity heuristic — requires human verification">
        <GitCompare size={12} />
        Heuristic{code ? ` · ${code}` : ''}
      </span>
    );
  }
  return (
    <span className="badge badge-info" title="Optional local demonstration synthesis — not authoritative">
      <Sparkles size={12} />
      Optional RAG synthesis
    </span>
  );
};
