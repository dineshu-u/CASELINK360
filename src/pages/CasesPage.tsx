import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Download, RotateCcw, ArrowUpDown, BookOpen, Filter } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { ALL_BUREAUS, CASE_CATEGORIES } from '../data/seedData';
import {
  CaseSortField,
  exportCasesToCsv,
  filterAndSortCases,
  getCaseSlaStatus,
  NewCaseInput,
  validateNewCase,
} from '../services/caseService';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/ui/Badges';
import { BureauName, CasePriority, CaseRecord, CaseStatus } from '../types/domain';
import { X } from 'lucide-react';
import { expandQueryWithGlossary, GLOSSARY_VERSION } from '../services/glossary';
import { hasFullCaseReadAccess } from '../services/accessService';

export const CasesPage: React.FC = () => {
  const { state, currentUser, canWrite, createCase } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [bureau, setBureau] = useState(searchParams.get('bureau') ?? 'All');
  const [assignedBureau, setAssignedBureau] = useState(
    searchParams.get('assignedBureau') ?? 'All'
  );
  const [officerId, setOfficerId] = useState(searchParams.get('officer') ?? 'All');
  const [activeOnly, setActiveOnly] = useState(searchParams.get('scope') === 'active');
  const [clearanceOnly, setClearanceOnly] = useState(searchParams.get('clearance') === 'draft');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'All');
  const [priority, setPriority] = useState(searchParams.get('priority') ?? 'All');
  const [slaFilter, setSlaFilter] = useState(searchParams.get('sla') ?? 'All');
  const [institutionId, setInstitutionId] = useState(searchParams.get('inst') ?? 'All');
  const [sortField, setSortField] = useState<CaseSortField>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [drawerOpen, setDrawerOpen] = useState(searchParams.get('new') === '1');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
    setBureau(searchParams.get('bureau') ?? 'All');
    setAssignedBureau(searchParams.get('assignedBureau') ?? 'All');
    setOfficerId(searchParams.get('officer') ?? 'All');
    setActiveOnly(searchParams.get('scope') === 'active');
    setClearanceOnly(searchParams.get('clearance') === 'draft');
    setStatus(searchParams.get('status') ?? 'All');
    setPriority(searchParams.get('priority') ?? 'All');
    setSlaFilter(searchParams.get('sla') ?? 'All');
    setInstitutionId(searchParams.get('inst') ?? 'All');
    setDrawerOpen(searchParams.get('new') === '1');
  }, [searchParams]);

  const [form, setForm] = useState<NewCaseInput>({
    institutionId: state.institutions[0]?.id ?? '',
    subject: '',
    category: CASE_CATEGORIES[0],
    description: '',
    sourceChannel: 'Portal Grievance',
    sourceBureau: currentUser.bureau,
    assignedBureau: currentUser.bureau,
    assignedOfficerId: currentUser.id,
    priority: 'High',
    receivedDate: state.demoDate,
    dueDate: '2026-11-05',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const glossaryExpansion = useMemo(() => expandQueryWithGlossary(search), [search]);

  const draftClearanceCaseIds = useMemo(
    () =>
      clearanceOnly
        ? new Set(
            state.actions
              .filter((a) => a.status === 'Draft')
              .map((a) => a.caseId)
          )
        : undefined,
    [clearanceOnly, state.actions]
  );

  const idsParam = searchParams.get('ids') ?? '';
  const flowParam = searchParams.get('flow') ?? '';
  const [category, setCategory] = useState(searchParams.get('category') ?? 'All');
  const [region, setRegion] = useState(searchParams.get('region') ?? 'All');
  const [lifecycle, setLifecycle] = useState(searchParams.get('lifecycle') ?? 'All');
  const [receivedFrom, setReceivedFrom] = useState(searchParams.get('from') ?? '');
  const [receivedTo, setReceivedTo] = useState(searchParams.get('to') ?? '');

  useEffect(() => {
    setCategory(searchParams.get('category') ?? 'All');
    setRegion(searchParams.get('region') ?? 'All');
    setLifecycle(searchParams.get('lifecycle') ?? 'All');
    setReceivedFrom(searchParams.get('from') ?? '');
    setReceivedTo(searchParams.get('to') ?? '');
  }, [searchParams]);

  const baseFilteredCases = useMemo(
    () =>
      filterAndSortCases(
        state.cases,
        state.institutions,
        {
          search,
          bureau,
          assignedBureau,
          officerId,
          activeOnly,
          clearanceCaseIds: draftClearanceCaseIds,
          status,
          priority,
          slaFilter,
          institutionId,
        },
        sortField,
        sortDir,
        state.demoDate,
        state.settings.deadlineRules,
        {
          currentUser,
          accessRequests: state.accessRequests,
          demoDate: state.demoDate,
        }
      ),
    [
      state.cases,
      state.institutions,
      state.accessRequests,
      search,
      bureau,
      assignedBureau,
      officerId,
      activeOnly,
      draftClearanceCaseIds,
      status,
      priority,
      slaFilter,
      institutionId,
      sortField,
      sortDir,
      state.demoDate,
      state.settings.deadlineRules,
      currentUser,
    ]
  );

  // Secondary routed filters: explicit case-ID lists (e.g. from a coordination alert)
  // and transferred/escalated flow scoping from dashboard KPI navigation.
  const filteredCases = useMemo(() => {
    let rows = baseFilteredCases;
    if (flowParam === 'moved') {
      rows = rows.filter((c) => c.status === 'Escalated' || c.sourceBureau !== c.assignedBureau);
    }
    if (idsParam.trim()) {
      const idSet = new Set(
        idsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
      rows = rows.filter((c) => idSet.has(c.id));
    }
    if (category !== 'All') {
      rows = rows.filter((c) => c.category === category);
    }
    if (region !== 'All') {
      const regionInstIds = new Set(
        state.institutions.filter((i) => i.region === region).map((i) => i.id)
      );
      rows = rows.filter((c) => regionInstIds.has(c.institutionId));
    }
    if (lifecycle !== 'All') {
      rows = rows.filter((c) => {
        switch (lifecycle) {
          case 'Pending':
            return c.status === 'Open' || c.status === 'Pending Bureau';
          case 'Under Process':
            return (
              c.status === 'In Progress' ||
              c.status === 'Awaiting Review' ||
              c.status === 'Escalated'
            );
          case 'Disposed':
            return c.status === 'Resolved' || c.status === 'Closed';
          case 'Transferred':
            return c.sourceBureau !== c.assignedBureau;
          default:
            return true;
        }
      });
    }
    if (receivedFrom) {
      rows = rows.filter((c) => c.receivedDate >= receivedFrom);
    }
    if (receivedTo) {
      rows = rows.filter((c) => c.receivedDate <= receivedTo);
    }
    return rows;
  }, [
    baseFilteredCases,
    flowParam,
    idsParam,
    category,
    region,
    lifecycle,
    receivedFrom,
    receivedTo,
    state.institutions,
  ]);

  const toggleSort = (field: CaseSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setBureau('All');
    setAssignedBureau('All');
    setOfficerId('All');
    setActiveOnly(false);
    setClearanceOnly(false);
    setStatus('All');
    setPriority('All');
    setSlaFilter('All');
    setInstitutionId('All');
    setCategory('All');
    setRegion('All');
    setLifecycle('All');
    setReceivedFrom('');
    setReceivedTo('');
    setSearchParams({});
  };

  const handleExportCsv = () => {
    const csv = exportCasesToCsv(
      filteredCases,
      state.institutions,
      state.demoDate,
      state.settings.deadlineRules,
      {
        currentUser,
        accessRequests: state.accessRequests,
        demoDate: state.demoDate,
      }
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caselink360-cases-${state.demoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePriorityChange = (nextPriority: CasePriority) => {
    const rule = state.settings.deadlineRules.find((r) => r.priority === nextPriority);
    const base = new Date(`${form.receivedDate}T00:00:00Z`);
    if (rule && !Number.isNaN(base.getTime())) {
      base.setUTCDate(base.getUTCDate() + rule.targetDays);
      const dueStr = base.toISOString().slice(0, 10);
      setForm((prev) => ({ ...prev, priority: nextPriority, dueDate: dueStr }));
    } else {
      setForm((prev) => ({ ...prev, priority: nextPriority }));
    }
  };

  const handleSubmitNewCase = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateNewCase(form, state.institutions, currentUser);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    const res = createCase(form);
    if (!res.ok) {
      setErrors({ form: res.error ?? 'Unable to create case.' });
      return;
    }
    setErrors({});
    setDrawerOpen(false);
    setBannerMsg(
      `Registered case ${res.caseId} and evaluated same-institution relationship candidates without automatic merging.`
    );
    setForm((prev) => ({ ...prev, subject: '', description: '' }));
  };

  const allStatuses: CaseStatus[] = [
    'Open',
    'In Progress',
    'Pending Bureau',
    'Awaiting Review',
    'Escalated',
    'Resolved',
    'Closed',
  ];

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Case &amp; Grievance Register</h1>
          <p className="page-subtitle">
            Deterministic bureau intake, glossary-expanded search ({GLOSSARY_VERSION}), SLA tracking, and permission-scoped records
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={15} />
            Export Filtered CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canWrite}
            title={
              !canWrite
                ? 'Read-Only Auditor role cannot register new cases'
                : 'Register a new case record'
            }
            onClick={() => setDrawerOpen(true)}
          >
            <Plus size={15} />
            Register Case
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="alert-banner success">
          <div>{bannerMsg}</div>
        </div>
      )}

      {idsParam.trim() && (
        <div className="alert-banner info">
          <div>
            Showing only the linked dockets <span className="mono">{idsParam}</span> routed from a
            coordination record.{' '}
            <button
              type="button"
              className="link-inline"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('ids');
                setSearchParams(next);
              }}
            >
              Clear linked-docket scope
            </button>
          </div>
        </div>
      )}

      {flowParam === 'moved' && (
        <div className="alert-banner info">
          <div>
            Showing transferred or escalated dockets only (routed across bureaus or escalated in
            place).{' '}
            <button
              type="button"
              className="link-inline"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('flow');
                setSearchParams(next);
              }}
            >
              Clear flow scope
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="filter-bar">
          <input
            type="search"
            className="field-input search-wide"
            placeholder='Search Case ID, Institution, or Hinglish/synonym ("fees wapas", "caution money", "original TC")...'
            aria-label="Search cases"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="field-select"
            aria-label="Filter by bureau"
            value={bureau}
            onChange={(e) => setBureau(e.target.value)}
          >
            <option value="All">All Bureaus</option>
            {ALL_BUREAUS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            className="field-select"
            aria-label="Filter by status"
            value={activeOnly && status === 'All' ? 'Active' : status}
            onChange={(e) => {
              if (e.target.value === 'Active') {
                setActiveOnly(true);
                setStatus('All');
              } else {
                setActiveOnly(false);
                setStatus(e.target.value);
              }
            }}
          >
            <option value="All">All Statuses ({state.cases.length})</option>
            <option value="Active">Active Only (Exclude Resolved/Closed)</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="field-select"
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Standard">Standard</option>
            <option value="Low">Low</option>
          </select>

          <select
            className="field-select"
            aria-label="Filter by SLA status"
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
          >
            <option value="All">All SLA Windows</option>
            <option value="Overdue">Overdue Only</option>
            <option value="Approaching">Approaching Due Date</option>
            <option value="On Track">On Track</option>
          </select>

          <select
            className="field-select"
            aria-label="Filter by institution"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
          >
            <option value="All">All Institutions</option>
            {state.institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} — {i.name}
              </option>
            ))}
          </select>

          <select
            className="field-select"
            aria-label="Filter by complaint category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CASE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="field-select"
            aria-label="Filter by region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="All">All Regions</option>
            {Array.from(new Set(state.institutions.map((i) => i.region))).map((r) => (
              <option key={r} value={r}>
                {r} Region
              </option>
            ))}
          </select>

          <select
            className="field-select"
            aria-label="Filter by lifecycle stage"
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
          >
            <option value="All">All Lifecycle Stages</option>
            <option value="Pending">Pending (Open / Pending Bureau)</option>
            <option value="Under Process">Under Process (incl. Escalated)</option>
            <option value="Disposed">Disposed (Resolved / Closed)</option>
            <option value="Transferred">Transferred Across Bureaus</option>
          </select>

          <label className="row-center text-xs" style={{ gap: 5, flexWrap: 'wrap' }}>
            Received
            <input
              type="date"
              className="field-input"
              aria-label="Received from date"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              style={{ width: 170, flex: '0 0 auto' }}
            />
            →
            <input
              type="date"
              className="field-input"
              aria-label="Received to date"
              value={receivedTo}
              onChange={(e) => setReceivedTo(e.target.value)}
              style={{ width: 170, flex: '0 0 auto' }}
            />
          </label>

          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <RotateCcw size={13} />
            Reset Filters
          </button>
        </div>

        {/* Hinglish / Domain Glossary Expansion Strip (Capability 7) */}
        {glossaryExpansion.matchedEntries.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--accent-soft)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
            }}
          >
            <BookOpen size={13} style={{ display: 'inline', marginRight: 6 }} />
            <strong>Deterministic Glossary Expansion ({GLOSSARY_VERSION} — Works with AI Off):</strong>{' '}
            {glossaryExpansion.matchedEntries.map((m) => (
              <span key={m.conceptId} style={{ marginRight: 10 }}>
                <span className="badge badge-info">{m.canonicalTerm}</span>
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            padding: '7px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            background: 'var(--bg-surface)',
          }}
        >
          <span className="text-xs text-secondary row-center" style={{ flexWrap: 'wrap', gap: 6 }}>
            <Filter size={12} />
            <strong>
              Showing {filteredCases.length} of {state.cases.length} case record(s)
            </strong>
            {activeOnly && <span className="badge badge-info">Scope: Active cases</span>}
            {assignedBureau !== 'All' && (
              <span className="badge badge-info">Desk: {assignedBureau}</span>
            )}
            {officerId !== 'All' && (
              <span className="badge badge-info">
                Officer: {state.users.find((u) => u.id === officerId)?.name ?? officerId}
              </span>
            )}
            {clearanceOnly && (
              <span className="badge badge-warning">Pending pre-dispatch clearance</span>
            )}
            {slaFilter !== 'All' && (
              <span className="badge badge-critical">SLA: {slaFilter}</span>
            )}
          </span>
          <span className="text-xs text-muted">
            Quick test synonyms:{' '}
            {[
              'admission-fee repayment',
              'caution money',
              'original TC',
              'academic documents retained',
              'vetan bakaya',
            ].map((term) => (
              <button
                key={term}
                type="button"
                className="btn-link text-xs mono"
                style={{ marginRight: 10 }}
                onClick={() => setSearch(term)}
              >
                [{term}]
              </button>
            ))}
          </span>
        </div>

        {filteredCases.length === 0 ? (
          <div className="empty-state">
            <h3>No Matching Cases Found</h3>
            <p className="text-sm text-secondary mt-1">
              No case records match the active search query and filter criteria.
            </p>
            <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={clearFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggleSort('id')}
                    >
                      Case ID <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>Subject &amp; Category</th>
                  <th>Institution</th>
                  <th>Assigned Bureau &amp; Officer</th>
                  <th>
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggleSort('priority')}
                    >
                      Priority <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>Status</th>
                  <th>
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggleSort('dueDate')}
                    >
                      Target Due &amp; SLA <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>Next Action &amp; Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const inst = state.institutions.find((i) => i.id === c.institutionId);
                  const sla = getCaseSlaStatus(c, state.demoDate, state.settings.deadlineRules);
                  const readable = hasFullCaseReadAccess(
                    currentUser,
                    c,
                    state.accessRequests,
                    state.demoDate
                  );
                  return (
                    <tr key={c.id}>
                      <td className="mono font-semibold" style={{ whiteSpace: 'nowrap' }}>
                        <Link to={`/cases/${c.id}`} className="link-inline">
                          {c.id}
                        </Link>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <Link
                          to={`/cases/${c.id}`}
                          className="font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {readable
                            ? c.subject
                            : `[Restricted Stub] ${c.coarseCategoryLabel ?? 'Bureau Scoped Inquiry'}`}
                        </Link>
                        <div className="text-xs text-muted">
                          {readable ? `${c.category} • ${c.sourceChannel}` : `Restricted — ${c.assignedBureau}`}
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/institutions/${c.institutionId}`}
                          className="link-inline font-semibold"
                        >
                          {inst?.name ?? c.institutionId}
                        </Link>
                        <div className="mono text-xs text-muted">
                          {c.institutionId} ({inst?.city}, {inst?.state})
                        </div>
                      </td>
                      <td>
                        {c.assignedBureau}
                        <div className="text-xs text-muted">
                          {state.users.find((u) => u.id === c.assignedOfficerId)?.name ??
                            'Unassigned'}
                        </div>
                      </td>
                      <td>
                        <PriorityBadge priority={c.priority} />
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <div className="mono text-xs mb-2">{c.dueDate}</div>
                        <SlaBadge status={sla.status} label={sla.label} />
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {(() => {
                          const nextAction = state.actions.find(
                            (a) =>
                              a.caseId === c.id &&
                              a.status !== 'Completed' &&
                              a.status !== 'Subscribed to Shared Evidence'
                          );
                          return nextAction ? (
                            <div className="text-xs">
                              <span className="font-semibold">{nextAction.actionType}</span>
                              <div className="text-muted">
                                {nextAction.status} · from {nextAction.scheduledStart}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted">
                              {c.status === 'Resolved' || c.status === 'Closed'
                                ? 'Docket disposed'
                                : 'Continue bureau processing'}
                            </div>
                          );
                        })()}
                        <div className="mono text-xs text-muted mt-1">Upd {c.lastUpdated}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Case Drawer */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} role="presentation">
          <aside
            className="drawer-panel"
            onClick={(e) => e.stopPropagation()}
            aria-label="Register new case"
          >
            <div className="drawer-head">
              <div>
                <h3>Register New Case / Grievance</h3>
                <p className="text-xs text-muted">
                  Validated against AICTE Institution Registry; SLA deadline calculated automatically
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCase} className="drawer-body stack-md">
              {errors.form && (
                <div className="alert-banner critical">
                  <div>{errors.form}</div>
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="new-inst">
                  Target Institution (AICTE Permanent ID) *
                </label>
                <select
                  id="new-inst"
                  className="field-select"
                  value={form.institutionId}
                  onChange={(e) => setForm((p) => ({ ...p, institutionId: e.target.value }))}
                >
                  {state.institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} — {i.name} ({i.city}, {i.state})
                    </option>
                  ))}
                </select>
                {errors.institutionId && <span className="field-error">{errors.institutionId}</span>}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-subject">
                  Case Subject / Grievance Summary *
                </label>
                <input
                  id="new-subject"
                  type="text"
                  className="field-input"
                  placeholder="Concise summary of reported non-compliance or request"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                />
                {errors.subject && <span className="field-error">{errors.subject}</span>}
              </div>

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="new-cat">
                    Issue Category *
                  </label>
                  <select
                    id="new-cat"
                    className="field-select"
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        category: e.target.value as CaseRecord['category'],
                      }))
                    }
                  >
                    {CASE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="new-channel">
                    Intake Channel
                  </label>
                  <select
                    id="new-channel"
                    className="field-select"
                    value={form.sourceChannel}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        sourceChannel: e.target.value as CaseRecord['sourceChannel'],
                      }))
                    }
                  >
                    <option value="Portal Grievance">Portal Grievance</option>
                    <option value="Inspection Referral">Inspection Referral</option>
                    <option value="Vigilance Reference">Vigilance Reference</option>
                    <option value="State Directorate Note">State Directorate Note</option>
                    <option value="Compliance Undertaking">Compliance Undertaking</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="new-bureau">
                    Assigned Bureau *
                  </label>
                  <select
                    id="new-bureau"
                    className="field-select"
                    value={form.assignedBureau}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, assignedBureau: e.target.value as BureauName }))
                    }
                  >
                    {ALL_BUREAUS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="new-officer">
                    Assigned Case Officer
                  </label>
                  <select
                    id="new-officer"
                    className="field-select"
                    value={form.assignedOfficerId}
                    onChange={(e) => setForm((p) => ({ ...p, assignedOfficerId: e.target.value }))}
                  >
                    {state.users
                      .filter((u) => u.role !== 'Read-Only Auditor')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.bureau})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid-3">
                <div className="field-group">
                  <label className="field-label" htmlFor="new-priority">
                    Priority Level
                  </label>
                  <select
                    id="new-priority"
                    className="field-select"
                    value={form.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as CasePriority)}
                  >
                    <option value="Critical">Critical (10d SLA)</option>
                    <option value="High">High (14d SLA)</option>
                    <option value="Standard">Standard (21d SLA)</option>
                    <option value="Low">Low (30d SLA)</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="new-received">
                    Received Date *
                  </label>
                  <input
                    id="new-received"
                    type="date"
                    className="field-input mono"
                    value={form.receivedDate}
                    onChange={(e) => setForm((p) => ({ ...p, receivedDate: e.target.value }))}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="new-due">
                    Target Due Date *
                  </label>
                  <input
                    id="new-due"
                    type="date"
                    className="field-input mono"
                    value={form.dueDate}
                    onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                  {errors.dueDate && <span className="field-error">{errors.dueDate}</span>}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-desc">
                  Detailed Factual Description *
                </label>
                <textarea
                  id="new-desc"
                  className="field-textarea"
                  rows={4}
                  placeholder="Record factual allegations, document references, program names, and dates..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
                {errors.description && <span className="field-error">{errors.description}</span>}
              </div>

              <div className="row-center" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save &amp; Register Case
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
};
