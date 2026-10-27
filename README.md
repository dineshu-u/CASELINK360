# CASELINK 360 — Regulatory Case Management, Pre-Dispatch Clearance & Evidence Coordination Platform

**CASELINK 360** is a deterministic multi-bureau regulatory case management and operational coordination application built for **Smart India Hackathon (SIH) Problem Statement 26264** (*AICTE — Regulation Bureau (RB)*).

> **Important Prototype & Synthetic Data Disclosure:**  
> All institutions (such as `ABC Engineering College` `INST-MH-2040` and `Cauvery Institute` `INST-TN-1008`), case dockets, officer profiles, SHA-256 checksums, circulars, and benchmark queries are **100% synthetic demonstration fixtures**. RBAC redaction, file hashing, effective-date RAG filtering, and reliability benchmarks execute locally in the browser to demonstrate system architecture and governance rules transparently without claiming live server security or live LLM API calls.

---

## Core Architectural Principle: Deterministic First, Optional AI Layer

CASELINK 360 is engineered so every mission-critical regulatory workflow operates **without AI dependency**:
- Case intake validation, workflow state transitions, SLA overdue computation, audit logging, CSV exports;
- **Synchronous Pre-Dispatch Action Clearance** (`Draft → Issued`) catching duplicate document demands and confidential inspection collisions via deterministic rules;
- **Permission-Aware Redacted Stubs & Scoped Cross-Bureau Access Requests** (`Pending`, `Approved`, `Denied`, `Expired`, `Revoked`);
- **Shared Evidence Vault** reuse across bureaus without merging independent statutory case outcomes;
- **Rolling 60-Day Cohort Pattern Detection** & **Negative Memory Suppression** watch signatures;
- **Versioned Hinglish & Domain Glossary Search** (`GLOSSARY-v1.2`).

When **AI Assistance** is disabled (`Degraded Mode`) or when external AI services time out (`Simulated AI Failure Mode`), all deterministic operations remain 100% available.

---

## 7 Advanced Regulatory Coordination Capabilities Implemented

1. **Pre-Dispatch Action Clearance (`/cases/CL-2026-0125`, `/cases/CL-2026-0114`, `/cases/CL-2026-0121`)**
   - Synchronous pre-issuance rules gate (`CLR-RULESET-v2.4`):
     - *Duplicate Evidence Demand:* Flags PGRC's 9-day prior request (`ACT-2026-07`) on `INST-MH-2040` with one-click subscription to `EVD-2026-01` (`v2`).
     - *Confidential Inspection Sequencing Hazard:* Blocks advance Show-Cause Notice dispatch on `INST-TN-1008` while redacting confidential Vigilance inspection dates from non-authorised bureaus; requires **Senior Review Authority / Cross-Bureau Coordinator** override with mandatory written justification logged to the Audit Register.
     - *Clear to Proceed:* Permits unrelated same-institution actions (e.g., Hostel Welfare advisory `CL-2026-0121`) without false blocking.

2. **Redacted Cross-Bureau Visibility & Scoped Access (`/institutions/INST-MH-2040`, `/cases/CL-2026-0128`)**
   - Non-owning bureaus see coarse coordination stubs (`Owning Bureau`, `Coarse Category`, `Coarse Status`, `Permitted Activity Period`) while sensitive subject/complainant/annexure details remain withheld.
   - Full lifecycle drawer supporting `Pending` (`REQ-2026-01`), `Approved` (`REQ-2026-02`), `Denied` (`REQ-2026-03`), `Expired` (`REQ-2026-04`), and `Revoked` (`REQ-2026-05`) grants plus pre-retrieval RAG exclusion.

3. **Shared Evidence Vault (`/evidence`)**
   - Institutions submit artifacts once (`EVD-2026-01` certified refund scroll for `ABC Engineering College`), referenced simultaneously by closed PGRC case `CL-2026-0124` (`v2`) and open RB systemic review `CL-2026-0125` (`v1`, showing live newer-version upgrade prompt) without merging statutory outcomes.
   - Explicitly separates **SHA-256 file integrity checksums** from **official authority authenticity verification**.

4. **Five-Part Relationship Taxonomy & Negative Memory (`/coordination`)**
   - Explicitly distinguishes `Duplicate Filing`, `Cohort / Pattern Cluster` (rolling 60-day count $\ge 3$), `Causal Cross-Category Link` (separating verified facts from hypothesised link), `Operational Schedule Collision Only`, and `Verified Independent`.
   - Stateful **Negative Memory Suppression Ledger (`SUP-2026-01`)** suppresses dismissed pairs until watched facts (actions, documents/vault, due dates, or rule version) change.

