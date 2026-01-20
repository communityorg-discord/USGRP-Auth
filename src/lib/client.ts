/**
 * USGRP Auth Client Library
 * 
 * This module provides utilities for other USGRP services to validate
 * Auth tokens and integrate with the central authentication system.
 * 
 * Usage in other services:
 * 
 * import { validateAuthToken, getAuthRedirectUrl, hasMinimumAuthority } from '@usgrp/auth-client';
 * 
 * Example middleware:
 * 
 * const result = await validateAuthToken(token);
 * if (!result.valid) {
 *     return redirect(getAuthRedirectUrl(request.url));
 * }
 */

export interface AuthUser {
    userId: string;
    email: string;
    discordId: string | null;
    displayName: string;
    authorityLevel: number;
    roles: string[];
    permissions: string[];
    sessionId: string;
}

export interface TokenValidationResult {
    valid: boolean;
    user?: AuthUser;
    error?: string;
}

const AUTH_BASE_URL = process.env.AUTH_URL || 'https://auth.usgrp.xyz';

/**
 * Validate an Auth token by calling the Auth service
 */
export async function validateAuthToken(token: string): Promise<TokenValidationResult> {
    try {
        const response = await fetch(`${AUTH_BASE_URL}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok || !data.valid) {
            return { valid: false, error: data.error || 'Token validation failed' };
        }

        return { valid: true, user: data.user };
    } catch (error) {
        console.error('Auth token validation error:', error);
        return { valid: false, error: 'Auth service unavailable' };
    }
}

/**
 * Get the SSO redirect URL for a return URL
 */
export function getAuthRedirectUrl(returnUrl: string): string {
    const encoded = encodeURIComponent(returnUrl);
    return `${AUTH_BASE_URL}/login?return=${encoded}`;
}

/**
 * Check if user has minimum authority level
 */
export function hasMinimumAuthority(user: AuthUser | null, requiredLevel: number): boolean {
    if (!user) return false;
    return user.authorityLevel >= requiredLevel;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: AuthUser | null, permission: string): boolean {
    if (!user) return false;
    return user.permissions.includes(permission);
}

/**
 * Authority level constants
 */
export const AUTHORITY_LEVELS = {
    USER: 0,
    MODERATOR: 1,
    SENIOR_MOD: 2,
    ADMIN: 3,
    HR: 4,
    SUPERUSER: 5,
    BOT_DEVELOPER: 6,
} as const;

/**
 * Permission constants
 */
export const PERMISSIONS = {
    MAIL_ACCESS: 'mail:access',
    MAIL_ADMIN: 'mail:admin',
    MAIL_SHARED_MAILBOX: 'mail:shared_mailbox',
    DASHBOARD_VIEW: 'dashboard:view',
    DASHBOARD_APPEALS: 'dashboard:appeals',
    DASHBOARD_USERS: 'dashboard:users',
    DASHBOARD_ANALYTICS: 'dashboard:analytics',
    BOT_COMMANDS: 'bot:commands',
    BOT_ADMIN: 'bot:admin',
    STATUS_VIEW: 'status:view',
    STATUS_MANAGE: 'status:manage',
    AUTH_MANAGE_USERS: 'auth:manage_users',
    AUTH_MANAGE_ROLES: 'auth:manage_roles',
    AUTH_VIEW_AUDIT: 'auth:view_audit',
} as const;
