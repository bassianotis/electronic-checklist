import { Response, NextFunction } from 'express';
import { verifyToken } from './auth';
import { AuthenticatedRequest } from './types';

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; expires: number }>();

export function rateLimit(windowMs: number, max: number) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const ip = req.ip || 'unknown';
        const now = Date.now();
        const record = rateLimits.get(ip);

        if (record && now < record.expires) {
            if (record.count >= max) {
                res.status(429).json({ error: 'Too many requests' });
                return;
            }
            record.count++;
        } else {
            rateLimits.set(ip, { count: 1, expires: now + windowMs });
        }
        next();
    };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = req.cookies.tasks_auth_token;

    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = verifyToken(token);
    if (!user) {
        res.clearCookie('tasks_auth_token');
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    req.user = user;
    next();
}
