import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Archive,
  GitFork,
  BookOpenCheck,
  Library,
  FlaskConical,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Menu,
  ChevronRight,
  ChevronDown,
  Sparkles,
  CheckCheck,
  RotateCcw,
  X,
} from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { isOpenCoordinationAlert, isTerminalCaseStatus } from '../../services/caseService';
import { Drawer, Modal } from '../ui/Overlays';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, section: 'ops' },
  { to: '/cases', label: 'Cases & Actions', icon: FolderKanban, section: 'ops' },
  { to: '/institutions', label: 'Institution 360', icon: Building2, section: 'ops' },
  { to: '/coordination', label: 'Coordination Centre', icon: GitFork, section: 'ops' },
  { to: '/alerts', label: 'Alerts', icon: Bell, section: 'ops' },
  { to: '/evidence', label: 'Evidence Vault', icon: Archive, section: 'ops' },
  { to: '/reports', label: 'Reports & Audit', icon: BarChart3, section: 'gov' },
  { to: '/knowledge', label: 'Knowledge Assistant', icon: BookOpenCheck, section: 'gov' },
  { to: '/knowledge/sources', label: 'Policy Sources', icon: Library, section: 'gov' },
  { to: '/evaluation', label: 'Evaluation', icon: FlaskConical, section: 'gov' },
  { to: '/admin', label: 'Administration', icon: Settings, section: 'gov' },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    currentUser,
    toasts,
    dismissToast,
    switchUser,
    resetDemoData,
    updateSettings,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const activeCaseCount = useMemo(
    () => state.cases.filter((c) => !isTerminalCaseStatus(c.status)).length,
    [state.cases]
  );

  const openAlertCount = useMemo(
    () => state.alerts.filter((a) => isOpenCoordinationAlert(a)).length,
    [state.alerts]
  );

  const unreadNotifCount = useMemo(
    () => state.notifications.filter((n) => !n.read).length,
    [state.notifications]
  );

  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [{ label: 'Operational Dashboard' }];
    }
    const labelMap: Record<string, string> = {
      cases: 'Cases & Actions',
      institutions: 'Institution 360',
      evidence: 'Shared Evidence Vault',
      alerts: 'Alerts & Notifications',
      coordination: 'Coordination Centre',
      knowledge: 'Knowledge Assistant',
      assistant: 'Knowledge Assistant',
      sources: 'Knowledge Sources',
      evaluation: 'Reliability & Evaluation',
      reports: 'Reports & Audit',
      admin: 'Administration',
    };
    const first = segments[0];
    const items: Array<{ label: string; to?: string }> = [
      { label: 'Home', to: '/' },
      {
        label: labelMap[first] ?? first,
        to: segments.length > 1 ? `/${first}` : undefined,
      },
    ];
    if (segments[1]) {
      items.push({ label: decodeURIComponent(segments[1]) });
    }
    return items;
  }, [location.pathname]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        cases: state.cases.slice(0, 3),
        institutions: state.institutions.slice(0, 2),
        alerts: state.alerts.slice(0, 2),
        documents: state.documents.slice(0, 2),
      };
    }
    return {
      cases: state.cases
        .filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.subject.toLowerCase().includes(q) ||
            c.institutionId.toLowerCase().includes(q)
        )
        .slice(0, 4),
      institutions: state.institutions
        .filter(
          (i) =>
            i.id.toLowerCase().includes(q) ||
            i.name.toLowerCase().includes(q) ||
            i.city.toLowerCase().includes(q)
        )
        .slice(0, 4),
      alerts: state.alerts
        .filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.title.toLowerCase().includes(q) ||
            a.ruleCode.toLowerCase().includes(q)
        )
        .slice(0, 3),
      documents: state.documents
        .filter(
          (d) =>
            d.id.toLowerCase().includes(q) ||
            d.title.toLowerCase().includes(q) ||
            d.summary.toLowerCase().includes(q)
        )
        .slice(0, 3),
    };
  }, [searchQuery, state.cases, state.institutions, state.alerts, state.documents]);

  const initials = currentUser.name
    .split(/\s+/)
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div
          className="mobile-nav-scrim"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`app-sidebar${collapsed ? ' collapsed' : ''}${
          mobileOpen ? ' mobile-open' : ''
        }`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <div className="brand-mark">360</div>
          {!collapsed && (
            <div className="brand-copy">
              <span className="brand-title">CASELINK 360</span>
              <span className="brand-subtitle">Cross-Bureau Coordination</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">Operations</div>}
          {NAV_ITEMS.filter((i) => i.section === 'ops').map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link-item${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.to === '/cases' && (
                  <span className="nav-badge">{activeCaseCount}</span>
                )}
                {!collapsed && item.to === '/evidence' && (
                  <span className="nav-badge">{state.evidenceVault.length}</span>
                )}
                {!collapsed && item.to === '/coordination' && openAlertCount > 0 && (
                  <span className="nav-badge alert">{openAlertCount}</span>
                )}
                {collapsed && item.to === '/coordination' && openAlertCount > 0 && (
                  <span className="nav-collapsed-dot" aria-hidden="true" />
                )}
                {!collapsed && item.to === '/alerts' && unreadNotifCount > 0 && (
                  <span className="nav-badge alert">{unreadNotifCount}</span>
                )}
                {collapsed && item.to === '/alerts' && unreadNotifCount > 0 && (
                  <span className="nav-collapsed-dot" aria-hidden="true" />
                )}
              </NavLink>
            );
          })}

          {!collapsed && (
            <div className="sidebar-section-label" style={{ marginTop: 8 }}>
              Governance
            </div>
          )}
          {collapsed && <div className="sidebar-collapsed-divider" aria-hidden="true" />}
          {NAV_ITEMS.filter((i) => i.section === 'gov').map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/knowledge'}
                className={({ isActive }) => `nav-link-item${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={resetDemoData}
            title="Restore this workspace to its baseline records"
            aria-label="Reset workspace data"
          >
            <RotateCcw size={15} />
            {!collapsed && <span>Reset Workspace Data</span>}
          </button>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>

            <nav aria-label="Breadcrumb" className="breadcrumbs">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {idx > 0 && <ChevronRight size={14} />}
                  {crumb.to ? (
                    <Link to={crumb.to}>{crumb.label}</Link>
                  ) : (
                    <span className="breadcrumb-current">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="global-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Global search across cases, institutions, alerts, and sources"
            >
              <Search size={15} />
              <span className="search-placeholder-text">Search ID, institution, rule...</span>
              <span className="kbd-hint">/</span>
            </button>

            <span
              className="env-pill"
              title="Operational working date for this workspace — not connected to live AICTE systems"
            >
              As of · {state.demoDate}
            </span>

            <button
              type="button"
              className={`ai-status-btn${state.settings.aiAssistanceEnabled ? ' enabled' : ' disabled'}`}
              aria-pressed={state.settings.aiAssistanceEnabled}
              onClick={() =>
                updateSettings(
                  { aiAssistanceEnabled: !state.settings.aiAssistanceEnabled },
                  `Optional AI/RAG layer ${
                    state.settings.aiAssistanceEnabled ? 'disabled' : 'enabled'
                  } by ${currentUser.name}.`
                )
              }
              title="Toggle optional RAG layer — case intake, SLA deadlines, Pre-Dispatch Clearance, Shared Vault, and glossary rules remain active when Off"
            >
              <Sparkles size={14} />
              <span>
                Optional AI: {state.settings.aiAssistanceEnabled ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setNotifOpen(true)}
              aria-label={`Notifications (${unreadNotifCount} unread)`}
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && <span className="notif-dot">{unreadNotifCount}</span>}
            </button>

            <div className="user-menu-wrapper" ref={userMenuRef}>
              <button
                type="button"
                className="user-trigger-btn"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="user-avatar">{initials}</span>
                <span className="user-meta">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-role">{currentUser.role}</span>
                </span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <div className="dropdown-panel" role="menu">
                  <div
                    style={{
                      padding: '6px 8px 8px',
                      borderBottom: '1px solid var(--border-subtle)',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{currentUser.designation}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-secondary)' }}>
                      {currentUser.bureau} · Switch Desk Profile
                    </div>
                  </div>
                  <div className="stack-sm">
                    {state.users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          switchUser(u.id);
                          setUserMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          width: '100%',
                          padding: '6px 8px',
                          border:
                            u.id === currentUser.id
                              ? '1px solid var(--accent-border)'
                              : '1px solid transparent',
                          borderRadius: 'var(--radius-sm)',
                          background:
                            u.id === currentUser.id ? 'var(--accent-soft)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {u.name} {u.id === currentUser.id ? '(Active)' : ''}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-secondary)' }}>
                          {u.role} · {u.bureau}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Link
                      to="/admin"
                      className="btn btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Open Administration Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-container">{children}</main>
      </div>

      {/* Global Search Modal */}
      <Modal
        open={searchOpen}
        title="Global Registry, Case & Vault Search"
        onClose={() => setSearchOpen(false)}
      >
        <div className="stack-md">
          <div className="field-group">
            <label htmlFor="global-search-input" className="field-label">
              Search by Case ID, Institution ID, Coordination Rule, or Circular
            </label>
            <input
              id="global-search-input"
              type="search"
              className="input"
              placeholder="e.g. INST-MH-2040, CL-2026-0125, CRD-2026-004, DOC-POL-2025-09..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {searchResults.cases.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>
                Cases ({searchResults.cases.length})
              </div>
              <div className="stack-sm">
                {searchResults.cases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => {
                      setSearchOpen(false);
                      navigate(`/cases/${c.id}`);
                    }}
                  >
                    <span>
                      <strong className="mono">{c.id}</strong> — {c.subject}
                    </span>
                    <span className="badge badge-neutral">{c.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.institutions.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>
                Institutions ({searchResults.institutions.length})
              </div>
              <div className="stack-sm">
                {searchResults.institutions.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="btn"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => {
                      setSearchOpen(false);
                      navigate(`/institutions/${i.id}`);
                    }}
                  >
                    <span>
                      <strong className="mono">{i.id}</strong> — {i.name} ({i.city})
                    </span>
                    <span className="badge badge-neutral">{i.region}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.alerts.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>
                Coordination Alerts ({searchResults.alerts.length})
              </div>
              <div className="stack-sm">
                {searchResults.alerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => {
                      setSearchOpen(false);
                      navigate(`/coordination?alert=${a.id}`);
                    }}
                  >
                    <span>
                      <strong className="mono">{a.id}</strong> — {a.title}
                    </span>
                    <span className="badge badge-warning">{a.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.documents.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>
                Knowledge Sources ({searchResults.documents.length})
              </div>
              <div className="stack-sm">
                {searchResults.documents.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="btn"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => {
                      setSearchOpen(false);
                      navigate(`/knowledge/sources?doc=${d.id}`);
                    }}
                  >
                    <span>
                      <strong className="mono">{d.id}</strong> — {d.title}
                    </span>
                    <span className="badge badge-neutral">{d.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Notification Centre Drawer */}
      <Drawer
        open={notifOpen}
        title="Notification Centre"
        subtitle={`${unreadNotifCount} unread operational alerts`}
        onClose={() => setNotifOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={markAllNotificationsRead}
              disabled={unreadNotifCount === 0}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNotifOpen(false)}>
              Done
            </button>
          </>
        }
      >
        <div className="stack-sm">
          {state.notifications.map((n) => (
            <div
              key={n.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: n.read
                  ? '1px solid var(--border-subtle)'
                  : '1px solid var(--accent-border)',
                background: n.read ? 'var(--bg-surface)' : 'var(--accent-soft)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{n.title}</strong>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-secondary)' }}>
                  {n.timestamp}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-secondary)' }}>{n.body}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    markNotificationRead(n.id);
                    setNotifOpen(false);
                    navigate(n.linkTo);
                  }}
                >
                  Open record
                </button>
                {!n.read && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => markNotificationRead(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setNotifOpen(false);
              navigate('/alerts');
            }}
          >
            Open Full Alerts &amp; Notification Centre
          </button>
        </div>
      </Drawer>

      {/* Toast Feedback Viewport */}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item${t.tone === 'error' ? ' error' : ''}`}>
            <span>{t.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
