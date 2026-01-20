import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { login } from '@/lib/auth';
import { sessionOptions, extendedSessionOptions, SessionData } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password, rememberMe, returnUrl } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password required' },
                { status: 400 }
            );
        }

        // Get IP and user agent for audit logging
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Attempt login
        const result = await login(email, password, ip, userAgent, rememberMe);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Login failed' },
                { status: 401 }
            );
        }

        // Check if 2FA is required
        if (result.requires2FA) {
            // Store pending 2FA state in session
            const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
            session.pending2FA = true;
            session.pendingUserId = result.user?.userId;
            session.isLoggedIn = false;
            await session.save();

            return NextResponse.json({
                success: true,
                requires2FA: true,
            });
        }

        // Successful login - save session
        const options = rememberMe ? extendedSessionOptions : sessionOptions;
        const session = await getIronSession<SessionData>(await cookies(), options);
        session.authToken = result.token;
        session.user = {
            ...result.user!,
            sessionId: '', // Will be from token
        };
        session.isLoggedIn = true;
        session.lastActivity = Date.now();
        session.pending2FA = false;
        await session.save();

        // If there's a return URL, include it in response for client-side redirect
        return NextResponse.json({
            success: true,
            token: result.token,
            user: result.user,
            returnUrl: returnUrl || null,
        });

    } catch (error: unknown) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Login failed' },
            { status: 500 }
        );
    }
}
