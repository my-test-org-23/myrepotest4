# When Are You Free? — Event Availability Scheduler

A small, mobile-first web app for collecting everyone's availability for **one
event** and surfacing the times that work for the most people.

- **One event, July 2026.** The whole month is shown as a calendar. Tap a day,
  pick the hours you're free, save, and repeat for other days.
- **Suggested times.** Once people mark availability, the app shows the slots
  where the most (ideally _everyone_) can meet.
- **Dead-simple auth.** Share one **access code** with participants — they type
  it, enter their name, and they're in. A separate **admin code** opens a
  read-only dashboard of everyone and their picks.
- **Runs anywhere.** A single Node process serves the API _and_ the site from a
  tiny SQLite file — ideal for a short-lived deployment on a VPS.

The UI is built to adapt to any phone: fluid CSS grids, `clamp()`-based sizing,
safe-area insets, 44px+ tap targets, and automatic light/dark mode. Verified
with no horizontal overflow down to 320px-wide screens.

---

## Tech stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | React 18 + TypeScript + Vite, hand-rolled responsive CSS      |
| Backend  | Node + Express + TypeScript                                   |
| Database | SQLite (`better-sqlite3`) — one file, zero external services  |
| Auth     | Shared codes → opaque bearer tokens stored in the DB          |

```
web/      React + TypeScript single-page app
server/   Express API (also serves the built SPA in production)
deploy/   Sample systemd unit + Nginx config for the VPS
scripts/  build.sh — one command to build everything for prod
```

---

## Run it locally

Two terminals (the Vite dev server proxies `/api` to the API):

```bash
# Terminal 1 — API on :4000
cd server
cp .env.example .env      # optional; defaults work out of the box
npm install
npm run dev

# Terminal 2 — web on :5173
cd web
npm install
npm run dev
```

Open http://localhost:5173.

- Participant: code `JULY2026`, then enter any name.
- Admin dashboard: code `ADMIN2026`.

(Change these via the env vars below before going public.)

---

## Configuration (env vars, read by the API)

| Variable          | Default             | Purpose                                       |
| ----------------- | ------------------- | --------------------------------------------- |
| `PORT`            | `4000`              | Port the API listens on                       |
| `ACCESS_CODE`     | `JULY2026`          | Code participants type to sign in             |
| `ADMIN_CODE`      | `ADMIN2026`         | Code that unlocks the admin dashboard         |
| `EVENT_TITLE`     | `Team Get-Together` | Name shown at the top                         |
| `DB_PATH`         | `server/data/…db`   | Where the SQLite file lives                   |
| `SLOT_START_HOUR` | `7`                 | First selectable hour (inclusive)             |
| `SLOT_END_HOUR`   | `23`                | End hour (exclusive) → last slot is 22:00     |
| `CORS_ORIGIN`     | `*`                 | Allowed origins; `*` is fine for same-origin  |

> The event month is fixed to **July 2026** in `server/src/config.ts`.

---

## Deploy to a VPS (with HTTPS)

1. **Build everything** (compiles the API and bundles the frontend into
   `server/public`, so one process serves both):

   ```bash
   ./scripts/build.sh
   ```

2. **Copy to the server**, e.g. `/opt/scheduler`, and install the systemd unit
   from `deploy/scheduler.service` (edit the codes/paths first):

   ```bash
   sudo cp deploy/scheduler.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now scheduler
   ```

   The API now serves the whole app on `127.0.0.1:4000`.

3. **Put Nginx in front and add HTTPS.** Use `deploy/nginx.conf.example` (set
   your domain), then let certbot issue the certificate:

   ```bash
   sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/scheduler
   sudo ln -s /etc/nginx/sites-available/scheduler /etc/nginx/sites-enabled/
   sudo certbot --nginx -d your-domain.example.com
   sudo systemctl reload nginx
   ```

Once your public domain is ready, point it at the VPS and run the certbot step —
nothing in the app is hard-coded to a domain, so no code changes are needed.

---

## API reference

All authenticated requests send `Authorization: Bearer <token>`.

| Method | Path                       | Auth          | Description                                    |
| ------ | -------------------------- | ------------- | ---------------------------------------------- |
| GET    | `/api/meta`                | none          | Event info, the month's dates, selectable hours |
| POST   | `/api/auth`                | none          | `{code, name?}` → `{token, isAdmin, name}`     |
| GET    | `/api/me`                  | token         | Who the token belongs to (restores sessions)   |
| POST   | `/api/logout`              | token         | Invalidate the token                           |
| GET    | `/api/availability`        | participant   | Your picks, grouped by date                    |
| PUT    | `/api/availability/:date`  | participant   | `{hours: number[]}` — replace one day's picks  |
| GET    | `/api/overlap`             | any signed-in | Every used slot with counts + who's free       |
| GET    | `/api/admin/summary`       | admin         | All participants and their availability         |

### Data model

- `users(id, name unique, created_at)`
- `sessions(token, user_id, is_admin, created_at)`
- `availability(user_id, date, hour)` — one row per free hour, unique per user

---

## Notes & possible next steps

- Auth is intentionally lightweight (shared codes) per the brief — fine for a
  one-day gathering, not for anything sensitive.
- To reset all data, stop the service and delete the SQLite file at `DB_PATH`.
- Natural extensions: multiple events, timezone handling, exporting the winning
  slot to a calendar invite.
