import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth';
import { logAudit } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { token, service } = await request.json();

        if (!token) {
            return NextResponse.json(
                { valid: false, error: 'Token required' },
                { status: 400 }
            );
        }

        const result = await validateToken(token);

        if (!result.valid) {
            return NextResponse.json(
                { valid: false, error: result.error },
                { status: 401 }
            );
        }

        // Log SSO access to service
        if (service && result.user) {
            const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                request.headers.get('x-real-ip') ||
                'unknown';
            logAudit(
                result.user.userId,
                'SSO_ACCESS',
                service,
                `Authenticated via SSO to ${service}`,
                ip
            );
        }

        return NextResponse.json({
            valid: true,
            user: result.user,
        });

    } catch (error: unknown) {
        console.error('Token validation error:', error);
        return NextResponse.json(
            { valid: false, error: 'Validation failed' },
            { status: 500 }
        );
    }
}

// Also support GET for simple token checks (header auth)
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { valid: false, error: 'Authorization header required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const result = await validateToken(token);

        if (!result.valid) {
            return NextResponse.json(
                { valid: false, error: result.error },
                { status: 401 }
            );
        }

        return NextResponse.json({
            valid: true,
            user: result.user,
        });

    } catch (error: unknown) {
        console.error('Token validation error:', error);
        return NextResponse.json(
            { valid: false, error: 'Validation failed' },
            { status: 500 }
        );
    }
}

