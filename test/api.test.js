/* API tests. Run with: TEST_DATABASE_URL=mysql://... npm test
   Uses its own database (it is wiped on each run) and a fake media store, so nothing is uploaded. */
const test = require("node:test");
const assert = require("node:assert/strict");

if (!process.env.TEST_DATABASE_URL) {
  test("API tests", { skip: "Set TEST_DATABASE_URL to a throwaway database to run these tests." }, () => {});
  return;
}
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.ADMIN_EMAIL = "";
process.env.PORT = "0";

/* ---- fake media storage ---- */
const media = require("../server/media");
const uploads = [];
const destroyed = [];
let failUploads = false;
media.isConfigured = () => true;
media.uploadFile = async (file, kind, folder) => {
  if (failUploads && kind === "video") throw Object.assign(new Error("boom"), { http_code: 500 });
  const n = uploads.length + 1;
  const item = {
    type: kind,
    url: `/uploads/${folder}/f${n}.${kind === "video" ? "mp4" : "jpg"}`,
    publicId: `/uploads/${folder}/f${n}.${kind === "video" ? "mp4" : "jpg"}`
  };
  uploads.push(item);
  return item;
};
media.destroy = async items => {
  destroyed.push(...(items || []).filter(i => i && i.publicId).map(i => i.publicId));
};

const { pool, query } = require("../server/db");
const { hashPassword } = require("../server/auth");
const { start } = require("../server/index");

let server, base, cookie = "";
const ADMIN = { "X-Requested-With": "earthsar-admin" };

async function call(method, path, { body, headers = {}, form } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers: h, body: payload });
  const set = res.headers.get("set-cookie");
  if (set && set.startsWith("es_admin=")) cookie = set.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const file = (bytes, type, name) => new Blob([Buffer.alloc(bytes, 1)], { type });
function reviewForm(extra = {}) {
  const fd = new FormData();
  const fields = { name: "Asha Verma", email: "asha@example.com", rating: "5", message: "Very helpful advisors.", ...extra };
  for (const [k, v] of Object.entries(fields)) if (typeof v === "string") fd.append(k, v);
  return fd;
}

test.before(async () => {
  await pool.query("DROP TABLE IF EXISTS admins, reviews, gallery_items, enquiries");
  server = await start();
  base = `http://127.0.0.1:${server.address().port}`;
  await query("INSERT INTO admins (email, name, password_hash) VALUES (?, 'Test', ?)", ["admin@test.local", await hashPassword("correct-horse-battery")]);
});
test.after(async () => {
  await new Promise(r => server.close(r));
  await pool.end();
});

test("a review with photos, a video and a profile photo waits for approval", async () => {
  const fd = reviewForm({ phone: "+91 98100 00000" });
  fd.append("avatar", file(2000, "image/jpeg"), "me.jpg");
  fd.append("photos", file(3000, "image/png"), "a.png");
  fd.append("photos", file(3000, "image/jpeg"), "b.jpg");
  fd.append("video", file(9000, "video/mp4"), "v.mp4");
  const r = await call("POST", "/api/reviews", { form: fd });
  assert.equal(r.status, 201);
  assert.equal(uploads.length, 4);

  const pub = await call("GET", "/api/reviews");
  assert.equal(pub.data.reviews.length, 0, "pending reviews must not be public");
});

test("invalid reviews are rejected with field errors", async () => {
  const r = await call("POST", "/api/reviews", { form: reviewForm({ name: "A", email: "nope", rating: "7", message: "", videoLink: "https://example.com/v" }) });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.fields).sort(), ["email", "message", "name", "rating", "videoLink"]);
});

test("wrong file types and too many photos are refused", async () => {
  const fd = reviewForm();
  fd.append("photos", file(100, "application/pdf"), "x.pdf");
  let r = await call("POST", "/api/reviews", { form: fd });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Photo 1 must be/);

  const fd2 = reviewForm();
  for (let i = 0; i < 5; i++) fd2.append("photos", file(100, "image/jpeg"), `p${i}.jpg`);
  r = await call("POST", "/api/reviews", { form: fd2 });
  assert.equal(r.status, 400);
});

test("photos over the size limit are refused", async () => {
  const fd = reviewForm();
  fd.append("photos", file(9 * 1024 * 1024, "image/jpeg"), "big.jpg");
  const r = await call("POST", "/api/reviews", { form: fd });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /larger than 5 MB/);
});

test("if one upload fails, the files already uploaded are deleted", async () => {
  failUploads = true;
  const before = destroyed.length;
  const fd = reviewForm();
  fd.append("photos", file(100, "image/jpeg"), "ok.jpg");
  fd.append("video", file(100, "video/mp4"), "bad.mp4");
  const r = await call("POST", "/api/reviews", { form: fd });
  failUploads = false;
  assert.equal(r.status, 502);
  assert.equal(destroyed.length, before + 1);
  const { rows } = await query("SELECT COUNT(*) AS n FROM reviews");
  assert.equal(rows[0].n, 1, "no review row for the failed submission");
});

test("the honeypot silently drops bots", async () => {
  const r = await call("POST", "/api/reviews", { form: reviewForm({ website: "http://spam" }) });
  assert.equal(r.status, 201);
  const { rows } = await query("SELECT COUNT(*) AS n FROM reviews");
  assert.equal(rows[0].n, 1);
});

