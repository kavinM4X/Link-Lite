import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import Url from '../src/models/Url.js';
import ClickEvent from '../src/models/ClickEvent.js';

let server;
let baseUrl;

const TEST_SHORT_CODES = [
  'my-product',
  'valid-alias-1',
  'future-test',
  'redir-valid',
  'redir-expired',
  'redir-inactive',
  'redir-repeat',
  'live-demo',
  'list-1',
  'list-2',
  'list-3',
  'search-code-xyz',
  'search-url-abc',
  'status-active-link',
  'status-expired-link',
  'status-inactive-link',
  'get-single-link',
  'update-link-target',
  'delete-link-target',
  'analytics-demo',
  'analytics-fail',
  'analytics-del',
];

before(async () => {
  await connectDB();
  // Clean up any previous test records
  await Url.deleteMany({ shortCode: { $in: TEST_SHORT_CODES } });
  await ClickEvent.deleteMany({ shortCode: { $in: TEST_SHORT_CODES } });

  // Listen on dynamic free port for isolated testing
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  // Clean up test data
  await Url.deleteMany({ shortCode: { $in: TEST_SHORT_CODES } });
  await ClickEvent.deleteMany({ shortCode: { $in: TEST_SHORT_CODES } });
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

// -------------------------------------------------------------
// Health and API routes preservation tests
// -------------------------------------------------------------

test('1. Health endpoint: GET /api/health still works properly', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.services.database.status, 'connected');
});

test('2. Unknown /api/... route still returns JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/non-existent-endpoint`);
  assert.equal(response.status, 404);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /Endpoint not found/i);
});

// -------------------------------------------------------------
// URL Creation tests
// -------------------------------------------------------------

test('3. URL creation: Valid URL without custom alias', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com/products/item-123?ref=test',
    }),
  });

  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data.originalUrl, 'https://example.com/products/item-123?ref=test');
  assert.ok(json.data.shortCode && json.data.shortCode.length >= 4);
  assert.ok(json.data.shortUrl.includes(json.data.shortCode));
  assert.equal(json.data.customAlias, false);
  assert.equal(json.data.clickCount, 0);
  assert.equal(json.data.expiresAt, null);
  assert.equal(json.data.isActive, true);
  assert.ok(json.data.createdAt);
});

test('4. URL creation: Valid URL with custom alias', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com/products',
      customAlias: 'my-product',
      expiresAt: null,
    }),
  });

  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data.shortCode, 'my-product');
  assert.equal(json.data.customAlias, true);
  assert.equal(json.data.originalUrl, 'https://example.com/products');
});

test('5. URL creation: Duplicate custom alias returns HTTP 409', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://another-example.com',
      customAlias: 'my-product',
    }),
  });

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /already (taken|in use)/i);
});

test('6. URL creation: Invalid URL returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'not-a-valid-url',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /invalid or malformed url/i);
});

test('7. URL creation: Unsupported URL protocol (javascript:) returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'javascript:alert("XSS")',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /unsupported protocol/i);
});

test('8. URL creation: Unsupported URL protocol (file:) returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'file:///etc/passwd',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /unsupported protocol/i);
});

test('9. URL creation: Invalid expiry date format returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com',
      expiresAt: 'not-a-real-date-string',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /invalid expiry date/i);
});

test('10. URL creation: Expiry date in the past returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com',
      expiresAt: '2020-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /must be in the future/i);
});

test('11. URL creation: Valid future expiry date returns HTTP 201', async () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com/future-offer',
      customAlias: 'future-test',
      expiresAt: futureDate,
    }),
  });

  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data.shortCode, 'future-test');
  assert.equal(new Date(json.data.expiresAt).toISOString(), futureDate);
});

test('12. URL creation: Malformed request body (array instead of object) returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(['invalid array']),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /must be a valid json object/i);
});

test('13. URL creation: Reserved custom alias (e.g. api) returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com',
      customAlias: 'api',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /reserved system route/i);
});

test('14. URL creation: Invalid custom alias characters returns HTTP 400', async () => {
  const response = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com',
      customAlias: 'invalid alias with spaces!',
    }),
  });

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.success, false);
});

// -------------------------------------------------------------
// Redirect and Click Tracking tests
// -------------------------------------------------------------

