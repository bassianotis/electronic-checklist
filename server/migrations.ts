import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database) {
    // Get current schema version
    const versionTable = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_version'
    `).get();

    if (!versionTable) {
        // Initialize schema_version table
        db.exec(`
            CREATE TABLE schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL DEFAULT (unixepoch())
            );
            INSERT INTO schema_version (version) VALUES (0);
        `);
    }

    const currentVersion = (db.prepare('SELECT MAX(version) as version FROM schema_version').get() as any).version;

    // Migration 1: Add permissions table
    if (currentVersion < 1) {
        console.log('Running migration 1: Add permissions table');
        db.exec(`
            CREATE TABLE permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_user_id INTEGER NOT NULL,
                viewer_user_id INTEGER NOT NULL,
                permission_level TEXT NOT NULL CHECK(permission_level IN ('read')),
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(viewer_user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(owner_user_id, viewer_user_id)
            );
            
            CREATE INDEX idx_permissions_viewer ON permissions(viewer_user_id);
            CREATE INDEX idx_permissions_owner ON permissions(owner_user_id);
            
            INSERT INTO schema_version (version) VALUES (1);
        `);
        console.log('Migration 1 completed');
    }
}
