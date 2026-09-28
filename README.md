# earthsar website

Website for **earthsar — Smart Advisors In Real Estate**, with an admin panel.

- **Reviews with approval.** Customers post a review with an optional profile photo, up to 4 photos, a video, or a YouTube/Vimeo link. Nothing appears on the website until an admin approves it.
- **Gallery.** Admins add photos and videos by uploading to the hosting storage or by pasting a direct media link.
- **Client photos & videos.** A separate section showing the photos and videos from approved reviews.
- **Enquiries.** The contact form is saved to the database and shown in the admin panel.

Built with Node.js, Express and MySQL/MariaDB. Photos and videos are stored under `public/uploads` on the hosting account. The front end is plain HTML, CSS and JavaScript, so there is no build step.

---

## What's where

```
public/                 The website (served as-is)
  index.html            Page structure and copy
  styles.css            All styling (brand colours at the top)
  main.js               Website behaviour
  config.js             Fixed content: stats, contact details, team, partners, credentials
  admin/                The admin panel (open /admin)
server/
  index.js              Starts the server, security headers
  routes/public.js      API used by the website
  routes/admin.js       API used by the admin panel
  media.js              Local uploads and image/video URLs
  schema.sql            Database tables (created automatically on start)
scripts/create-admin.js Create an admin or reset a password
test/api.test.js        Automated tests
```

## What you need

1. **Node.js 20 or newer** (22 or 24 recommended).
2. **A MySQL/MariaDB database.** Hostinger Web/Cloud hosting includes this.
3. **Writable hosting storage** for uploaded photos and videos.

## Run it on your computer

```bash
npm install
cp .env.example .env        # then open .env and fill it in
npm start
```

Open <http://localhost:3000> for the website and <http://localhost:3000/admin> for the admin panel.

The database tables are created automatically the first time the server starts.

### Creating the first admin

Pick one:

- **Easiest (works on any host):** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` or in your host's environment settings. When the server starts and there are no admins yet, it creates this account. Afterwards you can remove `ADMIN_PASSWORD`.
- **From a terminal:** run `npm run create-admin` and answer the prompts. Running it again with an existing email resets that admin's password, which is also how to recover a forgotten password.

## Settings (`.env`)

### Social media accounts

In **Admin → Settings → Social Media**, choose **Add social account**, select a platform/logo, and enter its HTTPS profile link. Enable **Show on website** and click **Save website details** to display it. Change the platform to change its logo, uncheck visibility to hide an account while keeping its link, or remove it and save.

All accounts start hidden (the default list is empty). Facebook, Instagram, LinkedIn, X, YouTube and Threads logos are bundled locally. Enabled accounts appear in the footer on all public pages; no empty social section is shown. Settings are stored in the existing site settings database record, with support for both Node and PHP backends.

| Setting | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL/MariaDB connection string, for example `mysql://USER:PASSWORD@HOST:3306/DATABASE`. |
| `JWT_SECRET` | Yes | A long random string (32+ characters) used to sign admin sessions. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `SITE_URL` | Recommended | Your final public website URL, for example `https://earthsar.com`. Used for sitemap and robots.txt. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First run only | Creates the first admin (see above). Password must be 10+ characters. |
| `REVIEW_PHOTO_MAX_MB` | No | Largest photo a customer can upload. Default 5. |
| `REVIEW_VIDEO_MAX_MB` | No | Largest video a customer can upload. Default 50. Consider using YouTube/Vimeo links for longer videos. |
| `ADMIN_UPLOAD_MAX_MB` | No | Largest file an admin can upload to the gallery. Default 100. |
| `NODE_ENV` | On the live site | Set to `production`. This turns on secure cookies and HTTPS upgrades. |
| `PORT` | No | Most hosts set this for you. Default 3000. |

## Upload storage

Uploaded files are saved locally under `public/uploads/reviews` and `public/uploads/gallery`.

**Adding a gallery item by link:** paste a direct HTTPS image/video URL in *Admin → Gallery → Paste a link*. YouTube and Vimeo links work for videos too.

**Uploading from the admin panel:** choose *Upload a file*. The file is stored on the hosting account and added to the gallery in one step.

**What happens on delete:**

- Deleting a gallery item that was **uploaded through the admin panel** also deletes it from `public/uploads`.
- Deleting a gallery item that was **added by link** leaves the linked file where it is hosted.
- Deleting a review, or removing a photo from a review, deletes uploaded files from `public/uploads`.
- Rejecting a review keeps its files, in case you change your mind. Delete the review to remove them.

