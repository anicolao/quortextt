// Authentication routes for Discord OAuth
import express from 'express';
import rateLimit from 'express-rate-limit';
import passport from '../auth/passport-config.js';
import { generateToken, authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { UserStore } from '../models/User.js';

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for authenticated endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Discord OAuth routes
router.get('/discord', 
  authLimiter,
  passport.authenticate('discord', { session: false })
);

router.get('/discord/callback',
  authLimiter,
  passport.authenticate('discord', { session: false, failureRedirect: '/auth/error' }),
  (req, res) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}?error=auth_failed`);
    }

    // Generate JWT token
    const token = generateToken(user.id);
    
    // Redirect to client with token
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}?token=${token}`);
  }
);

// Get current authenticated user
router.get('/me', apiLimiter, authenticateJWT, (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = UserStore.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return user data without sensitive information
  res.json({
    id: user.id,
    displayName: user.displayName,
    avatar: user.avatar,
    provider: user.provider,
    stats: user.stats,
    settings: user.settings,
    createdAt: user.createdAt,
    lastActive: user.lastActive
  });
});

// Update user settings
router.put('/me/settings', apiLimiter, authenticateJWT, (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { settings } = req.body;
  if (!settings) {
    return res.status(400).json({ error: 'Settings object required' });
  }

  const user = UserStore.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update settings
  const updatedUser = UserStore.update(userId, {
    settings: { ...user.settings, ...settings }
  });

  res.json({
    settings: updatedUser?.settings
  });
});

// Logout (client-side should delete token)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Error page redirect
router.get('/error', (req, res) => {
  res.status(401).json({ 
    error: 'Authentication failed',
    message: 'Could not authenticate with Discord'
  });
});

export default router;
