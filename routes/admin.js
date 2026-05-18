// ══════════════════════════════════════════════════════════════
//  /api/admin — consultant-only endpoints to manage tenants + users
//
//  Used by you (the consultant) to:
//    - Create a new tenant (client business)
//    - Create a new user (assign to a tenant)
//    - List tenants and users
//    - Reset a user's password
// ══════════════════════════════════════════════════════════════
const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { pool } = require('../db');
const { requireAuth, requireConsultant } = require('../middleware/auth');

const router = express.Router();

// All admin routes require an authenticated consultant
router.use(requireAuth, requireConsultant);

// ── Tenants ─────────────────────────────────────────────────────

// GET /api/admin/tenants — list all tenants
router.get('/tenants', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
              (SELECT updated_at FROM app_state s WHERE s.tenant_id = t.id) AS last_state_update
         FROM tenants t
         ORDER BY t.created_at DESC`
    );
    res.json({ tenants: r.rows });
  } catch(err){
    console.error('GET /tenants error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/admin/tenants  body: { id?: 'easy-travel', name: 'Easy Travel Leeds' }
router.post('/tenants', async (req, res) => {
  const name = String(req.body?.name||'').trim();
  if(!name){ return res.status(400).json({ error: 'name_required' }); }
  let id = String(req.body?.id||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
  if(!id){
    id = name.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0, 50) || ('tenant-'+Date.now());
  }
  try {
    await pool.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2)`,
      [id, name]
    );
    res.json({ tenant: { id, name } });
  } catch(err){
    if(err.code === '23505'){
      return res.status(409).json({ error: 'tenant_id_exists' });
    }
    console.error('POST /tenants error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Users ───────────────────────────────────────────────────────

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.role, u.tenant_id, u.display_name,
              u.created_at, u.last_login_at,
              t.name AS tenant_name
         FROM users u
         LEFT JOIN tenants t ON t.id = u.tenant_id
         ORDER BY u.created_at DESC`
    );
    res.json({ users: r.rows });
  } catch(err){
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/admin/users
//   body: { email, password, role: 'consultant'|'client_user', tenantId?, displayName? }
router.post('/users', async (req, res) => {
  const email       = String(req.body?.email||'').trim().toLowerCase();
  const password    = String(req.body?.password||'');
  const role        = String(req.body?.role||'').trim();
  const tenantId    = req.body?.tenantId ? String(req.body.tenantId).trim() : null;
  const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null;

  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({ error: 'valid_email_required' });
  }
  if(!password || password.length < 8){
    return res.status(400).json({ error: 'password_min_8' });
  }
  if(!['consultant','client_user'].includes(role)){
    return res.status(400).json({ error: 'invalid_role' });
  }
  if(role === 'client_user' && !tenantId){
    return res.status(400).json({ error: 'tenant_required_for_client_user' });
  }

  try {
    if(tenantId){
      const t = await pool.query(`SELECT 1 FROM tenants WHERE id = $1`, [tenantId]);
      if(!t.rows.length){ return res.status(404).json({ error: 'tenant_not_found' }); }
    }

    const id   = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, tenant_id, role, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, hash, tenantId, role, displayName]
    );
    res.json({ user: { id, email, role, tenantId, displayName } });
  } catch(err){
    if(err.code === '23505'){
      return res.status(409).json({ error: 'email_exists' });
    }
    console.error('POST /users error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/admin/users/:id/reset-password  body: { password }
router.post('/users/:id/reset-password', async (req, res) => {
  const id       = req.params.id;
  const password = String(req.body?.password||'');
  if(!password || password.length < 8){
    return res.status(400).json({ error: 'password_min_8' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, id]
    );
    if(r.rowCount === 0){ return res.status(404).json({ error: 'user_not_found' }); }
    res.json({ ok: true });
  } catch(err){
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
