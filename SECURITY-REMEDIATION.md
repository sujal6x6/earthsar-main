# Security and responsive remediation — 27 September 2026

## Implemented

- Detect upload types from file contents in both backends. Store only approved extensions derived from those types. Reject active HTML/SVG/PHP disguised as images; validate all PHP attachments before storing them.
- Block executable upload URLs, sandbox media responses, and restrict deletion to the upload directory. Add Apache/LiteSpeed rules to deny script execution and deployment-file access.
- Remove the Node web initialization route; make PHP setup CLI-only. Add `npm run setup` for deployment.
- Reject missing, short, blank, and known default JWT signing secrets. Restrict Node JWT algorithms and require valid PHP token expiry/signature claims. Use secure PHP cookies on HTTPS and a valid constant-time dummy password hash.
- Remove public database error details and wildcard PHP CORS. Lock PHP rate-limit storage updates.
- Apply a restrictive script CSP, move theme initialization into an external script, and configure headers for static HTML as well as dynamic responses.
- Repair the API suite's startup function mismatch and update its upload fixtures for content detection.
- Fix the 320px homepage clipping and tablet navigation overflow. Make menus scrollable in landscape. Correct text/button contrast and rating accessibility labels.

## Verified

- 90 local page/viewport checks: no detected horizontal content overflow or JavaScript errors.
- axe-core WCAG A/AA scan on all 10 pages at 390px: no detected violations in the final pass. Automated checks do not replace manual accessibility testing.
- Eight Node security regression tests passed; the database integration suite was skipped because no disposable MySQL database was configured.
- Native PHP 8.3 upload/JWT regression checks and syntax checks passed. Local PHP HTTP tests rejected disguised uploads (400), unauthenticated admin access (401), and excess review submissions (429).
- Both runtimes refuse admin authentication with weak signing-secret configurations.
- Browser checks against the real Express middleware (with stubbed database reads) passed for homepage, reviews, and admin sign-in, with no CSP violations or script errors.
- Dependency audit: zero reported advisories for the final lockfile.

## Required deployment configuration

1. Set a unique, securely generated `JWT_SECRET` of at least 32 characters **before deployment**. Missing/default secrets disable admin access; public pages remain available. Rotate existing secrets if a fallback was used; this invalidates old sessions.
2. Node deployments require Node 20+ (22/24 recommended), `npm ci`, and `NODE_ENV=production`. PHP needs the `fileinfo` extension and its production environment setting.
3. Preserve root `.htaccess` and `public/uploads/.htaccess` on Apache/LiteSpeed. Ensure override/header rules are enabled. Other hosting stacks need equivalent rules; CDN/static responses may need configuration outside this repository.
4. Run CLI setup if migrations are needed; do not restore public setup routes.
5. Retest authenticated database flows on staging, then verify live headers and uploads after deployment. Review existing uploaded files separately; none were deleted by this change.

Hosting secrets, Apache/LiteSpeed behavior, CDN settings, and authenticated production/database flows were not changed or verified from this workspace. These code changes alone are not a production security certification.
