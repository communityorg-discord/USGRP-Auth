import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/db';

// API key for bot authentication
const BOT_API_KEY = 'usgrp-admin-2026-secure-key-x7k9m2p4';

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
