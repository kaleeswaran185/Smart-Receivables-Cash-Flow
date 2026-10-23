import express from 'express';
import { createToken, verifyToken, extractToken, getOwnerCredentials, isDemoMode } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/auth/config
 * Returns demo mode configuration for the UI login page
 */
router.get('/config', (req, res) => {
  const creds = getOwnerCredentials();
  res.json({
    demo_mode: isDemoMode(),
    owner_email: creds.rawEmail
  });
});

/**
 * POST /api/auth/login
 * Verifies owner credentials and issues a signed session token.
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
  }

  const creds = getOwnerCredentials();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail !== creds.email || password !== creds.password) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  }

  const token = createToken({ email: creds.rawEmail, role: 'owner' });

  // Set httpOnly session cookie
  res.cookie('baaki_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token,
    user: { email: creds.rawEmail, role: 'owner' }
  });
});

/**
 * POST /api/auth/demo-login
 * Single-click login when DEMO_MODE=true
 */
router.post('/demo-login', (req, res) => {
  if (!isDemoMode()) {
    return res.status(403).json({ error: 'DEMO_MODE_DISABLED', message: 'Demo one-click login is disabled' });
  }

  const creds = getOwnerCredentials();
  const token = createToken({ email: creds.rawEmail, role: 'owner', demo: true });

  res.cookie('baaki_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token,
    user: { email: creds.rawEmail, role: 'owner', demo: true }
  });
});

/**
 * GET /api/auth/me
 * Checks currently active session
 */
router.get('/me', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false, message: 'Not logged in' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ authenticated: false, message: 'Session expired or invalid' });
  }

  res.json({
    authenticated: true,
    user
  });
});

/**
 * POST /api/auth/logout
 * Clears session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('baaki_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
