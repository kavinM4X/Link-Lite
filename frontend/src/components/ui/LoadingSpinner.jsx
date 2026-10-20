import React from 'react';

export const LoadingSpinner = ({ size = 'md', className = '', message = null }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-8)',
      }}
      className={className}
    >
      <div className={`spinner spinner-${size}`} role="status" aria-label="Loading" />
      {message && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{message}</span>}
    </div>
  );
};
