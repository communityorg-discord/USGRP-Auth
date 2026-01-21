import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import {
    getMailUsers,
    createMailbox,
    deleteMailbox,
    changeMailPassword,
    MailUser
} from '@/lib/miab';
import { getUserByEmail, updateUser, deleteUser, getAllUsers, logAudit, User } from '@/lib/db';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import path from 'path';

const DATA_DIR = process.env.AUTH_DATA_DIR || (
    process.platform === 'win32'
        ? 'C:/usgrp-auth-data'
        : '/var/lib/usgrp-auth'
);
const DB_PATH = path.join(DATA_DIR, 'auth.db');

/**
 * Combined User + Mailbox Management API
 * 
 * This creates users in Auth AND mailboxes in Mail-in-a-box together.
 */

// GET: List all users (Auth DB + MIAB status)
export async function GET() {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user || session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Auth users
        const authUsers = getAllUsers();

        // Get MIAB mailboxes
        const miabResult = await getMailUsers();
        const mailboxes = miabResult.ok ? (miabResult.users || []) : [];

        // Debug logging
        console.log('MIAB Result:', miabResult.ok ? `Found ${mailboxes.length} mailboxes` : miabResult.error);
        if (mailboxes.length > 0) {
            console.log('Mailbox emails:', mailboxes.map(m => m.email));
        }

        // Merge data - use case-insensitive email matching
        const users = authUsers.map((u: User) => {
            const userEmail = u.email.toLowerCase();
            const mailbox = mailboxes.find((m: MailUser) => m.email.toLowerCase() === userEmail);
            return {
                id: u.id,
                email: u.email,
                displayName: u.display_name,
                discordId: u.discord_id,
                authorityLevel: u.authority_level,
                enabled: !!u.enabled,
                totpEnabled: !!u.totp_enabled,
                createdAt: u.created_at,
                hasMailbox: !!mailbox,
                mailboxStatus: mailbox?.status,
                isMailAdmin: mailbox?.privileges?.includes('admin'),
            };
        });

        return NextResponse.json({
            users,
            miabConnected: miabResult.ok,
        });

    } catch (error: unknown) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
    }
}

// POST: Create user + mailbox
export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user || session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { email, password, displayName, discordId, authorityLevel, createMailbox: shouldCreateMailbox } = body;

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: 'Email, password, and displayName are required' }, { status: 400 });
        }

        // Check if user already exists
        const existing = getUserByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        // Create mailbox in MIAB first (if requested)
        if (shouldCreateMailbox !== false) {
            const mailResult = await createMailbox(email, password);
            if (!mailResult.ok) {
                return NextResponse.json({
                    error: `Failed to create mailbox: ${mailResult.error}`
                }, { status: 500 });
            }
        }

        // Create user in Auth DB directly
        const userId = randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);

        const db = new Database(DB_PATH);
        db.prepare(`
            INSERT INTO users (id, email, password_hash, discord_id, display_name, 
                authority_level, roles, permissions, enabled, totp_secret, totp_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            email.toLowerCase(),
            passwordHash,
            discordId || null,
            displayName,
            authorityLevel || 0,
            '[]',
            '[]',
            1,
            null,
            0
        );
        db.close();

        // Log audit
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'user.create', userId, `Created user ${email}`, ip);

        return NextResponse.json({
            success: true,
            userId,
            mailboxCreated: shouldCreateMailbox !== false,
        });

    } catch (error: unknown) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// PUT: Update user
export async function PUT(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user || session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, email, password, displayName, discordId, authorityLevel, enabled } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (displayName !== undefined) updates.display_name = displayName;
        if (discordId !== undefined) updates.discord_id = discordId;
        if (authorityLevel !== undefined) updates.authority_level = authorityLevel;
        if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;

        // If password changed, update both Auth and MIAB
        if (password) {
            updates.password_hash = await bcrypt.hash(password, 10);

            if (email) {
                const mailResult = await changeMailPassword(email, password);
                if (!mailResult.ok) {
                    console.warn('Failed to update MIAB password:', mailResult.error);
                }
            }
        }

        updateUser(userId, updates);

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'user.update', userId, `Updated user`, ip);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

// DELETE: Delete user + mailbox
export async function DELETE(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user || session.user.authorityLevel < 5) {
            return NextResponse.json({ error: 'Unauthorized - requires SUPERUSER' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const email = searchParams.get('email');
        const deleteMailboxToo = searchParams.get('deleteMailbox') !== 'false';

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Delete mailbox from MIAB
        if (deleteMailboxToo && email) {
            const mailResult = await deleteMailbox(email);
            if (!mailResult.ok) {
                console.warn('Failed to delete MIAB mailbox:', mailResult.error);
            }
        }

        // Delete from Auth DB
        deleteUser(userId);

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'user.delete', userId, `Deleted user ${email}`, ip);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
