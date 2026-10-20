import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { API_BASE_URL, PUBLIC_SHORT_URL_BASE, checkApiHealth } from '../services/api';
import {
  Server,
  Activity,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Sliders,
  ShieldCheck,
  Info,
  Clock,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

const PREFERENCES_STORAGE_KEY = 'linklite_user_preferences_v1';

const DEFAULT_PREFERENCES = {
  defaultExpiryPreset: 'never',
  confirmBeforeDelete: true,
  autoCopyCreatedLink: true,
};

export const SettingsPage = () => {
  // 1. Health state
  const [health, setHealth] = useState({
    status: 'checking', // 'checking' | 'connected' | 'unavailable'
    data: null,
    latencyMs: null,
    error: null,
  });

  // 2. Client preferences state
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore JSON parse errors
    }
    return DEFAULT_PREFERENCES;
  });

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsFeedback, setPrefsFeedback] = useState(null);

  /**
   * Performs real health check against GET /api/health
   */
  const executeHealthCheck = useCallback(async (signal) => {
    setHealth((prev) => ({ ...prev, status: 'checking', error: null }));
    const startTime = performance.now();

    try {
      const result = await checkApiHealth({ signal });
      const latencyMs = Math.round(performance.now() - startTime);

      setHealth({
        status: result.status === 'healthy' ? 'connected' : 'degraded',
        data: result,
        latencyMs,
        error: null,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        const latencyMs = Math.round(performance.now() - startTime);
        setHealth({
          status: 'unavailable',
          data: null,
          latencyMs,
          error: err.message || 'Unable to connect to LinkLite API server.',
        });
      }
    }
  }, []);

  // Run health check on mount
  useEffect(() => {
    const controller = new AbortController();
    executeHealthCheck(controller.signal);

    return () => {
      controller.abort();
    };
  }, [executeHealthCheck]);

  // Save client preferences
  const handleSavePreferences = () => {
    setIsSavingPrefs(true);
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      setPrefsFeedback('Preferences saved to local browser.');
      setTimeout(() => setPrefsFeedback(null), 3000);
    } catch {
      setPrefsFeedback('Failed to save to localStorage.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Reset client preferences
  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
      setPrefsFeedback('Reset to default preferences.');
      setTimeout(() => setPrefsFeedback(null), 3000);
    } catch {
      // Ignore
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Configuration</h1>
          <p className="page-description">
            Inspect real-time backend health, review network routing configuration, and manage browser preferences.
          </p>
        </div>

        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => executeHealthCheck()}
            isLoading={health.status === 'checking'}
            icon={RefreshCw}
            aria-label="Re-test API health status"
          >
            Check Health
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Section 1: Application & Health Status */}
        <Card>
          <CardHeader
            title="Application & Runtime"
            description="Active instance details and real-time backend connectivity"
          />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* App Identity */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Application</span>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
                    LinkLite URL Shortener
                  </div>
                </div>
                <Badge variant="active">v1.0.0</Badge>
              </div>

              {/* Frontend Origin */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Frontend Origin</span>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                    {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                  </div>
                </div>
                <Globe size={16} color="var(--text-muted)" />
              </div>

              {/* Backend Health Status Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Backend Connection</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {health.status === 'checking' && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="spinner spinner-sm" /> Checking...
                      </span>
                    )}

                    {health.status === 'connected' && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Connected ({health.latencyMs}ms)
                      </span>
                    )}

                    {health.status === 'degraded' && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Degraded ({health.latencyMs}ms)
                      </span>
                    )}

                    {health.status === 'unavailable' && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Unavailable
                      </span>
                    )}
                  </div>
                </div>

                <Badge
                  variant={
                    health.status === 'connected'
                      ? 'active'
                      : health.status === 'degraded'
                      ? 'expired'
                      : 'inactive'
                  }
                >
                  {health.status.toUpperCase()}
                </Badge>
              </div>

              {/* Health Details / Error Box */}
              {health.status === 'unavailable' ? (
                <div className="error-alert">
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="error-alert-title">Health check failed</div>
                    <div className="error-alert-message">{health.error}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => executeHealthCheck()}>
                    Retry
                  </Button>
                </div>
              ) : health.data ? (
                <div
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    fontSize: 'var(--text-xs)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Database: </span>
                    <strong style={{ color: health.data.services?.database?.status === 'connected' ? 'var(--success)' : 'var(--danger)' }}>
                      {health.data.services?.database?.status || 'unknown'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Uptime: </span>
                    <span>{health.data.uptimeSeconds ? `${health.data.uptimeSeconds}s` : '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Environment: </span>
                    <span>{health.data.environment || 'development'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Server: </span>
                    <span>{health.data.services?.server?.status || 'up'}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Browser Link Defaults (Client Preferences) */}
        <Card>
          <CardHeader
            title="Link Defaults"
            description="Client-side defaults applied during link creation in this browser"
            action={
              prefsFeedback && (
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--success)' }}>
                  ✓ {prefsFeedback}
                </span>
              )
            }
          />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Default Expiry Preset */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', display: 'block' }}>
                    Default Expiry Preset
                  </strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Initial expiration period selected when opening Create Link
                  </span>
                </div>
                <select
                  className="input-control"
                  style={{ width: '140px', padding: '6px 10px', fontSize: 'var(--text-xs)' }}
                  value={preferences.defaultExpiryPreset}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, defaultExpiryPreset: e.target.value }))
                  }
                  aria-label="Default link expiry preset"
                >
                  <option value="never">Never expires</option>
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>

              {/* Confirm Before Deletion Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', display: 'block' }}>
                    Confirm Link Deletion
                  </strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Show safety confirmation dialog before deleting short links
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.confirmBeforeDelete}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, confirmBeforeDelete: e.target.checked }))
                  }
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Auto-Copy Created Link Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', display: 'block' }}>
                    Auto-Copy Generated Link
                  </strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Automatically copy the generated short URL to clipboard upon creation
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.autoCopyCreatedLink}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, autoCopyCreatedLink: e.target.checked }))
                  }
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.5,
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  Preferences are stored in your local browser storage (<code>localStorage</code>) and apply only to this browser session. They are not stored in MongoDB and not shared across separate devices.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={handleResetPreferences} icon={RotateCcw}>
                  Reset Defaults
                </Button>
                <Button variant="primary" size="sm" onClick={handleSavePreferences} isLoading={isSavingPrefs}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Configuration Guidance (Environment Routing) */}
      <Card>
        <CardHeader
          title="Configuration & Environment Architecture"
          description="Understanding LinkLite network routing and production variables"
        />
        <CardContent>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-5)',
            }}
          >
            {/* VITE_API_BASE_URL */}
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)' }}>
                <Server size={18} color="var(--primary)" />
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  VITE_API_BASE_URL
                </strong>
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
                The backend REST API base endpoint. The frontend uses this to make internal JSON requests for link creation, deletion, pagination, and telemetry analytics.
              </p>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Current Target:
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--primary)',
                    backgroundColor: 'var(--bg-surface)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    marginTop: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {API_BASE_URL}
                </div>
              </div>
            </div>

            {/* VITE_PUBLIC_SHORT_URL_BASE */}
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)' }}>
                <Globe size={18} color="var(--success)" />
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  VITE_PUBLIC_SHORT_URL_BASE
                </strong>
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
                The public redirect root domain (e.g. <code>https://link.li</code>). Kept distinct from the API URL so public short links never inadvertently expose internal API paths to visitors.
              </p>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Active Base Domain:
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--bg-surface)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    marginTop: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {PUBLIC_SHORT_URL_BASE || 'Derived from backend baseUrl (http://localhost:5000)'}
                </div>
              </div>
            </div>
          </div>

          {/* Security & Production Guidance Notice */}
          <div
            style={{
              marginTop: 'var(--space-5)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
                Production Security Standard
              </strong>
              Client-side build variables prefixed with <code>VITE_</code> are embedded directly into the public bundle. Never place server secrets (e.g. <code>MONGODB_URI</code>, encryption keys, or admin tokens) into frontend <code>.env</code> files. Server credentials are kept strictly isolated in <code>backend/.env</code> and never exposed to the client.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
