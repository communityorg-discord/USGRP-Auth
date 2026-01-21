/**
 * Database connection and schema management
 * Uses better-sqlite3 for synchronous SQLite operations
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.AUTH_DATA_DIR || (
    process.platform === 'win32'
        ? 'C:/usgrp-auth-data'
        : '/var/lib/usgrp-auth'
);

const DB_PATH = path.join(DATA_DIR, 'auth.db');

// Ensure data directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.warn('Could not create data directory:', e);
}

// Create database connection
let db: Database.Database;

function getDb(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        initializeSchema();
    }
    return db;
}

function initializeSchema() {
    const database = db;

    // Users table
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            discord_id TEXT UNIQUE,
            display_name TEXT NOT NULL,
            authority_level INTEGER DEFAULT 0,
            roles TEXT DEFAULT '[]',
            permissions TEXT DEFAULT '[]',
            enabled INTEGER DEFAULT 1,
            totp_secret TEXT,
            totp_enabled INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Sessions table
    database.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            ip TEXT,
            user_agent TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Audit log table
    database.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            target TEXT,
            details TEXT,
            ip TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Create indexes
    database.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    `);
}

// User types
export interface User {
    id: string;
    email: string;
    password_hash: string;
    discord_id: string | null;
    display_name: string;
    authority_level: number;
    roles: string;  // JSON string
    permissions: string;  // JSON string
    enabled: number;
    totp_secret: string | null;
    totp_enabled: number;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: string;
    user_id: string;
    token_hash: string;
    ip: string | null;
    user_agent: string | null;
    expires_at: string;
    created_at: string;
}

export interface AuditLogEntry {
    id: number;
    user_id: string | null;
    action: string;
    target: string | null;
    details: string | null;
    ip: string | null;
    created_at: string;
}

// User operations
export function createUser(user: Omit<User, 'created_at' | 'updated_at'>): User | null {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO users (id, email, password_hash, discord_id, display_name, 
                authority_level, roles, permissions, enabled, totp_secret, totp_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            user.id,
            user.email.toLowerCase(),
            user.password_hash,
            user.discord_id,
            user.display_name,
            user.authority_level,
            user.roles,
            user.permissions,
            user.enabled,
            user.totp_secret,
            user.totp_enabled
        );
        return getUserById(user.id);
    } catch (e) {
        console.error('Error creating user:', e);
        return null;
    }
}

export function getUserById(id: string): User | null {
    const stmt = getDb().prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
}

export function getUserByEmail(email: string): User | null {
    const stmt = getDb().prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase()) as User | null;
}

export function getUserByDiscordId(discordId: string): User | null {
    const stmt = getDb().prepare('SELECT * FROM users WHERE discord_id = ?');
    return stmt.get(discordId) as User | null;
}

export function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): boolean {
    try {
        const fields: string[] = [];
        const values: unknown[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(key === 'email' ? (value as string).toLowerCase() : value);
            }
        });

        if (fields.length === 0) return false;

        fields.push("updated_at = datetime('now')");
        values.push(id);

        const stmt = getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values);
        return result.changes > 0;
    } catch (e) {
        console.error('Error updating user:', e);
        return false;
    }
}

export function deleteUser(id: string): boolean {
    try {
        const stmt = getDb().prepare('DELETE FROM users WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    } catch (e) {
        console.error('Error deleting user:', e);
        return false;
    }
}

export function getAllUsers(): User[] {
    const stmt = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as User[];
}

export function disableUser(id: string): boolean {
    return updateUser(id, { enabled: 0 });
}

export function enableUser(id: string): boolean {
    return updateUser(id, { enabled: 1 });
}

// Session operations
export function createSession(session: Omit<Session, 'created_at'>): Session | null {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            session.id,
            session.user_id,
            session.token_hash,
            session.ip,
            session.user_agent,
            session.expires_at
        );
        return getSessionById(session.id);
    } catch (e) {
        console.error('Error creating session:', e);
        return null;
    }
}

export function getSessionById(id: string): Session | null {
    const stmt = getDb().prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as Session | null;
}

export function getSessionByTokenHash(tokenHash: string): Session | null {
    const stmt = getDb().prepare('SELECT * FROM sessions WHERE token_hash = ?');
    return stmt.get(tokenHash) as Session | null;
}

export function getSessionsByUserId(userId: string): Session[] {
    const stmt = getDb().prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as Session[];
}

export function deleteSession(id: string): boolean {
    try {
        const stmt = getDb().prepare('DELETE FROM sessions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    } catch (e) {
        console.error('Error deleting session:', e);
        return false;
    }
}

export function deleteUserSessions(userId: string): number {
    try {
        const stmt = getDb().prepare('DELETE FROM sessions WHERE user_id = ?');
        const result = stmt.run(userId);
        return result.changes;
    } catch (e) {
        console.error('Error deleting user sessions:', e);
        return 0;
    }
}

export function cleanExpiredSessions(): number {
    try {
        const stmt = getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')");
        const result = stmt.run();
        return result.changes;
    } catch (e) {
        console.error('Error cleaning expired sessions:', e);
        return 0;
    }
}

// Audit log operations
export function logAudit(
    userId: string | null,
    action: string,
    target: string | null = null,
    details: string | null = null,
    ip: string | null = null
): void {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO audit_log (user_id, action, target, details, ip)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(userId, action, target, details, ip);
    } catch (e) {
        console.error('Error logging audit:', e);
    }
}

export function getAuditLog(limit = 100, offset = 0): AuditLogEntry[] {
    const stmt = getDb().prepare(`
        SELECT 
            a.id, a.user_id, a.action, a.target_user, a.details, a.ip_address, a.created_at,
            u.display_name, u.email
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC 
        LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as AuditLogEntry[];
}
}

export function getAuditLogByUser(userId: string, limit = 50): AuditLogEntry[] {
    const stmt = getDb().prepare(`
        SELECT * FROM audit_log 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `);
    return stmt.all(userId, limit) as AuditLogEntry[];
}

// Export the database getter for direct access if needed
export { getDb };
