import React from 'react';

/**
 * Reusable Input component with optional label, hint, error, and icon
 */
export const Input = ({
  label,
  id,
  hint,
  error,
  icon: Icon = null,
  className = '',
  required = false,
  ...props
}) => {
  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={id} className="input-label">
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      <div className="input-wrapper">
        <input
          id={id}
          className={`input-control ${error ? 'error' : ''}`}
          required={required}
          {...props}
        />
      </div>
      {hint && !error && <span className="input-hint">{hint}</span>}
      {error && <span className="input-error">{error}</span>}
    </div>
  );
};
