const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.DATABASE_URL = '';
process.env.DATABASE_USER = '';
process.env.DATABASE_NAME = '';
process.env.NODE_ENV = 'test';
const { check } = require('../server/uploads');
const media = require('../server/media');
const { app } = require('../server/index');
const { pool } = require('../server/db');
let temp, server, base;
test.before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'earthsar-security-'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
  await fs.rm(temp, { recursive: true, force: true });
});
async function fixture(name, content, mimetype) {
  const filePath = path.join(temp, crypto.randomUUID());
  await fs.writeFile(filePath, content);
  return { path: filePath, originalname: name, mimetype, size: Buffer.byteLength(content) };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');

test('rejects text, HTML, SVG, and PHP falsely advertised as images', async () => {
  for (const body of ['not an image', '<html><script>alert(1)</script></html>', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', '<?php echo 1; ?>']) {
    const f = await fixture('photo.jpg', body, 'image/jpeg');
    await assert.rejects(check(f, { kind: 'image', label: 'Photo', maxMb: 5 }), /must be/);
    assert.equal(f.verifiedMime, undefined);
  }
});
test('derives the saved extension from bytes, never the filename or claimed type', async () => {
  const f = await fixture('disguised.php', png, 'text/html');
  assert.equal(await check(f, { kind: 'image', label: 'Photo', maxMb: 5 }), 'image');
  assert.equal(f.verifiedMime, 'image/png');
  const item = await media.uploadFile(f, 'image', 'reviews');
  try { assert.match(item.url, /\.png$/); } finally { await media.destroy([item]); }
});
test('rejects unvalidated storage calls and wrong media kind', async () => {
  const f = await fixture('photo.jpg', png, 'image/png');
  await assert.rejects(media.uploadFile(f, 'image', 'reviews'), /validation/);
  await assert.rejects(check(f, { kind: 'video', label: 'Video' }), /must be/);
  await assert.rejects(check(f, { kind: 'image', label: 'Photo', maxMb: 0.000001 }), /larger than/);
});
test('multipart review upload rejects disguised active content before database access', async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Security Test', email: 'audit@example.com', rating: '5', message: 'Validation check only.' })) form.append(key, value);
  form.append('photos', new Blob(['<html>not a photograph</html>'], { type: 'image/jpeg' }), 'disguised.php');
  const response = await fetch(base + '/api/reviews', { method: 'POST', body: form });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Photo 1 must be/);
});
test('dangerous upload paths and initialization endpoint are unavailable', async () => {
  for (const url of ['/api/admin/init', '/uploads/reviews/test.php', '/uploads/reviews/test.html', '/uploads/reviews/test.svg']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
  for (const method of ['POST', 'DELETE']) assert.equal((await fetch(base + '/api/admin/init', { method })).status, 404);
});
test('protected routes reject missing and invalid sessions', async () => {
  for (const route of ['me', 'reviews', 'enquiries', 'settings']) {
    assert.equal((await fetch(base + '/api/admin/' + route)).status, 401);
    assert.equal((await fetch(base + '/api/admin/' + route, { headers: { Cookie: 'es_admin=invalid' } })).status, 401);
  }
});
test('static HTML receives restrictive script policy and standard headers', async () => {
  const response = await fetch(base + '/reviews.html');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
});
test('production rejects missing, short, and known default signing secrets', () => {
  for (const secret of ['', 'short', 'earthsar-production-jwt-secret-min-32-chars-long', 'fallback_secret_must_be_changed_in_prod']) {
    const result = spawnSync(process.execPath, ['-e', 'require("./server/config")'], { cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET/);
  }
});
