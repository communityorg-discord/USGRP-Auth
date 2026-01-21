import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { logAudit, getAuditLog, getAuditLogByUser } from '@/lib/db';
import { requiresAuthority } from '@/lib/auth';
import { AUTHORITY_LEVELS } from '@/lib/roles';

// API key for bot authentication
const BOT_API_KEY = 'usgrp-admin-2026-secure-key-x7k9m2p4';

// GET: Retrieve audit logs (ADMIN+ only)
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!requiresAuthority(session.user, AUTHORITY_LEVELS.ADMIN)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        let logs;
        if (userId) {
            logs = getAuditLogByUser(userId, limit);
        } else {
            logs = getAuditLog(limit, offset);
        }

        return NextResponse.json({ logs });

    } catch (error: unknown) {
        console.error('Get audit log error:', error);
        return NextResponse.json({ error: 'Failed to get audit log' }, { status: 500 });
    }
}

// POST: Create audit log entry (Bot API)
export async function POST(request: NextRequest) {
    try {
        // Verify API key
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        if (apiKey !== BOT_API_KEY) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const { userId, action, target, details } = await request.json();

        if (!action) {
            return NextResponse.json({ error: 'Action required' }, { status: 400 });
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'bot';

        logAudit(userId || null, action, target || null, details || null, ip);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Audit log error:', error);
        return NextResponse.json({ error: 'Failed to log audit' }, { status: 500 });
    }
}

