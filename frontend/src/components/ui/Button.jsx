import React from 'react';

/**
 * Reusable Button component
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'} [variant='primary']
 * @param {'sm' | 'md' | 'lg'} [size='md']
 * @param {boolean} [isLoading=false]
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  icon: Icon = null,
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="spinner spinner-sm" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : null}
      <span>{children}</span>
    </button>
  );
};
