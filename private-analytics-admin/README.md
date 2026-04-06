# Private Analytics Admin

Private frontend for the standalone analytics service.

## Features

- admin login
- real-time live activity overview
- daily course/user summary
- Excel export button

## Run locally

1. Copy `.env.example` to `.env.local`
2. Set `NEXT_PUBLIC_PRIVATE_ANALYTICS_URL`
3. Default private admin login is `admin / admin` unless changed in the service env
4. Start:

```bash
npm install
npm run dev
```

## Expected backend

This dashboard expects the private analytics service generated beside it in:

- `../private-analytics-service`
