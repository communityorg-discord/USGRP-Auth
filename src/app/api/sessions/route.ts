/**
 * Sessions API
 * 
 * Manage user sessions: list, delete, kill all
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import {
    getUserSessions,
    deleteSession,
    deleteAllUserSessions,
    logAudit
} from '@/lib/db';

// GET - List active sessions for current user
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentSessionId = session.user.sessionId;
        const sessions = getUserSessions(session.user.userId);

        // Format sessions for display
        const formattedSessions = sessions.map(s => ({
            id: s.id,
            device: parseUserAgent(s.user_agent || ''),
            ip: s.ip || 'Unknown',
            lastActive: s.last_active,
            createdAt: s.created_at,
            isCurrent: s.id === currentSessionId,
            isRemembered: s.is_remembered === 1,
        }));

        return NextResponse.json({
            sessions: formattedSessions,
            currentSessionId
        });

    } catch (error) {
        console.error('Sessions GET error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Kill a session or all sessions
export async function DELETE(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId, all } = await request.json();
        const currentSessionId = session.user.sessionId;

        if (all) {
            // Kill all sessions except current
            const count = deleteAllUserSessions(session.user.userId, currentSessionId);

            logAudit(
                session.user.userId,
                'SESSIONS_KILL_ALL',
                null,
                `Killed ${count} sessions`,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
            );

            return NextResponse.json({
                success: true,
                message: `Logged out of ${count} other session(s)`
            });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        // Don't allow killing current session through this endpoint
        if (sessionId === currentSessionId) {
            return NextResponse.json({ error: 'Cannot kill current session. Use logout instead.' }, { status: 400 });
        }

        // Verify session belongs to user
        const userSessions = getUserSessions(session.user.userId);
        const targetSession = userSessions.find(s => s.id === sessionId);

        if (!targetSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const deleted = deleteSession(sessionId);

        if (deleted) {
            logAudit(
                session.user.userId,
                'SESSION_KILL',
                sessionId,
                `Killed session from ${targetSession.ip || 'unknown IP'}`,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
            );
        }

        return NextResponse.json({
            success: deleted,
            message: deleted ? 'Session terminated' : 'Failed to terminate session'
        });

    } catch (error) {
        console.error('Sessions DELETE error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// Helper function to parse user agent string
function parseUserAgent(ua: string): string {
    if (!ua) return 'Unknown Device';

    // Browser detection
    let browser = 'Unknown Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

    // OS detection
    let os = 'Unknown OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
}
