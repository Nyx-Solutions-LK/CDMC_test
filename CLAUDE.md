# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo root contains the project brief (`scope of project.pdf`, `meeting minutes.txt`) and two parts of the project:

- `cdmc-web-final/` — the static front-end for CDMC Sri Lanka (Christian Discipleship Mentor Center, Colombo): the original one-page marketing site (`index.php`) plus new login-gated pages (`notices.html`, `messages.html`, `admin.html`) added for the engagement described below.
- `backend/` — a Node/Express API + session auth backend (added for this engagement) that serves `cdmc-web-final/` and powers the new pages. See "Backend (login, notices, messages, admin)" below.

The original site has no build tooling, package manager, or test suite (no `package.json`, `composer.json`, or test framework) — it's plain static HTML/CSS/JS. `backend/` is a small, dependency-light Node project (no ORM, no frontend bundler) layered on top without modifying that ethos.

## Architecture

- `cdmc-web-final/index.php` is the **only** page — a single static HTML document (despite the `.php` extension; there is no server-side PHP logic in it). All sections of the site (hero slider, about, objectives, services, governance/about-me, videos, gallery, contact, footer) live in this one file as sequential `<div>` blocks, navigated via in-page anchor links (`#soul-center`, `#governance`, `#services`, `#aboutMe`, `#contactUs`).
- The theme originates from a purchased/mirrored HTML template ("bluebird" corporate theme from unicoderbd.com, captured via HTTrack — see the mirror comment at the bottom of `index.php`). Most CSS/JS under `assets/` is vendor/library code, not hand-written for this project:
  - Vendor CSS: `bootstrap.min.css`, `all.min.css` (**Font Awesome 5.15.3, free** — icon classes are `fa`/`fas`/`far`/`fab`, *not* FA6's `fa-solid`/`fa-regular`/`fa-brands`; using the FA6 prefix silently renders no glyph at all instead of erroring), `animate.min.css`, `owl.carousel*.css`, `jquery.fancybox.min.css`, `layerslider.css`, `template.css` (theme base styles).
  - Vendor JS: `jquery.min.js`, `bootstrap.bundle.min.js`, `greensock.js`, `layerslider.*.js`, `owl.carousel*.js`, `jquery.fancybox.min.js`, `mixitup.min.js`, `wow.js`.
  - Project-specific overrides live in `assets/css/style.css` and `assets/css/category/corporate-4.css` (page-specific tweaks layered on top of `template.css`), and `assets/js/custom.js` (binds carousels, accordions, nav scroll behavior, smooth-scroll anchors, etc. — see the comment block at the top of that file for an index of its responsibilities) plus `assets/js/custom-carousel.js`, `assets/js/map.scripts.js`.
  - When changing visual styling, prefer editing `assets/css/style.css` (or `category/corporate-4.css`) over the vendor/template CSS files.
- Images live under `assets/images/` (including `slider/`, `gallery/`, `words/`, `logo/`); fonts under `assets/webfonts/` (Font Awesome + a custom `flaticon` icon set).
- The hero banner uses the LayerSlider jQuery plugin (`#slider`), configured inline at the bottom of `index.php`.

## Deployment

- The site deploys to **Google App Engine** (`runtime: php82`, standard environment) per `cdmc-web-final/app.yaml`. All requests to `/` route to `index.php` via `script: auto`; static asset routes (`/assets/css/`, `/assets/images/`, `/assets/webfonts/`, `/assets/js/`) are served directly as static files per the `handlers` section.
- Deploy with `gcloud app deploy` from inside `cdmc-web-final/` (requires the `gcloud` CLI and an authenticated/configured GCP project — not preconfigured in this repo).
- `.gcloudignore` excludes `.git`, `.gitignore`, and `/vendor/` from the upload bundle.

## Working in this codebase

- To preview the site with the backend/login/notices/messages/admin features, run the `backend/` server (see "Running the backend locally" below) and visit `http://localhost:4000/`. To preview *only* the static front-end with no backend at all, any static file server works (e.g. `python3 -m http.server` from inside `cdmc-web-final/`) — but then the new login/notices/messages/admin pages won't function, only the original static sections will render.
- Because `index.php` is one large file containing every page section, use anchor IDs (e.g. `id="services"`, `id="governance"`) or section HTML comments (e.g. `<!-- services start -->` / `<!-- services end -->`) to locate the right section instead of scanning the whole file.

## Project scope

The repo root holds the engagement docs: `scope of project.pdf` (Letter of Commitment, ref `NYX-CDMC-2026-01`, Nyx Solutions → CDMC Sri Lanka) and `meeting minutes.txt` (follow-up clarifications: a second login-gated tab mirroring Notices' permissions, for "message of the day"-style audio content in multiple languages). The contracted features — login system, Notices tab, the second (audio message) tab, and an admin panel — are built and runnable locally; see "Backend" below. Final hosting (Supabase vs. DigitalOcean) is still undecided, so none of this is deployed anywhere yet — it only runs on `localhost`.

Per the meeting minutes, the client wants the existing front-end design left unchanged. The implementation reflects that: `index.php`'s existing markup/sections are untouched aside from a small additive nav block (Login button / user menu, hidden by default), and the new pages (`notices.html`, `messages.html`, `admin.html`) reuse the same header/footer chrome and Bootstrap classes rather than introducing new design language.

## Backend (login, notices, messages, admin)

`backend/` is a single Express app (`backend/src/app.js`) that does two things on one port: serves `cdmc-web-final/` as static files (so the whole site, old and new pages, is one origin — no CORS), and exposes a JSON API under `/api/*`. `index.php` itself has no PHP logic added — auth state is entirely client-side, via `assets/js/auth-nav.js` calling `GET /api/auth/me` on every page load and toggling nav visibility.

**Data store: SQLite, not Postgres.** The original plan called for Postgres via Docker (to match Supabase/DigitalOcean's managed databases with zero schema translation later), but Docker required `sudo`/group access not available in this environment. `backend/src/db/pool.js` is a thin shim that gives repositories a pg-style `pool.query(text, params)` API (`$1`-style placeholders, `{ rows }` results) while actually running against Node's built-in `node:sqlite` (`DatabaseSync`, no native deps, no install step). **This shim is the one place that needs rework when exporting to a real Postgres host** — the migration SQL (`backend/src/db/sql/*.sql`) is SQLite syntax (`INTEGER PRIMARY KEY AUTOINCREMENT`, `datetime('now')`, `BLOB`) and would need a Postgres equivalent (`BIGSERIAL`, `now()`, `BYTEA`).

**Sessions are in-memory** (`express-session`'s default `MemoryStore`, wired in `backend/src/auth/session.js`) — fine for local dev, but **sessions are lost on every server restart** and won't work across multiple processes. Swap in a persistent store (e.g. `connect-pg-simple` once on Postgres) before any real deployment.

**Schema** (`backend/src/db/sql/001_users.sql`, `002_content.sql`): `users` (username/email unique, `course_id` free text and explicitly non-unique, `role` user/admin, `password_hash`, `is_disabled`), `notices`, and `messages` + `message_audio_slots` (one row per language per message — language is free text, not a fixed enum; each slot is *either* an uploaded audio file stored as `BLOB` in the DB *or* an external URL, e.g. for YouTube video links — never both, enforced by a CHECK constraint). Notices and messages are deliberately separate tables, not a polymorphic one — messages need the per-language slot structure notices don't.

**Auth**: no public self-registration. `npm run seed:admin` (`backend/src/db/seed/seed_admin.js`) creates the first admin from `.env`'s `SEED_ADMIN_USERNAME`/`SEED_ADMIN_EMAIL` if none exists, prints the generated password once, and is a safe no-op afterward. Admin-created users (`POST /api/admin/users`) get an auto-generated password returned once in the response (never emailed — the client distributes it manually); users change their own password via `POST /api/auth/change-password`. `must_change_password` (set `true` on creation and on admin-triggered reset) is **enforced**, not just a UI hint: `assets/js/auth-nav.js`'s `maybeShowForcePasswordModal()` shows a non-dismissable `#forcePasswordModal` (no close button, `data-bs-backdrop="static"`, `data-bs-keyboard="false"`) on every page load while the flag is true, blocking interaction with the rest of the page until the user submits a new password. The modal markup is duplicated across all 4 HTML files (same pattern as `#loginModal`) since there's no templating layer.

**API**: session-cookie auth (no JWT). `/api/auth/*` (login/logout/me/change-password), `/api/notices` + `/api/messages` (paginated, any logged-in user), `/api/messages/:id/slots/:slotId/audio` (streams the BLOB with correct `Content-Type` — must wrap in `Buffer.from()` before `res.send()`, since `node:sqlite` returns `BLOB` columns as `Uint8Array`, which Express's static-binary detection doesn't recognize), and `/api/admin/*` (full CRUD on users/notices/messages, admin-only). Audio/URL slots are submitted as `multipart/form-data` with **flat field names** (`slot0LanguageLabel`, `slot0SourceType`, `slot0AudioFile` or `slot0ExternalUrl`, `slot1...`, `slot2...`) rather than bracketed array fields, to avoid fighting multer's form parsing.

**Frontend**: `notices.html`/`messages.html`/`admin.html` are plain static HTML (no build step) with page-specific vanilla/jQuery scripts (`assets/js/notices.js`, `messages.js`, `admin.js`) that `fetch()` the API directly. `messages.js` renders a pill-style language picker (Bootstrap's `btn-check` pattern: a visually-hidden radio + a `<label class="btn btn-outline-primary">` sibling) per message; selecting a language swaps an `<audio>` element's `src` (upload slots) or a clickable link (URL slots) — both come from the same `slot.playbackUrl` field so the frontend logic doesn't need to branch on `sourceType`, and both are set via jQuery's `.attr()` rather than string concatenation (see Security posture below). `admin.js` covers user management (add/disable/reset-password), notices CRUD, and messages CRUD (per-slot upload-or-URL inputs, toggled via a change handler since Bootstrap's `.d-flex` utility is `!important` and will silently override a plain inline `display:none` — visibility toggles in this codebase must add/remove the `d-none`/`d-flex` classes, not set inline styles).

**Theming the new pages (`auth.css`)**: the site's actual brand color is the CSS variable `--theme-primary-color` (olive, `#b3b07e`, defined in `category/corporate-4.css`) — *not* Bootstrap's default blue `--bs-primary`. Bootstrap's `.btn-primary`/`.btn-outline-primary`/`.nav-tabs .nav-link` etc. all render blue out of the box, and `--bs-primary` is never overridden, so any new markup using bare Bootstrap classes will look like unstyled boilerplate next to the rest of the site. `auth.css` recolors these, but **scoped to `.auth-page-section` and the two modal IDs (`#loginModal`, `#forcePasswordModal`)** rather than redefining `--bs-primary` globally — `index.php`'s original template markup also has a couple of pre-existing bare `.btn-primary`/`.text-primary` spots (e.g. the "About Me" tagline) that must stay exactly as the client received them. If you add a new Bootstrap-colored element to the auth pages, make sure it's inside `.auth-page-section` (or one of those modal IDs) or it won't pick up the brand color — and if you use the `btn-check` pattern, remember Bootstrap's checked/focus states for it are sibling-combinator selectors (`.btn-check:checked + .btn-outline-primary`, `.btn-check:focus + .btn-outline-primary`), so overriding plain `.btn-outline-primary:focus` alone won't catch them. Separately, the theme's own `.form-control { border: none; }` (in `template.css`) leaves inputs with no visible edge at all on a white background — `auth.css` restores a visible border scoped to `.auth-add-card` and the two modals.

### Running the backend locally

```
cd backend
npm install
cp .env.example .env          # already done in this checkout
npm run migrate                # applies backend/src/db/sql/*.sql, idempotent
npm run seed:admin              # creates the first admin if none exists, prints its password once
npm run dev                      # nodemon, or `npm start` for a plain node run
```

Serves the whole site (old and new pages) at the port in `.env` (default `4000`). Restarting the server clears all sessions (MemoryStore) — everyone has to log in again.

### Security posture

A cold (no-context) security audit plus manual review turned up and fixed several real issues — worth knowing before changing auth/session/upload code:

- **Login timing oracle (fixed)**: `verifyPasswordTimingSafe` in `backend/src/auth/passwords.js` always runs a bcrypt compare, even for a username that doesn't exist (against a fixed dummy hash), so response time can't be used to enumerate valid usernames. Don't reintroduce an early-return before the password check in `/api/auth/login`.
- **Session fixation (fixed)**: `/api/auth/login` calls `req.session.regenerate()` before setting `req.session.userId`, so a pre-set session ID can't become authenticated by riding along with a victim's login. Any future code that sets session data on privilege change (e.g. impersonation, role switch) should do the same.
- **Cookie `secure` flag (fixed)**: now driven by `config.cookieSecure` (`backend/src/config/env.js`), defaulting to `NODE_ENV === 'production'`, overridable via `COOKIE_SECURE`. Don't hardcode this back to `false`.
- **Last-admin lockout (fixed)**: `PATCH /api/admin/users/:id` (`backend/src/routes/users.routes.js`) refuses to demote-or-disable the last remaining active admin (`usersRepo.countActiveAdmins()`). Keep this check if `updateUser` logic changes.
- **Stored XSS in Messages (fixed)**: `assets/js/messages.js`'s `renderPlayer()` used to string-concatenate `slot.playbackUrl` (an admin-supplied external URL for `url`-type slots) directly into an `href`/`src` attribute. The page's `escapeHtml()` helper only escapes `& < >` for text-node content — it does **not** escape quotes, so it's unsafe for attribute-value contexts and a `"` in the URL could break out and add a live event-handler attribute. Fixed by building those elements via jQuery's `.attr()` (real DOM API, not string parsing) instead of string concatenation. **If you add new attribute interpolation anywhere in the frontend JS, use `.attr()`/`.prop()`, not string concatenation with `escapeHtml()`** — that helper is text-node-safe only.
- **Rate limiting (added)**: `backend/src/auth/rateLimit.js` — `loginLimiter`/`changePasswordLimiter` (10 req/15min/IP) on `/api/auth/login` and `/api/auth/change-password`, plus a baseline `apiLimiter` (300 req/15min/IP) on all of `/api/*`. Limits are in-memory (reset on restart), same caveat as sessions.
- **Security headers (added)**: `helmet()` is wired in `backend/src/app.js` with `contentSecurityPolicy` explicitly disabled — the legacy template (`index.php` and friends) relies on inline `<script>`/`<style>` throughout, so a real CSP would require rewriting that markup, which is out of scope (client wants the existing design untouched). Other headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) are on. `x-powered-by` is disabled.
- **`Content-Disposition` filename (fixed)**: the audio-streaming endpoint now strips quotes/control characters from the user-supplied original filename before putting it in a header value (`backend/src/routes/messages.routes.js`).
- **External URL scheme validation (added)**: `parseSlotsFromRequest` in `backend/src/routes/messages.routes.js` rejects anything that isn't `http://`/`https://` for `url`-type slots (defense in depth alongside the XSS fix above).
- **Dependency**: swapped `bcrypt` → `bcryptjs` (pure JS, same hash/compare API) to drop a native-build dependency chain that pulled in a vulnerable `tar` version. `npm audit` is clean.
- Not done, deliberately: CSRF tokens (the session cookie's `sameSite: 'lax'` already blocks the common cross-site POST vector; revisit if that ever changes) and magic-byte verification on uploaded audio files (admin-only upload path, low priority).

## Hosting

- The original site is configured for Google App Engine (see `cdmc-web-final/app.yaml`, `runtime: php82`), but the client is also evaluating hosting outside Google Cloud (Supabase or DigitalOcean) for the new backend — undecided as of this writing. The Node backend above is not deployed anywhere; it only runs locally. Don't assume GAE-specific constraints (`app.yaml` handlers, PHP runtime) apply to the new backend's eventual host.
- Whichever host is chosen, exporting `backend/` means: (1) swap `backend/src/db/pool.js` and the migration SQL from SQLite to Postgres, (2) swap the session store from `MemoryStore` to a persistent one, (3) point `DATABASE_URL`-equivalent env vars at the managed DB. The route/repository/auth code itself shouldn't need to change.
