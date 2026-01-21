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
            suspended INTEGER DEFAULT 0,
            suspended_reason TEXT,
            suspended_at TEXT,
            suspended_by TEXT,
            totp_secret TEXT,
            totp_enabled INTEGER DEFAULT 0,
            mfa_enforced INTEGER DEFAULT 1,
            recovery_codes TEXT,
            backup_email TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Add new columns if they don't exist (for existing databases)
    const userColumns = ['suspended', 'suspended_reason', 'suspended_at', 'suspended_by', 'mfa_enforced', 'recovery_codes', 'backup_email'];
    userColumns.forEach(col => {
        try {
            database.exec(`ALTER TABLE users ADD COLUMN ${col} ${col === 'mfa_enforced' ? 'INTEGER DEFAULT 1' : col === 'suspended' ? 'INTEGER DEFAULT 0' : 'TEXT'}`);
        } catch { /* Column already exists */ }
    });

    // Sessions table with device tracking
    database.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            ip TEXT,
            user_agent TEXT,
            device_name TEXT,
            device_fingerprint TEXT,
            last_active TEXT DEFAULT (datetime('now')),
            is_remembered INTEGER DEFAULT 0,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Add new session columns if they don't exist
    const sessionColumns = ['device_name', 'device_fingerprint', 'last_active', 'is_remembered'];
    sessionColumns.forEach(col => {
        try {
            database.exec(`ALTER TABLE sessions ADD COLUMN ${col} ${col === 'is_remembered' ? 'INTEGER DEFAULT 0' : col === 'last_active' ? "TEXT DEFAULT (datetime('now'))" : 'TEXT'}`);
        } catch { /* Column already exists */ }
    });

    // Remembered devices table
    database.exec(`
        CREATE TABLE IF NOT EXISTS remembered_devices (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL,
            device_name TEXT,
            ip TEXT,
            last_used TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Approval requests table (two-person rule)
    database.exec(`
        CREATE TABLE IF NOT EXISTS approval_requests (
            id TEXT PRIMARY KEY,
            requester_id TEXT NOT NULL,
            approver_id TEXT,
            action_type TEXT NOT NULL,
            target_user TEXT,
            action_data TEXT,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            resolved_at TEXT,
            approver_reason TEXT,
            FOREIGN KEY (requester_id) REFERENCES users(id),
            FOREIGN KEY (approver_id) REFERENCES users(id)
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
        CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active);
        CREATE INDEX IF NOT EXISTS idx_remembered_devices_user_id ON remembered_devices(user_id);
        CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
        CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
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
    suspended: number;
    suspended_reason: string | null;
    suspended_at: string | null;
    suspended_by: string | null;
    totp_secret: string | null;
    totp_enabled: number;
    mfa_enforced: number;
    recovery_codes: string | null;  // JSON array of hashed codes
    backup_email: string | null;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: string;
    user_id: string;
    token_hash: string;
    ip: string | null;
    user_agent: string | null;
    device_name: string | null;
    device_fingerprint: string | null;
    last_active: string;
    is_remembered: number;
    expires_at: string;
    created_at: string;
}

export interface RememberedDevice {
    id: string;
    user_id: string;
    device_fingerprint: string;
    device_name: string | null;
    ip: string | null;
    last_used: string;
    created_at: string;
}

