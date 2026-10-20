import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ErrorAlert = ({ title = 'An error occurred', message, className = '' }) => {
  if (!message) return null;
  return (
    <div className={`error-alert ${className}`} role="alert">
      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        <div className="error-alert-title">{title}</div>
        <div className="error-alert-message">{message}</div>
      </div>
    </div>
  );
};
