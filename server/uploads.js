/* Receives multipart uploads to a temp folder, then checks type and size. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

const TMP = path.join(os.tmpdir(), "earthsar-uploads");
fs.mkdirSync(TMP, { recursive: true });

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/3gpp"];

class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

function makeUpload(maxMb) {
  return multer({
    storage: multer.diskStorage({ destination: TMP }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 8, fields: 30, fieldSize: 64 * 1024 }
  });
}

/* Every uploaded file from req.files, whether multer gave an array or a map. */
function allFiles(req) {
  if (!req.files) return req.file ? [req.file] : [];
  return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
}

function cleanup(req) {
  for (const f of allFiles(req)) fs.promises.unlink(f.path).catch(() => {});
}

function kindOf(file) {
  if (IMAGE_TYPES.includes(file.mimetype)) return "image";
  if (VIDEO_TYPES.includes(file.mimetype)) return "video";
  return null;
}

/* Throws a UserError when a file is the wrong type or too big. */
function check(file, { kind, maxMb, label }) {
  const k = kindOf(file);
  if (!k || (kind && k !== kind)) {
    throw new UserError(
      kind === "video"
        ? `${label} must be an MP4, MOV or WebM video.`
        : kind === "image"
          ? `${label} must be a JPG, PNG, WebP or HEIC image.`
          : `${label} must be an image or a video.`
    );
  }
  if (maxMb && file.size > maxMb * 1024 * 1024) {
    throw new UserError(`${label} is larger than ${maxMb} MB.`);
  }
  return k;
}

module.exports = { makeUpload, allFiles, cleanup, check, kindOf, UserError };
