// ══════════════════════════════════════════════════════════════
//  /api/state — per-tenant state load and save
//
//  Every state read/write is scoped to req.user.tenantId.
//  Consultants without a tenant_id need to pick a tenant via
//  ?tenantId=xxx query param (admin UI in Phase B+).
// ══════════════════════════════════════════════════════════════
const express  = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { mergeAppState } = require('../lib/mergeState');

const router = express.Router();

// Resolve which tenant the request is acting on.
// - client_user: always their own tenant_id, ignores query.
// - consultant: must pass ?tenantId=... (or it'd be ambiguous).
function _resolveTenant(req){
  if(req.user.role === 'client_user'){
    return req.user.tenantId || null;
  }
  // consultant
  return (req.query?.tenantId || req.body?.tenantId || '').toString() || null;
}

// GET /api/state[?tenantId=xxx]  (tenantId required for consultants)
router.get('/', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId){
    return res.status(400).json({ error: 'tenant_required' });
  }
  try {
    const r = await pool.query(
      `SELECT state, updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if(!r.rows.length){
      // No state yet — return empty state so frontend can seed it
      return res.json({ tenantId, state: null, updatedAt: null });
    }
    res.json({
      tenantId,
      state:     r.rows[0].state,
      updatedAt: r.rows[0].updated_at
    });
  } catch(err){
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/state/version[?tenantId=xxx] — just the last-saved time, so open
// tabs can check cheaply whether another device has saved something new.
router.get('/version', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId){
    return res.status(400).json({ error: 'tenant_required' });
  }
  try {
    const r = await pool.query(
      `SELECT updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    res.json({ tenantId, updatedAt: r.rows[0]?.updated_at || null });
  } catch(err){
    console.error('GET /api/state/version error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/state  body: { state: {...}, tenantId?: 'xxx', replace?: true }
//
// By default the posted state is MERGED into what the server holds (see
// lib/mergeState.js), so a device with an out-of-date copy can't wipe records
// saved from another device. `replace: true` overwrites outright — used only
// by the deliberate "Reset app data" action.
//
// If the merge kept anything the sender didn't have, the merged state is sent
// back so the sender can catch up; otherwise the reply stays small.
router.post('/', requireAuth, express.json({ limit: '50mb' }), async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId){
    return res.status(400).json({ error: 'tenant_required' });
  }
  const state = req.body?.state;
  if(!state || typeof state !== 'object'){
    return res.status(400).json({ error: 'state_object_required' });
  }
  const replace = req.body?.replace === true;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify the tenant exists (and the user is allowed to write to it)
    const t = await client.query(`SELECT 1 FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if(!t.rows.length){
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'tenant_not_found' });
    }
    if(req.user.role === 'client_user' && req.user.tenantId !== tenantId){
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'forbidden' });
    }

    let toStore  = state;
    let fromBase = false;
    if(!replace){
      // Lock the row so two devices saving at once merge one after the other.
      const cur = await client.query(
        `SELECT state FROM app_state WHERE tenant_id = $1 FOR UPDATE`,
        [tenantId]
      );
      const existing = cur.rows[0]?.state;
      if(existing && typeof existing === 'object' && Object.keys(existing).length){
        const m = mergeAppState(existing, state);
        toStore  = m.state;
        fromBase = m.fromBase;
      }
    }

    const r = await client.query(
      `INSERT INTO app_state (tenant_id, state, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE
         SET state = EXCLUDED.state,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [tenantId, JSON.stringify(toStore), req.user.id]
    );
    await client.query('COMMIT');

    const out = { ok: true, tenantId, updatedAt: r.rows[0].updated_at };
    if(fromBase) out.state = toStore;
    res.json(out);
  } catch(err){
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /api/state error:', err);
    if(err.code === '54000' || /size/i.test(err.message)){
      return res.status(413).json({ error: 'state_too_large' });
    }
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

module.exports = router;