test('15. Redirect: Valid short code redirects to exact destination with HTTP 302', async () => {
  const targetUrl = 'https://news.ycombinator.com/best';
  await Url.create({
    originalUrl: targetUrl,
    shortCode: 'redir-valid',
    clickCount: 0,
    isActive: true,
  });

  const response = await fetch(`${baseUrl}/redir-valid`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), targetUrl);
});

test('16. Click tracking: Successful redirect increments clickCount by exactly one', async () => {
  const docBefore = await Url.findOne({ shortCode: 'redir-valid' });
  assert.equal(docBefore.clickCount, 1);

  const response = await fetch(`${baseUrl}/redir-valid`, { redirect: 'manual' });
  assert.equal(response.status, 302);

  const docAfter = await Url.findOne({ shortCode: 'redir-valid' });
  assert.equal(docAfter.clickCount, 2);
});

test('17. Redirect: Unknown short code returns HTTP 404', async () => {
  const response = await fetch(`${baseUrl}/non-existent-code`, { redirect: 'manual' });
  assert.equal(response.status, 404);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /not found/i);
});

test('18. Redirect: Expired link returns HTTP 410 and is NOT counted', async () => {
  const targetUrl = 'https://example.com/expired-item';
  await Url.create({
    originalUrl: targetUrl,
    shortCode: 'redir-expired',
    clickCount: 0,
    isActive: true,
    expiresAt: new Date(Date.now() - 3600000),
  });

  const response = await fetch(`${baseUrl}/redir-expired`, { redirect: 'manual' });
  assert.equal(response.status, 410);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /expired/i);

  const doc = await Url.findOne({ shortCode: 'redir-expired' });
  assert.equal(doc.clickCount, 0);
});

test('19. Redirect: Deactivated link cannot redirect and is NOT counted', async () => {
  const targetUrl = 'https://example.com/inactive-item';
  await Url.create({
    originalUrl: targetUrl,
    shortCode: 'redir-inactive',
    clickCount: 0,
    isActive: false,
  });

  const response = await fetch(`${baseUrl}/redir-inactive`, { redirect: 'manual' });
  assert.equal(response.status, 403);
  const json = await response.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /deactivated/i);

  const doc = await Url.findOne({ shortCode: 'redir-inactive' });
  assert.equal(doc.clickCount, 0);
});

test('20. Click tracking: Repeated requests increment the count correctly', async () => {
  const targetUrl = 'https://example.com/repeat-test';
  await Url.create({
    originalUrl: targetUrl,
    shortCode: 'redir-repeat',
    clickCount: 0,
    isActive: true,
  });

  for (let i = 1; i <= 3; i++) {
    const res = await fetch(`${baseUrl}/redir-repeat`, { redirect: 'manual' });
    assert.equal(res.status, 302);
  }

  const doc = await Url.findOne({ shortCode: 'redir-repeat' });
  assert.equal(doc.clickCount, 3);
});

test('21. Redirect: Invalid short-code formats are handled safely', async () => {
  const resShort = await fetch(`${baseUrl}/abc`, { redirect: 'manual' });
  assert.equal(resShort.status, 400);

  const resInvalid = await fetch(`${baseUrl}/bad!code$`, { redirect: 'manual' });
  assert.equal(resInvalid.status, 400);
});

test('22. Redirect: Database errors handled without leaking internal details', async () => {
  const originalFindOne = Url.findOne;
  Url.findOne = () => {
    throw new Error('Simulated database connection failure');
  };

  try {
    const response = await fetch(`${baseUrl}/redir-valid`, { redirect: 'manual' });
    assert.equal(response.status, 500);
    const json = await response.json();
    assert.equal(json.success, false);
    assert.ok(json.error.message);
  } finally {
    Url.findOne = originalFindOne;
  }
});

// -------------------------------------------------------------
// List, Search, and Pagination tests
// -------------------------------------------------------------

test('23. Listing links and pagination', async () => {
  // Seed test links
  await Url.create([
    { originalUrl: 'https://example.com/item1', shortCode: 'list-1', isActive: true },
    { originalUrl: 'https://example.com/item2', shortCode: 'list-2', isActive: true },
    { originalUrl: 'https://example.com/item3', shortCode: 'list-3', isActive: true },
  ]);

  const res = await fetch(`${baseUrl}/api/urls?page=1&limit=2`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.length, 2);
  assert.equal(json.pagination.page, 1);
  assert.equal(json.pagination.limit, 2);
  assert.ok(json.pagination.totalRecords >= 3);
  assert.ok(json.pagination.totalPages >= 2);
  assert.ok(json.data[0].shortUrl.includes(json.data[0].shortCode));
  assert.equal(json.data[0]._id, undefined); // Ensure _id is not exposed
});

