/* Endpoints used by the public website. */
const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const { query } = require("../db");
const media = require("../media");
const { sanitizeSiteSettings } = require("../site-settings");
const { makeUpload, allFiles, cleanup, check, UserError } = require("../uploads");

const router = express.Router();

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- Reviews ---------- */

function publicReview(r) {
  const link = r.video_link ? media.parseVideoLink(r.video_link) : null;
  return {
    id: r.id,
    name: r.name,
    rating: r.rating,
    message: r.message,
    verified: r.verified,
    createdAt: r.created_at,
    avatar: r.avatar ? media.transform(r.avatar.url, "c_fill,g_face,w_160,h_160,f_auto,q_auto") : "",
    media: (r.media || []).map(media.present).filter(Boolean),
    videoLink: link ? { type: "video", url: link.url, embed: link.embed, thumb: link.thumb, full: "" } : null
  };
}

router.get("/reviews", async (req, res) => {
  const { rows } = await query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500");
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of rows) {
    distribution[r.rating]++;
    total += r.rating;
  }
  res.set("Cache-Control", "no-cache");
  res.json({
    summary: { count: rows.length, average: rows.length ? +(total / rows.length).toFixed(2) : 0, distribution },
    limits: { photoMb: config.limits.reviewPhotoMb, videoMb: config.limits.reviewVideoMb },
    reviews: rows.map(publicReview)
  });
});

const skipInTests = () => process.env.NODE_ENV === "test";

const reviewLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many reviews from this connection. Try again in an hour." }
});

const L = config.limits;
const reviewUpload = makeUpload(Math.max(L.reviewPhotoMb, L.reviewVideoMb)).fields([
  { name: "avatar", maxCount: 1 },
  { name: "photos", maxCount: 4 },
  { name: "video", maxCount: 1 }
]);

router.post("/reviews", reviewLimiter, reviewUpload, async (req, res) => {
  const uploaded = [];
  try {
    const b = req.body || {};
    // Hidden field that people never see; bots tend to fill it in.
    if (b.website) return res.status(201).json({ ok: true });

    const name = str(b.name, 80);
    const email = str(b.email, 200).toLowerCase();
    const phone = str(b.phone, 30);
    const message = str(b.message, 1500);
    const rating = parseInt(b.rating, 10);
    const videoLinkRaw = str(b.videoLink, 500);

    const errors = {};
    if (name.length < 2) errors.name = "Enter your name.";
    if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    if (!(rating >= 1 && rating <= 5)) errors.rating = "Choose a rating from 1 to 5 stars.";
    if (message.length < 3) errors.message = "Write a few words about your experience.";
    const link = videoLinkRaw ? media.parseVideoLink(videoLinkRaw) : null;
    if (videoLinkRaw && !link) errors.videoLink = "Paste a full YouTube or Vimeo link.";
    if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });

    const f = req.files || {};
    const avatarFile = (f.avatar || [])[0];
    const photoFiles = f.photos || [];
    const videoFile = (f.video || [])[0];
    if (avatarFile) check(avatarFile, { kind: "image", maxMb: L.reviewPhotoMb, label: "Profile photo" });
    photoFiles.forEach((p, i) => check(p, { kind: "image", maxMb: L.reviewPhotoMb, label: `Photo ${i + 1}` }));
    if (videoFile) check(videoFile, { kind: "video", maxMb: L.reviewVideoMb, label: "Video" });

    // Store in parallel and remember each one so we can undo on failure.
    const track = p => p.then(r => (uploaded.push(r), r));
    const [avatar, photos, video] = await Promise.all([
      avatarFile ? track(media.uploadFile(avatarFile, "image", "reviews")) : null,
      Promise.all(photoFiles.map(p => track(media.uploadFile(p, "image", "reviews")))),
      videoFile ? track(media.uploadFile(videoFile, "video", "reviews")) : null
    ]);

    const items = [...photos, ...(video ? [video] : [])];
    await query(
      `INSERT INTO reviews (name, email, phone, rating, message, avatar, media, video_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, rating, message, avatar ? JSON.stringify(avatar) : null, JSON.stringify(items), link ? link.url : ""]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (uploaded.length) media.destroy(uploaded);
    if (err.expose) return res.status(err.status).json({ error: err.message });
    if (err.http_code || err.error) {
      console.error("Media upload failed:", err.message || err.error);
      return res.status(502).json({ error: "Your files could not be uploaded. Try again, or send the review without them." });
    }
    throw err;
  } finally {
    cleanup(req);
  }
});

/* ---------- Gallery ---------- */

router.get("/gallery", async (req, res) => {
  const { rows } = await query("SELECT * FROM gallery_items WHERE published = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 300");
  res.set("Cache-Control", "no-cache");
  res.json({
    items: rows.map(g => ({ id: g.id, title: g.title, caption: g.caption, ...media.present({ type: g.type, url: g.url }) }))
  });
});

/* ---------- Website settings ---------- */

router.get("/settings", async (req, res) => {
  const { rows } = await query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
  let saved = {};
  if (rows[0]) {
    try {
      saved = typeof rows[0].setting_value === "string" ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
    } catch {
      saved = {};
    }
  }
  res.set("Cache-Control", "no-cache");
  res.json({ settings: sanitizeSiteSettings(saved) });
});

/* ---------- Enquiries ---------- */

const enquiryLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many enquiries from this connection. Call us instead, or try again later." }
});

router.post("/enquiries", enquiryLimiter, express.json({ limit: "20kb" }), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.status(201).json({ ok: true });
  const name = str(b.name, 80);
  const phone = str(b.phone, 30);
  const email = str(b.email, 200).toLowerCase();
  const errors = {};
  if (!name) errors.name = "Enter your name.";
  if (phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a phone number we can call.";
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (b.consent !== true) errors.consent = "Please confirm we may contact you.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
  await query("INSERT INTO enquiries (name, phone, email, topic, message) VALUES (?, ?, ?, ?, ?)", [
    name,
    phone,
    email,
    str(b.topic, 80),
    str(b.message, 3000)
  ]);
  res.status(201).json({ ok: true });
});

router.get("/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ ok: true });
});

module.exports = router;
