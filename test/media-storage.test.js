const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test('uploads survive a storage reload and serve real media with byte ranges and missing-file 404s', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'earthsar-media-storage-'));
  process.env.UPLOAD_DIR = path.join(temp, 'persistent');
  process.env.JWT_SECRET = 'media-test-secret-at-least-32-characters';
  process.env.DATABASE_URL = '';
  process.env.DATABASE_USER = '';
  process.env.DATABASE_NAME = '';
  const mediaPath = require.resolve('../server/media');
  const media = require(mediaPath);
  const legacy = path.join(__dirname, '../public/uploads/settings', path.basename(temp) + '.jpg');
  let server;
  try {
    await fs.mkdir(path.dirname(legacy), { recursive: true });
    await fs.writeFile(legacy, 'legacy-cover');
    const source = path.join(temp, 'video.mp4');
    await fs.writeFile(source, '0123456789');
    const uploaded = await media.uploadFile({ path: source, verifiedMime: 'video/mp4' }, 'video', 'settings');
    assert.equal(await fs.readFile(path.join(media.UPLOAD_DIR, 'settings', path.basename(legacy)), 'utf8'), 'legacy-cover');
    delete require.cache[mediaPath];
    const reloaded = require(mediaPath);
    assert.equal(await fs.readFile(path.join(reloaded.UPLOAD_DIR, uploaded.url.slice('/uploads/'.length)), 'utf8'), '0123456789');
    const db = require('../server/db');
    db.query = async () => { throw new Error('No database needed for media test'); };
    const { app } = require('../server/app');
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + uploaded.url, { headers: { Range: 'bytes=2-5' } });
    assert.equal(response.status, 206);
    assert.match(response.headers.get('content-type'), /^video\/mp4/);
    assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await response.text(), '2345');
    for (const url of ['/uploads/settings/missing.mp4', '/uploads/settings/missing.jpg']) {
      const missing = await fetch(base + url);
      assert.equal(missing.status, 404);
      assert.doesNotMatch(missing.headers.get('content-type'), /text\/html/);
    }
    await reloaded.destroy([uploaded]);
    assert.equal((await fetch(base + uploaded.url)).status, 404);
    await db.pool.end();
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await fs.unlink(legacy).catch(() => {});
    assert.equal(path.dirname(temp), os.tmpdir());
    await fs.rm(temp, { recursive: true, force: true });
  }
});
