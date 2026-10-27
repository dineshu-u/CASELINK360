import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, BookOpen, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { KnowledgeDocument } from '../../types/domain';
import { Drawer } from './Overlays';
import { formatDateDisplay } from '../../services/caseService';
import { useAppState } from '../../state/AppStateContext';
import { canUserAccessDocument } from '../../services/accessService';

export const DocumentPreviewDrawer: React.FC<{
  doc?: KnowledgeDocument | null;
  document?: KnowledgeDocument | null;
  highlightPassageId?: string;
  highlightSection?: string;
  onSelectDocId?: (docId: string) => void;
  onClose: () => void;
}> = ({
  doc,
  document: documentProp,
  highlightPassageId,
  highlightSection,
  onSelectDocId,
  onClose,
}) => {
  const { state, currentUser, reindexKnowledgeDocument } = useAppState();
  const targetDoc = doc ?? documentProp ?? null;

  const isAuthorised = targetDoc
    ? canUserAccessDocument(
        currentUser,
        targetDoc,
        state.cases,
        state.accessRequests,
        state.demoDate
      )
    : false;

  return (
    <Drawer
      open={Boolean(targetDoc)}
      title={targetDoc ? `${targetDoc.id} — ${targetDoc.title}` : 'Document Preview'}
      subtitle={
        targetDoc
          ? `${targetDoc.category} · ${targetDoc.docType} · Version ${targetDoc.version}`
          : undefined
      }
      onClose={onClose}
      footer={
        targetDoc ? (
          <>
            {isAuthorised && (
              <button
                type="button"
                className="btn"
                onClick={() => reindexKnowledgeDocument(targetDoc.id)}
                disabled={targetDoc.indexingStatus === 'Re-indexing'}
              >
                <RefreshCw size={14} />
                {targetDoc.indexingStatus === 'Re-indexing' ? 'Re-indexing...' : 'Re-index metadata'}
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close preview
            </button>
          </>
        ) : undefined
      }
    >
      {targetDoc && (
        <div className="stack-md">
          {!isAuthorised ? (
            <div className="callout critical">
              <div className="row-center">
                <Lock size={15} />
                <strong>Restricted Cross-Bureau Source — Scoped Grant Required</strong>
              </div>
              <span>
                This annexure belongs to <strong>{targetDoc.issuingBureau}</strong> (
                {targetDoc.accessScope}). Both UI preview and RAG context assembly block
                unauthorised access until a scoped grant is approved via{' '}
                {targetDoc.linkedInstitutionId ? (
                  <Link
                    to={`/institutions/${targetDoc.linkedInstitutionId}`}
                    onClick={onClose}
                  >
                    Institution 360 ({targetDoc.linkedInstitutionId})
                  </Link>
                ) : (
                  'the owning bureau'
                )}
                .
              </span>
            </div>
          ) : (
            <>
              {targetDoc.supersededByDocId && (
                <div className="callout warning">
                  <div className="row-center">
                    <AlertTriangle size={15} />
                    <strong>Superseded Historical Policy Notice</strong>
                  </div>
                  <span>
                    Valid from <span className="mono">{targetDoc.effectiveFrom}</span> to{' '}
                    <span className="mono">{targetDoc.effectiveTo ?? '—'}</span>. Superseded by{' '}
                    {onSelectDocId ? (
                      <button
                        type="button"
                        className="btn-link mono font-semibold"
                        onClick={() => onSelectDocId(targetDoc.supersededByDocId!)}
                      >
                        {targetDoc.supersededByDocId}
                      </button>
                    ) : (
                      <Link
                        to={`/knowledge/sources?doc=${targetDoc.supersededByDocId}`}
                        className="mono font-semibold"
                        onClick={onClose}
                      >
                        {targetDoc.supersededByDocId}
                      </Link>
                    )}
                    . Retained strictly for evaluating older incident dates.
                  </span>
                </div>
              )}

              <div className="kv-grid">
                <div className="kv-item">
                  <span className="kv-label">Document ID</span>
                  <span className="kv-value mono">{targetDoc.id}</span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Issuing / Owning Bureau</span>
                  <span className="kv-value">{targetDoc.issuingBureau}</span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Effective Window</span>
                  <span className="kv-value mono">
                    {formatDateDisplay(targetDoc.effectiveFrom)} →{' '}
                    {targetDoc.effectiveTo ? formatDateDisplay(targetDoc.effectiveTo) : 'In Force'}
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Applicable Scope</span>
                  <span className="kv-value">{targetDoc.applicableScope}</span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Review Status</span>
                  <span className="kv-value">
                    <span
                      className={`badge ${
                        targetDoc.supersededByDocId ? 'badge-warning' : 'badge-success'
                      }`}
                    >
                      {targetDoc.reviewStatus}
                    </span>
                  </span>
                </div>
                <div className="kv-item">
                  <span className="kv-label">Access Scope</span>
                  <span className="kv-value">{targetDoc.accessScope}</span>
                </div>
              </div>

              <div>
                <h3 className="panel-title" style={{ marginBottom: 6 }}>
                  <FileText size={15} /> Summary
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-secondary)' }}>{targetDoc.summary}</p>
              </div>

              <div>
                <h3 className="panel-title" style={{ marginBottom: 6 }}>
                  <BookOpen size={15} /> Extracted Text Preview
                </h3>
                <pre
                  style={{
                    margin: 0,
                    padding: '12px 14px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: 1.55,
                  }}
                >
                  {targetDoc.extractedPreview}
                </pre>
              </div>

              <div>
                <h3 className="panel-title" style={{ marginBottom: 8 }}>
                  Indexed Citation Passages ({targetDoc.passages.length})
                </h3>
                <div className="stack-sm">
                  {targetDoc.passages.map((p) => {
                    const highlighted =
                      p.id === highlightPassageId ||
                      (Boolean(highlightSection) && p.section === highlightSection);
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '11px 13px',
                          borderRadius: 'var(--radius-sm)',
                          border: highlighted
                            ? '2px solid var(--accent-primary)'
                            : '1px solid var(--border-subtle)',
                          background: highlighted ? 'var(--accent-soft)' : 'var(--bg-surface)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            marginBottom: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--ink-secondary)',
                          }}
                        >
                          <span>{p.section}</span>
                          <span className="mono">Page {p.page}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13 }}>{p.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {(targetDoc.linkedCaseIds.length > 0 || targetDoc.linkedInstitutionId) && (
                <div>
                  <h3 className="panel-title" style={{ marginBottom: 8 }}>
                    Linked Operational Records
                  </h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {targetDoc.linkedInstitutionId && (
                      <Link
                        to={`/institutions/${targetDoc.linkedInstitutionId}`}
                        className="btn btn-sm"
                        onClick={onClose}
                      >
                        Institution: <span className="mono">{targetDoc.linkedInstitutionId}</span>
                      </Link>
                    )}
                    {targetDoc.linkedCaseIds.map((cid) => (
                      <Link
                        key={cid}
                        to={`/cases/${cid}`}
                        className="btn btn-sm"
                        onClick={onClose}
                      >
                        Case: <span className="mono">{cid}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
};
