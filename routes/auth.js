// ══════════════════════════════════════════════════════════════
//  /api/auth — login, logout, me
// ══════════════════════════════════════════════════════════════
const express  = require('express');
const bcrypt   = require('bcryptjs');
const { pool } = require('../db');
const {
  signSession, setSessionCookie, clearSessionCookie, requireAuth
} = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const email    = String(req.body?.email||'').trim().toLowerCase();
  const password = String(req.body?.password||'');

  if(!email || !password){
    return res.status(400).json({ error: 'email_and_password_required' });
  }

  try {
    const r = await pool.query(
      `SELECT id, email, password_hash, tenant_id, role, display_name
         FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );
    if(!r.rows.length){
      // Same shape of response as wrong-password so attackers can't enumerate users
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const user = r.rows[0];
    const ok   = await bcrypt.compare(password, user.password_hash);
    if(!ok){
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Record login time (best-effort, don't block response)
    pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])
      .catch(err => console.warn('Failed to update last_login_at:', err.message));

    const token = signSession(user);
    setSessionCookie(res, token);
    res.json({
      user: {
        id:       user.id,
        email:    user.email,
        role:     user.role,
        tenantId: user.tenant_id,
        name:     user.display_name
      }
    });
  } catch(err){
    console.error('Login error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me — returns current user (or 401 if not logged in)
router.get('/me', requireAuth, async (req, res) => {
  // Re-read from DB so we get the latest tenant + role (in case of recent changes)
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.tenant_id, u.role, u.display_name,
              t.name AS tenant_name
         FROM users u
         LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = $1 LIMIT 1`,
      [req.user.id]
    );
    if(!r.rows.length){
      clearSessionCookie(res);
      return res.status(401).json({ error: 'user_not_found' });
    }
    const u = r.rows[0];
    res.json({
      user: {
        id:         u.id,
        email:      u.email,
        role:       u.role,
        tenantId:   u.tenant_id,
        tenantName: u.tenant_name,
        name:       u.display_name
      }
    });
  } catch(err){
    console.error('/me error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
