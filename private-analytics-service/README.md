# Private Analytics Service

Standalone private backend for:

- ingesting study activity from the public NPTEL Hub backend
- serving user progress summaries back to the public backend
- powering a private admin dashboard
- exporting daily analytics as Excel

## Expected flow

1. Public backend receives study heartbeats from the learner-facing app.
2. Public backend forwards them here when `PRIVATE_ANALYTICS_BASE_URL` and `PRIVATE_ANALYTICS_SHARED_SECRET` are set.
3. Private admin frontend logs into this service directly for live stats and exports.

## Run locally

1. Copy `.env.example` to `.env`
2. Set `PRIVATE_ANALYTICS_SHARED_SECRET`
3. Use the same secret in the public backend env
4. Default admin login is `admin / admin` unless you change it in `.env`
5. Start with:

```bash
npm install
npm run dev
```

## Main endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/ingest/study-activity`
- `GET /api/summary/me/today`
- `GET /api/summary/admin/live`
- `GET /api/summary/admin/daily`
- `GET /api/export/admin/daily.xlsx`
