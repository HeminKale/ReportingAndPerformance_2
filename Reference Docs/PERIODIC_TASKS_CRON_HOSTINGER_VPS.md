# Periodic tasks cron on a Hostinger VPS (no Vercel)

This guide explains how to run **`/api/cron/periodic-tasks`** on a **VPS** (e.g. Hostinger) so manager periodic templates materialize into `tasks` on a schedule. The **application code** is the same as on Vercel; only **hosting and scheduling** change.

**Canonical behavior** (what the cron does): [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md).

---

## What you do *not* rely on on a VPS

| On Vercel | On Hostinger VPS |
|-----------|------------------|
| `vercel.json` `crons` | **Ignored** unless you also deploy to Vercel. Schedule with **Linux `cron`** or **`systemd` timer** instead. |
| Vercel injecting `Authorization: Bearer <CRON_SECRET>` | **You** must send that header in `curl` (or your script). |
| Vercel Deployment Protection / bypass | Usually **N/A**; use **firewall + HTTPS** and keep `CRON_SECRET` secret. |

**Repo files you do *not* need to edit** for VPS-only cron:

- `app/api/cron/periodic-tasks/route.ts` — already correct; same URL path.
- `lib/cron/periodic-tasks-materialize.ts` — shared logic; no VPS-specific change.

**Optional:** If the project **never** deploys to Vercel, you may **delete or ignore** `vercel.json`. Leaving it in the repo is harmless if you still use Vercel for previews.

---

## What must be true on the VPS

1. **Next.js app is running in production**  
   Example: `npm run build` then `npm run start` (port **3000** is common), or **PM2** / systemd wrapping the same.

2. **Environment variables** available to the Node process (e.g. `.env` in app directory, or systemd `EnvironmentFile=`):

   | Variable | Required for cron route |
   |----------|-------------------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | Yes |
   | `CRON_SECRET` | Yes (your own long random string; same value you send in `curl`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes for the rest of the app (auth, UI) |

   Same set you would set on Vercel for a working app + cron.

3. **Reachable URL** for the app  
   - **Public:** `https://your-domain.com` (e.g. Nginx reverse proxy → `127.0.0.1:3000`).  
   - **Private:** Cron can call **`http://127.0.0.1:3000`** if `curl` runs **on the same machine** as the app (recommended: no need to expose the cron path publicly).

---

## Schedule materialization with Linux cron

Use the same path as in the repo: **`/api/cron/periodic-tasks`**.

### 1. Pick a schedule (UTC or server local)

`crontab` uses the **server’s** time zone unless you set `TZ=` in the crontab line. Examples:

```cron
# Every day at 06:00 (server clock)
0 6 * * * /opt/reporting-app/scripts/run-periodic-cron.sh

# Twice a day (example)
0 6,18 * * * /opt/reporting-app/scripts/run-periodic-cron.sh
```

Unlike Vercel Hobby, **your** VPS can run **hourly** if you want tighter alignment with org calendar days:

```cron
0 * * * * /opt/reporting-app/scripts/run-periodic-cron.sh
```

### 2. Use a small shell script (keeps secrets out of global crontab)

Create **`/opt/reporting-app/scripts/run-periodic-cron.sh`** (adjust paths):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load secrets (chmod 600 this file; owned by deploy user)
source /opt/reporting-app/.env.cron

# If Next.js listens only on localhost:
curl -sS -o /tmp/periodic-cron-last.json -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:3000/api/cron/periodic-tasks"
```

**`/opt/reporting-app/.env.cron`** (example — no quotes needed if no spaces):

```bash
CRON_SECRET=your-long-random-secret-matching-the-app-env
```

On the VPS, **`CRON_SECRET`** in the **Node process environment** (e.g. main `.env`) must **equal** the value in `.env.cron` used for `curl`.

```bash
chmod 700 /opt/reporting-app/scripts/run-periodic-cron.sh
chmod 600 /opt/reporting-app/.env.cron
```

### 3. Install the crontab

As the user that should run the job (not necessarily root):

```bash
crontab -e
```

Add the line pointing at your script. Ensure **`curl`** is installed (`sudo apt install curl` on Ubuntu).

### 4. Verify

Manual run:

```bash
/opt/reporting-app/scripts/run-periodic-cron.sh
cat /tmp/periodic-cron-last.json
```

Expect JSON like `{"ok":true,"templatesProcessed":...}`. **401** = wrong or missing `CRON_SECRET` in the header or mismatch with app env. **500** = missing Supabase URL/service key on the server.

---

## Nginx + HTTPS (typical Hostinger setup)

1. Point DNS to the VPS.
2. Nginx `server_name` + `proxy_pass http://127.0.0.1:3000` for your site.
3. TLS via Let’s Encrypt (Certbot).

Cron can still use **`http://127.0.0.1:3000`** from the server so the cron URL is not exposed on the public internet.

---

## PM2 (optional but common)

```bash
cd /path/to/app
npm ci
npm run build
pm2 start npm --name "reporting" -- start
pm2 save
pm2 startup   # follow instructions for reboot persistence
```

Ensure PM2 loads env (e.g. `ecosystem.config.cjs` with `env: { CRON_SECRET: '...', ... }` or `dotenv`).

---

## Manager “instant” materialize on create

**`POST /api/manager/periodic-tasks/materialize`** runs in the **browser** when a manager saves a new periodic template. It only needs the **same** production app URL and **`SUPABASE_SERVICE_ROLE_KEY`** on the server (already required for cron). **No extra VPS cron** for that path.

---

## Checklist summary

| Step | Action |
|------|--------|
| 1 | Deploy app to VPS; `npm run build` + `npm run start` or PM2. |
| 2 | Set `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, anon key for the running process. |
| 3 | Add `cron` (or systemd timer) calling `curl` to `http://127.0.0.1:3000/api/cron/periodic-tasks` with `Authorization: Bearer $CRON_SECRET`. |
| 4 | Test script manually; check JSON and Supabase `tasks` / `manager_periodic_dispatches`. |
| 5 | Ignore `vercel.json` for scheduling on VPS (or remove if no Vercel). |

---

## Related docs

- [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md) — period keys, daily/weekly/monthly behavior, employee UX  
- [DEPLOYMENT.md](DEPLOYMENT.md) — general env checklist  
- [SELECTIVE_PERIODIC_TASK_ASSIGNMENT.md](SELECTIVE_PERIODIC_TASK_ASSIGNMENT.md) — `assigned_user_ids`

---

*Hostinger-specific: use their VPS SSH, Ubuntu template, and optional Nginx stack as offered in hPanel; the steps above apply to any Linux VPS.*
