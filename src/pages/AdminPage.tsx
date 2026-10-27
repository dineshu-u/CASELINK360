import React, { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAppState } from '../state/AppStateContext';
import { ALL_BUREAUS, CASE_CATEGORIES } from '../data/seedData';
import { BureauName, UserRole } from '../types/domain';
import { isTerminalCaseStatus } from '../services/caseService';

const CATEGORY_DEFAULT_BUREAU: Record<string, BureauName> = {
  'Unapproved Intake / Admission': 'Approval Bureau',
  'Faculty Salary & Statutory Dues': 'Faculty & Pay Redressal Cell',
  'Fee Refund & Admission Cancellation': 'Public Grievance Redressal Cell (PGRC)',
  'Laboratory & Academic Infrastructure': 'Academic Inspection Bureau',
  'Faculty Roster & Attendance': 'Academic Inspection Bureau',
  'Faculty Qualifications & Appointments': 'Regulation Bureau (RB)',
  'Hostel & Student Amenities': 'Student Welfare Cell',
};

export const AdminPage: React.FC = () => {
  const { state, canWrite, updateSettings, addUserRoleProfile, switchUser, currentUser } =
    useAppState();

  const [newName, setNewName] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newBureau, setNewBureau] = useState<BureauName>('Regulation Bureau (RB)');
  const [newRole, setNewRole] = useState<UserRole>('Bureau Case Officer');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Complaint category routing configuration (session-level demonstration state)
  const [categoryConfig, setCategoryConfig] = useState(
    CASE_CATEGORIES.map((cat) => ({
      category: cat,
      defaultBureau: CATEGORY_DEFAULT_BUREAU[cat] ?? ('Regulation Bureau (RB)' as BureauName),
      intakeEnabled: true,
    }))
  );

  const bureauDirectory = useMemo(
    () =>
      ALL_BUREAUS.map((bureau) => {
        const officers = state.users.filter((u) => u.bureau === bureau && u.active);
        const active = state.cases.filter(
          (c) => c.assignedBureau === bureau && !isTerminalCaseStatus(c.status)
        );
        const escalationRule = state.settings.deadlineRules.find(
          (r) => r.escalationBureau === bureau
        );
        return {
          bureau,
          officers,
          activeCount: active.length,
          escalationFor: escalationRule?.priority,
        };
      }),
    [state.users, state.cases, state.settings.deadlineRules]
  );

  const settingsActivity = useMemo(
    () =>
      state.auditLog.filter(
        (e) =>
          e.actionType === 'Settings Modified' ||
          e.actionType === 'Settings Updated' ||
          e.entityId.startsWith('SET')
      ),
    [state.auditLog]
  );

  const handleNotifyToggle = (
    key: 'notifyOnOverdue' | 'notifyOnCrossBureauAlert' | 'notifyOnStatusChange',
    label: string,
    value: boolean
  ) => {
    if (!canWrite) return;
    updateSettings({ [key]: value }, `${value ? 'Enabled' : 'Disabled'} ${label} notifications.`);
    setFeedback(`${value ? 'Enabled' : 'Disabled'} ${label} notifications.`);
  };

  const handleCategoryChange = (
    category: string,
    patch: Partial<{ defaultBureau: BureauName; intakeEnabled: boolean }>
  ) => {
    if (!canWrite) return;
    setCategoryConfig((prev) =>
      prev.map((row) => (row.category === category ? { ...row, ...patch } : row))
    );
    setFeedback(`Updated routing configuration for category "${category}".`);
  };

  const handleDeadlineChange = (
    priority: 'Critical' | 'High' | 'Standard' | 'Low',
    field: 'targetDays' | 'warningThresholdDays',
    val: number
  ) => {
    if (!canWrite) return;
    const updated = state.settings.deadlineRules.map((r) =>
      r.priority === priority ? { ...r, [field]: Math.max(1, val) } : r
    );
    updateSettings(
      { deadlineRules: updated },
      `Updated ${priority} priority ${field} to ${val} days.`
    );
    setFeedback(`Saved SLA rule change for ${priority} priority cases.`);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDesignation.trim()) {
      setFeedback('Officer name and designation are required.');
      return;
    }
    const res = addUserRoleProfile({
      name: newName.trim(),
      designation: newDesignation.trim(),
      bureau: newBureau,
      role: newRole,
      email: `${newName.trim().toLowerCase().replace(/\s+/g, '.')}@caselink.gov.example`,
      active: true,
    });
    if (res.ok) {
      setNewName('');
      setNewDesignation('');
      setFeedback(`Added officer profile "${newName.trim()}" (${newRole}).`);
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1>Administration &amp; Governance Settings</h1>
          <p className="page-subtitle">
            Role-based access profiles, Pre-Dispatch Clearance &amp; Cohort windows, SLA deadlines, and optional AI fallback switches
          </p>
        </div>
      </div>

      {feedback && (
        <div className="alert-banner success">
          <div>{feedback}</div>
        </div>
      )}

      {/* Optional AI, Pre-Dispatch Clearance & Cohort Threshold Controls */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Deterministic Rules Thresholds &amp; Optional AI Controls</h2>
            <p className="text-xs text-muted">
              Changes take immediate effect across Pre-Dispatch Clearance, Cohort Pattern Detection, and Negative Memory
            </p>
          </div>
        </div>
        <div className="panel-body stack-md">
          <div className="grid-2">
            <label className="row-center" style={{ cursor: 'pointer', gap: 10 }}>
              <input
                type="checkbox"
                checked={state.settings.aiAssistanceEnabled}
                onChange={(e) =>
                  updateSettings(
                    { aiAssistanceEnabled: e.target.checked },
                    `Set Optional AI Assistance to ${e.target.checked ? 'Enabled' : 'Disabled'}.`
                  )
                }
              />
              <div>
                <div className="font-semibold text-sm">Enable Optional AI / Hybrid RAG Layer</div>
                <div className="text-xs text-muted">
                  When unchecked, application runs strictly in Degraded Mode (rules + glossary search).
                </div>
              </div>
            </label>

            <label className="row-center" style={{ cursor: 'pointer', gap: 10 }}>
              <input
                type="checkbox"
                checked={state.settings.aiSimulatedFailureMode}
                onChange={(e) =>
                  updateSettings(
                    { aiSimulatedFailureMode: e.target.checked },
                    `Set Simulated AI Service Failure Mode to ${e.target.checked}.`
                  )
                }
              />
              <div>
                <div className="font-semibold text-sm">
                  Simulate External AI Service Timeout (Circuit-Breaker Test)
                </div>
                <div className="text-xs text-muted">
                  Verifies graceful deterministic passage fallback when LLM service fails.
                </div>
              </div>
            </label>
          </div>

          <div className="grid-3">
            <div className="field-group">
              <label className="field-label" htmlFor="cfg-seq">
                Confidential Inspection Sequencing Buffer (Days)
              </label>
              <input
                id="cfg-seq"
                type="number"
                min={1}
                max={30}
                disabled={!canWrite}
                className="field-input mono"
                value={state.settings.clearanceSequencingWindowDays}
                onChange={(e) =>
                  updateSettings(
                    { clearanceSequencingWindowDays: Number(e.target.value) },
                    `Set Pre-Dispatch Sequencing Window to ${e.target.value} days.`
                  )
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-dup">
                Duplicate Evidence Reuse Window (Days)
              </label>
              <input
                id="cfg-dup"
                type="number"
                min={1}
                max={90}
                disabled={!canWrite}
                className="field-input mono"
                value={state.settings.duplicateEvidenceWindowDays}
                onChange={(e) =>
                  updateSettings(
                    { duplicateEvidenceWindowDays: Number(e.target.value) },
                    `Set Duplicate Evidence Window to ${e.target.value} days.`
                  )
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-coh">
                Cohort Alert Minimum Active Cases (60-Day Window)
              </label>
              <input
                id="cfg-coh"
                type="number"
                min={2}
                max={10}
                disabled={!canWrite}
                className="field-input mono"
                value={state.settings.cohortThresholdCount}
                onChange={(e) =>
                  updateSettings(
                    { cohortThresholdCount: Number(e.target.value) },
                    `Set 60-day Cohort Alert threshold to ${e.target.value} cases.`
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* SLA Deadline Rules */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>SLA Priority Deadline Rules</h2>
            <p className="text-xs text-muted">
              Used deterministically across all Case Queues and Institution 360 views
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority Level</th>
                <th>Target Resolution Window (Days)</th>
                <th>Warning Threshold (Days)</th>
                <th>Default Escalation Bureau</th>
                <th>Scope Criteria</th>
              </tr>
            </thead>
            <tbody>
              {state.settings.deadlineRules.map((rule) => (
                <tr key={rule.priority}>
                  <td className="font-semibold">{rule.priority}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      disabled={!canWrite}
                      aria-label={`${rule.priority} target days`}
                      className="field-input mono"
                      style={{ width: 84 }}
                      value={rule.targetDays}
                      onChange={(e) =>
                        handleDeadlineChange(rule.priority, 'targetDays', Number(e.target.value))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={!canWrite}
                      aria-label={`${rule.priority} warning days`}
                      className="field-input mono"
                      style={{ width: 84 }}
                      value={rule.warningThresholdDays}
                      onChange={(e) =>
                        handleDeadlineChange(
                          rule.priority,
                          'warningThresholdDays',
                          Number(e.target.value)
                        )
                      }
                    />
                  </td>
                  <td>{rule.escalationBureau}</td>
                  <td className="text-xs text-secondary">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User & Role Management */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Officer Role &amp; Permission Profiles</h2>
            <p className="text-xs text-muted">
              Switch active profile to test Bureau Redaction, Scoped Access, Senior Clearance Overrides, and Read-Only Auditor restrictions
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer Name</th>
                <th>Designation</th>
                <th>Assigned Bureau</th>
                <th>RBAC Role</th>
                <th>Session Control</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u) => {
                const isActive = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td>{u.designation}</td>
                    <td>{u.bureau}</td>
                    <td>
                      <span className="badge badge-info">{u.role}</span>
                    </td>
                    <td>
                      {isActive ? (
                        <span className="badge badge-success">Active Profile</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => switchUser(u.id)}
                        >
                          Switch to Profile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canWrite && (
          <form
            onSubmit={handleAddUser}
            className="panel-body stack-md"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}
          >
            <h3 style={{ fontSize: '0.9rem' }}>Add Officer Profile</h3>
            <div className="grid-3">
              <div className="field-group">
                <label className="field-label" htmlFor="usr-name">
                  Officer Name
                </label>
                <input
                  id="usr-name"
                  type="text"
                  className="field-input"
                  placeholder="e.g., P. Narayanan"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="usr-desig">
                  Designation
                </label>
                <input
                  id="usr-desig"
                  type="text"
                  className="field-input"
                  placeholder="e.g., Section Officer"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="usr-bureau">
                  Bureau
                </label>
                <select
                  id="usr-bureau"
                  className="field-select"
                  value={newBureau}
                  onChange={(e) => setNewBureau(e.target.value as BureauName)}
                >
                  {ALL_BUREAUS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row-center" style={{ justifyContent: 'space-between' }}>
              <div className="row-center">
                <label className="field-label" htmlFor="usr-role">
                  Role Permission Level:
                </label>
                <select
                  id="usr-role"
                  className="field-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value="Bureau Case Officer">Bureau Case Officer</option>
                  <option value="Cross-Bureau Coordinator">Cross-Bureau Coordinator</option>
                  <option value="Senior Review Authority">Senior Review Authority</option>
                  <option value="Read-Only Auditor">Read-Only Auditor</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <UserPlus size={14} /> Add Role Profile
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bureau & Department Configuration */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Bureau &amp; Department Configuration</h2>
            <p className="text-xs text-muted">
              Operational desks, officer strength, live workload, and escalation routing
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bureau / Cell</th>
                <th>Active Officers</th>
                <th>Active Workload</th>
                <th>Escalation Target For</th>
              </tr>
            </thead>
            <tbody>
              {bureauDirectory.map((row) => (
                <tr key={row.bureau}>
                  <td className="font-semibold">{row.bureau}</td>
                  <td>
                    {row.officers.length > 0 ? (
                      <div className="text-xs">
                        {row.officers.map((o) => (
                          <div key={o.id}>
                            {o.name} <span className="text-muted">({o.designation})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Shared coordination pool</span>
                    )}
                  </td>
                  <td className="mono">{row.activeCount} active cases</td>
                  <td className="text-xs text-secondary">
                    {row.escalationFor
                      ? `${row.escalationFor} priority escalations`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complaint Category Configuration */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Complaint Category Configuration</h2>
            <p className="text-xs text-muted">
              Default intake routing per complaint category — changes apply to this session&apos;s
              intake routing suggestions
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Complaint Category</th>
                <th>Default Routing Bureau</th>
                <th>Intake Status</th>
              </tr>
            </thead>
            <tbody>
              {categoryConfig.map((row) => (
                <tr key={row.category}>
                  <td className="font-semibold">{row.category}</td>
                  <td>
                    <select
                      className="field-select"
                      aria-label={`Default bureau for ${row.category}`}
                      value={row.defaultBureau}
                      disabled={!canWrite}
                      onChange={(e) =>
                        handleCategoryChange(row.category, {
                          defaultBureau: e.target.value as BureauName,
                        })
                      }
                      style={{ height: 32, minWidth: 260 }}
                    >
                      {ALL_BUREAUS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <label className="row-center text-xs" style={{ gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={row.intakeEnabled}
                        disabled={!canWrite}
                        onChange={(e) =>
                          handleCategoryChange(row.category, { intakeEnabled: e.target.checked })
                        }
                      />
                      {row.intakeEnabled ? 'Accepting new intake' : 'Intake paused'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Transition Rules & Notification Preferences */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Status &amp; Priority Transition Rules</h2>
              <p className="text-xs text-muted">
                Permitted lifecycle transitions enforced on every status update
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From Status</th>
                  <th>Allowed Transitions</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {state.settings.transitionRules.map((rule) => (
                  <tr key={rule.from}>
                    <td className="font-semibold">{rule.from}</td>
                    <td className="text-xs text-secondary">{rule.allowedTo.join(', ') || '—'}</td>
                    <td className="text-xs">
                      {rule.requiresNote && <span className="badge badge-neutral">Note required</span>}{' '}
                      {rule.restrictedToSenior && (
                        <span className="badge badge-warning">Senior authority only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Notification Preferences</h2>
              <p className="text-xs text-muted">Controls which events raise entries in the Alerts centre</p>
            </div>
          </div>
          <div className="panel-body stack-sm">
            <label className="row-center" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={state.settings.notifyOnOverdue}
                disabled={!canWrite}
                onChange={(e) => handleNotifyToggle('notifyOnOverdue', 'overdue-case', e.target.checked)}
              />
              <span className="text-sm">Overdue case notifications</span>
            </label>
            <label className="row-center" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={state.settings.notifyOnCrossBureauAlert}
                disabled={!canWrite}
                onChange={(e) =>
                  handleNotifyToggle('notifyOnCrossBureauAlert', 'cross-bureau alert', e.target.checked)
                }
              />
              <span className="text-sm">Cross-bureau relationship alert notifications</span>
            </label>
            <label className="row-center" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={state.settings.notifyOnStatusChange}
                disabled={!canWrite}
                onChange={(e) =>
                  handleNotifyToggle('notifyOnStatusChange', 'status-change', e.target.checked)
                }
              />
              <span className="text-sm">Case status change notifications</span>
            </label>
            <p className="text-xs text-muted">
              Preferences apply to the current coordination desk and are recorded in the system
              activity log below.
            </p>
          </div>
        </div>
      </div>

      {/* System Activity History */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>System Configuration Activity ({settingsActivity.length})</h2>
            <p className="text-xs text-muted">
              Administrative changes to rules, thresholds, and preferences
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Administrator</th>
                <th>Change Summary</th>
              </tr>
            </thead>
            <tbody>
              {settingsActivity.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-xs text-muted">
                    No configuration changes recorded this session yet.
                  </td>
                </tr>
              ) : (
                settingsActivity.map((e) => (
                  <tr key={e.id}>
                    <td className="mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                      {e.timestamp}
                    </td>
                    <td>
                      <div className="font-semibold">{e.actorName}</div>
                      <div className="text-xs text-muted">{e.actorBureau}</div>
                    </td>
                    <td className="text-sm">{e.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