test('24. Searching by short code', async () => {
  await Url.create({
    originalUrl: 'https://example.com/something',
    shortCode: 'search-code-xyz',
    isActive: true,
  });

  const res = await fetch(`${baseUrl}/api/urls?search=code-xyz`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.some((item) => item.shortCode === 'search-code-xyz'));
});

test('25. Searching by original URL', async () => {
  await Url.create({
    originalUrl: 'https://special-domain-unique.com/page',
    shortCode: 'search-url-abc',
    isActive: true,
  });

  const res = await fetch(`${baseUrl}/api/urls?search=special-domain-unique`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.some((item) => item.shortCode === 'search-url-abc'));
});

test('26. Active, expired, and inactive filtering', async () => {
  await Url.create([
    {
      originalUrl: 'https://example.com/active',
      shortCode: 'status-active-link',
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000), // future
    },
    {
      originalUrl: 'https://example.com/expired',
      shortCode: 'status-expired-link',
      isActive: true,
      expiresAt: new Date(Date.now() - 86400000), // past
    },
    {
      originalUrl: 'https://example.com/inactive',
      shortCode: 'status-inactive-link',
      isActive: false, // inactive
    },
  ]);

  // Active filter
  const resActive = await fetch(`${baseUrl}/api/urls?status=active`);
  assert.equal(resActive.status, 200);
  const jsonActive = await resActive.json();
  assert.ok(jsonActive.data.some((i) => i.shortCode === 'status-active-link'));
  assert.ok(!jsonActive.data.some((i) => i.shortCode === 'status-expired-link'));
  assert.ok(!jsonActive.data.some((i) => i.shortCode === 'status-inactive-link'));

  // Expired filter
  const resExpired = await fetch(`${baseUrl}/api/urls?status=expired`);
  assert.equal(resExpired.status, 200);
  const jsonExpired = await resExpired.json();
  assert.ok(jsonExpired.data.some((i) => i.shortCode === 'status-expired-link'));
  assert.ok(!jsonExpired.data.some((i) => i.shortCode === 'status-active-link'));

  // Inactive filter
  const resInactive = await fetch(`${baseUrl}/api/urls?status=inactive`);
  assert.equal(resInactive.status, 200);
  const jsonInactive = await resInactive.json();
  assert.ok(jsonInactive.data.some((i) => i.shortCode === 'status-inactive-link'));
  assert.ok(!jsonInactive.data.some((i) => i.shortCode === 'status-active-link'));
});

test('27. Invalid pagination and filter parameters return HTTP 400', async () => {
  // Invalid page
  const resBadPage = await fetch(`${baseUrl}/api/urls?page=0`);
  assert.equal(resBadPage.status, 400);

  const resStrPage = await fetch(`${baseUrl}/api/urls?page=abc`);
  assert.equal(resStrPage.status, 400);

  // Invalid limit
  const resBadLimit = await fetch(`${baseUrl}/api/urls?limit=0`);
  assert.equal(resBadLimit.status, 400);

  const resOverLimit = await fetch(`${baseUrl}/api/urls?limit=101`);
  assert.equal(resOverLimit.status, 400);

  // Invalid status
  const resBadStatus = await fetch(`${baseUrl}/api/urls?status=unknown_status`);
  assert.equal(resBadStatus.status, 400);
  const jsonBadStatus = await resBadStatus.json();
  assert.match(jsonBadStatus.error.message, /invalid status filter/i);
});

// -------------------------------------------------------------
// Get Single Link tests
// -------------------------------------------------------------

test('28. Getting an existing link: GET /api/urls/:code', async () => {
  await Url.create({
    originalUrl: 'https://example.com/single-view',
    shortCode: 'get-single-link',
    customAlias: true,
    clickCount: 5,
    isActive: true,
  });

  const res = await fetch(`${baseUrl}/api/urls/get-single-link`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.shortCode, 'get-single-link');
  assert.equal(json.data.originalUrl, 'https://example.com/single-view');
  assert.equal(json.data.clickCount, 5);
  assert.ok(json.data.shortUrl.includes('get-single-link'));
  assert.equal(json.data._id, undefined);
});

