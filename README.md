# Workplace Inspection System

Archer H&S — multi-tenant web app for workplace inspections, action tracking, and compliance reporting.

## Local development

```bash
npm install
npm start
```

Then open http://localhost:3000

## Project structure

```
.
├── server.js          # Express server (entry point)
├── package.json
├── .env.example       # Copy to .env for local dev
├── public/
│   └── index.html     # The application front-end
└── README.md
```

## Deployment (Render)

Per `Archer_HS_Render_GoLive_SOP.docx`:

- **Service type**: Web Service (Starter plan, EU region)
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Node version**: 18+ (auto-detected from package.json `engines`)
- **Health check path**: `/healthz`
- **Environment variables**: see `.env.example`

The server binds to `0.0.0.0` on the port supplied by `process.env.PORT`, as required by Render.

## Phase roadmap

- **Phase A** ✅ — Static deploy: serve the front-end as-is, validate the deploy pipeline.
- **Phase B** — Auth (email + password) + per-tenant state API endpoints.
- **Phase C** — Persistent storage (Render Postgres or Disk).
- **Phase D** — Custom domain + onboard first client.

## Owner

Simon Archer — Archer H&S
