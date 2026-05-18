// ══════════════════════════════════════════════════════════════
//  Workplace Inspection System — server
//  Phase A: serves the static front-end only.
//  Phase B will add auth + per-tenant API endpoints here.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// Health check — Render uses this to know the service is alive
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Serve the front-end from public/
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  extensions: ['html']
}));

// SPA fallback — any unknown route serves index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Workplace Inspection System listening on http://${HOST}:${PORT}`);
});
