/* Reads settings from environment variables (.env in development). */
require("dotenv").config({ quiet: true });

const isProd = process.env.NODE_ENV === "production";
const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);

let dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl && process.env.DATABASE_USER && process.env.DATABASE_NAME) {
  const host = process.env.DATABASE_HOST || "localhost";
  const port = process.env.DATABASE_PORT || 3306;
  const user = encodeURIComponent(process.env.DATABASE_USER);
  const pass = encodeURIComponent(process.env.DATABASE_PASS || process.env.DATABASE_PASSWORD || "");
  const db = process.env.DATABASE_NAME;
  dbUrl = `mysql://${user}:${pass}@${host}:${port}/${db}`;
}

const config = {
  isProd,
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  databaseUrl: dbUrl,
  jwtSecret: process.env.JWT_SECRET || "earthsar-production-jwt-secret-min-32-chars-long",
  siteUrl: (process.env.SITE_URL || "").trim().replace(/\/+$/, ""),
  // Optional first-run admin. Created only when the admins table is empty.
  bootstrapAdmin: {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "Admin"
  },
  limits: {
    reviewPhotoMb: num(process.env.REVIEW_PHOTO_MAX_MB, 20),
    reviewVideoMb: num(process.env.REVIEW_VIDEO_MAX_MB, 50),
    adminUploadMb: num(process.env.ADMIN_UPLOAD_MAX_MB, 100)
  }
};

if (!config.databaseUrl) {
  console.warn("Warning: DATABASE_URL is not set. Set it in Hostinger environment variables.");
}

module.exports = config;
