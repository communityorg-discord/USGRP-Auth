import { NextRequest, NextResponse } from 'next/server';
import { getUserByDiscordId as dbGetUserByDiscordId } from '@/lib/db';

// API key for bot authentication
const BOT_API_KEY = process.env.BOT_API_KEY || 'usgrp-bot-api-key-change-in-production';

type Params = {
    params: Promise<{ discordId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
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

        const { discordId } = await params;

        if (!discordId) {
            return NextResponse.json({ error: 'Discord ID required' }, { status: 400 });
        }

        const user = dbGetUserByDiscordId(discordId);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            user: {
                userId: user.id,
                email: user.email,
                discordId: user.discord_id,
                displayName: user.display_name,
                authorityLevel: user.authority_level,
                roles: JSON.parse(user.roles || '[]'),
                permissions: JSON.parse(user.permissions || '[]'),
                enabled: !!user.enabled,
            },
        });

    } catch (error: unknown) {
        console.error('Get user by Discord ID error:', error);
        return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
    }
}