test('29. Requesting an unknown link returns HTTP 404', async () => {
  const res = await fetch(`${baseUrl}/api/urls/completely-non-existent-code`);
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /not found/i);
});

// -------------------------------------------------------------
// Update Link tests (PATCH)
// -------------------------------------------------------------

test('30. Updating a valid original URL: PATCH /api/urls/:code', async () => {
  await Url.create({
    originalUrl: 'https://example.com/initial-page',
    shortCode: 'update-link-target',
    clickCount: 12,
    customAlias: false,
    isActive: true,
  });

  const res = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://example.com/updated-page',
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.originalUrl, 'https://example.com/updated-page');
  assert.equal(json.data.clickCount, 12); // Click count preserved!
  assert.equal(json.data.shortCode, 'update-link-target'); // Short code preserved!
});

test('31. Updating expiry dates and removing expiry', async () => {
  // Set future expiry
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const resSet = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresAt: futureDate }),
  });
  assert.equal(resSet.status, 200);
  const jsonSet = await resSet.json();
  assert.equal(new Date(jsonSet.data.expiresAt).toISOString(), futureDate);

  // Remove expiry with null
  const resRemove = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresAt: null }),
  });
  assert.equal(resRemove.status, 200);
  const jsonRemove = await resRemove.json();
  assert.equal(jsonRemove.data.expiresAt, null);
});

test('32. Deactivating and reactivating a link', async () => {
  // Deactivate
  const resDeact = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(resDeact.status, 200);
  const jsonDeact = await resDeact.json();
  assert.equal(jsonDeact.data.isActive, false);

  // Reactivate
  const resReact = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true }),
  });
  assert.equal(resReact.status, 200);
  const jsonReact = await resReact.json();
  assert.equal(jsonReact.data.isActive, true);
});

test('33. Rejecting attempts to change protected fields', async () => {
  // Attempt to change clickCount
  const resClicks = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clickCount: 9999 }),
  });
  assert.equal(resClicks.status, 400);
  const jsonClicks = await resClicks.json();
  assert.match(jsonClicks.error.message, /cannot be updated/i);

  // Attempt to change shortCode
  const resCode = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortCode: 'hacked-code' }),
  });
  assert.equal(resCode.status, 400);

  // Attempt to change customAlias
  const resAlias = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customAlias: true }),
  });
  assert.equal(resAlias.status, 400);
});

test('34. Rejecting invalid URLs and invalid request bodies', async () => {
  // Empty body
  const resEmpty = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(resEmpty.status, 400);
  const jsonEmpty = await resEmpty.json();
  assert.match(jsonEmpty.error.message, /cannot be empty/i);

  // Malformed / unsupported URL
  const resBadUrl = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: 'javascript:alert(1)' }),
  });
  assert.equal(resBadUrl.status, 400);

  // Past expiry date
  const resPastExpiry = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresAt: '2021-01-01T00:00:00.000Z' }),
  });
  assert.equal(resPastExpiry.status, 400);
  const jsonPast = await resPastExpiry.json();
  assert.match(jsonPast.error.message, /must be in the future/i);

  // Invalid boolean for isActive
  const resBadActive = await fetch(`${baseUrl}/api/urls/update-link-target`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: 'true' }),
  });
  assert.equal(resBadActive.status, 400);
});

// -------------------------------------------------------------
// Delete Link tests (DELETE)
// -------------------------------------------------------------

test('35. Deleting an existing link: DELETE /api/urls/:code', async () => {
  await Url.create({
    originalUrl: 'https://example.com/to-delete',
    shortCode: 'delete-link-target',
    isActive: true,
  });

  const res = await fetch(`${baseUrl}/api/urls/delete-link-target`, {
    method: 'DELETE',
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.message, /deleted successfully/i);

  // Verify it is gone from database
  const getRes = await fetch(`${baseUrl}/api/urls/delete-link-target`);
  assert.equal(getRes.status, 404);
});

test('36. Returning 404 for deletion of a nonexistent link', async () => {
  const res = await fetch(`${baseUrl}/api/urls/non-existent-link-to-delete`, {
    method: 'DELETE',
  });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /not found/i);
});

// -------------------------------------------------------------
// ClickEvent Model and Analytics tests
// -------------------------------------------------------------

