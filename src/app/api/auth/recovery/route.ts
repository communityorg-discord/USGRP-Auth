/**
 * Recovery Codes API
 * 
 * Generate and use recovery codes for 2FA backup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb, logAudit } from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Generate recovery codes
function generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
        // Generate 8-character alphanumeric codes
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
}

// Hash recovery codes for storage
async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
    const hashed = await Promise.all(
        codes.map(code => bcrypt.hash(code, 10))
    );
    return hashed;
}

// POST - Generate new recovery codes
export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user needs to verify password first (security measure)
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({
                error: 'Password required to generate recovery codes'
            }, { status: 400 });
        }

        // Verify password
        const db = getDb();
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?')
            .get(session.user.userId) as { password_hash: string } | undefined;

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        // Generate new codes
        const codes = generateRecoveryCodes();
        const hashedCodes = await hashRecoveryCodes(codes);

        // Save hashed codes to database
        const stmt = db.prepare(`
            UPDATE users 
            SET recovery_codes = ?, updated_at = datetime('now')
            WHERE id = ?
        `);
        stmt.run(JSON.stringify(hashedCodes), session.user.userId);

        logAudit(
            session.user.userId,
            'RECOVERY_CODES_GENERATED',
            null,
            'Generated new recovery codes',
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        );

        // Return plain codes (only time user will see them)
        return NextResponse.json({
            success: true,
            codes,
            message: 'Save these codes securely. They will not be shown again.'
        });

    } catch (error) {
        console.error('Recovery codes generation error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Use a recovery code to bypass 2FA
export async function PUT(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        // Allow for pending 2FA state
        if (!session.pending2FA || !session.pendingUserId) {
            return NextResponse.json({ error: 'No pending 2FA verification' }, { status: 400 });
        }

        const { code } = await request.json();

        if (!code) {
            return NextResponse.json({ error: 'Recovery code required' }, { status: 400 });
        }

        const db = getDb();
        const user = db.prepare('SELECT id, recovery_codes FROM users WHERE id = ?')
            .get(session.pendingUserId) as { id: string; recovery_codes: string | null } | undefined;

        if (!user || !user.recovery_codes) {
            return NextResponse.json({ error: 'No recovery codes found' }, { status: 400 });
        }

        const hashedCodes: string[] = JSON.parse(user.recovery_codes);

        // Try to match the code
        let matchedIndex = -1;
        for (let i = 0; i < hashedCodes.length; i++) {
            const valid = await bcrypt.compare(code.toUpperCase(), hashedCodes[i]);
            if (valid) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex === -1) {
            logAudit(
                session.pendingUserId,
                'RECOVERY_CODE_FAILED',
                null,
                'Invalid recovery code attempt',
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
            );
            return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 });
        }

        // Remove used code
        hashedCodes.splice(matchedIndex, 1);
        db.prepare('UPDATE users SET recovery_codes = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(JSON.stringify(hashedCodes), session.pendingUserId);

        logAudit(
            session.pendingUserId,
            'RECOVERY_CODE_USED',
            null,
            `Used recovery code. ${hashedCodes.length} remaining.`,
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        );

        // Clear pending state and mark as logged in
        return NextResponse.json({
            success: true,
            remainingCodes: hashedCodes.length,
            message: `Recovery code accepted. ${hashedCodes.length} codes remaining.`
        });

    } catch (error) {
        console.error('Recovery code validation error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// GET - Check if user has recovery codes
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = getDb();
        const user = db.prepare('SELECT recovery_codes FROM users WHERE id = ?')
            .get(session.user.userId) as { recovery_codes: string | null } | undefined;

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const hasRecoveryCodes = !!user.recovery_codes;
        let codeCount = 0;

        if (user.recovery_codes) {
            try {
                const codes = JSON.parse(user.recovery_codes);
                codeCount = codes.length;
            } catch {
                codeCount = 0;
            }
        }

        return NextResponse.json({
            hasRecoveryCodes,
            codeCount
        });

    } catch (error) {
        console.error('Recovery codes check error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
