import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getOverviewAnalytics, getRecentUrls, getLinkShortUrl } from '../services/api';
import {
  Link2,
  MousePointerClick,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

/**
 * Safely format ISO date strings into readable locale strings.
 */
const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

/**
 * Resolves the status badge for a link item based on active state and expiry.
 */
const renderStatusBadge = (link) => {
  if (!link.isActive) {
    return <Badge variant="inactive">Inactive</Badge>;
  }
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return <Badge variant="expired">Expired</Badge>;
  }
  return <Badge variant="active">Active</Badge>;
};

export const DashboardPage = () => {
  // State for Overview Metrics
  const [metrics, setMetrics] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  // State for Recent Links
  const [recentLinks, setRecentLinks] = useState({
    data: [],
    pagination: null,
    isLoading: true,
    error: null,
  });

  // UI interaction states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);

  /**
   * Loads both overview statistics and recent links concurrently.
   */
  const loadDashboardData = useCallback(async (signal) => {
    // 1. Fetch Overview Analytics
    setMetrics((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const overviewData = await getOverviewAnalytics({ signal });
      setMetrics({ data: overviewData, isLoading: false, error: null });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMetrics({ data: null, isLoading: false, error: err.message });
      }
    }

    // 2. Fetch Recent URLs (page 1, limit 5, newest first)
    setRecentLinks((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const urlsResponse = await getRecentUrls({ page: 1, limit: 5, sort: 'createdAt' }, { signal });
      setRecentLinks({
        data: urlsResponse.data,
        pagination: urlsResponse.pagination,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setRecentLinks({ data: [], pagination: null, isLoading: false, error: err.message });
      }
    }
  }, []);

  // Component lifecycle - fetch on mount with cleanup
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadDashboardData]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const controller = new AbortController();
    await loadDashboardData(controller.signal);
    setIsRefreshing(false);
  };

  // Copy Short URL to clipboard with fallback
  const handleCopy = async (shortUrl, shortCode) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shortUrl);
      } else {
        // Fallback for non-HTTPS or restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = shortUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      setCopiedCode(shortCode);
      setCopyFeedback(`Copied ${shortUrl}`);
      setTimeout(() => {
        setCopiedCode(null);
        setCopyFeedback(null);
      }, 2500);
    } catch (err) {
      setCopyFeedback('Failed to copy. Please copy manually.');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  return (
    <div>
      {/* Page Header with Real-Time Refresh */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome to LinkLite</h1>
          <p className="page-description">
            Your centralized URL shortening and performance analytics workspace.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {copyFeedback && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--success)',
                backgroundColor: 'var(--success-bg)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--success-border)',
              }}
            >
              ✓ {copyFeedback}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={RefreshCw}
            aria-label="Refresh dashboard data"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Notice if Analytics Metrics fail */}
      {metrics.error && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div className="error-alert">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div className="error-alert-title">Failed to load platform metrics</div>
              <div className="error-alert-message">{metrics.error}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Real Summary Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Metric 1: Total Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Total Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                <Link2 size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {metrics.isLoading ? (
                <span className="skeleton" style={{ width: '60px', height: '32px' }} />
              ) : metrics.error ? (
                <span style={{ fontSize: 'var(--text-lg)', color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {metrics.data.totalLinks.toLocaleString()}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Links in your database
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Clicks */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Total Clicks</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                <MousePointerClick size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {metrics.isLoading ? (
                <span className="skeleton" style={{ width: '60px', height: '32px' }} />
              ) : metrics.error ? (
                <span style={{ fontSize: 'var(--text-lg)', color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {metrics.data.totalClicks.toLocaleString()}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                All-time tracked redirects
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Active Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Active Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {metrics.isLoading ? (
                <span className="skeleton" style={{ width: '60px', height: '32px' }} />
              ) : metrics.error ? (
                <span style={{ fontSize: 'var(--text-lg)', color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {metrics.data.activeLinks.toLocaleString()}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Ready to accept visitors
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Expired Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Expired Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {metrics.isLoading ? (
                <span className="skeleton" style={{ width: '60px', height: '32px' }} />
              ) : metrics.error ? (
                <span style={{ fontSize: 'var(--text-lg)', color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {metrics.data.expiredLinks.toLocaleString()}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Past scheduled expiration
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Quick Shorten UI & Performance Insights Info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Card>
          <CardHeader
            title="Quick Shorten"
            description="Turn a long URL into an optimized short link"
          />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="input-group">
                <label htmlFor="quick-url-disabled" className="input-label">
                  Destination URL
                </label>
                <input
                  id="quick-url-disabled"
                  className="input-control"
                  placeholder="https://example.com/very/long/destination/url"
                  disabled
                />
              </div>
              <Button variant="primary" disabled icon={ArrowRight}>
                Shorten URL
              </Button>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <em>Interactive link creation form will be integrated in subsequent prompt.</em>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Performance Summary"
            description="Real-time telemetry from LinkLite backend"
          />
          <CardContent>
            <div
              style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 'var(--radius-md)' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
                    Clicks Today
                  </h4>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    UTC date boundary (today)
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary)', marginBottom: 'var(--space-2)' }}>
                {metrics.isLoading ? (
                  <span className="skeleton" style={{ width: '40px', height: '28px' }} />
                ) : metrics.error ? (
                  '—'
                ) : (
                  metrics.data?.clicksToday?.toLocaleString() ?? 0
                )}
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)' }}>
                Previous 7-day period clicks:{' '}
                <strong>
                  {metrics.isLoading ? '…' : metrics.data?.clicksPrevious7Days?.toLocaleString() ?? 0}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Recent Links Section */}
      <Card>
        <CardHeader
          title="Recent Links"
          description="Latest shortened URLs stored in MongoDB"
          action={
            <Link to="/links">
              <Button variant="ghost" size="sm" icon={ArrowRight}>
                View All Links
              </Button>
            </Link>
          }
        />
        <CardContent style={{ padding: 0 }}>
          {recentLinks.isLoading ? (
            <div style={{ padding: 'var(--space-8)' }}>
              <LoadingSpinner message="Loading recent links from backend..." />
            </div>
          ) : recentLinks.error ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <div className="error-alert">
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div className="error-alert-title">Unable to retrieve recent links</div>
                  <div className="error-alert-message">{recentLinks.error}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRefresh}>
                  Retry
                </Button>
              </div>
            </div>
          ) : recentLinks.data.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No links in your database yet"
              description="Your database is connected. Once links are created, the most recent 5 records will appear here with live click statistics."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Short Link</th>
                    <th>Destination URL</th>
                    <th>Clicks</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLinks.data.map((item) => {
                    const isCopied = copiedCode === item.shortCode;
                    const resolvedShortUrl = getLinkShortUrl(item);

                    return (
                      <tr key={item.shortCode}>
                        {/* Short Link / Short Code */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <a
                              href={resolvedShortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: 'var(--primary)',
                                fontWeight: 700,
                                fontSize: 'var(--text-sm)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title={`Open ${resolvedShortUrl}`}
                            >
                              <span>{item.shortCode}</span>
                              <ExternalLink size={12} opacity={0.6} />
                            </a>
                            {item.customAlias && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                custom alias
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Destination URL */}
                        <td>
                          <div
                            style={{
                              maxWidth: '260px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                              fontSize: 'var(--text-xs)',
                            }}
                            title={item.originalUrl}
                          >
                            {item.originalUrl}
                          </div>
                        </td>

                        {/* Click Count */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)' }}>
                              {item.clickCount.toLocaleString()}
                            </strong>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              clicks
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>{renderStatusBadge(item)}</td>

                        {/* Creation Date */}
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(item.createdAt)}
                        </td>

                        {/* Actions (Copy Short URL) */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <Button
                              variant={isCopied ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleCopy(resolvedShortUrl, item.shortCode)}
                              icon={isCopied ? Check : Copy}
                              title="Copy short link to clipboard"
                            >
                              {isCopied ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
