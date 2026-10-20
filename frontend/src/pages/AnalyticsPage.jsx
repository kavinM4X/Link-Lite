import React, { useState, useEffect, useCallback, useId } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import {
  getOverviewAnalytics,
  getClicksTimeseries,
  getTopLinks,
  getUrlAnalytics,
  getLinkShortUrl,
} from '../services/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  MousePointerClick,
  Link2,
  CheckCircle2,
  Clock,
  Calendar,
  RefreshCw,
  ExternalLink,
  BarChart3,
  Globe,
  Smartphone,
  Compass,
  AlertTriangle,
  ArrowRight,
  X,
  Search,
} from 'lucide-react';

/**
 * Format ISO date string into readable short date (e.g. "Oct 20, 2026").
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
 * Format YYYY-MM-DD string into localized chart axis tick (e.g. "Oct 20").
 */
const formatTickDate = (dateString) => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return dateString;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateString;
  }
};

// Vibrant, accessible palette for categorical pie/donut charts
const PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

/**
 * Custom dark glassmorphic tooltip for Recharts.
 */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const clicks = payload[0].value;
    return (
      <div className="chart-tooltip-box">
        <div className="chart-tooltip-date">{formatTickDate(label) || label}</div>
        <div className="chart-tooltip-value">
          {Number(clicks).toLocaleString()} {clicks === 1 ? 'click' : 'clicks'}
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsPage = () => {
  const gradientId = useId();

  // 1. Overview state
  const [overview, setOverview] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  // 2. Click time-series state
  const [period, setPeriod] = useState('7d');
  const [timeseries, setTimeseries] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  // 3. Top links state
  const [topLinks, setTopLinks] = useState({
    data: [],
    isLoading: true,
    error: null,
  });

  // 4. Detailed URL analytics state
  const [selectedCode, setSelectedCode] = useState(null);
  const [inspectInput, setInspectInput] = useState('');
  const [urlAnalytics, setUrlAnalytics] = useState({
    data: null,
    isLoading: false,
    error: null,
  });

  // Refresh indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Fetch overview statistics (GET /api/analytics/overview)
   */
  const loadOverview = useCallback(async (signal) => {
    setOverview((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getOverviewAnalytics({ signal });
      setOverview({ data, isLoading: false, error: null });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setOverview({ data: null, isLoading: false, error: err.message });
      }
    }
  }, []);

  /**
   * Fetch click activity time-series (GET /api/analytics/clicks?period=...)
   */
  const loadTimeseries = useCallback(async (targetPeriod, signal) => {
    setTimeseries((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await getClicksTimeseries(targetPeriod, { signal });
      setTimeseries({ data: result, isLoading: false, error: null });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setTimeseries({ data: null, isLoading: false, error: err.message });
      }
    }
  }, []);

  /**
   * Fetch top ranked links (GET /api/analytics/top-links)
   */
  const loadTopLinks = useCallback(async (signal) => {
    setTopLinks((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getTopLinks({ signal });
      setTopLinks({ data, isLoading: false, error: null });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setTopLinks({ data: [], isLoading: false, error: err.message });
      }
    }
  }, []);

  /**
   * Fetch detailed breakdown for a specific short link (GET /api/analytics/urls/:code)
   */
  const loadUrlAnalytics = useCallback(async (code, signal) => {
    if (!code) return;
    setUrlAnalytics({ data: null, isLoading: true, error: null });
    try {
      const data = await getUrlAnalytics(code, { signal });
      setUrlAnalytics({ data, isLoading: false, error: null });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setUrlAnalytics({ data: null, isLoading: false, error: err.message });
      }
    }
  }, []);

  // Initial load effect
  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);
    loadTimeseries(period, controller.signal);
    loadTopLinks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOverview, loadTimeseries, loadTopLinks, period]);

  // Effect for inspecting a specific link
  useEffect(() => {
    if (!selectedCode) return;
    const controller = new AbortController();
    loadUrlAnalytics(selectedCode, controller.signal);

    return () => {
      controller.abort();
    };
  }, [selectedCode, loadUrlAnalytics]);

  // Manual refresh all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const controller = new AbortController();
    await Promise.all([
      loadOverview(controller.signal),
      loadTimeseries(period, controller.signal),
      loadTopLinks(controller.signal),
      selectedCode ? loadUrlAnalytics(selectedCode, controller.signal) : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  };

  // Inspect manual code submit
  const handleInspectSubmit = (e) => {
    e.preventDefault();
    const trimmed = inspectInput.trim();
    if (trimmed) {
      setSelectedCode(trimmed);
    }
  };

  return (
    <div>
      {/* Page Header with Time-Series Period Selector and Refresh */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Link Analytics</h1>
          <p className="page-description">
            Live telemetry, contiguous time-series trends, top links, and visitor demographics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={RefreshCw}
            aria-label="Refresh analytics data"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Error Alert */}
      {overview.error && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div className="error-alert">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div className="error-alert-title">Failed to load platform metrics</div>
              <div className="error-alert-message">{overview.error}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => loadOverview()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* 1. Real Summary Cards (Connected to GET /api/analytics/overview) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Total Clicks */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Total Clicks</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                <MousePointerClick size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {overview.data?.totalClicks?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                All-time tracked redirects
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Clicks Today */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Clicks Today</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
                <TrendingUp size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--success)' }}>
                  {overview.data?.clicksToday?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Since UTC midnight
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Previous 7-Day Period Clicks */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Previous 7 Days</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <Calendar size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {overview.data?.clicksPrevious7Days?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Prior 7-day UTC window
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Total Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                <Link2 size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {overview.data?.totalLinks?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Registered short links
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Active Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {overview.data?.activeLinks?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Ready to accept visitors
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Expired Links */}
        <Card>
          <CardContent style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Expired Links</span>
              <div style={{ padding: '6px', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              {overview.isLoading ? (
                <span className="skeleton" style={{ width: '50px', height: '30px' }} />
              ) : overview.error ? (
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Error</span>
              ) : (
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {overview.data?.expiredLinks?.toLocaleString() ?? 0}
                </span>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Past scheduled expiration
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Click Activity Chart (Connected to GET /api/analytics/clicks?period=...) */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader
          title={
            <div className="chart-card-header">
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Click Activity Trend
                </h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {timeseries.data
                    ? `${timeseries.data.totalClicks?.toLocaleString() ?? 0} total clicks recorded from ${formatDate(timeseries.data.startDate)} to ${formatDate(timeseries.data.endDate)}`
                    : 'Loading daily click telemetry...'}
                </span>
              </div>

              {/* Working 7d, 30d, 90d selectors */}
              <div className="period-selector" role="group" aria-label="Select analytics time period">
                <button
                  type="button"
                  className={`period-btn ${period === '7d' ? 'active' : ''}`}
                  onClick={() => setPeriod('7d')}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  className={`period-btn ${period === '30d' ? 'active' : ''}`}
                  onClick={() => setPeriod('30d')}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  className={`period-btn ${period === '90d' ? 'active' : ''}`}
                  onClick={() => setPeriod('90d')}
                >
                  90 Days
                </button>
              </div>
            </div>
          }
        />
        <CardContent>
          {timeseries.isLoading ? (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner message={`Loading ${period} click activity...`} />
            </div>
          ) : timeseries.error ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <div className="error-alert">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="error-alert-title">Unable to load click activity</div>
                  <div className="error-alert-message">{timeseries.error}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => loadTimeseries(period)}>
                  Retry
                </Button>
              </div>
            </div>
          ) : !timeseries.data?.data || timeseries.data.data.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No click telemetry recorded"
              description="When visitors follow your shortened links, daily click metrics will appear here."
            />
          ) : (
            <div style={{ width: '100%', height: '280px', marginTop: 'var(--space-2)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeseries.data.data}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`clickGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatTickDate}
                    stroke="var(--text-subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-light)' }}
                    interval={period === '90d' ? 14 : period === '30d' ? 4 : 0}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--text-subtle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#clickGradient-${gradientId})`}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#4f46e5' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Top Links Section (Connected to GET /api/analytics/top-links) */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader
          title="Top Performing Links"
          description="Most clicked short URLs ranked across your workspace"
          action={
            <form onSubmit={handleInspectSubmit} style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Inspect short code..."
                  value={inspectInput}
                  onChange={(e) => setInspectInput(e.target.value)}
                  className="input-control"
                  style={{ width: '180px', height: '32px', fontSize: 'var(--text-xs)', paddingRight: '28px' }}
                />
              </div>
              <Button variant="secondary" size="sm" type="submit" icon={Search} disabled={!inspectInput.trim()}>
                Inspect
              </Button>
            </form>
          }
        />
        <CardContent style={{ padding: 0 }}>
          {topLinks.isLoading ? (
            <div style={{ padding: 'var(--space-8)' }}>
              <LoadingSpinner message="Loading top links..." />
            </div>
          ) : topLinks.error ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <div className="error-alert">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="error-alert-title">Unable to retrieve top links</div>
                  <div className="error-alert-message">{topLinks.error}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => loadTopLinks()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : topLinks.data.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No link rankings yet"
              description="Links with recorded visitor activity will be ranked here by total click volume."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                    <th>Short Link</th>
                    <th>Destination URL</th>
                    <th>Total Clicks</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topLinks.data.map((item, index) => {
                    const resolvedShortUrl = getLinkShortUrl(item);
                    const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
                    const isSelected = selectedCode === item.shortCode;

                    return (
                      <tr
                        key={item.shortCode}
                        style={isSelected ? { backgroundColor: 'var(--primary-soft)' } : undefined}
                      >
                        {/* Rank Badge */}
                        <td style={{ textAlign: 'center' }}>
                          <span className={`rank-badge ${rankClass}`}>{index + 1}</span>
                        </td>

                        {/* Short Link */}
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                          </div>
                        </td>

                        {/* Destination URL */}
                        <td>
                          <div
                            style={{
                              maxWidth: '280px',
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

                        {/* Total Clicks */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MousePointerClick size={14} color="var(--primary)" />
                            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)' }}>
                              {item.clickCount?.toLocaleString() ?? 0}
                            </strong>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>clicks</span>
                          </div>
                        </td>

                        {/* Created Date */}
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(item.createdAt)}
                        </td>

                        {/* Action: Inspect */}
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant={isSelected ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => {
                              setSelectedCode(item.shortCode);
                              // Smooth scroll to breakdown
                              setTimeout(() => {
                                document.getElementById('detailed-breakdown-section')?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                });
                              }, 100);
                            }}
                            icon={ArrowRight}
                          >
                            {isSelected ? 'Inspecting' : 'Inspect'}
                          </Button>
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

      {/* 4. Detailed Link Analytics (Connected to GET /api/analytics/urls/:code) */}
      {selectedCode && (
        <div id="detailed-breakdown-section" style={{ marginBottom: 'var(--space-8)' }}>
          <Card>
            <CardHeader
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      Link Breakdown: <span style={{ color: 'var(--primary)' }}>{selectedCode}</span>
                    </h3>
                  </div>

                  {urlAnalytics.data?.isDeleted && (
                    <Badge variant="expired">Historical (Link Deleted)</Badge>
                  )}
                </div>
              }
              description={
                urlAnalytics.data?.originalUrl
                  ? `Destination: ${urlAnalytics.data.originalUrl}`
                  : 'Detailed breakdown of referrers, device types, and browser environments.'
              }
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCode(null)}
                  icon={X}
                  aria-label="Close detailed breakdown"
                >
                  Close
                </Button>
              }
            />
            <CardContent>
              {urlAnalytics.isLoading ? (
                <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
                  <LoadingSpinner message={`Loading analytics for ${selectedCode}...`} />
                </div>
              ) : urlAnalytics.error ? (
                <div style={{ padding: 'var(--space-6)' }}>
                  <div className="error-alert">
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="error-alert-title">Unable to load link breakdown</div>
                      <div className="error-alert-message">{urlAnalytics.error}</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => loadUrlAnalytics(selectedCode)}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : !urlAnalytics.data ? null : (
                <div>
                  {/* Summary Bar */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      marginBottom: 'var(--space-6)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Link Target:</span>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px',
                        }}
                        title={urlAnalytics.data.originalUrl || 'Historical link'}
                      >
                        {urlAnalytics.data.originalUrl || 'Link record was deleted (historical events preserved)'}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total Tracked Clicks:</span>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                        {urlAnalytics.data.totalClicks?.toLocaleString() ?? 0}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Top Referrer:</span>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                        {urlAnalytics.data.referrers?.[0]?.referrer || 'Direct / None'}
                      </div>
                    </div>
                  </div>

                  {/* Charts Grid: Daily breakdown + Referrers + Devices + Browsers */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 'var(--space-6)',
                    }}
                  >
                    {/* 1. Daily Clicks Bar Chart */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                        7-Day Click Activity
                      </h4>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                        Daily clicks for this link
                      </p>

                      <div style={{ width: '100%', height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={urlAnalytics.data.dailyClicks}
                            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatTickDate}
                              stroke="var(--text-subtle)"
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis allowDecimals={false} stroke="var(--text-subtle)" fontSize={10} tickLine={false} />
                            <Tooltip content={<CustomChartTooltip />} />
                            <Bar dataKey="clicks" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 2. Device Breakdown (Donut Chart) */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-1)' }}>
                        <Smartphone size={16} color="var(--primary)" />
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0 }}>Device Categories</h4>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                        Visitor hardware distribution
                      </p>

                      {urlAnalytics.data.devices?.length === 0 ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          No device data recorded yet
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={urlAnalytics.data.devices}
                                dataKey="count"
                                nameKey="device"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                              >
                                {urlAnalytics.data.devices.map((entry, idx) => (
                                  <Cell key={`device-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [`${value} clicks`, name]}
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: '#fff',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* 3. Browser Breakdown (Donut Chart) */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-1)' }}>
                        <Compass size={16} color="var(--primary)" />
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0 }}>Browser Categories</h4>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                        Client web browsers
                      </p>

                      {urlAnalytics.data.browsers?.length === 0 ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          No browser telemetry recorded yet
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={urlAnalytics.data.browsers}
                                dataKey="count"
                                nameKey="browser"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                              >
                                {urlAnalytics.data.browsers.map((entry, idx) => (
                                  <Cell key={`browser-${idx}`} fill={PALETTE[(idx + 2) % PALETTE.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [`${value} clicks`, name]}
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: '#fff',
                                  fontSize: '12px',
                                }}
                              />
                              <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* 4. Referrers Breakdown Table */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-1)' }}>
                        <Globe size={16} color="var(--primary)" />
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0 }}>Referrer Hostnames</h4>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                        Origins generating link clicks
                      </p>

                      {urlAnalytics.data.referrers?.length === 0 ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          No referrers recorded yet
                        </div>
                      ) : (
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '6px 8px' }}>Referrer</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Clicks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {urlAnalytics.data.referrers.map((ref, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {ref.referrer || 'Direct / None'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                                    {ref.count.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
