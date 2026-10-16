const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, defaults } = require('../public/registration');
const { sanitizeSiteSettings } = require('../server/site-settings');

test('existing settings receive registration defaults without replacing saved edits or removals', () => {
  assert.deepEqual(sanitizeSiteSettings({}).registration, defaults);
  const registration = { enabled: false, number: '', verificationUrl: '', office: '' };
  assert.deepEqual(sanitizeSiteSettings({ registration }).registration, registration);
  const edited = { ...defaults, number: 'NEW/123', verificationUrl: 'https://example.com/certificate', office: 'New office' };
  assert.deepEqual(sanitizeSiteSettings({ registration: edited }).registration, edited);
  assert.equal(clean({ number: '  NEW/123  ' }).number, 'NEW/123');
});

test('unsafe certificate links are removed by the settings sanitizer', () => {
  for (const verificationUrl of ['javascript:alert(1)', 'data:text/html,bad', '//example.com', 'http://example.com', 'https://user:pass@example.com', 'https://example.com\\evil', 'https://example.com/ bad']) {
    assert.equal(sanitizeSiteSettings({ registration: { verificationUrl } }).registration.verificationUrl, '');
  }
});
