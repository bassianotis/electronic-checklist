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

const GrantPermissionSchema = z.object({
    viewerUsername: z.string().min(3),
    permissionLevel: z.enum(['read'])
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

// --- Permission Routes ---

// Grant read access to another user
router.post('/permissions', requireAuth, rateLimit(60000, 20), (req: AuthenticatedRequest, res: Response) => {
    const result = GrantPermissionSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Invalid input', details: result.error.errors });
        return;
    }

    const { viewerUsername, permissionLevel } = result.data;
    const ownerUserId = req.user!.id;

    try {
        // Find viewer user by username
        const viewer = db.prepare('SELECT id, username FROM users WHERE username = ?').get(viewerUsername) as any;

        if (!viewer) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Prevent self-permission
        if (viewer.id === ownerUserId) {
            res.status(400).json({ error: 'Cannot grant permission to yourself' });
            return;
        }

        // Insert permission (UNIQUE constraint prevents duplicates)
        db.prepare('INSERT INTO permissions (owner_user_id, viewer_user_id, permission_level) VALUES (?, ?, ?)')
            .run(ownerUserId, viewer.id, permissionLevel);

        // Audit log
        db.prepare('INSERT INTO audit_logs (user_id, action_type, details) VALUES (?, ?, ?)').run(
            ownerUserId,
            'PERMISSION_GRANTED',
            JSON.stringify({ viewer_user_id: viewer.id, viewer_username: viewerUsername, permission_level: permissionLevel })
        );

        res.status(201).json({
            success: true,
            permission: {
                viewerUsername,
                permissionLevel,
                createdAt: Date.now()
            }
        });
    } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(409).json({ error: 'Permission already exists' });
        } else {
            console.error('Grant permission error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    }
});

// List permissions granted by current user (who can see my data)
router.get('/permissions/granted', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const ownerUserId = req.user!.id;

    try {
        const permissions = db.prepare(`
            SELECT p.id, u.username as viewerUsername, p.permission_level as permissionLevel, p.created_at as createdAt
            FROM permissions p
            JOIN users u ON p.viewer_user_id = u.id
            WHERE p.owner_user_id = ?
            ORDER BY p.created_at DESC
        `).all(ownerUserId);

        res.json({ permissions });
    } catch (err) {
        console.error('List granted permissions error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// List permissions received by current user (whose data I can see)
router.get('/permissions/received', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const viewerUserId = req.user!.id;

    try {
        const permissions = db.prepare(`
            SELECT p.id, u.id as ownerUserId, u.username as ownerUsername, p.permission_level as permissionLevel, p.created_at as createdAt
            FROM permissions p
            JOIN users u ON p.owner_user_id = u.id
            WHERE p.viewer_user_id = ?
            ORDER BY p.created_at DESC
        `).all(viewerUserId);

        res.json({ permissions });
    } catch (err) {
        console.error('List received permissions error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Revoke a permission
router.delete('/permissions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const permissionId = parseInt(req.params.id, 10);
    const ownerUserId = req.user!.id;

    try {
        // Verify ownership before deletion
        const permission = db.prepare('SELECT * FROM permissions WHERE id = ? AND owner_user_id = ?')
            .get(permissionId, ownerUserId) as any;

        if (!permission) {
            res.status(404).json({ error: 'Permission not found or access denied' });
            return;
        }

        db.prepare('DELETE FROM permissions WHERE id = ?').run(permissionId);

        // Audit log
        db.prepare('INSERT INTO audit_logs (user_id, action_type, details) VALUES (?, ?, ?)').run(
            ownerUserId,
            'PERMISSION_REVOKED',
            JSON.stringify({ permission_id: permissionId, viewer_user_id: permission.viewer_user_id })
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Revoke permission error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Fetch another user's data (if you have read permission)
router.get('/data/:userId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const requestedUserId = parseInt(req.params.userId, 10);
    const viewerUserId = req.user!.id;

    // Check if viewer has permission
    const permission = db.prepare(`
        SELECT permission_level 
        FROM permissions 
        WHERE owner_user_id = ? AND viewer_user_id = ?
    `).get(requestedUserId, viewerUserId) as any;

    if (!permission) {
        res.status(403).json({ error: 'Access denied: No permission to view this user\'s data' });
        return;
    }

    // Fetch the user's state
    const row = db.prepare('SELECT data_json, version FROM state WHERE user_id = ?').get(requestedUserId) as any;

    if (!row) {
        res.json({ data: null, version: 0, ownerUsername: null });
        return;
    }

    // Get owner's username for display
    const owner = db.prepare('SELECT username FROM users WHERE id = ?').get(requestedUserId) as any;

    res.json({
        data: JSON.parse(row.data_json),
        version: row.version,
        ownerUsername: owner?.username
    });
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
    const now = Date.now();
    const FUTURE_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

    // Validation: Check for Future Timestamps (Prevents "God Mode" devices overwriting server)
    if (newData.items && Array.isArray(newData.items)) {
        for (const item of newData.items) {
            if (item.updatedAt && item.updatedAt > now + FUTURE_TOLERANCE_MS) {
                res.status(400).json({
                    error: 'Future timestamp detected',
                    details: `Item ${item.id} has time in future: ${new Date(item.updatedAt).toISOString()}`
                });
                return;
            }
        }
    }

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
