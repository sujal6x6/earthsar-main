/* Admin sign-in with a signed, httpOnly cookie. */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { query } = require("./db");

const COOKIE = "es_admin";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Used when the email is unknown so the response takes as long as a real check.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function cookieOptions() {
  return { httpOnly: true, sameSite: "strict", secure: config.isProd, path: "/api/admin", maxAge: MAX_AGE_MS };
}

async function verifyLogin(email, password) {
  const { rows } = await query("SELECT * FROM admins WHERE email = ?", [String(email || "").trim().toLowerCase()]);
  const admin = rows[0];
  const ok = await bcrypt.compare(String(password || ""), admin ? admin.password_hash : DUMMY_HASH);
  return ok && admin ? admin : null;
}

function issue(res, admin) {
  const token = jwt.sign({ sub: admin.id, v: admin.token_version }, config.jwtSecret, { expiresIn: "7d" });
  res.cookie(COOKIE, token, cookieOptions());
}

function clear(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE, opts);
}

/* Middleware: only signed-in admins get through.
   Changes also need the X-Requested-With header, which a browser will not
   send from another site. Together with SameSite=Strict this blocks CSRF. */
async function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    clear(res);
    return res.status(401).json({ error: "Your session has expired. Sign in again." });
  }
  const { rows } = await query("SELECT id, email, name, token_version FROM admins WHERE id = ?", [payload.sub]);
  const admin = rows[0];
  if (!admin || admin.token_version !== payload.v) {
    clear(res);
    return res.status(401).json({ error: "Your session has expired. Sign in again." });
  }
  if (!["GET", "HEAD"].includes(req.method) && req.get("X-Requested-With") !== "earthsar-admin") {
    return res.status(403).json({ error: "Request blocked." });
  }
  req.admin = admin;
  next();
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, 12);
}

/* Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if there are none yet. */
async function bootstrapAdmin() {
  const { email, password, name } = config.bootstrapAdmin;
  if (!email || !password) return;
  const { rows } = await query("SELECT COUNT(*) AS n FROM admins");
  if (rows[0].n > 0) return;
  if (password.length < 10) {
    console.warn("ADMIN_PASSWORD must be at least 10 characters. Admin not created.");
    return;
  }
  await query("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)", [email, name, await hashPassword(password)]);
  console.log(`Created admin account ${email}. You can remove ADMIN_PASSWORD from the environment now.`);
}

module.exports = { verifyLogin, issue, clear, requireAdmin, hashPassword, bootstrapAdmin };
