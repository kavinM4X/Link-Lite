import React from 'react';

/**
 * Reusable Badge component
 * @param {'active' | 'inactive' | 'expired' | 'default'} [variant='default']
 */
export const Badge = ({ children, variant = 'default', className = '', ...props }) => {
  return (
    <span className={`badge badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  );
};
