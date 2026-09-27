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
const { app } = require('../server/app');
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
test('production disables admin auth for missing, short, and default secrets', () => {
  for (const secret of ['', 'short', 'earthsar-production-jwt-secret-min-32-chars-long', 'fallback_secret_must_be_changed_in_prod']) {
    const result = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify({enabled:require("./server/config").adminAuthConfigured}))'], { cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret }, encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).enabled, false);
    assert.match(result.stderr, /JWT_SECRET/);
  }
});

test('public site starts despite invalid admin configuration and database initialization failure', () => {
  const script = `
    process.env.PORT='0';
    process.env.DATABASE_URL='mysql://test@127.0.0.1:1/test';
    const db=require('./server/db');
    db.migrate=async()=>{throw new Error('simulated database outage')};
    db.query=async()=>{throw new Error('simulated database outage')};
    (async()=>{
      const {start}=require('./server/app');
      const server=await start();
      const base='http://127.0.0.1:'+server.address().port;
      const statuses=[];
      for(const route of ['/','/api/health','/api/admin/me','/api/admin/login']) statuses.push((await fetch(base+route)).status);
      console.log(JSON.stringify(statuses));
      await new Promise(r=>server.close(r));
      await db.pool.end();
    })().catch(e=>{console.error(e);process.exit(1)});
  `;
  const result=spawnSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',JWT_SECRET:''},encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);
  // Database health still reports failure; serving the public page does not.
  assert.deepEqual(JSON.parse(result.stdout),[200,500,503,503]);
});

test('hosting loader require starts listening immediately without a main-module guard', () => {
  const script = `
    process.env.PORT='0';
    process.env.DATABASE_URL='';
    const http=require('node:http');
    let called=false;
    http.Server.prototype.listen=function(){called=true;return this};
    require('./server/index');
    if(!called) throw new Error('Hosting entry did not call listen synchronously');
    console.log('listen called');
  `;
  const result=spawnSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production'},encoding:'utf8',timeout:3000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/listen called/);
});