## Putting it online

Any host that runs Node.js and MySQL/MariaDB works. For Hostinger:

1. Create a MySQL database in Hostinger and copy its host, database name, username and password.
2. Configure the Node.js app in Hostinger.
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: add `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, and `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first start.
3. Make sure uploaded files in `public/uploads` are not deleted during deployment.
4. Connect your domain, sign in to `/admin`, then remove `ADMIN_PASSWORD` from the environment.

The same structure applies to a VPS or any cPanel host with Node.js and MySQL.

**Not suitable:** static-only hosts (Netlify, GitHub Pages) and serverless platforms with temporary file storage, because customer uploads must persist on disk.

## Using the admin panel

Open `/admin` and sign in.

- **Reviews.** New reviews wait under *Waiting*. Open photos and videos to check them, then choose **Approve & publish** or **Reject**.
  - Tick *Show "Verified client" badge* for clients you have confirmed.
  - The × on a photo removes just that file.
  - The private note is only visible to admins.
  - *Published* reviews can be unpublished at any time.
- **Gallery.** Add items at the top. Use the arrows to change the order, **Hide** to take an item off the website without deleting it, and **Edit** to change the title or caption. The Gallery section and its menu link only appear on the website once at least one item is shown.
- **Enquiries.** Messages from the contact form. Mark each as handled once an advisor has replied.
- **Account.** Change your password (this signs out your other devices) or sign out.

The orange numbers in the menu count reviews waiting for approval and enquiries not yet handled.

## Editing the fixed content

Stats, contact details, team, partner logos, credentials and legal links are still in `public/config.js`. Edit that file and redeploy.

## Security

- Admin passwords are hashed with bcrypt. Sessions use a signed, httpOnly cookie that lasts 7 days.
- Admin changes need a special request header, and the cookie is `SameSite=Strict`, which blocks cross-site request forgery.
- Sign-in attempts are rate-limited. Review and enquiry submissions are rate-limited per connection and include a hidden spam-trap field.
- Uploads are checked for type and size before anything is stored. If one file in a review fails, the files already uploaded are removed.
- Customer email addresses and phone numbers are only visible in the admin panel, never on the website.
- Security headers include a Content Security Policy. The admin panel is marked `noindex`.

## Tests

The tests need their own **throwaway** database, because they wipe it on each run. They use a fake media store, so nothing is uploaded.

```bash
TEST_DATABASE_URL=mysql://user:pass@localhost:3306/earthsar_test npm test
```

## Brand colours

| Token | Value | Use |
|---|---|---|
| `--es-blue` | #004AAD | Trust: headings, navigation, statistics |
| `--es-orange` | #F1770A | Action: buttons, highlights, stars |
| `--soft-blue` | #F4F8FF | Section backgrounds |
| `--soft-orange` | #FFF6EE | Accent backgrounds |
| `--ink` | #182433 | Body text |

Fonts: Outfit (headings) and Manrope (body), loaded from Google Fonts.

## Security update deployment

- Before deploying, set a unique JWT_SECRET of at least 32 characters on the host. Missing, blank, and former default values disable admin access without stopping public pages. Generate it locally with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))". Never commit the result. Rotating the secret signs out existing administrators.
- Set NODE_ENV=production (APP_ENV=production for PHP is also supported). Use Node 20+ for the Node backend; Node 22/24 is recommended. Run npm ci to install the locked content-type detector.
- Initialize via npm run setup (Node) or php setup.php (PHP CLI). Browser initialization endpoints have been removed.
- Apache/LiteSpeed deployments must retain both the root .htaccess and public/uploads/.htaccess, enable rewrite/headers, and allow the overrides. Other hosts need equivalent rules: reject executable upload extensions, deny deployment files, disable directory listing/script execution, apply nosniff and CSP to static HTML as well as dynamic responses.
- Uploaded media now uses detected content types and safe extensions. Existing suspect uploads should be reviewed separately; this change does not delete existing customer files. Back up media before any cleanup.
- The local security suite runs without a database: node --test test/security.test.js. The existing API integration suite needs TEST_DATABASE_URL pointing to a disposable MySQL database; it drops tables and must never use production.

PHP hosts also require the fileinfo extension. Run php test/php-security.php for database-free upload/JWT regression checks. PHP rate limits now lock local storage updates; multi-server deployments still need shared rate-limit storage.
