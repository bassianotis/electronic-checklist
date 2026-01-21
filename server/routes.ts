import { Router, Response } from 'express';
import { AuthenticatedRequest } from './types';
import db from './db';
import { hashPassword, comparePassword, generateToken } from './auth';
import { requireAuth, rateLimit } from './middleware';
import { z } from 'zod';

const router = Router();

// Validation Schemas
const RegisterSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    inviteCode: z.string()
});

const LoginSchema = z.object({
    username: z.string(),
    password: z.string()
});

// --- System Routes ---
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Auth Routes ---

router.post('/auth/register', rateLimit(60000, 5), async (req: AuthenticatedRequest, res: Response) => {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: result.error.errors });
        return;
    }

    const { username, password, inviteCode } = result.data;

    // Verify Invite Code from Env
    if (inviteCode !== process.env.REGISTRATION_CODE) {
        res.status(403).json({ error: 'Invalid invite code' });
        return;
    }

    try {
        const hashedPassword = await hashPassword(password);
        const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashedPassword);

        // Auto-login logic
        const token = generateToken({ id: Number(info.lastInsertRowid), username });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ success: true, user: { id: info.lastInsertRowid, username } });
    } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(409).json({ error: 'Username taken' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }
});

router.post('/auth/login', rateLimit(60000, 10), async (req: AuthenticatedRequest, res: Response) => {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Invalid input' });
        return;
    }

    const { username, password } = result.data;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || !(await comparePassword(password, user.password_hash))) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    const token = generateToken({ id: user.id, username: user.username });

    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user: { id: user.id, username: user.username } });
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
});

router.post('/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

// --- Data Routes ---

router.get('/data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const row = db.prepare('SELECT data_json, version FROM state WHERE user_id = ?').get(userId) as any;

    if (!row) {
        // Initial State: Empty
        res.set('ETag', '"0"');
        res.json({ data: null, version: 0 });
        return;
    }

    const etag = `"${row.version}"`;

    // ETag Check
    if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
    }

    res.set('ETag', etag);
    // Parse JSON to return as object, or send raw string if client expects it. 
    // Store expects object.
    res.json({ data: JSON.parse(row.data_json), version: row.version });
});

router.get('/audit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const logs = db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);
    res.json(logs);
});

router.post('/data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id; // ! is safe because requireAuth ensures it
    const newData = req.body; // Expecting { ...state... }

    // Optimistic Concurrency Check
    // ETag format: '"123"' or '123'
    const ifMatch = req.headers['if-match']?.replace(/"/g, '');

    if (!ifMatch) {
        res.status(400).json({ error: 'Missing If-Match header' });
        return;
    }

    const currentVersion = parseInt(ifMatch, 10);

    // Transaction to Ensure Atomicity
    const updateTx = db.transaction(() => {
        const row = db.prepare('SELECT version, data_json FROM state WHERE user_id = ?').get(userId) as any;

        const dbVersion = row ? row.version : 0;

        if (dbVersion !== currentVersion) {
            // Conflict!
            return {
                success: false,
                yourVersion: currentVersion,
                serverVersion: dbVersion,
                serverData: row ? JSON.parse(row.data_json) : null
            };
        }

        const newVersion = dbVersion + 1;
        const jsonStr = JSON.stringify(newData);

        if (row) {
            // AUDIT LOGGING: Check for mass completion
            try {
                const oldData = JSON.parse(row.data_json);
                const completedItems: string[] = [];
                const oldItemMap = new Map((oldData.items || []).map((i: any) => [i.id, i]));

                if (newData.items && Array.isArray(newData.items)) {
                    for (const newItem of newData.items) {
                        const oldItem: any = oldItemMap.get(newItem.id);
                        // Detect transition: Incomplete -> Complete
                        if (oldItem && oldItem.status === 'incomplete' && newItem.status === 'complete') {
                            completedItems.push(newItem.text || newItem.id);
                        }
                    }
                }

                if (completedItems.length > 0) {
                    db.prepare('INSERT INTO audit_logs (user_id, action_type, details) VALUES (?, ?, ?)').run(
                        userId,
                        'COMPLETION_EVENT',
                        JSON.stringify({
                            count: completedItems.length,
                            items: completedItems.slice(0, 50), // Limit size
                            userAgent: req.headers['user-agent']
                        })
                    );
                }
            } catch (e) {
                console.error("Audit log error:", e);
            }

            db.prepare('UPDATE state SET data_json = ?, version = ?, updated_at = unixepoch() WHERE user_id = ?')
                .run(jsonStr, newVersion, userId);
        } else {
            db.prepare('INSERT INTO state (user_id, data_json, version, updated_at) VALUES (?, ?, ?, unixepoch())')
                .run(userId, jsonStr, newVersion);
        }

        return { success: true, newVersion };
    });

    try {
        const result = updateTx();

        if (!result.success) {
            res.status(412).json({
                error: 'Conflict',
                serverVersion: result.serverVersion,
                // Optional: Send data back for merge assistance? 
                // Plan said: "On 412, don’t include serverData by default... let client re-GET"
                // But for efficiency, sending it here saves a round trip.
                // I will follow plan: return 412, let client fetch.
            });
            return;
        }

        res.set('ETag', `"${result.newVersion}"`);
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- Clear Data (Full Reset) ---
router.delete('/data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
        // Reset to empty state with version 1
        const emptyState = {
            items: [],
            routines: [],
            currentTime: new Date().toISOString(),
            allowUncomplete: true,
            userTimezone: 'America/New_York',
            lastRolledWeek: null,
            dataVersion: 1
        };

        const jsonStr = JSON.stringify(emptyState);

        // Upsert: insert or update
        const existing = db.prepare('SELECT user_id FROM state WHERE user_id = ?').get(userId);
        if (existing) {
            db.prepare('UPDATE state SET data_json = ?, version = 1, updated_at = unixepoch() WHERE user_id = ?')
                .run(jsonStr, userId);
        } else {
            db.prepare('INSERT INTO state (user_id, data_json, version, updated_at) VALUES (?, ?, 1, unixepoch())')
                .run(userId, jsonStr);
        }

        res.set('ETag', '"1"');
        res.status(200).json({ success: true, newVersion: 1 });
    } catch (err: any) {
        console.error('Clear data error:', err);
        res.status(500).json({ error: 'Database error', details: err?.message });
    }
});

export default router;
