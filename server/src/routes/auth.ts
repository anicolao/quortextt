// Authentication routes for OAuth providers (Discord and Google)
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

// Validate and sanitize redirect URL to prevent open redirect vulnerabilities
function getValidatedRedirectUrl(returnTo: string): string {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const defaultRedirect = `${clientUrl}/quortextt/multiplayer.html`;
  
  // If no returnTo or not a valid URL, use default
  if (!returnTo || !returnTo.startsWith('http')) {
    return defaultRedirect;
  }
  
  try {
    const returnUrl = new URL(returnTo);
    const clientUrlObj = new URL(clientUrl);
    
    // Only allow redirects to the same origin as CLIENT_URL
    if (returnUrl.origin === clientUrlObj.origin) {
      return returnTo;
    }
    
    // URL is from a different origin, reject and use default
    console.warn(`Rejected redirect to untrusted origin: ${returnUrl.origin}`);
    return defaultRedirect;
  } catch (e) {
    // Invalid URL format, use default
    console.warn(`Invalid redirect URL format: ${returnTo}`);
    return defaultRedirect;
  }
}

// Discord OAuth routes
router.get('/discord', 
  authLimiter,
  (req, res, next) => {
    // Store the returnTo URL from query parameter or referer
    const returnTo = req.query.returnTo as string || req.get('Referer') || '';
    
    // Pass state through OAuth flow
    passport.authenticate('discord', { 
      session: false,
      state: Buffer.from(returnTo).toString('base64')
    })(req, res, next);
  }
);

router.get('/discord/callback',
  authLimiter,
  passport.authenticate('discord', { session: false, failureRedirect: '/auth/error' }),
  (req, res) => {
    const user = req.user as any;
    
    // Decode the state parameter to get the return URL
    const state = req.query.state as string;
    let decodedReturnTo = '';
    
    if (state) {
      try {
        decodedReturnTo = Buffer.from(state, 'base64').toString('utf-8');
      } catch (e) {
        console.error('Failed to decode state:', e);
      }
    }
    
    // Validate and sanitize the redirect URL
    const returnTo = getValidatedRedirectUrl(decodedReturnTo);
    
    if (!user) {
      // Append error to return URL
      const separator = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${separator}error=auth_failed`);
    }

    // Generate JWT token
    const token = generateToken(user.id);
    
    // Redirect back to the original page with token
    const separator = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${returnTo}${separator}token=${token}`);
  }
);

// Google OAuth routes
router.get('/google', 
  authLimiter,
  (req, res, next) => {
    // Store the returnTo URL from query parameter or referer
    const returnTo = req.query.returnTo as string || req.get('Referer') || '';
    
    // Pass state through OAuth flow
    passport.authenticate('google', { 
      session: false,
      state: Buffer.from(returnTo).toString('base64'),
      scope: ['profile', 'email']
    })(req, res, next);
  }
);

router.get('/google/callback',
  authLimiter,
  passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
  (req, res) => {
    const user = req.user as any;
    
    // Decode the state parameter to get the return URL
    const state = req.query.state as string;
    let decodedReturnTo = '';
    
    if (state) {
      try {
        decodedReturnTo = Buffer.from(state, 'base64').toString('utf-8');
      } catch (e) {
        console.error('Failed to decode state:', e);
      }
    }
    
    // Validate and sanitize the redirect URL
    const returnTo = getValidatedRedirectUrl(decodedReturnTo);
    
    if (!user) {
      // Append error to return URL
      const separator = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${separator}error=auth_failed`);
    }

    // Generate JWT token
    const token = generateToken(user.id);
    
    // Redirect back to the original page with token
    const separator = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${returnTo}${separator}token=${token}`);
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
    alias: user.alias,
    avatar: user.avatar,
    provider: user.provider,
    isAnonymous: user.isAnonymous,
    profileCompleted: user.profileCompleted,
    claimCode: user.claimCode,
    stats: user.stats,
    settings: user.settings,
    createdAt: user.createdAt,
    lastActive: user.lastActive
  });
});

// Update user settings
router.put('/me/settings', apiLimiter, authenticateJWT, async (req: AuthRequest, res) => {
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
  const updatedUser = await UserStore.update(userId, {
    settings: { ...user.settings, ...settings }
  });

  res.json({
    settings: updatedUser?.settings
  });
});

// Create anonymous user
router.post('/anonymous', authLimiter, async (req, res) => {
  const { username } = req.body;
  
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }

  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be 2-20 characters' });
  }

  // Generate unique anonymous ID
  const { v4: uuidv4 } = await import('uuid');
  const anonymousId = `anon:${uuidv4()}`;

  try {
    // Create anonymous user
    const user = await UserStore.create({
      id: anonymousId,
      displayName: trimmedUsername,
      provider: 'anonymous',
      alias: trimmedUsername,
      isAnonymous: true
    });

    // Generate JWT token
    const token = generateToken(user.id);

    // Set cookie for anonymous user
    res.cookie('quortex_anon_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      userId: user.id,
      token,
      alias: user.alias,
      claimCode: user.claimCode,
      isAnonymous: true
    });
  } catch (error) {
    console.error('Error creating anonymous user:', error);
    res.status(500).json({ error: 'Failed to create anonymous user' });
  }
});

// Validate anonymous cookie
router.get('/validate-anonymous', apiLimiter, async (req, res) => {
  const anonymousId = req.cookies?.quortex_anon_id;
  
  if (!anonymousId) {
    return res.json({ valid: false });
  }

  const user = UserStore.findById(anonymousId);
  
  if (!user || !user.isAnonymous) {
    // Clear invalid cookie
    res.clearCookie('quortex_anon_id');
    return res.json({ valid: false });
  }

  // Update last active
  await UserStore.update(user.id, { lastActive: new Date() });

  res.json({
    valid: true,
    userId: user.id,
    alias: user.alias,
    claimCode: user.claimCode
  });
});

// Logout (client-side should delete token)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Discord Activity token exchange endpoint
// This endpoint is accessed via Discord's /.proxy path from embedded activities
router.post('/api/token', authLimiter, async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Discord OAuth credentials not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Discord token exchange failed:', errorText);
      return res.status(tokenResponse.status).json({ 
        error: 'Failed to exchange authorization code' 
      });
    }

    const tokens = await tokenResponse.json() as { access_token: string };
    
    // Return the access token to the client
    // The Discord SDK will use this to call authenticate()
    res.json({
      access_token: tokens.access_token,
    });
  } catch (error) {
    console.error('Error in Discord Activity token exchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error page redirect
router.get('/error', (req, res) => {
  res.status(401).json({ 
    error: 'Authentication failed',
    message: 'Could not authenticate with Discord'
  });
});

export default router;
