import {
  BureauName,
  CaseRecord,
  DemoUser,
  DocumentCategory,
  DocumentPassage,
  KnowledgeDocument,
  ScopedAccessRequest,
} from '../types/domain';
import { canUserAccessDocument } from './accessService';
import { expandQueryWithGlossary, GLOSSARY_VERSION, QueryExpansionResult } from './glossary';

export interface RagQueryFilters {
  category?: 'All' | DocumentCategory;
  bureau?: 'All' | BureauName;
  institutionId?: string;
  reviewStatus?: 'All' | KnowledgeDocument['reviewStatus'];
  publishedAfter?: string;
  asOfIncidentDate?: string;
  caseContextId?: string;
  includeSupersededComparison?: boolean;
  includeSupersededForComparison?: boolean;
}

export type PolicyValidityState =
  | 'In Force on Target Date'
  | 'Historically Applicable'
  | 'Superseded for Target Date'
  | 'Not Yet Effective'
  | 'Case Filing Reference';

export interface RetrievedPassageMatch {
  passage: DocumentPassage;
  document: KnowledgeDocument;
  score: number;
  relevanceBand: 'High Match' | 'Moderate Match' | 'Contextual Reference';
  validityState: PolicyValidityState;
  validityStatus: PolicyValidityState;
  supersedingDocumentId?: string;
  matchedTerms: string[];
}

export interface PipelineStageTrace {
  stage: string;
  status: 'Passed' | 'Fallback Active' | 'Abstained' | 'Disabled';
  detail: string;
}

export interface RagQueryResponse {
  query: string;
  effectiveAsOfDate: string;
  contextDateUsed: string;
  measuredLatencyMs: number;
  glossaryVersion: string;
  glossaryExpansion: QueryExpansionResult;
  restrictedDocsExcludedCount: number;
  unapprovedDocsExcludedCount: number;
  hasSufficientEvidence: boolean;
  aiSynthesisIncluded: boolean;
  aiFallbackTriggered: boolean;
  abstentionReason?: string;
  synthesizedAnswer?: string;
  pipelineStages: PipelineStageTrace[];
  citationsUsed: Array<{
    docId: string;
    title: string;
    version: string;
    section: string;
    page: number;
    validityState: PolicyValidityState;
  }>;
  matches: RetrievedPassageMatch[];
}

export const EXAMPLE_ASSISTANT_QUERIES: Array<{
  label: string;
  query: string;
  caseId?: string;
}> = [
  {
    label: 'Current Fee Refund & Caution Money (AY 2026-27)',
    query: 'caution money and original TC deduction limit',
    caseId: 'CL-2026-0125',
  },
  {
    label: 'Time-Travel: Nov 2024 Historical Refund Rule (CL-2025-0041)',
    query: 'fee refund deduction 2500 historical',
    caseId: 'CL-2025-0041',
  },
  {
    label: 'Hinglish Synonym Query ("fees wapas cutoff")',
    query: 'fees wapas cutoff rule',
  },
  {
    label: 'Pre-Dispatch Sequencing Gate (CRD-2026-001)',
    query: 'Why was coordination alert CRD-2026-001 raised?',
  },
  {
    label: 'Restricted Source Boundary Check (PhD Verification)',
    query: 'forged phd degree ece qualification',
  },
  {
    label: 'Insufficient Evidence Abstention Check',
    query: 'international joint foreign exchange royalty norm',
  },
];

const STOP_WORDS = new Set([
  'to',
  'in',
  'on',
  'at',
  'by',
  'of',
  'or',
  'is',
  'an',
  'be',
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'have',
  'which',
  'what',
  'when',
  'where',
  'are',
  'why',
  'was',
  'all',
  'other',
  'cases',
  'case',
  'support',
  'relate',
  'documents',
  'document',
  'summarise',
  'summarize',
  'about',
  'into',
  'rule',
  'norm',
  'clause',
  'history',
  'check',
]);

const EXPLICIT_ID_REGEX = /\b(?:DOC-[A-Z0-9-]+|CL-\d{4}-\d{4}|INST-[A-Z]{2}-\d{4}|CRD-\d{4}-\d{3})\b/gi;

