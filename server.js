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
app.use(express.json({ limit: '1mb' }));

// ── Health check ──────────────────────────────────────────────
//   /healthz returns 200 if both the process AND the DB are reachable.
app.get('/healthz', async (_req, res) => {
  const dbOk = await isHealthy();
  if(!dbOk) return res.status(503).json({ ok: false, db: false });
  res.json({ ok: true, db: true, ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/admin', adminRoutes);

// 404 for any unknown /api/* path (don't fall through to the SPA)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ── Static front-end ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  extensions: ['html']
}));

// SPA fallback — any other route serves index.html
app.get('*', (_req, res) => {
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
