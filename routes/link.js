// ══════════════════════════════════════════════════════════════
//  /api/link — service-token read access for linked apps
//
//  Lets a sibling app (Compass) pull a tenant's state server-to-server.
//  Auth is a single shared secret in LINK_SERVICE_TOKEN (set in Coolify,
//  never committed, never sent to any browser), checked with a
//  constant-time compare. Read-only: there is no write route here, and
//  existing cookie auth and routes are untouched.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const crypto  = require('crypto');
const { pool } = require('../db');

const router = express.Router();

function checkToken(req){
  const configured = process.env.LINK_SERVICE_TOKEN || '';
  if(configured.length < 32){
    return { ok: false, code: 503, error: 'link_not_configured' };
  }
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if(!m) return { ok: false, code: 401, error: 'missing_token' };
  const given = Buffer.from(m[1], 'utf8');
  const want  = Buffer.from(configured, 'utf8');
  if(given.length !== want.length || !crypto.timingSafeEqual(given, want)){
    return { ok: false, code: 401, error: 'bad_token' };
  }
  return { ok: true };
}

// GET /api/link/state?tenantId=xxx — same payload shape as GET /api/state.
router.get('/state', async (req, res) => {
  const t = checkToken(req);
  if(!t.ok) return res.status(t.code).json({ error: t.error });

  const tenantId = String(req.query?.tenantId || '').trim();
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });

  try {
    const exists = await pool.query(`SELECT 1 FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if(!exists.rows.length) return res.status(404).json({ error: 'tenant_not_found' });

    const r = await pool.query(
      `SELECT state, updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if(!r.rows.length){
      return res.json({ tenantId, state: null, updatedAt: null });
    }
    res.json({ tenantId, state: r.rows[0].state, updatedAt: r.rows[0].updated_at });
  } catch(err){
    console.error('GET /api/link/state error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
