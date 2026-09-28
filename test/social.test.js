const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, safeUrl } = require('../public/social-links');
const { sanitizeSiteSettings } = require('../server/site-settings');

test('existing sites start with no social accounts', () => {
  assert.deepEqual(sanitizeSiteSettings({}).social, []);
  assert.deepEqual(clean(null), []);
});
test('visibility is explicit and requires a valid secure link', () => {
  const accounts = clean([
    { platform: 'instagram', url: 'https://instagram.com/earthsar', enabled: true },
    { platform: 'facebook', url: 'https://facebook.com/earthsar', enabled: false },
    { platform: 'linkedin', url: '', enabled: true },
    { platform: 'x', url: 'https://x.com/earthsar', enabled: 'true' }
  ]);
  assert.deepEqual(accounts.map(x => x.enabled), [true, false, false, false]);
  assert.equal(accounts[1].url, 'https://facebook.com/earthsar');
  assert.deepEqual(sanitizeSiteSettings({ social: accounts }).social, accounts);
});
test('unsafe URLs and unrecognized logo names cannot reach the footer', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', '//example.com', 'http://example.com', 'https://user:pass@example.com', 'https://example.com\\evil', 'https://example.com/ bad']) {
    assert.equal(safeUrl(url), '');
    assert.equal(clean([{ platform: 'x', url, enabled: true }])[0].enabled, false);
  }
  assert.deepEqual(clean([null, { platform: '../fake', url: 'https://example.com', enabled: true }]), []);
  assert.equal(clean(Array.from({ length: 20 }, () => ({ platform: 'x' }))).length, 12);
});
