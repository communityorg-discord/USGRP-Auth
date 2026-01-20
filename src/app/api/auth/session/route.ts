import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ authenticated: false });
        }

        return NextResponse.json({
            authenticated: true,
            user: session.user,
        });

    } catch (error: unknown) {
        console.error('Session check error:', error);
        return NextResponse.json({ authenticated: false });
    }
}
