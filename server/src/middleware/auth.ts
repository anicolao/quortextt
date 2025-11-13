// JWT authentication middleware
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserStore } from '../models/User.js';

// Extend Express Request type to include our auth data
declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  authUser?: {
    userId: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  Using default JWT_SECRET. Set JWT_SECRET environment variable in production!');
}

export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Verify user still exists
    const user = UserStore.findById(decoded.userId);
    if (!user) {
      res.status(403).json({ error: 'User not found' });
      return;
    }

    req.authUser = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.authUser = decoded;
    } catch (error) {
      // Token is invalid, but that's okay for optional auth
    }
  }

  next();
}
