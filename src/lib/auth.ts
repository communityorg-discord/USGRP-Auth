/**
 * Core authentication library
 * Handles password hashing, JWT tokens, and session management
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'crypto';
import {
    getUserByEmail,
    getUserById,
    getUserByDiscordId,
    createSession,
    getSessionByTokenHash,
    deleteSession,
    deleteAllUserSessions,
    logAudit,
    type User
} from './db';
import { type AuthorityLevel, type Permission, getEffectivePermissions, getRoleName } from './roles';

// JWT secret - should be set in environment
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'usgrp-auth-jwt-secret-change-in-production-32chars'
);

const JWT_ISSUER = 'auth.usgrp.xyz';
const JWT_AUDIENCE = 'usgrp.xyz';

// Session durations
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const EXTENDED_SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

// Token types
export interface AuthToken {
    userId: string;
    email: string;
    discordId: string | null;
    displayName: string;
    authorityLevel: AuthorityLevel;
    roles: string[];
    permissions: Permission[];
    sessionId: string;
}

export interface TokenValidationResult {
    valid: boolean;
    user?: AuthToken;
    error?: string;
}

// Password hashing
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Generate unique IDs
export function generateId(): string {
    return crypto.randomUUID();
}

// Hash a token for storage
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Create JWT token
export async function createToken(
    user: User,
    sessionId: string,
    extended = false
): Promise<string> {
    const expiresIn = extended ? EXTENDED_SESSION_DURATION : SESSION_DURATION;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const roles: string[] = JSON.parse(user.roles || '[]');
    const explicitPermissions: Permission[] = JSON.parse(user.permissions || '[]');
    const effectivePermissions = getEffectivePermissions(
        user.authority_level as AuthorityLevel,
        explicitPermissions
    );

    const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        discordId: user.discord_id,
        displayName: user.display_name,
        authorityLevel: user.authority_level,
        roles,
        permissions: effectivePermissions,
        sessionId,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime(expiresAt)
        .sign(JWT_SECRET);

    return token;
}

// Validate JWT token
export async function validateToken(token: string): Promise<TokenValidationResult> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });

        const authPayload = payload as JWTPayload & AuthToken;

        // Verify session still exists
        const tokenHash = hashToken(token);
        const session = getSessionByTokenHash(tokenHash);

        if (!session) {
            return { valid: false, error: 'Session not found or expired' };
        }

        // Verify user is still enabled
        const user = getUserById(authPayload.userId);
        if (!user || !user.enabled) {
            return { valid: false, error: 'User disabled' };
        }

        return {
            valid: true,
            user: {
                userId: authPayload.userId,
                email: authPayload.email,
                discordId: authPayload.discordId,
                displayName: authPayload.displayName,
                authorityLevel: authPayload.authorityLevel,
                roles: authPayload.roles,
                permissions: authPayload.permissions,
                sessionId: authPayload.sessionId,
            },
        };
    } catch (error) {
        return { valid: false, error: 'Invalid or expired token' };
    }
}

// Login user
export interface LoginResult {
    success: boolean;
    token?: string;
    user?: Omit<AuthToken, 'sessionId'>;
    requires2FA?: boolean;
    error?: string;
}

export async function login(
    email: string,
    password: string,
    ip: string | null,
    userAgent: string | null,
    rememberMe = false
): Promise<LoginResult> {
    const user = getUserByEmail(email);

    if (!user) {
        logAudit(null, 'LOGIN_FAILED', email, 'User not found', ip);
        return { success: false, error: 'Invalid credentials' };
    }

    if (!user.enabled) {
        logAudit(user.id, 'LOGIN_FAILED', email, 'Account disabled', ip);
        return { success: false, error: 'Account disabled' };
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
        logAudit(user.id, 'LOGIN_FAILED', email, 'Invalid password', ip);
        return { success: false, error: 'Invalid credentials' };
    }

    // Check if 2FA is required
    if (user.totp_enabled) {
        // Return requires2FA flag - the client should call verify2FA
        logAudit(user.id, 'LOGIN_2FA_REQUIRED', email, null, ip);
        return { success: true, requires2FA: true };
    }

    // Create session
    const sessionId = generateId();
    const expiresIn = rememberMe ? EXTENDED_SESSION_DURATION : SESSION_DURATION;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const token = await createToken(user, sessionId, rememberMe);
    const tokenHash = hashToken(token);

    createSession({
        id: sessionId,
        user_id: user.id,
        token_hash: tokenHash,
        ip,
        user_agent: userAgent,
        is_remembered: rememberMe ? 1 : 0,
        expires_at: expiresAt,
    });

    logAudit(user.id, 'LOGIN_SUCCESS', email, null, ip);

    const roles: string[] = JSON.parse(user.roles || '[]');
    const explicitPermissions: Permission[] = JSON.parse(user.permissions || '[]');

    return {
        success: true,
        token,
        user: {
            userId: user.id,
            email: user.email,
            discordId: user.discord_id,
            displayName: user.display_name,
            authorityLevel: user.authority_level as AuthorityLevel,
            roles,
            permissions: getEffectivePermissions(
                user.authority_level as AuthorityLevel,
                explicitPermissions
            ),
        },
    };
}

// Logout
export async function logout(token: string, ip: string | null): Promise<boolean> {
    const validation = await validateToken(token);

    if (!validation.valid || !validation.user) {
        return false;
    }

    const tokenHash = hashToken(token);
    const session = getSessionByTokenHash(tokenHash);

    if (session) {
        deleteSession(session.id);
        logAudit(validation.user.userId, 'LOGOUT', validation.user.email, null, ip);
        return true;
    }

    return false;
}

// Logout all sessions for a user
export async function logoutAll(userId: string, ip: string | null): Promise<number> {
    const count = deleteAllUserSessions(userId);
    logAudit(userId, 'LOGOUT_ALL', null, `Logged out ${count} sessions`, ip);
    return count;
}

// Get SSO redirect URL
export function getAuthRedirectUrl(returnUrl: string): string {
    const authBase = process.env.AUTH_URL || 'https://auth.usgrp.xyz';
    const encoded = encodeURIComponent(returnUrl);
    return `${authBase}/login?return=${encoded}`;
}

// Verify user has minimum authority level
export function requiresAuthority(
    user: AuthToken | null,
    requiredLevel: AuthorityLevel
): boolean {
    if (!user) return false;
    return user.authorityLevel >= requiredLevel;
}

// Verify user has specific permission
export function requiresPermission(
    user: AuthToken | null,
    requiredPermission: Permission
): boolean {
    if (!user) return false;
    return user.permissions.includes(requiredPermission);
}

// Export user lookup functions
export { getUserByEmail, getUserById, getUserByDiscordId };