export interface ApprovalRequest {
    id: string;
    requester_id: string;
    approver_id: string | null;
    action_type: string;
    target_user: string | null;
    action_data: string | null;
    reason: string;
    status: 'pending' | 'approved' | 'denied' | 'expired';
    expires_at: string;
    created_at: string;
    resolved_at: string | null;
    approver_reason: string | null;
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
export function createUser(user: Omit<User, 'created_at' | 'updated_at' | 'suspended' | 'suspended_reason' | 'suspended_at' | 'suspended_by' | 'mfa_enforced' | 'recovery_codes' | 'backup_email'> & { suspended?: number; mfa_enforced?: number }): User | null {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO users (id, email, password_hash, discord_id, display_name, 
                authority_level, roles, permissions, enabled, suspended, mfa_enforced, totp_secret, totp_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            user.suspended || 0,
            user.mfa_enforced ?? 1,  // Default to MFA enforced
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
type CreateSessionInput = Omit<Session, 'created_at' | 'last_active' | 'device_name' | 'device_fingerprint' | 'is_remembered'> & {
    device_name?: string | null;
    device_fingerprint?: string | null;
    is_remembered?: number;
};
export function createSession(session: CreateSessionInput): Session | null {
    try {
        const stmt = getDb().prepare(`
            INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, device_name, device_fingerprint, last_active, is_remembered, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
        `);
        stmt.run(
            session.id,
            session.user_id,
            session.token_hash,
            session.ip,
            session.user_agent,
            session.device_name || null,
            session.device_fingerprint || null,
            session.is_remembered || 0,
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

export function getAuditLogByUser(userId: string, limit = 50): AuditLogEntry[] {
    const stmt = getDb().prepare(`
        SELECT * FROM audit_log 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `);
    return stmt.all(userId, limit) as AuditLogEntry[];
}

// ============================================
// Session Management
// ============================================

const MAX_SESSIONS = 2;
const SESSION_TIMEOUT_MINUTES = 10;

export function getUserSessions(userId: string): Session[] {
    const stmt = getDb().prepare(`
        SELECT * FROM sessions 
        WHERE user_id = ? AND expires_at > datetime('now')
        ORDER BY last_active DESC
    `);
    return stmt.all(userId) as Session[];
}

export function updateSessionActivity(sessionId: string): void {
    const stmt = getDb().prepare(`
        UPDATE sessions 
        SET last_active = datetime('now')
        WHERE id = ?
    `);
    stmt.run(sessionId);
}

export function deleteSession(sessionId: string): boolean {
    const stmt = getDb().prepare(`DELETE FROM sessions WHERE id = ?`);
    const result = stmt.run(sessionId);
    return result.changes > 0;
}

export function deleteAllUserSessions(userId: string, exceptSessionId?: string): number {
    let stmt;
    if (exceptSessionId) {
        stmt = getDb().prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`);
        return stmt.run(userId, exceptSessionId).changes;
    } else {
        stmt = getDb().prepare(`DELETE FROM sessions WHERE user_id = ?`);
        return stmt.run(userId).changes;
    }
}

export function enforceSessionLimit(userId: string): void {
    // Get all sessions for user
    const sessions = getUserSessions(userId);

    // If over limit, delete oldest sessions
    if (sessions.length >= MAX_SESSIONS) {
        // Sort by last_active, keep newest (MAX_SESSIONS - 1) to allow new login
        const sessionsToKeep = sessions
            .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime())
            .slice(0, MAX_SESSIONS - 1)
            .map(s => s.id);

        sessions.forEach(s => {
            if (!sessionsToKeep.includes(s.id)) {
                deleteSession(s.id);
            }
        });
    }
}

export function cleanExpiredSessions(): number {
    // Delete sessions expired by time OR inactive for more than timeout
    const stmt = getDb().prepare(`
        DELETE FROM sessions 
        WHERE expires_at < datetime('now') 
        OR last_active < datetime('now', '-${SESSION_TIMEOUT_MINUTES} minutes')
    `);
    return stmt.run().changes;
}

// ============================================
// User Suspension
// ============================================

export function suspendUser(
    userId: string,
    reason: string,
    suspendedBy: string
): boolean {
    const stmt = getDb().prepare(`
        UPDATE users 
        SET suspended = 1, 
            suspended_reason = ?, 
            suspended_at = datetime('now'), 
            suspended_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `);
    const result = stmt.run(reason, suspendedBy, userId);

    // Delete all sessions for suspended user
    if (result.changes > 0) {
        deleteAllUserSessions(userId);
    }

    return result.changes > 0;
}

export function unsuspendUser(userId: string): boolean {
    const stmt = getDb().prepare(`
        UPDATE users 
        SET suspended = 0, 
            suspended_reason = NULL, 
            suspended_at = NULL, 
            suspended_by = NULL,
            updated_at = datetime('now')
        WHERE id = ?
    `);
    return stmt.run(userId).changes > 0;
}

export function isUserSuspended(userId: string): { suspended: boolean; reason?: string } {
    const stmt = getDb().prepare(`SELECT suspended, suspended_reason FROM users WHERE id = ?`);
    const result = stmt.get(userId) as { suspended: number; suspended_reason: string | null } | undefined;
    if (!result) return { suspended: false };
    return {
        suspended: result.suspended === 1,
        reason: result.suspended_reason || undefined
    };
}

// ============================================
// Remembered Devices
// ============================================

export function getRememberedDevices(userId: string): RememberedDevice[] {
    const stmt = getDb().prepare(`
        SELECT * FROM remembered_devices 
        WHERE user_id = ? 
        ORDER BY last_used DESC
    `);
    return stmt.all(userId) as RememberedDevice[];
}

export function addRememberedDevice(
    userId: string,
    deviceFingerprint: string,
    deviceName: string | null,
    ip: string | null
): string {
    const id = crypto.randomUUID();
    const stmt = getDb().prepare(`
        INSERT OR REPLACE INTO remembered_devices (id, user_id, device_fingerprint, device_name, ip)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, deviceFingerprint, deviceName, ip);
    return id;
}

export function isDeviceRemembered(userId: string, deviceFingerprint: string): boolean {
    const stmt = getDb().prepare(`
        SELECT id FROM remembered_devices 
        WHERE user_id = ? AND device_fingerprint = ?
    `);
    const result = stmt.get(userId, deviceFingerprint);

    if (result) {
        // Update last used
        const update = getDb().prepare(`
            UPDATE remembered_devices SET last_used = datetime('now') WHERE user_id = ? AND device_fingerprint = ?
        `);
        update.run(userId, deviceFingerprint);
    }

    return !!result;
}

export function removeRememberedDevice(deviceId: string): boolean {
    const stmt = getDb().prepare(`DELETE FROM remembered_devices WHERE id = ?`);
    return stmt.run(deviceId).changes > 0;
}

export function removeAllRememberedDevices(userId: string): number {
    const stmt = getDb().prepare(`DELETE FROM remembered_devices WHERE user_id = ?`);
    return stmt.run(userId).changes;
}

// Export the database getter for direct access if needed
export { getDb };

