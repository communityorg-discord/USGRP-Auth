/**
 * Role hierarchy and authority levels
 * This is the single source of truth for RBAC across all USGRP services
 */

export const AUTHORITY_LEVELS = {
    USER: 0,
    MODERATOR: 1,
    SENIOR_MOD: 2,
    ADMIN: 3,
    HR: 4,
    SUPERUSER: 5,
    BOT_DEVELOPER: 6
} as const;

export type AuthorityLevel = typeof AUTHORITY_LEVELS[keyof typeof AUTHORITY_LEVELS];
export type RoleName = keyof typeof AUTHORITY_LEVELS;

/**
 * Permissions that can be explicitly granted independent of authority level
 */
export const PERMISSIONS = {
    // Mail permissions
    MAIL_ACCESS: 'mail:access',
    MAIL_ADMIN: 'mail:admin',
    MAIL_SHARED_MAILBOX: 'mail:shared_mailbox',

    // Dashboard permissions
    DASHBOARD_VIEW: 'dashboard:view',
    DASHBOARD_APPEALS: 'dashboard:appeals',
    DASHBOARD_USERS: 'dashboard:users',
    DASHBOARD_ANALYTICS: 'dashboard:analytics',

    // Bot permissions
    BOT_COMMANDS: 'bot:commands',
    BOT_ADMIN: 'bot:admin',

    // Status portal
    STATUS_VIEW: 'status:view',
    STATUS_MANAGE: 'status:manage',

    // Auth admin
    AUTH_MANAGE_USERS: 'auth:manage_users',
    AUTH_MANAGE_ROLES: 'auth:manage_roles',
    AUTH_VIEW_AUDIT: 'auth:view_audit',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Default permissions granted by authority level
 */
export const LEVEL_PERMISSIONS: Record<AuthorityLevel, Permission[]> = {
    [AUTHORITY_LEVELS.USER]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.STATUS_VIEW,
    ],
    [AUTHORITY_LEVELS.MODERATOR]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.DASHBOARD_APPEALS,
        PERMISSIONS.BOT_COMMANDS,
        PERMISSIONS.STATUS_VIEW,
    ],
    [AUTHORITY_LEVELS.SENIOR_MOD]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.DASHBOARD_APPEALS,
        PERMISSIONS.DASHBOARD_ANALYTICS,
        PERMISSIONS.BOT_COMMANDS,
        PERMISSIONS.STATUS_VIEW,
    ],
    [AUTHORITY_LEVELS.ADMIN]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.MAIL_ADMIN,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.DASHBOARD_APPEALS,
        PERMISSIONS.DASHBOARD_USERS,
        PERMISSIONS.DASHBOARD_ANALYTICS,
        PERMISSIONS.BOT_COMMANDS,
        PERMISSIONS.BOT_ADMIN,
        PERMISSIONS.STATUS_VIEW,
        PERMISSIONS.STATUS_MANAGE,
        PERMISSIONS.AUTH_MANAGE_USERS,
        PERMISSIONS.AUTH_VIEW_AUDIT,
    ],
    [AUTHORITY_LEVELS.HR]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.DASHBOARD_USERS,
        PERMISSIONS.AUTH_MANAGE_USERS,
        PERMISSIONS.AUTH_VIEW_AUDIT,
    ],
    [AUTHORITY_LEVELS.SUPERUSER]: [
        // All permissions
        ...Object.values(PERMISSIONS),
    ],
    [AUTHORITY_LEVELS.BOT_DEVELOPER]: [
        PERMISSIONS.MAIL_ACCESS,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.BOT_COMMANDS,
        PERMISSIONS.BOT_ADMIN,
        PERMISSIONS.AUTH_VIEW_AUDIT,
    ],
};

/**
 * Check if a user has a specific permission
 * Either via their authority level default permissions or explicitly granted
 */
export function hasPermission(
    authorityLevel: AuthorityLevel,
    explicitPermissions: Permission[],
    requiredPermission: Permission
): boolean {
    // Check explicit permissions first
    if (explicitPermissions.includes(requiredPermission)) {
        return true;
    }

    // Check level-based permissions
    const levelPerms = LEVEL_PERMISSIONS[authorityLevel] || [];
    return levelPerms.includes(requiredPermission);
}

/**
 * Check if user meets minimum authority level
 */
export function hasMinimumAuthority(
    userLevel: AuthorityLevel,
    requiredLevel: AuthorityLevel
): boolean {
    return userLevel >= requiredLevel;
}

/**
 * Get all effective permissions for a user
 */
export function getEffectivePermissions(
    authorityLevel: AuthorityLevel,
    explicitPermissions: Permission[]
): Permission[] {
    const levelPerms = LEVEL_PERMISSIONS[authorityLevel] || [];
    const combined = new Set([...levelPerms, ...explicitPermissions]);
    return Array.from(combined);
}

/**
 * Get role name from authority level
 */
export function getRoleName(level: AuthorityLevel): RoleName {
    const entry = Object.entries(AUTHORITY_LEVELS).find(([, v]) => v === level);
    return (entry?.[0] as RoleName) || 'USER';
}