function tokenizeQuery(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9- ]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

export function evaluateDocumentValidityForDate(
  doc: KnowledgeDocument,
  asOfDate: string
): PolicyValidityState {
  if (asOfDate < doc.effectiveFrom) {
    return 'Not Yet Effective';
  }
  if (doc.category === 'Historical Case Record') {
    return 'Case Filing Reference';
  }
  if (doc.effectiveTo && asOfDate > doc.effectiveTo) {
    return 'Superseded for Target Date';
  }
  if (doc.supersededByDocId && (!doc.effectiveTo || asOfDate <= doc.effectiveTo)) {
    return 'Historically Applicable';
  }
  return 'In Force on Target Date';
}

export interface RagExecutionContext {
  currentUser?: DemoUser;
  cases?: CaseRecord[];
  accessRequests?: ScopedAccessRequest[];
  demoDate?: string;
  aiSimulatedFailure?: boolean;
}

export function runLocalKnowledgeQuery(
  rawQuery: string,
  documents: KnowledgeDocument[],
  filters: RagQueryFilters,
  aiEnabled: boolean,
  execContext?: RagExecutionContext
): RagQueryResponse {
  const t0 = performance.now();
  const trimmed = rawQuery.trim();
  const contextDate = filters.asOfIncidentDate || execContext?.demoDate || '2026-10-22';
  const includeSuperseded = Boolean(
    filters.includeSupersededComparison ?? filters.includeSupersededForComparison
  );
  const expansion = expandQueryWithGlossary(trimmed);
  const directTokens = tokenizeQuery(trimmed);

  let restrictedExcluded = 0;
  let unapprovedExcluded = 0;

  // Stage 1 & 2: Pre-Retrieval Authorization Gate + Temporal Validity Filter
  const eligibleDocs = documents.filter((doc) => {
    if (doc.indexingStatus !== 'Indexed') return false;

    if (execContext?.currentUser && execContext.cases && execContext.accessRequests) {
      const allowed = canUserAccessDocument(
        execContext.currentUser,
        doc,
        execContext.cases,
        execContext.accessRequests,
        execContext.demoDate ?? '2026-10-22'
      );
      if (!allowed) {
        restrictedExcluded += 1;
        return false;
      }
    }

    if (
      doc.reviewStatus === 'Pending Review' ||
      doc.reviewStatus === 'Draft (Excluded from RAG)'
    ) {
      unapprovedExcluded += 1;
      return false;
    }

    if (filters.category && filters.category !== 'All' && doc.category !== filters.category) {
      return false;
    }
    if (filters.bureau && filters.bureau !== 'All' && doc.issuingBureau !== filters.bureau) {
      return false;
    }
    if (filters.institutionId && doc.linkedInstitutionId && doc.linkedInstitutionId !== filters.institutionId) {
      return false;
    }

    const validity = evaluateDocumentValidityForDate(doc, contextDate);
    if (validity === 'Not Yet Effective' && !includeSuperseded) {
      return false;
    }
    if (
      validity === 'Superseded for Target Date' &&
      !includeSuperseded &&
      !trimmed.toLowerCase().includes(doc.id.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const aiFallbackTriggered = Boolean(aiEnabled && execContext?.aiSimulatedFailure);
  const useSemanticLayer = aiEnabled && !aiFallbackTriggered;

  // Enforce explicit entity-ID grounding: if user asks about a specific DOC-/CL-/INST-/CRD- ID,
  // candidate passages must reference that exact entity ID rather than matching generic words.
  const explicitIdsRequested = (trimmed.match(EXPLICIT_ID_REGEX) ?? []).map((id) =>
    id.toLowerCase()
  );

  // Stage 3 & 4: Lexical + Glossary Expansion + Optional Semantic Paraphrase Layer
  const MIN_GROUNDED_SCORE = 2.5;
  const scored: RetrievedPassageMatch[] = [];

  for (const doc of eligibleDocs) {
    const validityState = evaluateDocumentValidityForDate(doc, contextDate);

    for (const passage of doc.passages) {
      const haystack = [
        doc.id,
        doc.title,
        doc.summary,
        doc.applicableScope,
        doc.linkedInstitutionId ?? '',
        ...doc.linkedCaseIds,
        passage.section,
        passage.text,
        ...passage.keywords,
      ]
        .join(' ')
        .toLowerCase();

      if (
        explicitIdsRequested.length > 0 &&
        !explicitIdsRequested.every((reqId) => haystack.includes(reqId))
      ) {
        continue;
      }

      const matchedTerms: string[] = [];
      let rawScore = 0;

      for (const token of directTokens) {
        if (
          doc.id.toLowerCase() === token ||
          doc.linkedCaseIds.some((c) => c.toLowerCase() === token)
        ) {
          rawScore += 6.0;
          matchedTerms.push(token.toUpperCase());
        } else if ((doc.linkedInstitutionId ?? '').toLowerCase() === token) {
          rawScore += 6.0;
          matchedTerms.push(token.toUpperCase());
        } else if (passage.keywords.some((kw) => kw.toLowerCase().includes(token))) {
          rawScore += 3.0;
          matchedTerms.push(token);
        } else if (haystack.includes(token)) {
          rawScore += 1.5;
          matchedTerms.push(token);
        }
      }

      // Deterministic Glossary Expansion scoring
      for (const concept of expansion.matchedConcepts) {
        const hitTerm = concept.expandedTerms.find((phrase) =>
          haystack.includes(phrase.toLowerCase())
        );
        if (hitTerm) {
          rawScore += 4.0;
          matchedTerms.push(`Glossary:${concept.canonicalConcept}`);
        }
      }

      // Optional Hybrid Semantic Paraphrase layer (Active only when AI is enabled & healthy)
      if (useSemanticLayer) {
        const semanticPairs: Array<[string[], string[]]> = [
          [
            ['delayed', 'money', 'return', 'repayment', 'held', 'withdrawal', 'cancellation'],
            ['refund', 'cutoff', 'caution', 'working days'],
          ],
          [
            ['professors', 'resigned', 'shortage', 'withheld', 'monthly', 'dues'],
            ['salary', 'arrears', 'ninety', 'roster'],
          ],
          [
            ['parallel', 'letter', 'demands', 'conflict'],
            ['duplicate', 'sequencing', 'vault', 'clearance'],
          ],
        ];
        for (const [qSignals, docSignals] of semanticPairs) {
          const hitQ = qSignals.filter((s) => trimmed.toLowerCase().includes(s));
          if (hitQ.length >= 2 && docSignals.some((s) => haystack.includes(s))) {
            rawScore += 2.2;
            matchedTerms.push('Hybrid semantic paraphrase');
          }
        }
      }

      // Guard against single-word false positives on long out-of-domain queries
      const hasMultiWordSupport =
        directTokens.length < 4 ||
        matchedTerms.length >= 2 ||
        explicitIdsRequested.length > 0 ||
        expansion.matchedConcepts.length > 0;

      if (rawScore >= MIN_GROUNDED_SCORE && hasMultiWordSupport) {
        if (
          validityState === 'In Force on Target Date' ||
          validityState === 'Historically Applicable'
        ) {
          rawScore += 1.25;
        }
        const relevanceBand: RetrievedPassageMatch['relevanceBand'] =
          rawScore >= 6 ? 'High Match' : rawScore >= 3 ? 'Moderate Match' : 'Contextual Reference';

        scored.push({
          passage,
          document: doc,
          score: Number(rawScore.toFixed(2)),
          relevanceBand,
          validityState,
          validityStatus: validityState,
          supersedingDocumentId: doc.supersededByDocId,
          matchedTerms: Array.from(new Set(matchedTerms)),
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, 6);
  const hasSufficientEvidence = topMatches.length > 0;

  const pipelineStages: PipelineStageTrace[] = [
    {
      stage: 'Pre-Retrieval Authorization Gate',
      status: 'Passed',
      detail: `${eligibleDocs.length} source(s) cleared for caller; ${restrictedExcluded} restricted cross-bureau source(s) withheld prior to context assembly.`,
    },
    {
      stage: 'Effective-Date & Supersession Check',
      status: 'Passed',
      detail: `Evaluated effectiveFrom / effectiveTo windows against incident/context date ${contextDate}.`,
    },
    {
      stage: 'Hinglish & Domain Glossary Expansion',
      status: 'Passed',
      detail:
        expansion.matchedConcepts.length > 0
          ? `${GLOSSARY_VERSION} expanded: ${expansion.matchedConcepts
              .map((c) => `"${c.triggeredBy}" → ${c.canonicalConcept}`)
              .join('; ')}`
          : `Checked ${GLOSSARY_VERSION}; executed exact ID & keyword matching.`,
    },
    {
      stage: 'Optional Hybrid Semantic Layer',
      status: aiFallbackTriggered
        ? 'Fallback Active'
        : useSemanticLayer
        ? 'Passed'
        : 'Disabled',
      detail: aiFallbackTriggered
        ? 'Simulated AI service timeout caught by circuit breaker — automatically fell back to deterministic passage ranking.'
        : useSemanticLayer
        ? 'Applied hybrid paraphrase scoring alongside exact ID & glossary signals.'
        : 'AI layer turned off — pure deterministic lexical + glossary ranking.',
    },
    {
      stage: 'Citation Grounding & Abstention Gate',
      status: hasSufficientEvidence ? 'Passed' : 'Abstained',
      detail: hasSufficientEvidence
        ? `Verified all ${topMatches.length} retrieved passage(s) map to indexed registry documents.`
        : 'Insufficient approved date-valid evidence found — abstained cleanly with zero fabricated claims.',
    },
  ];

  const elapsed = Math.max(0.05, Number((performance.now() - t0).toFixed(2)));

  if (!hasSufficientEvidence) {
    const restrictedNote =
      restrictedExcluded > 0
        ? ` Note: ${restrictedExcluded} restricted bureau source(s) matched scope metadata but were withheld at the pre-retrieval authorization boundary.`
        : '';
    return {
      query: trimmed,
      effectiveAsOfDate: contextDate,
      contextDateUsed: contextDate,
      measuredLatencyMs: elapsed,
      glossaryVersion: GLOSSARY_VERSION,
      glossaryExpansion: expansion,
      restrictedDocsExcludedCount: restrictedExcluded,
      unapprovedDocsExcludedCount: unapprovedExcluded,
      hasSufficientEvidence: false,
      aiSynthesisIncluded: false,
      aiFallbackTriggered,
      abstentionReason: `No approved, date-valid source passages matched "${trimmed}" as of ${contextDate}.${restrictedNote} System abstains rather than fabricating regulatory rules.`,
      pipelineStages,
      citationsUsed: [],
      matches: [],
    };
  }

  const citationsUsed = topMatches.slice(0, 3).map((m) => ({
    docId: m.document.id,
    title: m.document.title,
    version: m.document.version,
    section: m.passage.section,
    page: m.passage.page,
    validityState: m.validityState,
  }));

  const synthesizedAnswer =
    useSemanticLayer
      ? topMatches
          .slice(0, 2)
          .map((m) => {
            const tag =
              m.validityState === 'Historically Applicable'
                ? ` [Historically Applicable on ${contextDate}; later superseded by ${m.supersedingDocumentId}]`
                : m.validityState === 'Superseded for Target Date'
                ? ` [SUPERSEDED by ${m.supersedingDocumentId}]`
                : '';
            return `[${m.document.id}, ${m.document.version}${tag}, ${m.passage.section}, p. ${m.passage.page}]: ${m.passage.text}`;
          })
          .join(' ')
      : undefined;

  return {
    query: trimmed,
    effectiveAsOfDate: contextDate,
    contextDateUsed: contextDate,
    measuredLatencyMs: elapsed,
    glossaryVersion: GLOSSARY_VERSION,
    glossaryExpansion: expansion,
    restrictedDocsExcludedCount: restrictedExcluded,
    unapprovedDocsExcludedCount: unapprovedExcluded,
    hasSufficientEvidence: true,
    aiSynthesisIncluded: Boolean(synthesizedAnswer),
    aiFallbackTriggered,
    synthesizedAnswer,
    pipelineStages,
    citationsUsed,
    matches: topMatches,
  };
}
