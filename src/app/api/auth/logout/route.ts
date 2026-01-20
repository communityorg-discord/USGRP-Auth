import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { logout } from '@/lib/auth';
import { sessionOptions, SessionData, defaultSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (session.authToken) {
            const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                request.headers.get('x-real-ip') ||
                'unknown';

            await logout(session.authToken, ip);
        }

        // Clear session
        session.authToken = undefined;
        session.user = undefined;
        session.isLoggedIn = false;
        session.lastActivity = undefined;
        session.pending2FA = false;
        session.pendingUserId = undefined;
        await session.save();

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
