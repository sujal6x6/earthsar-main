/* Local uploads and helpers for building display URLs. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const LEGACY_UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
// Production releases are replaceable; the account home survives a Git deployment.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || (process.env.NODE_ENV === "production"
  ? path.join(os.homedir(), ".earthsar", "uploads") : LEGACY_UPLOAD_DIR));
let migration;
function preserveUploads() {
  if (!migration) migration = (async () => {
    if (UPLOAD_DIR === LEGACY_UPLOAD_DIR) return;
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    if (fs.existsSync(LEGACY_UPLOAD_DIR)) {
      await fs.promises.cp(LEGACY_UPLOAD_DIR, UPLOAD_DIR, { recursive: true, force: false, errorOnExist: false });
    }
  })().catch(err => { migration = null; throw err; });
  return migration;
}

const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/3gpp": ".3gp"
};

function isConfigured() {
  return true;
}

function storageName() {
  return "Local storage";
}

function safeExt(file) {
  const ext = EXT_BY_TYPE[file.verifiedMime];
  if (!ext) throw new Error("Upload has not passed content validation.");
  return ext;
}

/* Store a temp upload under public/uploads. Returns {type,url,publicId}. */
async function uploadFile(file, kind, subfolder) {
  safeExt(file);
  await preserveUploads();
  const dir = path.join(UPLOAD_DIR, subfolder);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt(file)}`;
  const dest = path.join(dir, name);
  await fs.promises.rename(file.path, dest).catch(async err => {
    if (err.code !== "EXDEV") throw err;
    await fs.promises.copyFile(file.path, dest);
    await fs.promises.unlink(file.path).catch(() => {});
  });
  const url = `/uploads/${subfolder}/${name}`;
  return { type: kind, url, publicId: url };
}

/* Delete local assets we uploaded. Never throws: cleanup should not block the admin. */
async function destroy(items) {
  const list = (items || []).filter(Boolean);
  await Promise.all(
    list.map(async item => {
      const url = item.publicId || item.url || "";
      if (!url.startsWith("/uploads/")) return;
      const file = path.join(UPLOAD_DIR, url.slice("/uploads/".length));
      const rel = path.relative(UPLOAD_DIR, file);
      if (rel.startsWith("..") || path.isAbsolute(rel)) return;
      await fs.promises.unlink(file).catch(err => {
        if (err.code !== "ENOENT") console.warn("Local media delete failed for", url, err.message);
      });
      if (UPLOAD_DIR !== LEGACY_UPLOAD_DIR) {
        await fs.promises.unlink(path.join(LEGACY_UPLOAD_DIR, url.slice("/uploads/".length))).catch(() => {});
      }
    })
  );
}

/* ---------- URL helpers ---------- */
function transform(url) {
  return url;
}

function videoPoster() {
  return "";
}

/* YouTube / Vimeo links. Returns null for anything else. */
function parseVideoLink(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const s = u.href;
  let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (m)
    return {
      kind: "youtube",
      url: s,
      embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`,
      thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`
    };
  m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: "vimeo", url: s, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: "" };
  return null;
}

function isHttpsUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/* Guess image/video from a URL. */
function guessType(url) {
  if (parseVideoLink(url)) return "video";
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return "video";
  return "image";
}

/* Shape one stored media item for the public site. */
function present(item) {
  if (!item) return null;
  const link = item.type === "video" ? parseVideoLink(item.url) : null;
  if (link) return { type: "video", url: link.url, embed: link.embed, thumb: link.thumb, full: "" };
  if (item.type === "video") return { type: "video", url: item.url, embed: "", thumb: "", full: item.url };
  return { type: "image", url: item.url, embed: "", thumb: item.url, full: item.url };
}

module.exports = {
  UPLOAD_DIR,
  preserveUploads,
  isConfigured,
  storageName,
  uploadFile,
  destroy,
  transform,
  videoPoster,
  parseVideoLink,
  isHttpsUrl,
  guessType,
  present
};
