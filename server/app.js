const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const config = require("./config");
const { migrate } = require("./db");
const { query } = require("./db");
const { bootstrapAdmin } = require("./auth");
const { sanitizeSiteSettings } = require("./site-settings");

const app = express();
const PUBLIC = path.join(__dirname, "..", "public");

// Hosts such as Render, Railway and Heroku sit behind one proxy.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "blob:", "https:"],
        frameSrc: ["https://www.youtube-nocookie.com", "https://player.vimeo.com"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(compression());
app.use(cookieParser());

app.use("/api", require("./routes/public"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

function siteOrigin(req) {
  return config.siteUrl || `${req.protocol}://${req.get("host")}`;
}

const sitemapUrls = [
  ["", "weekly", "1.0"],
  ["about.html", "monthly", "0.8"],
  ["services.html", "monthly", "0.9"],
  ["real-estate-advisory-gurugram.html", "monthly", "0.8"],
  ["contact.html", "monthly", "0.7"],
  ["reviews.html", "monthly", "0.8"],
  ["privacy.html", "yearly", "0.3"],
  ["terms.html", "yearly", "0.3"],
  ["disclaimer.html", "yearly", "0.3"]
];

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function absoluteUrl(value, origin) {
  if (!value) return "";
  try {
    return new URL(value, origin + "/").href;
  } catch {
    return value;
  }
}

async function readPublicSettings() {
  try {
    const { rows } = await query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
    let saved = {};
    if (rows && rows[0]) {
      try {
        saved = typeof rows[0].setting_value === "string" ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
      } catch {
        saved = {};
      }
    }
    return sanitizeSiteSettings(saved);
  } catch (err) {
    console.warn("Could not read site settings from DB, using defaults:", err.message);
    return sanitizeSiteSettings({});
  }
}

function upsertMeta(html, selector, value) {
  if (!value) return html;
  const content = escapeHtml(value);
  if (selector.type === "name") {
    const re = new RegExp(`<meta\\s+name=["']${selector.key}["'][^>]*>`, "i");
    const tag = `<meta name="${selector.key}" content="${content}">`;
    return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`);
  }
  if (selector.type === "property") {
    const re = new RegExp(`<meta\\s+property=["']${selector.key}["'][^>]*>`, "i");
    const tag = `<meta property="${selector.key}" content="${content}">`;
    return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`);
  }
  const re = /<link\s+rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${content}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}\n</head>`);
}

async function indexHtml(req) {
  let html = await fs.readFile(path.join(PUBLIC, "index.html"), "utf8");
  const settings = await readPublicSettings();
  const seo = settings.seo || {};
  const origin = siteOrigin(req);
  const title = seo.title || seo.ogTitle || seo.twitterTitle;
  const description = seo.description || seo.ogDescription || seo.twitterDescription;
  const canonical = seo.canonicalUrl || `${origin}/`;
  const image = absoluteUrl(seo.ogImage || settings.hero.image, origin);

  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertMeta(html, { type: "name", key: "description" }, description);
  html = upsertMeta(html, { type: "name", key: "keywords" }, seo.keywords);
  html = upsertMeta(html, { type: "name", key: "robots" }, seo.robots);
  html = upsertMeta(html, { type: "link", key: "canonical" }, canonical);
  html = upsertMeta(html, { type: "property", key: "og:url" }, canonical);
  html = upsertMeta(html, { type: "property", key: "og:title" }, seo.ogTitle || title);
  html = upsertMeta(html, { type: "property", key: "og:description" }, seo.ogDescription || description);
  html = upsertMeta(html, { type: "property", key: "og:image" }, image);
  html = upsertMeta(html, { type: "property", key: "og:image:alt" }, seo.ogImageAlt || settings.hero.imageAlt);
  html = upsertMeta(html, { type: "name", key: "twitter:title" }, seo.twitterTitle || seo.ogTitle || title);
  html = upsertMeta(html, { type: "name", key: "twitter:description" }, seo.twitterDescription || seo.ogDescription || description);
  html = upsertMeta(html, { type: "name", key: "twitter:image" }, image);
  return html;
}

function maintenanceHtml(settings) {
  const maintenance = settings.maintenance || {};
  const contact = settings.contact || {};
  const title = maintenance.title || "Website under maintenance";
  const message = maintenance.message || "We are making a few updates and will be back online shortly.";
  const phone = contact.phone || contact.whatsapp || "";
  const email = contact.email || "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} | earthsar</title>
<style>
:root{color-scheme:light;--blue:#0B2D4D;--orange:#E97824;--ink:#263342;--muted:#687386;--bg:#F6F3EE;--surface:#fff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
main{width:min(620px,100%);background:var(--surface);border:1px solid #E4DED4;border-top:5px solid var(--orange);border-radius:18px;padding:38px 34px;box-shadow:0 24px 70px rgba(11,45,77,.16);text-align:center}
.brand img{width:min(220px,80%);height:auto;margin-bottom:20px}
h1{margin:0;color:var(--blue);font-size:clamp(28px,5vw,42px);line-height:1.08}p{font-size:18px;line-height:1.65;margin:18px auto 0;max-width:46ch;color:var(--muted)}
.contact{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:26px}.contact a{border:1px solid #D9E1EA;border-radius:999px;padding:10px 16px;color:var(--blue);text-decoration:none;font-weight:700}.contact a:hover{border-color:var(--blue)}
</style>
</head>
<body>
<main>
<div class="brand" aria-label="earthsar"><img src="/assets/earthsar-logo.png" alt="earthsar - Smart Advisors In Real Estate"></div>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
${phone || email ? `<div class="contact">${phone ? `<a href="tel:${escapeHtml(phone.replace(/\s+/g, ""))}">${escapeHtml(phone)}</a>` : ""}${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ""}</div>` : ""}
</main>
</body>
</html>`;
}

async function sendIndex(req, res, next) {
  try {
    res.set("Cache-Control", "no-cache");
    res.type("html").send(await indexHtml(req));
  } catch (err) {
    next(err);
  }
}

app.use(async (req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method) || req.path.startsWith("/admin") || req.path.startsWith("/api")) return next();
  if (req.accepts(["html", "json"]) !== "html") return next();
  try {
    const settings = await readPublicSettings();
    if (settings.maintenance && settings.maintenance.enabled) {
      res.set("Cache-Control", "no-cache");
      res.set("Retry-After", "3600");
      return res.status(503).type("html").send(maintenanceHtml(settings));
    }
  } catch (err) {
    console.warn("Could not render maintenance page:", err.message);
  }
  next();
});

app.get("/robots.txt", (req, res) => {
  const origin = siteOrigin(req);
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`);
});

app.get("/sitemap.xml", (req, res) => {
  const origin = siteOrigin(req);
  const today = new Date().toISOString().slice(0, 10);
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(([path, changefreq, priority]) => `  <url>
    <loc>${origin}/${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>
`);
});

// Keep the admin panel out of search engines.
app.use("/admin", (req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.get(["/", "/index.html"], sendIndex);
app.use("/uploads", (req, res, next) => {
  if (!/\.(?:jpe?g|png|webp|gif|heic|heif|avif|mp4|webm|mov|m4v|3gp)$/i.test(req.path)) return res.sendStatus(404);
  res.set("Content-Security-Policy", "default-src 'none'; sandbox");
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
app.use(
  express.static(PUBLIC, {
    extensions: ["html"],
    setHeaders(res, file) {
      // HTML, CSS and JS change with each release; images rarely do.
      if (/\.(html|css|js)$/.test(file)) res.set("Cache-Control", "no-cache");
      else res.set("Cache-Control", "public, max-age=604800");
    }
  })
);
app.use(sendIndex);

// One place that turns errors into JSON the front end can show.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "One of the files is too large."
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files, or a file was sent in the wrong field."
          : "The upload could not be read.";
    return res.status(400).json({ error: msg });
  }
  if (err.expose || err.type === "entity.parse.failed") {
    return res.status(err.status || 400).json({ error: err.expose && err.message ? err.message : "The request could not be read." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server. Try again in a moment." });
});

async function start() {
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(config.port, () => resolve(listening));
    listening.once('error', reject);
  });
  if (config.databaseUrl) {
    try {
      await migrate();
      await bootstrapAdmin();
    } catch (err) {
      console.error('Database initialization unavailable; public server remains online:', err.message);
    }
  }
  return server;
}

module.exports = { app, start };
