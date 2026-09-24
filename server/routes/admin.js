/* Admin panel API. Everything except login needs a signed-in admin. */
const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const { query, transaction } = require("../db");
const media = require("../media");
const auth = require("../auth");
const { sanitizeSiteSettings } = require("../site-settings");
const { makeUpload, cleanup, check, UserError } = require("../uploads");

const router = express.Router();
router.use(express.json({ limit: "50kb" }));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const intId = v => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UserError("Not found.", 404);
  return n;
};

/* ---------- Session ---------- */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many sign-in attempts. Wait 15 minutes and try again." }
});

router.post("/login", loginLimiter, async (req, res) => {
  const admin = await auth.verifyLogin(req.body && req.body.email, req.body && req.body.password);
  if (!admin) return res.status(401).json({ error: "That email and password do not match." });
  auth.issue(res, admin);
  res.json({ admin: { email: admin.email, name: admin.name } });
});

router.post("/logout", (req, res) => {
  auth.clear(res);
  res.json({ ok: true });
});

router.use(auth.requireAdmin);

router.get("/me", (req, res) => {
  res.json({
    admin: { email: req.admin.email, name: req.admin.name },
    storage: { configured: media.isConfigured(), name: media.storageName() },
    limits: { adminUploadMb: config.limits.adminUploadMb }
  });
});

router.patch("/profile", async (req, res) => {
  const name = str(req.body && req.body.name, 160);
  const email = str(req.body && req.body.email, 255).toLowerCase();
  const current = String((req.body && req.body.current) || "");
  if (!EMAIL_RE.test(email)) throw new UserError("Enter a valid login email.");
  const ok = await auth.verifyLogin(req.admin.email, current);
  if (!ok) throw new UserError("The current password is not correct.");
  const exists = await query("SELECT id FROM admins WHERE email = ? AND id <> ?", [email, req.admin.id]);
  if (exists.rows[0]) throw new UserError("Another admin already uses that email.");
  await query("UPDATE admins SET email = ?, name = ?, token_version = token_version + 1 WHERE id = ?", [email, name, req.admin.id]);
  const { rows } = await query("SELECT * FROM admins WHERE id = ?", [req.admin.id]);
  auth.issue(res, rows[0]);
  res.json({ admin: { email: rows[0].email, name: rows[0].name } });
});

router.post("/password", async (req, res) => {
  const current = String((req.body && req.body.current) || "");
  const next = String((req.body && req.body.next) || "");
  if (next.length < 10) throw new UserError("Use at least 10 characters for the new password.");
  const ok = await auth.verifyLogin(req.admin.email, current);
  if (!ok) throw new UserError("The current password is not correct.");
  await query("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?", [await auth.hashPassword(next), req.admin.id]);
  const { rows } = await query("SELECT * FROM admins WHERE id = ?", [req.admin.id]);
  auth.issue(res, rows[0]); // keep this session, sign out the others
  res.json({ ok: true });
});

