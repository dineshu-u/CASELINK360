export const GLOSSARY_VERSION = 'GLOSSARY-v1.2';

export interface GlossaryEntry {
  id: string;
  conceptId: string;
  canonicalConcept: string;
  canonicalTerm: string;
  domainSynonyms: string[];
  hinglishAndColloquial: string[];
  phrases: string[];
}

export const DOMAIN_GLOSSARY: GlossaryEntry[] = [
  {
    id: 'GLS-01',
    conceptId: 'GLS-01',
    canonicalConcept: 'Fee Refund / Admission Fee Repayment',
    canonicalTerm: 'Fee Refund / Admission Fee Repayment',
    domainSynonyms: [
      'fee refund',
      'admission-fee repayment',
      'admission fee repayment',
      'repayment of admission fees',
      'tuition refund',
    ],
    hinglishAndColloquial: ['fees wapas', 'fee wapsi', 'non-refund of fee'],
    phrases: [
      'fee refund',
      'admission-fee repayment',
      'admission fee repayment',
      'repayment of admission fees',
      'fees wapas',
      'fee wapsi',
      'tuition refund',
      'non-refund of fee',
    ],
  },
  {
    id: 'GLS-02',
    conceptId: 'GLS-02',
    canonicalConcept: 'Caution Money / Refundable Security Deposit',
    canonicalTerm: 'Caution Money / Refundable Security Deposit',
    domainSynonyms: [
      'caution money',
      'refundable security deposit',
      'caution deposit',
      'security deposit refund',
      'hostel security deposit',
    ],
    hinglishAndColloquial: ['amanat rashi', 'security money wapas'],
    phrases: [
      'caution money',
      'refundable security deposit',
      'caution deposit',
      'security deposit refund',
      'hostel security deposit',
      'amanat rashi',
    ],
  },
  {
    id: 'GLS-03',
    conceptId: 'GLS-03',
    canonicalConcept: 'Original TC / Transfer Certificate Retention',
    canonicalTerm: 'Original TC / Transfer Certificate Retention',
    domainSynonyms: [
      'original tc',
      'original transfer certificate',
      'transfer certificate',
      'leaving certificate',
      'migration certificate',
    ],
    hinglishAndColloquial: ['tc rok rakha', 'tc withheld'],
    phrases: [
      'original tc',
      'original transfer certificate',
      'transfer certificate',
      'leaving certificate',
      'migration certificate',
      'tc rok rakha',
      'tc withheld',
    ],
  },
  {
    id: 'GLS-04',
    conceptId: 'GLS-04',
    canonicalConcept: 'Marksheets Withheld / Academic Documents Retained',
    canonicalTerm: 'Marksheets Withheld / Academic Documents Retained',
    domainSynonyms: [
      'marksheets withheld',
      'academic documents retained',
      'original mark sheets',
      'original certificates',
    ],
    hinglishAndColloquial: ['documents kabza', 'marksheet retention'],
    phrases: [
      'marksheets withheld',
      'academic documents retained',
      'original mark sheets',
      'original certificates',
      'documents kabza',
      'marksheet retention',
    ],
  },
  {
    id: 'GLS-05',
    conceptId: 'GLS-05',
    canonicalConcept: 'Faculty Salary Arrears / Unpaid Faculty Salaries',
    canonicalTerm: 'Faculty Salary Arrears / Unpaid Faculty Salaries',
    domainSynonyms: [
      'faculty salary arrears',
      'unpaid faculty salaries',
      'salary arrears',
      'non-disbursement',
      'pending pay scale',
    ],
    hinglishAndColloquial: ['vetan bakaya', 'tankhwah due', 'unpaid wages'],
    phrases: [
      'faculty salary arrears',
      'unpaid faculty salaries',
      'salary arrears',
      'non-disbursement',
      'pending pay scale',
      'vetan bakaya',
      'tankhwah due',
      'unpaid wages',
    ],
  },
  {
    id: 'GLS-06',
    conceptId: 'GLS-06',
    canonicalConcept: 'Unapproved Intake / Excess Supernumerary Seats',
    canonicalTerm: 'Unapproved Intake / Excess Supernumerary Seats',
    domainSynonyms: [
      'unapproved intake',
      'excess admission',
      'supernumerary seats',
      'seats beyond eoa',
    ],
    hinglishAndColloquial: ['extra seats admitted'],
    phrases: [
      'unapproved intake',
      'excess admission',
      'supernumerary seats',
      'seats beyond eoa',
      'extra seats admitted',
    ],
  },
];

export const REGULATORY_GLOSSARY = DOMAIN_GLOSSARY;

export interface QueryExpansionResult {
  originalQuery: string;
  matchedEntries: GlossaryEntry[];
  matchedConcepts: Array<{
    glossaryId: string;
    canonicalConcept: string;
    triggeredBy: string;
    expandedTerms: string[];
  }>;
  allSearchTerms: string[];
}

export function expandQueryWithGlossary(rawQuery: string): QueryExpansionResult {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) {
    return {
      originalQuery: rawQuery,
      matchedEntries: [],
      matchedConcepts: [],
      allSearchTerms: [],
    };
  }

  const matchedEntries: GlossaryEntry[] = [];
  const matchedConcepts: QueryExpansionResult['matchedConcepts'] = [];
  const termSet = new Set<string>([normalized]);

  for (const word of normalized.replace(/[^a-z0-9- ]/g, ' ').split(/\s+/)) {
    if (word.length >= 2) termSet.add(word);
  }

  for (const entry of DOMAIN_GLOSSARY) {
    const hitPhrase = entry.phrases.find((p) => normalized.includes(p.toLowerCase()));
    if (hitPhrase) {
      matchedEntries.push(entry);
      matchedConcepts.push({
        glossaryId: entry.id,
        canonicalConcept: entry.canonicalConcept,
        triggeredBy: hitPhrase,
        expandedTerms: entry.phrases,
      });
      for (const phrase of entry.phrases) {
        termSet.add(phrase.toLowerCase());
        for (const subWord of phrase.toLowerCase().split(/[\s-]+/)) {
          if (subWord.length >= 3) termSet.add(subWord);
        }
      }
    }
  }

  return {
    originalQuery: rawQuery,
    matchedEntries,
    matchedConcepts,
    allSearchTerms: Array.from(termSet),
  };
}
