import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import {
    getAllUsers,
    createUser as dbCreateUser,
    updateUser as dbUpdateUser,
    deleteUser as dbDeleteUser,
    disableUser,
    enableUser,
    logAudit,
    type User
} from '@/lib/db';
import { hashPassword, generateId, requiresAuthority } from '@/lib/auth';
import { AUTHORITY_LEVELS } from '@/lib/roles';

// Get all users (ADMIN+ only)
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!requiresAuthority(session.user, AUTHORITY_LEVELS.ADMIN)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const users = getAllUsers().map((u: User) => ({
            id: u.id,
            email: u.email,
            discordId: u.discord_id,
            displayName: u.display_name,
            authorityLevel: u.authority_level,
            roles: JSON.parse(u.roles || '[]'),
            permissions: JSON.parse(u.permissions || '[]'),
            enabled: !!u.enabled,
            totpEnabled: !!u.totp_enabled,
            createdAt: u.created_at,
            updatedAt: u.updated_at,
        }));

        return NextResponse.json({ users });

    } catch (error: unknown) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
    }
}

// Create a new user (ADMIN+ only)
export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!requiresAuthority(session.user, AUTHORITY_LEVELS.ADMIN)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { email, password, displayName, discordId, authorityLevel } = await request.json();

        if (!email || !password || !displayName) {
            return NextResponse.json(
                { error: 'Email, password, and display name required' },
                { status: 400 }
            );
        }

        // Check admin can't create users with higher authority than themselves
        const requestedLevel = authorityLevel ?? AUTHORITY_LEVELS.USER;
        if (requestedLevel > session.user.authorityLevel) {
            return NextResponse.json(
                { error: 'Cannot create user with higher authority than yourself' },
                { status: 403 }
            );
        }

        const passwordHash = await hashPassword(password);

        const user = dbCreateUser({
            id: generateId(),
            email: email.toLowerCase(),
            password_hash: passwordHash,
            discord_id: discordId || null,
            display_name: displayName,
            authority_level: requestedLevel,
            roles: '[]',
            permissions: '[]',
            enabled: 1,
            totp_secret: null,
            totp_enabled: 0,
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Failed to create user (email may already exist)' },
                { status: 400 }
            );
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'USER_CREATED', user.email, null, ip);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                authorityLevel: user.authority_level,
            },
        });

    } catch (error: unknown) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// Update user (ADMIN+ only)
export async function PUT(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!requiresAuthority(session.user, AUTHORITY_LEVELS.ADMIN)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { userId, email, displayName, discordId, authorityLevel, password, enabled, permissions } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};

        if (email !== undefined) updates.email = email;
        if (displayName !== undefined) updates.display_name = displayName;
        if (discordId !== undefined) updates.discord_id = discordId;
        if (authorityLevel !== undefined) {
            if (authorityLevel > session.user.authorityLevel) {
                return NextResponse.json(
                    { error: 'Cannot set authority higher than yourself' },
                    { status: 403 }
                );
            }
            updates.authority_level = authorityLevel;
        }
        if (password !== undefined) {
            updates.password_hash = await hashPassword(password);
        }
        if (enabled !== undefined) {
            updates.enabled = enabled ? 1 : 0;
        }
        if (permissions !== undefined) {
            updates.permissions = JSON.stringify(permissions);
        }

        const success = dbUpdateUser(userId, updates);

        if (!success) {
            return NextResponse.json({ error: 'Failed to update user' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'USER_UPDATED', userId, JSON.stringify(Object.keys(updates)), ip);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

// Delete user (SUPERUSER only)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!requiresAuthority(session.user, AUTHORITY_LEVELS.SUPERUSER)) {
            return NextResponse.json({ error: 'Forbidden - SUPERUSER required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // Prevent deleting yourself
        if (userId === session.user.userId) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
        }

        const success = dbDeleteUser(userId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete user' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'USER_DELETED', userId, null, ip);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