router.get("/stats", async (req, res) => {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS pending,
      (SELECT COUNT(*) FROM reviews WHERE status = 'approved') AS approved,
      (SELECT COUNT(*) FROM reviews WHERE status = 'rejected') AS rejected,
      (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM reviews WHERE status = 'approved') AS average,
      (SELECT COUNT(*) FROM gallery_items) AS gallery,
      (SELECT COUNT(*) FROM gallery_items WHERE published = 1) AS gallery_published,
      (SELECT COUNT(*) FROM enquiries WHERE handled = 0) AS enquiries_new
  `);
  res.json(rows[0]);
});

/* ---------- Website settings ---------- */

async function readSiteSettings() {
  const { rows } = await query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
  let saved = {};
  if (rows[0]) {
    try {
      saved = typeof rows[0].setting_value === "string" ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    } catch {
      saved = {};
    }
  }
  return sanitizeSiteSettings(saved);
}

router.get("/settings", async (req, res) => {
  res.json({ settings: await readSiteSettings() });
});

router.patch("/settings", async (req, res) => {
  const settings = sanitizeSiteSettings(req.body && req.body.settings);
  await query(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES ('site', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [JSON.stringify(settings)]
  );
  res.json({ settings });
});

/* ---------- Reviews ---------- */

function adminReview(r) {
  const link = r.video_link ? media.parseVideoLink(r.video_link) : null;
  const show = i => ({ ...media.present(i), publicId: i.publicId || "" });
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    rating: r.rating,
    message: r.message,
    status: r.status,
    verified: r.verified,
    adminNote: r.admin_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    avatar: r.avatar ? show(r.avatar) : null,
    media: (r.media || []).map(show),
    videoLink: link
  };
}

router.get("/reviews", async (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
  const order = status === "pending" ? "created_at ASC" : "COALESCE(reviewed_at, created_at) DESC";
  const { rows } = await query(`SELECT * FROM reviews WHERE status = ? ORDER BY ${order} LIMIT 500`, [status]);
  res.json({ reviews: rows.map(adminReview) });
});

router.patch("/reviews/:id", async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (col, val) => {
    vals.push(val);
    sets.push(`${col} = ?`);
  };
  if (b.status !== undefined) {
    if (!["pending", "approved", "rejected"].includes(b.status)) throw new UserError("Unknown status.");
    add("status", b.status);
    sets.push(b.status === "pending" ? "reviewed_at = NULL" : "reviewed_at = CURRENT_TIMESTAMP");
  }
  if (b.verified !== undefined) add("verified", Boolean(b.verified));
  if (b.adminNote !== undefined) add("admin_note", str(b.adminNote, 1000));
  if (!sets.length) throw new UserError("Nothing to change.");
  vals.push(id);
  const upd = await query(`UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`, vals);
  if (!upd.rowCount) throw new UserError("That review no longer exists.", 404);
  const { rows } = await query("SELECT * FROM reviews WHERE id = ?", [id]);
  if (!rows[0]) throw new UserError("That review no longer exists.", 404);
  res.json({ review: adminReview(rows[0]) });
});

/* Remove one photo, video, profile photo or video link from a review. */
router.post("/reviews/:id/remove-media", async (req, res) => {
  const id = intId(req.params.id);
  const url = str(req.body && req.body.url, 2000);
  let removed = null;
  const row = await transaction(async client => {
    const { rows } = await client.query("SELECT * FROM reviews WHERE id = ? FOR UPDATE", [id]);
    const row = rows[0];
    if (!row) throw new UserError("That review no longer exists.", 404);
    if (row.avatar && row.avatar.url === url) {
      removed = row.avatar;
      row.avatar = null;
    } else if (row.video_link && media.parseVideoLink(row.video_link)?.url === url) {
      removed = { type: "link" };
      row.video_link = "";
    } else {
      const idx = (row.media || []).findIndex(m => m.url === url);
      if (idx === -1) throw new UserError("That file is not part of this review.", 404);
      removed = row.media[idx];
      row.media.splice(idx, 1);
    }
    await client.query(
      "UPDATE reviews SET avatar = ?, media = ?, video_link = ? WHERE id = ?",
      [row.avatar ? JSON.stringify(row.avatar) : null, JSON.stringify(row.media || []), row.video_link, id]
    );
    const upd = await client.query("SELECT * FROM reviews WHERE id = ?", [id]);
    return upd.rows[0];
  });
  if (removed && removed.publicId) await media.destroy([removed]);
  res.json({ review: adminReview(row) });
});

router.delete("/reviews/:id", async (req, res) => {
  const id = intId(req.params.id);
  const { rows } = await query("SELECT * FROM reviews WHERE id = ?", [id]);
  if (!rows[0]) throw new UserError("That review no longer exists.", 404);
  await query("DELETE FROM reviews WHERE id = ?", [id]);
  await media.destroy([rows[0].avatar, ...(rows[0].media || [])]);
  res.json({ ok: true });
});

/* ---------- Gallery ---------- */

function adminGalleryItem(g) {
  return {
    id: g.id,
    title: g.title,
    caption: g.caption,
    published: g.published,
    sortOrder: g.sort_order,
    uploadedHere: Boolean(g.public_id),
    createdAt: g.created_at,
    ...media.present({ type: g.type, url: g.url })
  };
}

async function nextSortOrder() {
  const { rows } = await query("SELECT COALESCE(MIN(sort_order), 0) - 1 AS n FROM gallery_items");
  return rows[0].n; // new items go first
}

router.get("/gallery", async (req, res) => {
  const { rows } = await query("SELECT * FROM gallery_items ORDER BY sort_order ASC, created_at DESC");
  res.json({ items: rows.map(adminGalleryItem) });
});

/* Add by direct HTTPS link. */
router.post("/gallery", async (req, res) => {
  const b = req.body || {};
  const url = str(b.url, 2000);
  if (!media.isHttpsUrl(url)) throw new UserError("Paste a full link that starts with https://");
  const type = ["image", "video"].includes(b.type) ? b.type : media.guessType(url);
  const inserted = await query(
    `INSERT INTO gallery_items (type, url, title, caption, published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [type, url, str(b.title, 120), str(b.caption, 500), b.published !== false, await nextSortOrder()]
  );
  const { rows } = await query("SELECT * FROM gallery_items WHERE id = ?", [inserted.insertId]);
  res.status(201).json({ item: adminGalleryItem(rows[0]) });
});