test('37. ClickEvent model validation: requires shortCode and urlId', async () => {
  const invalidEvent = new ClickEvent({});
  let validationError = null;
  try {
    await invalidEvent.validate();
  } catch (err) {
    validationError = err;
  }
  assert.ok(validationError);
  assert.ok(validationError.errors.shortCode);
  assert.ok(validationError.errors.urlId);
});

test('38. Successful redirect records ClickEvent with sanitized referrer, device, and browser', async () => {
  const url = await Url.create({
    originalUrl: 'https://example.com/analytics-target',
    shortCode: 'analytics-demo',
    clickCount: 0,
    isActive: true,
  });

  const customUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
  const res = await fetch(`${baseUrl}/analytics-demo`, {
    redirect: 'manual',
    headers: {
      'User-Agent': customUa,
      'Referer': 'https://www.twitter.com/post/12345?query=sensitive_param',
    },
  });

  assert.equal(res.status, 302);

  // Verify ClickEvent document was persisted
  const event = await ClickEvent.findOne({ shortCode: 'analytics-demo' });
  assert.ok(event);
  assert.equal(event.urlId.toString(), url._id.toString());
  // Referrer hostname only, stripped www and query params
  assert.equal(event.referrer, 'twitter.com');
  assert.equal(event.device, 'mobile');
  assert.equal(event.browser, 'safari');
});

test('39. Event-persistence failure policy: redirect still succeeds if ClickEvent write fails', async () => {
  await Url.create({
    originalUrl: 'https://example.com/resilience-target',
    shortCode: 'analytics-fail',
    clickCount: 0,
    isActive: true,
  });

  // Temporarily mock ClickEvent.create to simulate write failure
  const originalCreate = ClickEvent.create;
  ClickEvent.create = () => {
    throw new Error('Simulated event storage outage');
  };

  try {
    const res = await fetch(`${baseUrl}/analytics-fail`, { redirect: 'manual' });
    // Redirect MUST still succeed with 302!
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://example.com/resilience-target');

    // Click count on the URL MUST still increment atomically
    const doc = await Url.findOne({ shortCode: 'analytics-fail' });
    assert.equal(doc.clickCount, 1);
  } finally {
    ClickEvent.create = originalCreate;
  }
});

test('40. GET /api/analytics/overview: returns system-wide metrics and date boundaries', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.ok(typeof json.data.totalLinks === 'number');
  assert.ok(typeof json.data.activeLinks === 'number');
  assert.ok(typeof json.data.expiredLinks === 'number');
  assert.ok(typeof json.data.totalClicks === 'number');
  assert.ok(typeof json.data.clicksToday === 'number');
  assert.ok(typeof json.data.clicksPrevious7Days === 'number');
  assert.ok(json.data.dateBoundaries.startOfToday);
  assert.ok(json.data.dateBoundaries.startOfPrevious7Days);
  assert.equal(json.data.dateBoundaries.timezone, 'UTC');
});

test('41. GET /api/analytics/clicks?period=7d: returns exactly 7 contiguous zero-filled dates', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/clicks?period=7d`);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.equal(json.period, '7d');
  assert.equal(json.data.length, 7);
  assert.ok(json.startDate);
  assert.ok(json.endDate);
  assert.ok(typeof json.totalClicks === 'number');

  // Verify all elements have valid date format and numeric clicks
  for (const entry of json.data) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(typeof entry.clicks === 'number');
  }
});

test('42. GET /api/analytics/clicks?period=30d and 90d: returns 30 and 90 zero-filled dates', async () => {
  const res30 = await fetch(`${baseUrl}/api/analytics/clicks?period=30d`);
  assert.equal(res30.status, 200);
  const json30 = await res30.json();
  assert.equal(json30.data.length, 30);

  const res90 = await fetch(`${baseUrl}/api/analytics/clicks?period=90d`);
  assert.equal(res90.status, 200);
  const json90 = await res90.json();
  assert.equal(json90.data.length, 90);
});

test('43. GET /api/analytics/clicks?period=invalid returns HTTP 400', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/clicks?period=1year`);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /invalid period/i);
});