test("admin routes need a session, and changes need the admin header", async () => {
  assert.equal((await call("GET", "/api/admin/reviews")).status, 401);
  assert.equal((await call("POST", "/api/admin/login", { body: { email: "admin@test.local", password: "wrong" } })).status, 401);
  assert.equal((await call("POST", "/api/admin/login", { body: { email: "admin@test.local", password: "correct-horse-battery" } })).status, 200);
  assert.equal((await call("PATCH", "/api/admin/reviews/1", { body: { status: "approved" } })).status, 403);
});

test("approving publishes the review with its media", async () => {
  const list = await call("GET", "/api/admin/reviews?status=pending", { headers: ADMIN });
  const rev = list.data.reviews[0];
  assert.equal(rev.email, "asha@example.com");
  const r = await call("PATCH", `/api/admin/reviews/${rev.id}`, { body: { status: "approved", verified: true }, headers: ADMIN });
  assert.equal(r.status, 200);

  const pub = await call("GET", "/api/reviews");
  assert.equal(pub.data.summary.count, 1);
  const p = pub.data.reviews[0];
  assert.equal(p.verified, true);
  assert.equal(p.email, undefined, "email must never be public");
  assert.equal(p.media.length, 3);
  assert.equal(p.media.find(m => m.type === "video").full, "/uploads/reviews/f4.mp4");
  assert.equal(p.media[0].thumb, p.media[0].url);
});

test("removing one file keeps the review and deletes the file from local storage", async () => {
  const list = await call("GET", "/api/admin/reviews?status=approved", { headers: ADMIN });
  const rev = list.data.reviews[0];
  const target = rev.media[0];
  const r = await call("POST", `/api/admin/reviews/${rev.id}/remove-media`, { body: { url: target.url }, headers: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(r.data.review.media.length, 2);
  assert.ok(destroyed.includes(target.publicId));
});

test("deleting a review deletes all of its files", async () => {
  const list = await call("GET", "/api/admin/reviews?status=approved", { headers: ADMIN });
  const rev = list.data.reviews[0];
  const ids = [rev.avatar.publicId, ...rev.media.map(m => m.publicId)];
  assert.equal((await call("DELETE", `/api/admin/reviews/${rev.id}`, { headers: ADMIN })).status, 200);
  for (const id of ids) assert.ok(destroyed.includes(id), `${id} deleted`);
  assert.equal((await call("GET", "/api/reviews")).data.reviews.length, 0);
});

test("gallery: add by link, upload, hide, reorder, delete", async () => {
  let r = await call("POST", "/api/admin/gallery", { body: { url: "http://insecure.example/x.jpg" }, headers: ADMIN });
  assert.equal(r.status, 400);
  r = await call("POST", "/api/admin/gallery", { body: { url: "https://example.com/tour.mp4", title: "Tour" }, headers: ADMIN });
  assert.equal(r.status, 201);
  assert.equal(r.data.item.type, "video", "type detected from the link");
  const linked = r.data.item;

  const fd = new FormData();
  fd.append("title", "Office");
  fd.append("file", file(500, "image/jpeg"), "office.jpg");
  r = await call("POST", "/api/admin/gallery/upload", { form: fd, headers: ADMIN });
  assert.equal(r.status, 201);
  const uploaded = r.data.item;
  assert.equal(uploaded.uploadedHere, true);

  let pub = await call("GET", "/api/gallery");
  assert.deepEqual(pub.data.items.map(i => i.title), ["Office", "Tour"], "newest first");

  await call("POST", "/api/admin/gallery/reorder", { body: { ids: [linked.id, uploaded.id] }, headers: ADMIN });
  pub = await call("GET", "/api/gallery");
  assert.deepEqual(pub.data.items.map(i => i.title), ["Tour", "Office"]);

  await call("PATCH", `/api/admin/gallery/${linked.id}`, { body: { published: false }, headers: ADMIN });
  pub = await call("GET", "/api/gallery");
  assert.deepEqual(pub.data.items.map(i => i.title), ["Office"], "hidden items are not public");

  const before = destroyed.length;
  await call("DELETE", `/api/admin/gallery/${linked.id}`, { headers: ADMIN });
  assert.equal(destroyed.length, before, "linked files stay where they are hosted");
  await call("DELETE", `/api/admin/gallery/${uploaded.id}`, { headers: ADMIN });
  assert.equal(destroyed.length, before + 1, "uploaded files are deleted from local storage");
});

test("enquiries are saved and can be marked as handled", async () => {
  let r = await call("POST", "/api/enquiries", { body: { name: "Ravi", phone: "98" } });
  assert.equal(r.status, 400);
  r = await call("POST", "/api/enquiries", { body: { name: "Ravi", phone: "+91 98100 12345", consent: true, topic: "An investment" } });
  assert.equal(r.status, 201);
  const list = await call("GET", "/api/admin/enquiries");
  assert.equal(list.data.enquiries.length, 1);
  await call("PATCH", `/api/admin/enquiries/${list.data.enquiries[0].id}`, { body: { handled: true }, headers: ADMIN });
  const stats = await call("GET", "/api/admin/stats");
  assert.equal(stats.data.enquiries_new, 0);
});

test("changing the password signs out other sessions", async () => {
  const old = cookie;
  let r = await call("POST", "/api/admin/password", { body: { current: "wrong", next: "another-long-password" }, headers: ADMIN });
  assert.equal(r.status, 400);
  r = await call("POST", "/api/admin/password", { body: { current: "correct-horse-battery", next: "another-long-password" }, headers: ADMIN });
  assert.equal(r.status, 200);
  assert.equal((await call("GET", "/api/admin/me")).status, 200, "this session still works");
  cookie = old;
  assert.equal((await call("GET", "/api/admin/me")).status, 401, "the old session is signed out");
});
