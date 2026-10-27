import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  FileUp,
  History,
  Link2,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { AuthenticityBadge, StatusBadge } from '../components/ui/Badges';
import { EvidenceArtifact } from '../types/domain';

const ARTIFACT_TYPES: EvidenceArtifact['artifactType'][] = [
  'Certified Withdrawal & Fee Refund Scroll',
  'Authenticated University Enrolment Roll',
  'Bank Salary & EPF TRRN Scroll',
  'Compliance Undertaking Affidavit',
  'Laboratory Stock & Calibration Register',
  'Faculty Appointment & PhD Verification File',
];

export const EvidenceVaultPage: React.FC = () => {
  const {
    state,
    canWrite,
    uploadEvidenceToVault,
    verifyVaultArtifact,
    subscribeCaseToEvidence,
  } = useAppState();
  const [searchParams] = useSearchParams();

  const [instFilter, setInstFilter] = useState(searchParams.get('inst') ?? 'All');
  const [authFilter, setAuthFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string>(
    searchParams.get('artifact') ?? state.evidenceVault[0]?.id ?? ''
  );

  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'new' | 'version'>('new');
  const [formInst, setFormInst] = useState('INST-MH-2040');
  const [formAy, setFormAy] = useState('AY 2026-27');
  const [formType, setFormType] = useState<EvidenceArtifact['artifactType']>(ARTIFACT_TYPES[0]);
  const [formTitle, setFormTitle] = useState('');
  const [formSubmitter, setFormSubmitter] = useState('Registrar Office');
  const [formSummary, setFormSummary] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [linkCaseId, setLinkCaseId] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'success' | 'critical'; text: string } | null>(null);

  const filteredArtifacts = useMemo(() => {
    return state.evidenceVault.filter((a) => {
      if (instFilter !== 'All' && a.institutionId !== instFilter) return false;
      if (authFilter !== 'All' && a.authenticityStatus !== authFilter) return false;
      return true;
    });
  }, [state.evidenceVault, instFilter, authFilter]);

  const activeArtifact =
    state.evidenceVault.find((a) => a.id === selectedId) ?? filteredArtifacts[0] ?? null;

  const referencingCases = useMemo(() => {
    if (!activeArtifact) return [];
    return state.cases.filter((c) =>
      c.evidenceLinks.some((l) => l.artifactId === activeArtifact.id)
    );
  }, [activeArtifact, state.cases]);

  const eligibleCasesForSubscribe = useMemo(() => {
    if (!activeArtifact) return [];
    return state.cases.filter((c) => c.institutionId === activeArtifact.institutionId);
  }, [activeArtifact, state.cases]);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = uploadEvidenceToVault({
      targetArtifactId: uploadMode === 'version' && activeArtifact ? activeArtifact.id : undefined,
      institutionId: uploadMode === 'version' && activeArtifact ? activeArtifact.institutionId : formInst,
      academicYear: formAy,
      artifactType: formType,
      title:
        uploadMode === 'version' && activeArtifact
          ? activeArtifact.title
          : formTitle,
      submittedBy: formSubmitter,
      fileSizeLabel: '2.1 MB Signed PDF',
      summary: formSummary,
      changeSummary: formSummary,
    });
    if (!res.ok) {
      setMsg({ tone: 'critical', text: res.error ?? 'Submission failed.' });
      return;
    }
    setFormTitle('');
    setFormSummary('');
    setUploadDrawerOpen(false);
    if (res.artifactId) setSelectedId(res.artifactId);
    setMsg({
      tone: 'success',
      text: `Recorded ${res.artifactId} (${res.version}) with deterministic SHA-256 integrity hash. Official authenticity status remains "Pending Official Verification" until certified by an authorised officer.`,
    });
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Shared Evidence Vault</h1>
          <p className="page-subtitle">
            Submit-once institutional compliance artifacts referenced simultaneously across bureaus without merging independent case outcomes
          </p>
        </div>
        <div className="page-actions">
          {canWrite && (
            <>
              {activeArtifact && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setUploadMode('version');
                    setUploadDrawerOpen(true);
                  }}
                >
                  <History size={15} /> Append Newer Version ({activeArtifact.id})
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setUploadMode('new');
                  setUploadDrawerOpen(true);
                }}
              >
                <FileUp size={15} /> Submit Vault Artifact
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mandatory Integrity Hash vs Authenticity Verification Distinction Banner */}
      <div className="alert-banner info">
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>File Integrity Checksum vs. Official Authenticity Distinction:</strong> Recording a{' '}
          <span className="mono">SHA-256</span> file hash only verifies byte-level file integrity after upload (no silent file alteration). It does <strong>not</strong> prove real-world document authenticity — an authorised bureau officer must explicitly verify bank scrolls, UTRs, or registrar seals before marking an artifact <em>Verified by Authority</em>.
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.tone}`}>
          <ShieldAlert size={16} />
          <div>{msg.text}</div>
        </div>
      )}

      <div className="detail-grid">
        {/* Left Master Table */}
        <div className="panel">
          <div className="filter-bar">
            <select
              className="field-select"
              aria-label="Filter vault by institution"
              value={instFilter}
              onChange={(e) => setInstFilter(e.target.value)}
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
              aria-label="Filter by verification status"
              value={authFilter}
              onChange={(e) => setAuthFilter(e.target.value)}
            >
              <option value="All">All Authenticity States</option>
              <option value="Verified by Authority">Verified by Authority</option>
              <option value="Pending Official Verification">Pending Official Verification</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artifact ID</th>
                  <th>Institution &amp; Type</th>
                  <th>Latest Version</th>
                  <th>Authenticity Status</th>
                  <th>Case Subscriptions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArtifacts.map((art) => {
                  const inst = state.institutions.find((i) => i.id === art.institutionId);
                  const subs = state.cases.filter((c) =>
                    c.evidenceLinks.some((l) => l.artifactId === art.id)
                  );
                  const selected = activeArtifact?.id === art.id;

                  return (
                    <tr
                      key={art.id}
                      onClick={() => setSelectedId(art.id)}
                      style={{
                        cursor: 'pointer',
                        background: selected ? 'var(--accent-soft)' : undefined,
                      }}
                    >
                      <td className="mono font-semibold text-accent">{art.id}</td>
                      <td>
                        <div className="font-semibold">{art.title}</div>
                        <div className="text-xs text-muted">
                          {art.institutionId} ({inst?.name}) • {art.academicYear}
                        </div>
                      </td>
                      <td className="mono">{art.currentVersion}</td>
                      <td>
                        <AuthenticityBadge status={art.authenticityStatus} />
                      </td>
                      <td className="mono">{subs.length} case(s)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="stack-lg">
          {activeArtifact && (
            <>
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="row-center" style={{ gap: 8 }}>
                      <span className="mono font-semibold text-accent">{activeArtifact.id}</span>
                      <span className="badge badge-info mono">{activeArtifact.currentVersion}</span>
                      <AuthenticityBadge status={activeArtifact.authenticityStatus} />
                    </div>
                    <h2 className="mt-1">{activeArtifact.title}</h2>
                  </div>
                </div>

                <div className="panel-body stack-md">
                  <div className="meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">Institution</span>
                      <span className="meta-value">
                        <Link
                          to={`/institutions/${activeArtifact.institutionId}`}
                          className="link-inline mono"
                        >
                          {activeArtifact.institutionId}
                        </Link>
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Academic Year</span>
                      <span className="meta-value mono">{activeArtifact.academicYear}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Artifact Classification</span>
                      <span className="meta-value">{activeArtifact.artifactType}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Access Policy</span>
                      <span className="meta-value">{activeArtifact.accessPolicy}</span>
                    </div>
                  </div>

                  <p className="text-sm text-secondary">{activeArtifact.summary}</p>

                  {activeArtifact.verifiedBy && (
                    <div className="alert-banner success">
                      <CheckCircle2 size={15} />
                      <div className="text-xs">
                        <strong>Official Authenticity Certified:</strong> {activeArtifact.verifiedBy} (
                        {activeArtifact.verifiedBureau}) at <span className="mono">{activeArtifact.verifiedAt}</span>
                      </div>
                    </div>
                  )}

                  {canWrite && activeArtifact.authenticityStatus !== 'Verified by Authority' && (
                    <div
                      className="panel"
                      style={{ background: 'var(--bg-subtle)' }}
                    >
                      <div className="panel-body stack-sm">
                        <h4 className="text-xs font-semibold">
                          Officer Authenticity Verification Action
                        </h4>
                        <input
                          type="text"
                          className="field-input"
                          placeholder="Verification note (e.g., Confirmed bank scroll / EPFO TRRN receipt)..."
                          value={verifyNote}
                          onChange={(e) => setVerifyNote(e.target.value)}
                        />
                        <div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              verifyVaultArtifact(activeArtifact.id, verifyNote);
                              setVerifyNote('');
                              setMsg({
                                tone: 'success',
                                text: `Certified official authenticity of ${activeArtifact.id} (${activeArtifact.currentVersion}).`,
                              });
                            }}
                          >
                            Mark Verified by Authority
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/*Simultaneous Cross-Bureau Case Subscriptions */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2">
                      Simultaneous Cross-Bureau Case Subscriptions ({referencingCases.length}) — Outcomes Remain Independent
                    </h4>
                    <div className="stack-xs">
                      {referencingCases.map((c) => {
                        const lnk = c.evidenceLinks.find((l) => l.artifactId === activeArtifact.id)!;
                        const outdated = lnk.linkedVersion !== activeArtifact.currentVersion;
                        return (
                          <div key={c.id} className="citation-card">
                            <div className="split-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                              <Link to={`/cases/${c.id}`} className="mono font-semibold link-inline">
                                {c.id}
                              </Link>
                              <div className="row-center">
                                <span
                                  className={`badge mono ${
                                    outdated ? 'badge-warning' : 'badge-neutral'
                                  }`}
                                >
                                  Linked {lnk.linkedVersion}
                                  {outdated ? ` (Latest: ${activeArtifact.currentVersion})` : ''}
                                </span>
                                <StatusBadge status={c.status} />
                              </div>
                            </div>
                            <div className="text-xs font-semibold mt-1">
                              {c.assignedBureau}: {c.subject}
                            </div>
                            <div className="text-xs text-muted mt-1">
                              Usage: {lnk.usagePurpose}
                            </div>
                            {outdated && canWrite && (
                              <button
                                type="button"
                                className="btn-link text-xs mt-1"
                                onClick={() => {
                                  subscribeCaseToEvidence(
                                    c.id,
                                    activeArtifact.id,
                                    `Updated to latest verified version ${activeArtifact.currentVersion}`
                                  );
                                  setMsg({
                                    tone: 'success',
                                    text: `Updated ${c.id} link to ${activeArtifact.id} (${activeArtifact.currentVersion}).`,
                                  });
                                }}
                              >
                                Upgrade {c.id} reference to {activeArtifact.currentVersion}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {canWrite && eligibleCasesForSubscribe.length > 0 && (
                      <div className="row-center mt-2" style={{ gap: 6 }}>
                        <select
                          className="field-select"
                          aria-label="Select same-institution case to subscribe"
                          value={linkCaseId}
                          onChange={(e) => setLinkCaseId(e.target.value)}
                        >
                          <option value="">Attach / Upgrade on same-institution case...</option>
                          {eligibleCasesForSubscribe.map((ec) => (
                            <option key={ec.id} value={ec.id}>
                              {ec.id} ({ec.assignedBureau})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={!linkCaseId}
                          onClick={() => {
                            if (!linkCaseId) return;
                            subscribeCaseToEvidence(
                              linkCaseId,
                              activeArtifact.id,
                              'Cross-bureau Shared Evidence Vault subscription'
                            );
                            setMsg({
                              tone: 'success',
                              text: `Linked ${activeArtifact.id} (${activeArtifact.currentVersion}) to ${linkCaseId}.`,
                            });
                            setLinkCaseId('');
                          }}
                        >
                          <Link2 size={13} /> Link
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Version History */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2">
                      Version History &amp; File Checksums ({activeArtifact.versions.length})
                    </h4>
                    <div className="stack-xs">
                      {activeArtifact.versions.map((v) => (
                        <div key={v.version} className="citation-card">
                          <div className="split-row">
                            <span className="mono font-semibold text-xs">
                              Version {v.version} • {v.submittedDate}
                            </span>
                            <span className="badge badge-neutral">{v.fileSizeLabel}</span>
                          </div>
                          <div className="text-xs text-secondary mt-1">{v.changeSummary}</div>
                          <div className="mono text-xs text-muted mt-1" style={{ wordBreak: 'break-all' }}>
                            SHA-256: {v.sha256Hash} ({v.integrityCheck})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload / New Version Drawer */}
      {uploadDrawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setUploadDrawerOpen(false)}
          role="presentation"
        >
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <h3>
                  {uploadMode === 'version' && activeArtifact
                    ? `Append Newer Version to ${activeArtifact.id}`
                    : 'Submit Institutional Artifact to Shared Vault'}
                </h3>
                <p className="text-xs text-muted">
                  Simulated submission workflow recording SHA-256 checksum &amp; audit event
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setUploadDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="drawer-body stack-md">
              {uploadMode === 'new' && (
                <>
                  <div className="field-group">
                    <label className="field-label" htmlFor="ev-inst">
                      Institution ID *
                    </label>
                    <select
                      id="ev-inst"
                      className="field-select"
                      value={formInst}
                      onChange={(e) => setFormInst(e.target.value)}
                    >
                      {state.institutions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.id} — {i.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid-2">
                    <div className="field-group">
                      <label className="field-label" htmlFor="ev-ay">
                        Academic Year
                      </label>
                      <select
                        id="ev-ay"
                        className="field-select"
                        value={formAy}
                        onChange={(e) => setFormAy(e.target.value)}
                      >
                        <option value="AY 2026-27">AY 2026-27</option>
                        <option value="AY 2025-26">AY 2025-26</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="ev-type">
                        Artifact Classification
                      </label>
                      <select
                        id="ev-type"
                        className="field-select"
                        value={formType}
                        onChange={(e) =>
                          setFormType(e.target.value as EvidenceArtifact['artifactType'])
                        }
                      >
                        {ARTIFACT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="ev-title">
                      Artifact Title *
                    </label>
                    <input
                      id="ev-title"
                      type="text"
                      className="field-input"
                      placeholder="e.g., Certified Supplementary Refund UTR Schedule (Oct 2026)"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="ev-sub">
                  Submitted By
                </label>
                <input
                  id="ev-sub"
                  type="text"
                  className="field-input"
                  value={formSubmitter}
                  onChange={(e) => setFormSubmitter(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="ev-sum">
                  {uploadMode === 'version'
                    ? 'Version Change Summary *'
                    : 'Submission Scope & Contents Summary *'}
                </label>
                <textarea
                  id="ev-sum"
                  className="field-textarea"
                  rows={3}
                  placeholder="Describe records included in this version..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                />
              </div>

              <div className="row-center" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setUploadDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Archive size={14} /> Record Artifact in Vault
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
};
