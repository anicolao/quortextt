// Profile management routes
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { UserStore } from '../models/User.js';

const router = express.Router();

// Rate limiting for profile endpoints
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for claim operations
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 claim attempts per hour
  message: { error: 'Too many claim attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validate alias input
function validateAlias(alias: string): { valid: boolean; error?: string } {
  if (!alias || typeof alias !== 'string') {
    return { valid: false, error: 'Alias is required' };
  }

  const trimmed = alias.trim();

  if (trimmed.length < 2 || trimmed.length > 20) {
    return { valid: false, error: 'Alias must be 2-20 characters' };
  }

  // Allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
    return { valid: false, error: 'Alias can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  // Basic profanity filter (extend as needed)
  const profanityList = ['admin', 'moderator', 'mod', 'system', 'bot'];
  if (profanityList.some(word => trimmed.toLowerCase().includes(word))) {
    return { valid: false, error: 'Alias contains reserved words' };
  }

  return { valid: true };
}

// Get current user's profile
router.get('/', profileLimiter, authenticateJWT, (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = UserStore.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return full profile data
  res.json({
    id: user.id,
    alias: user.alias,
    displayName: user.displayName,
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

// Update user alias
router.put('/alias', profileLimiter, authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { alias } = req.body;
  
  const validation = validateAlias(alias);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const user = UserStore.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update both alias and displayName, and mark profile as completed
  const trimmedAlias = alias.trim();
  const updatedUser = await UserStore.update(userId, {
    alias: trimmedAlias,
    displayName: trimmedAlias,
    profileCompleted: true
  });

  res.json({
    alias: updatedUser?.alias,
    displayName: updatedUser?.displayName,
    profileCompleted: updatedUser?.profileCompleted
  });
});

// Claim an account using a claim code
router.post('/claim', claimLimiter, authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { claimCode } = req.body;
  
  if (!claimCode || typeof claimCode !== 'string') {
    return res.status(400).json({ error: 'Claim code is required' });
  }

  const trimmedCode = claimCode.trim().toUpperCase();
  
  if (trimmedCode.length !== 6) {
    return res.status(400).json({ error: 'Claim code must be 6 characters' });
  }

  const result = await UserStore.claimAccount(userId, trimmedCode);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'Account claimed successfully',
    mergedStats: result.mergedStats
  });
});

// Regenerate claim code
router.post('/regenerate-claim-code', profileLimiter, authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.authUser?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const newClaimCode = await UserStore.regenerateClaimCode(userId);
  
  if (!newClaimCode) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    claimCode: newClaimCode
  });
});

export default router;
