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
        scriptSrc: ["'self'", "'unsafe-inline'"],
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

async function sendIndex(req, res, next) {
  try {
    res.set("Cache-Control", "no-cache");
    res.type("html").send(await indexHtml(req));
  } catch (err) {
    next(err);
  }
}

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
  const urls = [["", "1.0"]];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, priority]) => `  <url>
    <loc>${origin}/${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
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
  const server = await new Promise(resolve => {
    const s = app.listen(config.port, () => {
      console.log(`earthsar running on http://localhost:${config.port} (admin: /admin)`);
      resolve(s);
    });
  });

  if (config.databaseUrl) {
    try {
      await migrate();
      await bootstrapAdmin();
      console.log("Database initialized successfully.");
    } catch (err) {
      console.error("Database initialization warning:", err.message);
    }
  } else {
    console.warn("DATABASE_URL is not set. Site running in read-only / static mode.");
  }

  return server;
}

if (require.main === module) {
  start().catch(err => {
    console.error("Could not start:", err.message);
  });
}

module.exports = { app, start };