5. **Effective-Date-Aware ("Time-Travel") Regulatory RAG (`/knowledge`, `/knowledge/sources`)**
   - Evaluates document validity (`effectiveFrom`, `effectiveTo`, `supersededByDocId`) against case `incidentDate`:
     - Current AY 2026-27 dispute (`CL-2026-0125`, `2026-10-08`) cites current Circular `DOC-POL-2025-09`.
     - Historical AY 2024-25 dispute (`CL-2025-0041`, `2024-11-12`) retrieves `DOC-POL-2023-02` as *Historically Applicable* with prominent supersession link to `DOC-POL-2025-09`.
     - Pre-filters restricted documents before context assembly and abstains cleanly when evidence is missing or out of date.

6. **Institution Readiness & Regulatory Cycle Checkpoints (`/institutions/INST-MH-2040`)**
   - Advisory cross-bureau synthesis across *Extension of Approval (EoA)*, *Intake Expansion Review*, and *Counselling / Admission Readiness* using strictly descriptive states (`No recorded flag`, `Review recommended`, `Outstanding items`, `Evidence unavailable`) without inventing numeric scores or auto-blocking statutory decisions.

7. **Hinglish / Domain-Synonym Search & 60-Scenario Reliability Evaluation (`/evaluation`)**
   - Versioned glossary (`GLOSSARY-v1.2`) normalising regulatory synonyms & Hinglish phrases (`fees wapas`, `caution money`, `amanat rashi`, `original TC`, `tc rok rakha`, `vetan bakaya`) across Case Search and Knowledge Assistant even with AI turned off.
   - Reproducible 60-scenario live benchmark comparing **Degraded Mode (AI Off)** vs **Hybrid Mode (AI On)** using `Precision = TP/(TP+FP)`, `Recall = TP/(TP+FN)`, `FPR = FP/(FP+TN)`, and live `performance.now()` timing.

---

## Local Setup & Verification

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

---

## Complete Prototype Screen Map (SIH26264 / HLSD-Aligned)

| Screen | Route | Highlights |
| --- | --- | --- |
| Main Dashboard | `/` | 6 clickable KPI cards (active, overdue, approaching deadline, pending clearance, cross-bureau review, transferred/escalated), status-distribution donut, bureau-workload chart, pre-dispatch clearance queue, priority case queue, coordination alerts, recent activity, upcoming deadlines |
| Cases & Actions | `/cases` | Search, sort, bureau/status/priority/SLA/institution filters, linked-docket (`?ids=`) and transferred/escalated (`?flow=moved`) scopes, officer & next-action columns, CSV export, case registration drawer |
| Case Details | `/cases/:caseId` | Summary, timeline, status transitions, reassignment/priority routing, notes, related cases, clearance findings |
| Institution 360 | `/institutions/:id` | Complaint metrics strip, Overview / All Cases / Activity / Coordination tabs, bureau-wise distribution chart, pending actions & deadlines, readiness checkpoints, scoped access governance |
| Coordination Centre | `/coordination` | Alert queue, "Potentially Related Cases — Review Required" banner, side-by-side case comparison with match highlighting, Mark as Related / Mark as Independent / Add Coordination Note / Record Follow-Up Action, negative-memory ledger, cross-bureau tasks |
| Alerts & Notifications | `/alerts` | Unified feed of overdue cases, approaching deadlines, related-case reviews, pending coordination decisions, transfers/escalations, and clearance holds with severity filters and click-through navigation |
| Reports & Audit | `/reports` | Status/bureau/institution/taxonomy charts and tables, transfer & escalation statistics, case-report CSV export, audit CSV export, print view, immutable audit register |
| Evidence Vault | `/evidence` | Versioned artifacts, checksum vs authenticity separation, previews, cross-case references |
| Knowledge Assistant | `/knowledge` | Conversational policy search with citations, suggested questions, deterministic degraded mode |
| Administration | `/admin` | Officer/role profiles, bureau & department configuration, complaint-category routing, SLA deadline rules, status-transition rules, matching-rule thresholds, notification preferences, system configuration activity |

## Run Locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript strict check
npm test           # Vitest domain tests
npm run build      # Production bundle
```
