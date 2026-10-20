import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  listUrls,
  createUrl,
  updateUrl,
  deleteUrl,
  getLinkShortUrl,
} from '../services/api';
import {
  Plus,
  Search,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  MousePointerClick,
  Info,
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
 * Format ISO date string into readable date and time.
 */
const formatDateTime = (dateString) => {
  if (!dateString) return 'Never';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Converts a Date object or ISO string to local datetime-local input string format.
 */
const toDateTimeLocalValue = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  } catch {
    return '';
  }
};

/**
 * Computes status badge component for a link.
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

export const LinksPage = () => {
  // Query parameters state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Listing data state
  const [links, setLinks] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global toast / copy feedback state
  const [feedback, setFeedback] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editLink, setEditLink] = useState(null);
  const [deleteLinkTarget, setDeleteLinkTarget] = useState(null);

  // Form states - Create Modal
  const [createForm, setCreateForm] = useState({
    originalUrl: '',
    customAlias: '',
    expiryPreset: 'never',
    customExpiry: '',
  });
  const [createErrors, setCreateErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);

  // Form states - Edit Modal
  const [editForm, setEditForm] = useState({
    originalUrl: '',
    hasExpiry: false,
    expiryDate: '',
    isActive: true,
  });
  const [editErrors, setEditErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Form states - Delete Modal
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page when search changes
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Show transient feedback helper
  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  /**
   * Fetch links from backend with current filters and pagination.
   */
  const fetchLinks = useCallback(
    async (signal) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listUrls(
          {
            page,
            limit,
            search: debouncedSearch,
            status: statusFilter === 'all' ? '' : statusFilter,
            sort: sortField,
          },
          { signal }
        );

        setLinks(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to fetch links from backend server.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, debouncedSearch, statusFilter, sortField]
  );

  // Mount & dependencies effect
  useEffect(() => {
    const controller = new AbortController();
    fetchLinks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchLinks]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const controller = new AbortController();
    await fetchLinks(controller.signal);
    setIsRefreshing(false);
    showFeedback('Links refreshed.');
  };

  // Reset filters handler
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setSortField('createdAt');
    setPage(1);
  };

  // Copy short URL to clipboard
  const handleCopy = async (shortUrl, shortCode) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shortUrl);
      } else {
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
      showFeedback(`Copied: ${shortUrl}`);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      showFeedback('Failed to copy. Please copy manually.', 'error');
    }
  };

  // =========================================================================
  // CREATE LINK MODAL LOGIC
  // =========================================================================

  const handleOpenCreate = () => {
    let defaultPreset = 'never';
    try {
      const stored = localStorage.getItem('linklite_user_preferences_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.defaultExpiryPreset) {
          defaultPreset = parsed.defaultExpiryPreset;
        }
      }
    } catch {
      // Ignore
    }

    setCreateForm({
      originalUrl: '',
      customAlias: '',
      expiryPreset: defaultPreset,
      customExpiry: '',
    });
    setCreateErrors({});
    setCreatedResult(null);
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setCreatedResult(null);
  };

  const validateCreateForm = () => {
    const errors = {};
    const url = createForm.originalUrl.trim();

    if (!url) {
      errors.originalUrl = 'Destination URL is required.';
    } else {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.originalUrl = 'URL must begin with http:// or https://.';
        }
      } catch {
        errors.originalUrl = 'Please enter a valid, well-formed URL.';
      }
    }

    if (createForm.customAlias.trim()) {
      const alias = createForm.customAlias.trim();
      if (alias.length < 4 || alias.length > 32) {
        errors.customAlias = 'Custom alias must be between 4 and 32 characters.';
      } else if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
        errors.customAlias = 'Only letters, numbers, hyphens, and underscores are allowed.';
      }
    }

    if (createForm.expiryPreset === 'custom') {
      if (!createForm.customExpiry) {
        errors.customExpiry = 'Please select a custom expiry date and time.';
      } else {
        const expTime = new Date(createForm.customExpiry).getTime();
        if (isNaN(expTime) || expTime <= Date.now()) {
          errors.customExpiry = 'Expiry date must be in the future.';
        }
      }
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    setIsCreating(true);
    setCreateErrors({});

    try {
      let expiresAt = null;
      if (createForm.expiryPreset === '1') {
        expiresAt = new Date(Date.now() + 1 * 86400000).toISOString();
      } else if (createForm.expiryPreset === '7') {
        expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      } else if (createForm.expiryPreset === '30') {
        expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      } else if (createForm.expiryPreset === '90') {
        expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
      } else if (createForm.expiryPreset === 'custom' && createForm.customExpiry) {
        expiresAt = new Date(createForm.customExpiry).toISOString();
      }

      const newUrl = await createUrl({
        originalUrl: createForm.originalUrl.trim(),
        customAlias: createForm.customAlias.trim() || undefined,
        expiresAt: expiresAt || null,
      });

      setCreatedResult(newUrl);
      showFeedback(`Short link ${newUrl.shortCode} created successfully!`);

      try {
        const stored = localStorage.getItem('linklite_user_preferences_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.autoCopyCreatedLink) {
            handleCopy(getLinkShortUrl(newUrl), newUrl.shortCode);
          }
        }
      } catch {
        // Ignore
      }

      // Refresh list in background
      fetchLinks();
    } catch (err) {
      setCreateErrors({ form: err.message || 'Failed to create short link.' });
    } finally {
      setIsCreating(false);
    }
  };

  // =========================================================================
  // EDIT LINK MODAL LOGIC
  // =========================================================================

  const handleOpenEdit = (link) => {
    setEditLink(link);
    setEditForm({
      originalUrl: link.originalUrl,
      hasExpiry: Boolean(link.expiresAt),
      expiryDate: link.expiresAt ? toDateTimeLocalValue(link.expiresAt) : '',
      isActive: Boolean(link.isActive),
    });
    setEditErrors({});
  };

  const handleCloseEdit = () => {
    if (isUpdating) return;
    setEditLink(null);
  };

  const validateEditForm = () => {
    const errors = {};
    const url = editForm.originalUrl.trim();

    if (!url) {
      errors.originalUrl = 'Destination URL cannot be empty.';
    } else {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.originalUrl = 'URL must begin with http:// or https://.';
        }
      } catch {
        errors.originalUrl = 'Please enter a valid, well-formed URL.';
      }
    }

    if (editForm.hasExpiry) {
      if (!editForm.expiryDate) {
        errors.expiryDate = 'Please select an expiry date and time.';
      } else {
        const expTime = new Date(editForm.expiryDate).getTime();
        if (isNaN(expTime) || expTime <= Date.now()) {
          errors.expiryDate = 'Expiry date must be in the future.';
        }
      }
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editLink || !validateEditForm()) return;

    setIsUpdating(true);
    setEditErrors({});

    try {
      const updates = {
        originalUrl: editForm.originalUrl.trim(),
        isActive: Boolean(editForm.isActive),
        expiresAt: editForm.hasExpiry && editForm.expiryDate
          ? new Date(editForm.expiryDate).toISOString()
          : null,
      };

      const updated = await updateUrl(editLink.shortCode, updates);

      // Update in local state immediately
      setLinks((prev) =>
        prev.map((item) => (item.shortCode === updated.shortCode ? updated : item))
      );

      showFeedback(`Short link ${updated.shortCode} updated successfully.`);
      handleCloseEdit();
    } catch (err) {
      setEditErrors({ form: err.message || 'Failed to update short link.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // =========================================================================
  // DELETE LINK MODAL LOGIC
  // =========================================================================

  const handleOpenDelete = (link) => {
    setDeleteLinkTarget(link);
    setDeleteError(null);
  };

  const handleCloseDelete = () => {
    if (isDeleting) return;
    setDeleteLinkTarget(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteLinkTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteUrl(deleteLinkTarget.shortCode);

      // Remove from local list
      setLinks((prev) =>
        prev.filter((item) => item.shortCode !== deleteLinkTarget.shortCode)
      );
      setPagination((prev) => ({
        ...prev,
        totalRecords: Math.max(0, prev.totalRecords - 1),
      }));

      showFeedback(`Short link ${deleteLinkTarget.shortCode} deleted.`);
      handleCloseDelete();

      // Refetch if page is now empty
      if (links.length <= 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchLinks();
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete short link.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Links</h1>
          <p className="page-description">
            Search, filter, inspect, and manage all shortened URLs in your workspace.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {feedback && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: feedback.type === 'error' ? 'var(--danger)' : 'var(--success)',
                backgroundColor:
                  feedback.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${
                  feedback.type === 'error'
                    ? 'var(--danger-border)'
                    : 'var(--success-border)'
                }`,
              }}
            >
              {feedback.type === 'error' ? '⚠ ' : '✓ '} {feedback.message}
            </span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={RefreshCw}
            aria-label="Refresh links list"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={handleOpenCreate}
            id="create-link-btn"
          >
            Create Link
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardContent style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                id="search-links-input"
                placeholder="Search short code or destination URL..."
                icon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                id="status-filter-select"
                className="input-control"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by link status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Sort Order */}
            <div style={{ minWidth: '150px' }}>
              <select
                id="sort-filter-select"
                className="input-control"
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value);
                  setPage(1);
                }}
                aria-label="Sort links by"
              >
                <option value="createdAt">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="clicks">Most clicked</option>
              </select>
            </div>

            {/* Reset Action */}
            <Button
              variant="secondary"
              size="md"
              onClick={handleResetFilters}
              disabled={
                !search &&
                statusFilter === 'all' &&
                sortField === 'createdAt' &&
                page === 1
              }
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card>
        <CardHeader
          title="All Links"
          description={
            isLoading
              ? 'Fetching records...'
              : `${pagination.totalRecords} link${
                  pagination.totalRecords === 1 ? '' : 's'
                } registered in database`
          }
        />
        <CardContent style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: 'var(--space-10)' }}>
              <LoadingSpinner message="Loading links from database..." />
            </div>
          ) : error ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <div className="error-alert">
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div className="error-alert-title">Unable to load links</div>
                  <div className="error-alert-message">{error}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => fetchLinks()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : links.length === 0 ? (
            <EmptyState
              icon={Link2}
              title={
                debouncedSearch || statusFilter !== 'all'
                  ? 'No matching links found'
                  : 'No short links yet'
              }
              description={
                debouncedSearch || statusFilter !== 'all'
                  ? 'Try adjusting your search criteria or resetting the active status filter.'
                  : 'Start by shortening your first destination URL to track clicks and share compact links.'
              }
              action={
                debouncedSearch || statusFilter !== 'all' ? (
                  <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={handleOpenCreate}
                  >
                    Create Your First Link
                  </Button>
                )
              }
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
                    <th>Expires</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((item) => {
                    const resolvedShortUrl = getLinkShortUrl(item);
                    const isCopied = copiedCode === item.shortCode;

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
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--primary)',
                                  backgroundColor: 'var(--primary-soft)',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                  width: 'fit-content',
                                  marginTop: '2px',
                                  fontWeight: 600,
                                }}
                              >
                                custom alias
                              </span>
                            )}
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

                        {/* Click Count */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MousePointerClick size={14} color="var(--text-muted)" />
                            <strong
                              style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-main)',
                              }}
                            >
                              {item.clickCount?.toLocaleString() ?? 0}
                            </strong>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>{renderStatusBadge(item)}</td>

                        {/* Creation Date */}
                        <td
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDate(item.createdAt)}
                        </td>

                        {/* Expiry Date */}
                        <td
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: item.expiresAt ? 'var(--text-secondary)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.expiresAt ? formatDateTime(item.expiresAt) : 'Never'}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                            }}
                          >
                            {/* Copy Action */}
                            <Button
                              variant={isCopied ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleCopy(resolvedShortUrl, item.shortCode)}
                              icon={isCopied ? Check : Copy}
                              title="Copy short link"
                              aria-label={`Copy short URL for ${item.shortCode}`}
                            >
                              {isCopied ? 'Copied' : 'Copy'}
                            </Button>

                            {/* Edit / Details Action */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEdit(item)}
                              icon={Edit2}
                              title="Edit link details"
                              aria-label={`Edit ${item.shortCode}`}
                            />

                            {/* Delete Action */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDelete(item)}
                              icon={Trash2}
                              style={{ color: 'var(--danger)' }}
                              title="Delete short link"
                              aria-label={`Delete ${item.shortCode}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && !error && links.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing{' '}
                <strong>
                  {Math.min(
                    (pagination.page - 1) * pagination.limit + 1,
                    pagination.totalRecords
                  )}
                </strong>
                –
                <strong>
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.totalRecords
                  )}
                </strong>{' '}
                of <strong>{pagination.totalRecords}</strong> links
              </div>

              <div className="pagination-controls">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  icon={ChevronLeft}
                  aria-label="Previous page"
                >
                  Previous
                </Button>

                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    padding: '0 var(--space-2)',
                  }}
                >
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  icon={ChevronRight}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* MODAL: CREATE SHORT LINK */}
      {/* ================================================================= */}
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreate}
        title="Create Short Link"
        description="Transform a long URL into an optimized, trackable short link."
        maxWidth="540px"
      >
        {createdResult ? (
          <div>
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--success)',
                  fontWeight: 700,
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <Check size={16} /> Link Created Successfully
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <a
                  href={getLinkShortUrl(createdResult)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {getLinkShortUrl(createdResult)}
                </a>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleCopy(
                      getLinkShortUrl(createdResult),
                      createdResult.shortCode
                    )
                  }
                  icon={copiedCode === createdResult.shortCode ? Check : Copy}
                >
                  {copiedCode === createdResult.shortCode ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  marginTop: 'var(--space-2)',
                  overflowWrap: 'anywhere',
                }}
              >
                Target: {createdResult.originalUrl}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setCreatedResult(null);
                  setCreateForm({
                    originalUrl: '',
                    customAlias: '',
                    expiryPreset: 'never',
                    customExpiry: '',
                  });
                }}
              >
                Create Another Link
              </Button>
              <Button variant="primary" size="md" onClick={handleCloseCreate}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit}>
            {createErrors.form && (
              <div
                className="error-alert"
                style={{ marginBottom: 'var(--space-4)' }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <div className="error-alert-message">{createErrors.form}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Destination URL */}
              <div className="input-group">
                <label className="input-label" htmlFor="create-original-url">
                  Destination URL <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="create-original-url"
                  className={`input-control ${createErrors.originalUrl ? 'error' : ''}`}
                  placeholder="https://example.com/very/long/destination/url"
                  value={createForm.originalUrl}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      originalUrl: e.target.value,
                    }))
                  }
                  disabled={isCreating}
                  required
                />
                {createErrors.originalUrl ? (
                  <span className="input-error-msg" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {createErrors.originalUrl}
                  </span>
                ) : (
                  <span className="input-hint">The target destination where visitors will be redirected.</span>
                )}
              </div>

              {/* Custom Alias */}
              <div className="input-group">
                <label className="input-label" htmlFor="create-custom-alias">
                  Custom Alias <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  id="create-custom-alias"
                  className={`input-control ${createErrors.customAlias ? 'error' : ''}`}
                  placeholder="e.g. spring-sale-2026"
                  value={createForm.customAlias}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      customAlias: e.target.value,
                    }))
                  }
                  disabled={isCreating}
                  maxLength={32}
                />
                {createErrors.customAlias ? (
                  <span className="input-error-msg" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {createErrors.customAlias}
                  </span>
                ) : (
                  <span className="input-hint">4–32 letters, numbers, hyphens (-), and underscores (_).</span>
                )}
              </div>

              {/* Expiry Selector */}
              <div className="input-group">
                <label className="input-label" htmlFor="create-expiry-preset">
                  Link Expiration
                </label>
                <select
                  id="create-expiry-preset"
                  className="input-control"
                  value={createForm.expiryPreset}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      expiryPreset: e.target.value,
                    }))
                  }
                  disabled={isCreating}
                >
                  <option value="never">Never expires</option>
                  <option value="1">Expires in 1 day</option>
                  <option value="7">Expires in 7 days</option>
                  <option value="30">Expires in 30 days</option>
                  <option value="90">Expires in 90 days</option>
                  <option value="custom">Custom expiration date</option>
                </select>
              </div>

              {/* Custom Expiry Input */}
              {createForm.expiryPreset === 'custom' && (
                <div className="input-group">
                  <label className="input-label" htmlFor="create-custom-expiry">
                    Select Expiry Date & Time
                  </label>
                  <input
                    id="create-custom-expiry"
                    type="datetime-local"
                    className={`input-control ${createErrors.customExpiry ? 'error' : ''}`}
                    value={createForm.customExpiry}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        customExpiry: e.target.value,
                      }))
                    }
                    disabled={isCreating}
                  />
                  {createErrors.customExpiry && (
                    <span className="input-error-msg" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {createErrors.customExpiry}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                size="md"
                onClick={handleCloseCreate}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isCreating}
              >
                Generate Short Link
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: EDIT / DETAILS SHORT LINK */}
      {/* ================================================================= */}
      <Modal
        isOpen={Boolean(editLink)}
        onClose={handleCloseEdit}
        title="Edit Link Details"
        description="Update destination URL, expiration, or activate/deactivate this short link."
        maxWidth="540px"
      >
        {editLink && (
          <form onSubmit={handleEditSubmit}>
            {editErrors.form && (
              <div
                className="error-alert"
                style={{ marginBottom: 'var(--space-4)' }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <div className="error-alert-message">{editErrors.form}</div>
              </div>
            )}

            {/* Read-Only Link Info Box */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                marginBottom: 'var(--space-4)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Short Code: </span>
                <strong style={{ color: 'var(--primary)' }}>{editLink.shortCode}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Clicks: </span>
                <strong>{editLink.clickCount?.toLocaleString() ?? 0}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Created: </span>
                <span>{formatDate(editLink.createdAt)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Alias Type: </span>
                <span>{editLink.customAlias ? 'Custom Alias' : 'Generated'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Destination URL */}
              <div className="input-group">
                <label className="input-label" htmlFor="edit-original-url">
                  Destination URL <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="edit-original-url"
                  className={`input-control ${editErrors.originalUrl ? 'error' : ''}`}
                  value={editForm.originalUrl}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      originalUrl: e.target.value,
                    }))
                  }
                  disabled={isUpdating}
                  required
                />
                {editErrors.originalUrl && (
                  <span className="input-error-msg" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {editErrors.originalUrl}
                  </span>
                )}
              </div>

              {/* Active / Inactive Status Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', display: 'block' }}>
                    Active Status
                  </strong>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {editForm.isActive
                      ? 'Link is active and accepting visitor redirects'
                      : 'Link is paused; visitors will receive an unavailable message'}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    disabled={isUpdating}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                </label>
              </div>

              {/* Expiration Settings */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.hasExpiry}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        hasExpiry: e.target.checked,
                        expiryDate:
                          e.target.checked && !prev.expiryDate
                            ? toDateTimeLocalValue(new Date(Date.now() + 7 * 86400000))
                            : prev.expiryDate,
                      }))
                    }
                    disabled={isUpdating}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-main)' }}>
                    Set Link Expiration
                  </span>
                </label>

                {editForm.hasExpiry && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <input
                      type="datetime-local"
                      className={`input-control ${editErrors.expiryDate ? 'error' : ''}`}
                      value={editForm.expiryDate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          expiryDate: e.target.value,
                        }))
                      }
                      disabled={isUpdating}
                    />
                    {editErrors.expiryDate && (
                      <span className="input-error-msg" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                        {editErrors.expiryDate}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                size="md"
                onClick={handleCloseEdit}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isUpdating}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ================================================================= */}
      <Modal
        isOpen={Boolean(deleteLinkTarget)}
        onClose={handleCloseDelete}
        title="Delete Short Link"
        maxWidth="480px"
      >
        {deleteLinkTarget && (
          <div>
            {deleteError && (
              <div
                className="error-alert"
                style={{ marginBottom: 'var(--space-4)' }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <div className="error-alert-message">{deleteError}</div>
              </div>
            )}

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-4)' }}>
              Are you sure you want to delete short link{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {deleteLinkTarget.shortCode}
              </strong>
              ?
            </p>

            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Destination:</div>
              <div
                style={{
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {deleteLinkTarget.originalUrl}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: 'var(--text-xs)',
                lineHeight: 1.5,
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Important Notice:</strong> Deletion removes this link from active URL management, and visitors attempting to open it will receive a 404 response. Historical click analytics recorded for this link will remain preserved in event logs.
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                size="md"
                onClick={handleCloseDelete}
                disabled={isDeleting}
              >
                Keep Link
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Delete Link
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