/* Upload a file to local storage, then add it. */
const galleryUpload = makeUpload(config.limits.adminUploadMb).single("file");
router.post("/gallery/upload", galleryUpload, async (req, res) => {
  try {
    if (!req.file) throw new UserError("Choose a photo or video to upload.");
    const kind = check(req.file, { label: "The file" });
    let uploaded;
    try {
      uploaded = await media.uploadFile(req.file, kind, "gallery");
    } catch (err) {
      console.error("Local media upload failed:", err.message || err.error);
      throw new UserError("The upload could not be saved. Check the file and try again.", 502);
    }
    const b = req.body || {};
    const inserted = await query(
      `INSERT INTO gallery_items (type, url, public_id, title, caption, published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kind, uploaded.url, uploaded.publicId, str(b.title, 120), str(b.caption, 500), b.published !== "false", await nextSortOrder()]
    );
    const { rows } = await query("SELECT * FROM gallery_items WHERE id = ?", [inserted.insertId]);
    res.status(201).json({ item: adminGalleryItem(rows[0]) });
  } finally {
    cleanup(req);
  }
});

router.patch("/gallery/:id", async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (col, val) => {
    vals.push(val);
    sets.push(`${col} = ?`);
  };
  if (b.title !== undefined) add("title", str(b.title, 120));
  if (b.caption !== undefined) add("caption", str(b.caption, 500));
  if (b.published !== undefined) add("published", Boolean(b.published));
  if (!sets.length) throw new UserError("Nothing to change.");
  vals.push(id);
  const upd = await query(`UPDATE gallery_items SET ${sets.join(", ")} WHERE id = ?`, vals);
  if (!upd.rowCount) throw new UserError("That item no longer exists.", 404);
  const { rows } = await query("SELECT * FROM gallery_items WHERE id = ?", [id]);
  if (!rows[0]) throw new UserError("That item no longer exists.", 404);
  res.json({ item: adminGalleryItem(rows[0]) });
});

/* Save a new order: ids listed first to last. */
router.post("/gallery/reorder", async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) throw new UserError("Nothing to reorder.");
  await transaction(async client => {
    for (const [i, id] of ids.entries()) await client.query("UPDATE gallery_items SET sort_order = ? WHERE id = ?", [i + 1, id]);
  });
  res.json({ ok: true });
});

router.delete("/gallery/:id", async (req, res) => {
  const id = intId(req.params.id);
  const { rows } = await query("SELECT * FROM gallery_items WHERE id = ?", [id]);
  if (!rows[0]) throw new UserError("That item no longer exists.", 404);
  await query("DELETE FROM gallery_items WHERE id = ?", [id]);
  // Only files uploaded through this panel are removed from local storage.
  if (rows[0].public_id) await media.destroy([{ type: rows[0].type, publicId: rows[0].public_id }]);
  res.json({ ok: true });
});

/* ---------- Enquiries ---------- */

router.get("/enquiries", async (req, res) => {
  const { rows } = await query("SELECT * FROM enquiries ORDER BY handled ASC, created_at DESC LIMIT 500");
  res.json({
    enquiries: rows.map(e => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      email: e.email,
      topic: e.topic,
      message: e.message,
      handled: e.handled,
      status: e.lead_status,
      note: e.lead_note,
      followUp: e.follow_up_at ? new Date(e.follow_up_at).toISOString().slice(0, 10) : "",
      createdAt: e.created_at
    }))
  });
});

router.patch("/enquiries/:id", async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (col, val) => {
    vals.push(val);
    sets.push(`${col} = ?`);
  };
  if (b.handled !== undefined) add("handled", Boolean(b.handled));
  if (b.status !== undefined) {
    const status = str(b.status, 40);
    if (!["new", "contacted", "site_visit", "converted", "not_interested"].includes(status)) throw new UserError("Unknown lead status.");
    add("lead_status", status);
  }
  if (b.note !== undefined) add("lead_note", str(b.note, 1000));
  if (b.followUp !== undefined) add("follow_up_at", b.followUp ? str(b.followUp, 20) : null);
  if (!sets.length) throw new UserError("Nothing to change.");
  vals.push(id);
  const { rowCount } = await query(`UPDATE enquiries SET ${sets.join(", ")} WHERE id = ?`, vals);
  if (!rowCount) throw new UserError("That lead no longer exists.", 404);
  res.json({ ok: true });
});

router.delete("/enquiries/:id", async (req, res) => {
  const id = intId(req.params.id);
  await query("DELETE FROM enquiries WHERE id = ?", [id]);
  res.json({ ok: true });
});

module.exports = router;
