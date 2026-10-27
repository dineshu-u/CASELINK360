import React, { useState } from 'react';
import { FilePlus2, RefreshCw, Eye, X, Lock } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { ALL_BUREAUS } from '../data/seedData';
import { BureauName, KnowledgeDocument } from '../types/domain';
import { DocumentPreviewDrawer } from '../components/ui/DocumentPreviewDrawer';

export const KnowledgeSourcesPage: React.FC = () => {
  const { state, currentUser, canWrite, addKnowledgeDocument, reindexKnowledgeDocument } =
    useAppState();

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<KnowledgeDocument['category']>('Approved Policy');
  const [docType] = useState<KnowledgeDocument['docType']>('Regulatory Circular');
  const [issuingBureau, setIssuingBureau] = useState<BureauName>(currentUser.bureau);
  const [version, setVersion] = useState('v1.0');
  const [publicationDate] = useState(state.demoDate);
  const [effectiveFrom, setEffectiveFrom] = useState(state.demoDate);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [supersededByDocId, setSupersededByDocId] = useState('');
  const [applicableScope, setApplicableScope] = useState('AY 2026-27 onwards');
  const [accessScope, setAccessScope] = useState<KnowledgeDocument['accessScope']>(
    'All Authorised Officials'
  );
  const [reviewStatus, setReviewStatus] = useState<KnowledgeDocument['reviewStatus']>('Approved');
  const [linkedInstitutionId, setLinkedInstitutionId] = useState('');
  const [summary, setSummary] = useState('');
  const [extractedPreview, setExtractedPreview] = useState('');
  const [keywordsCsv, setKeywordsCsv] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredDocs = state.documents.filter((d) => {
    if (categoryFilter !== 'All' && d.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      d.id.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.issuingBureau.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q)
    );
  });

  const previewDoc = state.documents.find((d) => d.id === previewDocId) ?? null;

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addKnowledgeDocument({
      title,
      category,
      docType,
      issuingBureau,
      version,
      publicationDate,
      effectiveFrom,
      effectiveTo,
      supersededByDocId,
      applicableScope,
      accessScope,
      reviewStatus,
      linkedInstitutionId,
      summary,
      extractedPreview,
      keywordsCsv,
    });
    if (!res.ok) {
      setFormError(res.error ?? 'Unable to register source document.');
      return;
    }
    setFormError(null);
    setDrawerOpen(false);
    setTitle('');
    setSummary('');
    setExtractedPreview('');
    setKeywordsCsv('');
    setBanner(`Registered & indexed source document ${res.docId} with effective-date metadata.`);
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Knowledge Sources &amp; Temporal Validity Registry</h1>
          <p className="page-subtitle">
            Governs effective dates, supersession links, bureau access scope, and indexing status for all RAG citations
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canWrite}
            onClick={() => setDrawerOpen(true)}
          >
            <FilePlus2 size={15} />
            Register Policy / Record
          </button>
        </div>
      </div>

      {banner && (
        <div className="alert-banner success">
          <div>{banner}</div>
        </div>
      )}

      <div className="panel">
        <div className="filter-bar">
          <input
            type="search"
            className="field-input search-wide"
            placeholder="Search by Document ID (DOC-POL-2025-09, DOC-POL-2023-02), title, or bureau..."
            aria-label="Search knowledge sources"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-select"
            aria-label="Filter by source category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Approved Policy">Approved Policy &amp; Circulars</option>
            <option value="Historical Case Record">Historical Case Records</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doc ID</th>
                <th>Title &amp; Scope</th>
                <th>Issuing Bureau</th>
                <th>Effective Validity Window</th>
                <th>Status &amp; Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td className="mono font-semibold" style={{ whiteSpace: 'nowrap' }}>
                    {doc.id}
                  </td>
                  <td style={{ minWidth: 230 }}>
                    <div className="font-semibold">{doc.title}</div>
                    <div className="text-xs text-muted">
                      {doc.applicableScope}
                      {doc.supersededByDocId ? ` • Superseded by ${doc.supersededByDocId}` : ''}
                    </div>
                  </td>
                  <td>{doc.issuingBureau}</td>
                  <td className="mono text-xs">
                    {doc.effectiveFrom} → {doc.effectiveTo ?? 'Present'}
                  </td>
                  <td>
                    <div className="row-center" style={{ flexWrap: 'wrap', gap: 4 }}>
                      <span
                        className={`badge ${
                          doc.reviewStatus === 'Approved'
                            ? 'badge-success'
                            : doc.reviewStatus === 'Superseded (Historical)'
                            ? 'badge-warning'
                            : 'badge-critical'
                        }`}
                      >
                        {doc.reviewStatus}
                      </span>
                      {doc.accessScope === 'Restricted — Bureau Scoped' && (
                        <span className="badge badge-critical">
                          <Lock size={10} /> Restricted
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-center">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPreviewDocId(doc.id)}
                      >
                        <Eye size={13} /> Inspect
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            reindexKnowledgeDocument(doc.id);
                            setBanner(`Re-indexed ${doc.id}.`);
                          }}
                          title="Re-index passages & temporal validity"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload / Register Drawer */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} role="presentation">
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <h3>Register Policy Circular / Case Record</h3>
                <p className="text-xs text-muted">
                  Includes temporal effective-date window &amp; bureau access scope
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

            <form onSubmit={handleUpload} className="drawer-body stack-md">
              {formError && (
                <div className="alert-banner critical">
                  <div>{formError}</div>
                </div>
              )}

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-title">
                    Document Title *
                  </label>
                  <input
                    id="doc-title"
                    type="text"
                    className="field-input"
                    placeholder="e.g., Revised Fee Refund & Counselling Cutoff Circular"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-ver">
                    Version Label
                  </label>
                  <input
                    id="doc-ver"
                    type="text"
                    className="field-input mono"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-cat">
                    Source Category
                  </label>
                  <select
                    id="doc-cat"
                    className="field-select"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as KnowledgeDocument['category'])
                    }
                  >
                    <option value="Approved Policy">Approved Policy</option>
                    <option value="Historical Case Record">Historical Case Record</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="doc-access">
                    Pre-Retrieval Access Scope
                  </label>
                  <select
                    id="doc-access"
                    className="field-select"
                    value={accessScope}
                    onChange={(e) =>
                      setAccessScope(e.target.value as KnowledgeDocument['accessScope'])
                    }
                  >
                    <option value="All Authorised Officials">All Authorised Officials</option>
                    <option value="Restricted — Bureau Scoped">Restricted — Bureau Scoped</option>
                  </select>
                </div>
              </div>

              <div className="grid-3">
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-eff-from">
                    Effective From *
                  </label>
                  <input
                    id="doc-eff-from"
                    type="date"
                    className="field-input mono"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-eff-to">
                    Effective To (Optional)
                  </label>
                  <input
                    id="doc-eff-to"
                    type="date"
                    className="field-input mono"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-sup">
                    Superseded By Doc ID
                  </label>
                  <input
                    id="doc-sup"
                    type="text"
                    className="field-input mono"
                    placeholder="e.g., DOC-POL-2025-09"
                    value={supersededByDocId}
                    onChange={(e) => setSupersededByDocId(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-bureau">
                    Issuing Bureau
                  </label>
                  <select
                    id="doc-bureau"
                    className="field-select"
                    value={issuingBureau}
                    onChange={(e) => setIssuingBureau(e.target.value as BureauName)}
                  >
                    {ALL_BUREAUS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-status">
                    Review / Validity Status
                  </label>
                  <select
                    id="doc-status"
                    className="field-select"
                    value={reviewStatus}
                    onChange={(e) =>
                      setReviewStatus(e.target.value as KnowledgeDocument['reviewStatus'])
                    }
                  >
                    <option value="Approved">Approved (In Force)</option>
                    <option value="Superseded (Historical)">Superseded (Historical)</option>
                    <option value="Draft (Excluded from RAG)">Draft (Excluded from RAG)</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-scope">
                    Applicable Scope
                  </label>
                  <input
                    id="doc-scope"
                    type="text"
                    className="field-input"
                    value={applicableScope}
                    onChange={(e) => setApplicableScope(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="doc-inst">
                    Linked Institution (Optional)
                  </label>
                  <select
                    id="doc-inst"
                    className="field-select"
                    value={linkedInstitutionId}
                    onChange={(e) => setLinkedInstitutionId(e.target.value)}
                  >
                    <option value="">None (General Policy)</option>
                    {state.institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.id} — {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="doc-summary">
                  Executive Summary
                </label>
                <input
                  id="doc-summary"
                  type="text"
                  className="field-input"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="doc-extract">
                  Extracted Clause Text (Used for Citations) *
                </label>
                <textarea
                  id="doc-extract"
                  className="field-textarea"
                  rows={4}
                  value={extractedPreview}
                  onChange={(e) => setExtractedPreview(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="doc-kw">
                  Retrieval Keywords (Comma-separated)
                </label>
                <input
                  id="doc-kw"
                  type="text"
                  className="field-input"
                  placeholder="e.g., fee refund, caution money, original tc"
                  value={keywordsCsv}
                  onChange={(e) => setKeywordsCsv(e.target.value)}
                />
              </div>

              <div className="row-center" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save &amp; Index Document
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <DocumentPreviewDrawer
        doc={previewDoc}
        onSelectDocId={(id) => setPreviewDocId(id)}
        onClose={() => setPreviewDocId(null)}
      />
    </div>
  );
};
