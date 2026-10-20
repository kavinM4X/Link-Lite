import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Home, Compass } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--primary-soft)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Compass size={36} />
      </div>

      <span
        style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 800,
          color: 'var(--primary)',
          letterSpacing: '-0.03em',
        }}
      >
        404
      </span>

      <h1
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginTop: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Page Not Found
      </h1>

      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          maxWidth: '420px',
          lineHeight: 1.5,
          marginBottom: 'var(--space-6)',
        }}
      >
        The page you are looking for does not exist or has been moved to another route.
      </p>

      <Link to="/">
        <Button variant="primary" icon={Home}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
};