test('44. GET /api/analytics/top-links: returns top links ranked by click count', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/top-links`);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.data.length <= 10);

  if (json.data.length > 1) {
    // Verify descending order
    for (let i = 0; i < json.data.length - 1; i++) {
      assert.ok(json.data[i].clickCount >= json.data[i + 1].clickCount);
    }
  }

  if (json.data[0]) {
    assert.ok(json.data[0].shortCode);
    assert.ok(json.data[0].originalUrl);
    assert.ok(json.data[0].shortUrl);
    assert.ok(typeof json.data[0].clickCount === 'number');
  }
});

test('45. GET /api/analytics/urls/:code: returns detailed URL analytics breakdowns', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/urls/analytics-demo`);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.equal(json.data.shortCode, 'analytics-demo');
  assert.ok(json.data.totalClicks >= 1);
  assert.equal(json.data.dailyClicks.length, 7);
  assert.ok(Array.isArray(json.data.referrers));
  assert.ok(Array.isArray(json.data.devices));
  assert.ok(Array.isArray(json.data.browsers));

  // Check referrer breakdown captured twitter.com
  const twitterRef = json.data.referrers.find((r) => r.referrer === 'twitter.com');
  assert.ok(twitterRef && twitterRef.count >= 1);

  // Check device breakdown captured mobile
  const mobileDev = json.data.devices.find((d) => d.device === 'mobile');
  assert.ok(mobileDev && mobileDev.count >= 1);

  // Check browser breakdown captured safari
  const safariBrowser = json.data.browsers.find((b) => b.browser === 'safari');
  assert.ok(safariBrowser && safariBrowser.count >= 1);
});

test('46. GET /api/analytics/urls/:code for unknown code returns HTTP 404', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/urls/completely-unknown-code`);
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /not found/i);
});

test('47. Deleted URLs with historical events: historical analytics are preserved', async () => {
  // 1. Create link
  const url = await Url.create({
    originalUrl: 'https://example.com/to-be-deleted-analytics',
    shortCode: 'analytics-del',
    clickCount: 1,
    isActive: true,
  });

  // 2. Record click events
  await ClickEvent.create({
    shortCode: 'analytics-del',
    urlId: url._id,
    clickedAt: new Date(),
    referrer: 'github.com',
    device: 'desktop',
    browser: 'chrome',
  });

  // 3. Delete URL document
  const delRes = await fetch(`${baseUrl}/api/urls/analytics-del`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);

  // 4. Verify historical ClickEvent was NOT deleted
  const event = await ClickEvent.findOne({ shortCode: 'analytics-del' });
  assert.ok(event);

  // 5. Query analytics for the deleted link
  const analyticsRes = await fetch(`${baseUrl}/api/analytics/urls/analytics-del`);
  assert.equal(analyticsRes.status, 200);
  const json = await analyticsRes.json();

  assert.equal(json.success, true);
  assert.equal(json.data.shortCode, 'analytics-del');
  assert.equal(json.data.isDeleted, true);
  assert.ok(json.data.totalClicks >= 1);
  assert.ok(json.data.referrers.some((r) => r.referrer === 'github.com'));
});

test('48. Security: Rejection of URLs containing CRLF or control characters returns HTTP 400', async () => {
  const res = await fetch(`${baseUrl}/api/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: 'https://example.com/login\r\nSet-Cookie: admin=true' }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
});

test('49. Security: Search query exceeding 100 characters returns HTTP 400', async () => {
  const longSearch = 'a'.repeat(101);
  const res = await fetch(`${baseUrl}/api/urls?search=${longSearch}`);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error.message, /100 characters/i);
});

test('50. Security: GET /:shortCode includes rate-limiting headers', async () => {
  const res = await fetch(`${baseUrl}/analytics-demo`, { redirect: 'manual' });
  const limitHeader = res.headers.get('ratelimit-limit');
  const remainingHeader = res.headers.get('ratelimit-remaining');
  assert.ok(limitHeader, 'Should have RateLimit-Limit header');
  assert.ok(remainingHeader !== null, 'Should have RateLimit-Remaining header');
});

test('51. Security: Disallowed CORS origin does not crash or reflect allowed header', async () => {
  const res = await fetch(`${baseUrl}/api/urls`, {
    headers: { Origin: 'https://malicious-site.com' },
  });
  assert.notEqual(res.status, 500);
  const allowOrigin = res.headers.get('access-control-allow-origin');
  assert.notEqual(allowOrigin, 'https://malicious-site.com');
});

test('52. Deployment: Direct GET /health alias returns healthy orchestrator status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'healthy');
  assert.equal(json.services.server.status, 'up');
  assert.equal(json.services.database.status, 'connected');
});



