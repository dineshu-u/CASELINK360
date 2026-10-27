# CASELINK 360 — Visual Design & Architecture Specification

## 1. Governing Principle
CASELINK 360 is a deterministic institutional complaint-monitoring and cross-bureau coordination workspace with optional, citation-grounded RAG assistance. Every operational decision requires human review and explicit confirmation; turning AI assistance off leaves every core workflow intact.

## 2. Color System
- **Canvas & Surfaces:** `#F4F6F9` workspace canvas, `#FFFFFF` ledger sheet surface, `#EEF2F6` header & quiet sub-panel surface.
- **Navigation Rail:** `#13293D` deep institutional navy, `#1D3F5E` active item surface, `#63A4F4` active indicator bar.
- **Typography Ink:** `#152232` primary ink, `#526275` secondary metadata, `#6E7E91` muted captions.
- **Primary Action:** `#1F5AA6` action blue (`#184785` hover, `#EBF2FB` soft tint).
- **Borders:** `#DCE3EC` primary rule, `#BFCBD9` control edge.
- **Operational Semantics (reserved strictly for status/SLA meaning):**
  - Normal / Verified / Resolved: `#1B6B4A` ink on `#E9F5F0`
  - Pending / Approaching SLA / Needs Review: `#8A5600` ink on `#FEF6E7`
  - Critical / Overdue / Escalated: `#A61C14` ink on `#FDF0EF`
  - Active Cross-Bureau Coordination: `#1E4E8C` ink on `#EBF2FB`

## 3. Typography & Spacing
- **UI & Prose:** `IBM Plex Sans` (400, 500, 600) — high open-counter legibility for dense administrative tables and case dockets.
- **Identifiers & Tabular Data:** `IBM Plex Mono` (400, 500) + `tabular-nums` for case IDs (`CL-2026-0104`), institution IDs (`INST-TN-1042`), rule triggers (`RULE-OVL-02`), and dates.
- **Scale & Grid:** 4px base rhythm (`4 / 8 / 12 / 16 / 20 / 24 / 32px`), sentence-case labels, max 72ch prose width, restrained `4px–6px` border radius, zero decorative gradients or nested drop-shadow cards.

## 4. Navigation & Component Hierarchy
- **Left Navigation Rail:** Collapsible desktop rail (`244px` / `64px`) and accessible mobile drawer (`< 1024px`) covering Dashboard, Complaints & Cases, Institution Registry, Coordination Centre, Knowledge Assistant, Knowledge Sources, Reports & Audit, and Administration.
- **Top Application Bar:** Breadcrumb trail, Global Search omnibox, `PROTOTYPE · DEMO DATA` indicator, live `AI Assist` toggle status, Notification drawer, and Demonstration Role selector.
- **Distinctive Operational Affordances:**
  1. Single-surface **Operational Ledger Band** on Dashboard (replaces generic shadow KPI cards).
  2. Explicit **Provenance Tags** distinguishing `Deterministic Rule` triggers from `Optional RAG Synthesis`.
  3. **Human-in-the-Loop Decision Gate** in Coordination Centre requiring reasoned confirmation before confirming links or resolving alerts.
