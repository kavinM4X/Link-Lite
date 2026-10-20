import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable accessible modal dialog component.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {() => void} props.onClose - Dismiss callback
 * @param {string} props.title - Modal heading
 * @param {string} [props.description] - Optional subtext
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} [props.maxWidth='520px'] - Dialog width constraint
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = '520px',
}) => {
  const modalRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-dialog"
        ref={modalRef}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="modal-title" className="modal-title">
              {title}
            </h3>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};
