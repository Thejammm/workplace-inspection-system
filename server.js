// ══════════════════════════════════════════════════════════════
//  Workplace Inspection System — server (Phase B)
//
//  - Serves the front-end from public/
//  - Postgres-backed per-tenant state
//  - Email/password auth with JWT in httpOnly cookie
//  - Bootstrap creates a consultant user on first run
// ══════════════════════════════════════════════════════════════
const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { migrate, isHealthy } = require('./db');
const { bootstrap }          = require('./bootstrap');
const authRoutes             = require('./routes/auth');
const stateRoutes            = require('./routes/state');
const adminRoutes            = require('./routes/admin');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// Trust Render's proxy so req.protocol / req.ip work correctly
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────
app.use(cookieParser());

// JSON body parsing (state route overrides with a larger limit)
app.use(express.json({ limit: '50mb' }));

// ── Health check ──────────────────────────────────────────────
//   /healthz returns 200 if both the process AND the DB are reachable.
app.get('/healthz', async (_req, res) => {
  const dbOk = await isHealthy();
  if(!dbOk) return res.status(503).json({ ok: false, db: false });
  res.json({ ok: true, db: true, ts: new Date().toISOString() });
});

// ── Server time ───────────────────────────────────────────────
//   /api/time returns the authoritative server clock so the front-end can
//   stamp inspections and fill date fields from a single source of truth
//   rather than each device's (possibly wrong) local clock. Returns UTC ISO;
//   the browser converts to Europe/London for display. No auth needed — it
//   discloses nothing sensitive and is called before/independently of login.
app.get('/api/time', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ now: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/link',  require('./routes/link'));   // service-token read for linked apps (Compass)

// 404 for any unknown /api/* path (don't fall through to the SPA)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ── Static front-end ──────────────────────────────────────────
// HTML is always revalidated so deploys are picked up immediately by the
// browser. Static assets (none yet, but future JS/CSS/images) still get
// short-cached so the page is fast.
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if(/\.html$/i.test(filePath)){
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

// SPA fallback — any other route serves index.html (also no-cache)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Startup sequence ──────────────────────────────────────────
(async () => {
  try {
    await migrate();
    await bootstrap();
    app.listen(PORT, HOST, () => {
      console.log(`✓ Workplace Inspection System listening on http://${HOST}:${PORT}`);
    });
  } catch(err){
    console.error('FATAL: startup failed:', err);
    process.exit(1);
  }
})();
