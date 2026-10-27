import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  narrow?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, title, onClose, narrow, footer, children }) => {
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`modal-dialog${narrow ? ' narrow' : ''}`}
      >
        <div className="modal-header">
          <h2 id={headingId} className="panel-title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export const Drawer: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, title, subtitle, onClose, footer, children }) => {
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="drawer-panel"
      >
        <div className="modal-header">
          <div className="panel-title-group">
            <h2 id={headingId} className="panel-title">
              {title}
            </h2>
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel, danger, onConfirm, onCancel }) => {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      narrow
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--ink-primary)' }}>{description}</p>
    </Modal>
  );
};
