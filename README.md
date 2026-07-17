# Nyx Solutions — Client Portal

Full-stack client portal: announcements, subscriptions, maintenance quota/tickets,
invoices (with publish/paid workflow and downloadable HTML invoices), client
documents, and a contact form — with an admin side for managing all of it plus
client accounts.

## Stack

- **Backend:** Node.js + Express, `node:sqlite` (built-in, no native deps to
  compile), `express-session` with a persistent SQLite-backed store (logins
  survive server restarts and stay signed in until sign-out), `bcryptjs` for
  password hashing, `multer` for document uploads (stored in SQLite as blobs).
- **Frontend:** Plain HTML/CSS/JS single-page app (no build step, no
  framework) — dark mode by default with a light mode toggle, purple / light
  blue / orange accent palette, minimalist SAP Fiori–style layout (left nav +
  top bar + cards).

## Setup

```bash
cd backend
npm install
cp .env.example .env      # edit SESSION_SECRET at minimum
npm run migrate
npm run seed:admin        # prints the initial admin username + password once
npm start                 # http://localhost:4000
```

The frontend is served directly by the backend (static files in `../frontend`),
so there's nothing separate to build or deploy — one process, one port.

Forgot the admin password? `npm run admin:reset-password <username>`.

## Project layout

```
backend/
  src/
    config/env.js          Environment config
    db/
      pool.js               node:sqlite wrapped in a pg-style query() API
      migrate.js             Applies src/db/sql/*.sql in order, once each
      sql/                    Schema migrations
      seed/                   Admin seeding / password reset scripts
    auth/                   Sessions, password hashing, route guards
    repositories/            One file per feature — all SQL lives here
    routes/                  One file per feature — HTTP layer only
    upload/multer.config.js  Document upload handling
    app.js / server.js
frontend/
  login.html
  portal.html               Single shell; all sections are client-side routed
  assets/css/theme.css       Dark/light theme (CSS variables)
  assets/js/
    api.js                   fetch() wrapper + formatting helpers
    theme.js                 Dark/light mode toggle (persisted)
    login.js
    portal.js                All section rendering + admin management UI
```

## Notes on a few design choices

- **Invoices "download"** produces a clean, self-contained printable HTML
  file (styled, itemized, with a total and due date) rather than a real PDF —
  there's no PDF library dependency here, and "Print → Save as PDF" from that
  page gets you a PDF in two clicks if you need the file format specifically.
- **Maintenance quota** is a single numeric "hours" (or any unit you like)
  pool per client; each request records how many hours it consumed once
  resolved, and the usage bar is just `used / quota_total`.
- **Documents** are stored as blobs directly in SQLite (same pattern as audio
  in a sibling project) — fine for a handful of clients; move to disk/object
  storage if document volume grows large.
- **Sessions** are rolling and long-lived (a device stays logged in until it
  explicitly signs out), backed by a `sessions` table in the same SQLite file
  — no separate session store to run.
