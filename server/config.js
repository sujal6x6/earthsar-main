/* Reads settings from environment variables (.env in development). */
require("dotenv").config({ quiet: true });

const isProd = process.env.NODE_ENV === "production";
const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);

const config = {
  isProd,
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  siteUrl: (process.env.SITE_URL || "").trim().replace(/\/+$/, ""),
  // Optional first-run admin. Created only when the admins table is empty.
  bootstrapAdmin: {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "Admin"
  },
  limits: {
    reviewPhotoMb: num(process.env.REVIEW_PHOTO_MAX_MB, 5),
    reviewVideoMb: num(process.env.REVIEW_VIDEO_MAX_MB, 50),
    adminUploadMb: num(process.env.ADMIN_UPLOAD_MAX_MB, 100)
  }
};

if (!config.databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
if (!config.jwtSecret || config.jwtSecret.length < 32) {
  if (isProd) {
    console.error("JWT_SECRET must be set to a random string of at least 32 characters.");
    process.exit(1);
  }
  config.jwtSecret = config.jwtSecret || "dev-only-secret-change-me-dev-only-secret";
  console.warn("Warning: using a development JWT_SECRET. Set JWT_SECRET before going live.");
}

module.exports = config;
