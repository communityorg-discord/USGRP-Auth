import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getUserById, updateUser, logAudit } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { changeMailPassword } from '@/lib/miab';

/**
 * Self-service password change API
 * Updates password in Auth DB AND Mail-in-a-Box
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current password and new password are required' },
                { status: 400 }
            );
        }

        // Validate new password requirements
        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Get user from database
        const user = getUserById(session.user.userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isValid = await verifyPassword(currentPassword, user.password_hash);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 401 }
            );
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password in Auth database
        const updated = updateUser(session.user.userId, {
            password_hash: newPasswordHash,
        });

        if (!updated) {
            return NextResponse.json(
                { error: 'Failed to update password in Auth' },
                { status: 500 }
            );
        }

        // Update password in Mail-in-a-Box
        const mailResult = await changeMailPassword(user.email, newPassword);

        if (!mailResult.ok) {
            console.error('Failed to update MIAB password:', mailResult.error);
            // Don't fail the whole request, just warn
            // The Auth password was already updated
        }

        // Update stored mail credentials in session
        session.mailCredentials = Buffer.from(JSON.stringify({
            e: user.email,
            p: newPassword
        })).toString('base64');
        await session.save();

        // Log the password change
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        logAudit(session.user.userId, 'PASSWORD_CHANGED', user.email, null, ip);

        return NextResponse.json({
            success: true,
            mailUpdated: mailResult.ok,
            message: mailResult.ok
                ? 'Password updated in Auth and Mail'
                : 'Password updated in Auth (Mail update may have failed)',
        });

    } catch (error: unknown) {
        console.error('Password change error:', error);
        return NextResponse.json(
            { error: 'Failed to change password' },
            { status: 500 }
        );
    }
}
