/**
 * Approvals API
 * 
 * Two-person rule for high-risk actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb, logAudit, ApprovalRequest } from '@/lib/db';
import crypto from 'crypto';

// Actions that require approval
const APPROVAL_REQUIRED_ACTIONS = [
    'USER_DELETE',
    'AUTHORITY_CHANGE_ADMIN',  // Changing authority for users level 3+
    'USER_SUSPEND',
    'USER_UNSUSPEND',
    'RESET_2FA_ADMIN',  // Resetting 2FA for admins
];

// GET - List pending approvals
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Require Admin (level 3+) to view approvals
        if (session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get('status') || 'pending';
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const db = getDb();

        // Clean up expired approvals
        db.prepare(`
            UPDATE approval_requests 
            SET status = 'expired' 
            WHERE status = 'pending' AND expires_at < datetime('now')
        `).run();

        // Get approvals
        const approvals = db.prepare(`
            SELECT 
                ar.*,
                r.display_name as requester_name,
                r.email as requester_email,
                a.display_name as approver_name
            FROM approval_requests ar
            LEFT JOIN users r ON ar.requester_id = r.id
            LEFT JOIN users a ON ar.approver_id = a.id
            WHERE ar.status = ?
            ORDER BY ar.created_at DESC
            LIMIT ?
        `).all(status, limit);

        return NextResponse.json({ approvals });

    } catch (error) {
        console.error('Approvals GET error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create approval request
export async function POST(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Require Admin (level 3+) to create requests
        if (session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { actionType, targetUser, actionData, reason } = await request.json();

        if (!actionType || !reason) {
            return NextResponse.json({ error: 'Action type and reason required' }, { status: 400 });
        }

        // Check if action requires approval
        if (!APPROVAL_REQUIRED_ACTIONS.includes(actionType)) {
            return NextResponse.json({
                error: 'This action does not require approval',
                requiresApproval: false
            }, { status: 400 });
        }

        const db = getDb();
        const id = crypto.randomUUID();

        // Approval expires in 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        db.prepare(`
            INSERT INTO approval_requests 
            (id, requester_id, action_type, target_user, action_data, reason, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            session.user.userId,
            actionType,
            targetUser || null,
            actionData ? JSON.stringify(actionData) : null,
            reason,
            expiresAt.toISOString()
        );

        logAudit(
            session.user.userId,
            'APPROVAL_REQUESTED',
            targetUser,
            `Requested approval for ${actionType}: ${reason}`,
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        );

        return NextResponse.json({
            success: true,
            approvalId: id,
            message: 'Approval request created. Waiting for another admin to approve.'
        });

    } catch (error) {
        console.error('Approvals POST error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Approve or deny request
export async function PUT(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Require Admin (level 3+) to approve
        if (session.user.authorityLevel < 3) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { approvalId, decision, approverReason } = await request.json();

        if (!approvalId || !decision) {
            return NextResponse.json({ error: 'Approval ID and decision required' }, { status: 400 });
        }

        if (!['approved', 'denied'].includes(decision)) {
            return NextResponse.json({ error: 'Decision must be "approved" or "denied"' }, { status: 400 });
        }

        const db = getDb();

        // Get the approval request
        const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?')
            .get(approvalId) as ApprovalRequest | undefined;

        if (!approval) {
            return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
        }

        if (approval.status !== 'pending') {
            return NextResponse.json({ error: 'Request already resolved' }, { status: 400 });
        }

        // Two-person rule: Cannot approve your own request
        if (approval.requester_id === session.user.userId) {
            return NextResponse.json({
                error: 'Cannot approve your own request (two-person rule)'
            }, { status: 403 });
        }

        // Check expiry
        if (new Date(approval.expires_at) < new Date()) {
            db.prepare('UPDATE approval_requests SET status = ? WHERE id = ?')
                .run('expired', approvalId);
            return NextResponse.json({ error: 'Request has expired' }, { status: 400 });
        }

        // Update the approval
        db.prepare(`
            UPDATE approval_requests 
            SET status = ?, approver_id = ?, approver_reason = ?, resolved_at = datetime('now')
            WHERE id = ?
        `).run(decision, session.user.userId, approverReason || null, approvalId);

        logAudit(
            session.user.userId,
            decision === 'approved' ? 'APPROVAL_APPROVED' : 'APPROVAL_DENIED',
            approval.target_user,
            `${decision} request for ${approval.action_type}${approverReason ? `: ${approverReason}` : ''}`,
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        );

        // If approved, execute the action
        let actionResult = null;
        if (decision === 'approved') {
            actionResult = await executeApprovedAction(approval, db);
        }

        return NextResponse.json({
            success: true,
            decision,
            actionResult,
            message: `Request ${decision}`
        });

    } catch (error) {
        console.error('Approvals PUT error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// Execute an approved action
async function executeApprovedAction(approval: ApprovalRequest, db: ReturnType<typeof getDb>) {
    const actionData = approval.action_data ? JSON.parse(approval.action_data) : {};

    switch (approval.action_type) {
        case 'USER_DELETE':
            if (approval.target_user) {
                db.prepare('DELETE FROM users WHERE id = ?').run(approval.target_user);
                return { executed: true, action: 'User deleted' };
            }
            break;

        case 'USER_SUSPEND':
            if (approval.target_user) {
                db.prepare(`
                    UPDATE users 
                    SET suspended = 1, suspended_reason = ?, suspended_at = datetime('now'), suspended_by = ?
                    WHERE id = ?
                `).run(actionData.reason || approval.reason, approval.requester_id, approval.target_user);
                // Also clear their sessions
                db.prepare('DELETE FROM sessions WHERE user_id = ?').run(approval.target_user);
                return { executed: true, action: 'User suspended' };
            }
            break;

        case 'USER_UNSUSPEND':
            if (approval.target_user) {
                db.prepare(`
                    UPDATE users 
                    SET suspended = 0, suspended_reason = NULL, suspended_at = NULL, suspended_by = NULL
                    WHERE id = ?
                `).run(approval.target_user);
                return { executed: true, action: 'User unsuspended' };
            }
            break;

        case 'AUTHORITY_CHANGE_ADMIN':
            if (approval.target_user && actionData.newLevel !== undefined) {
                db.prepare('UPDATE users SET authority_level = ? WHERE id = ?')
                    .run(actionData.newLevel, approval.target_user);
                return { executed: true, action: `Authority changed to ${actionData.newLevel}` };
            }
            break;

        case 'RESET_2FA_ADMIN':
            if (approval.target_user) {
                db.prepare(`
                    UPDATE users 
                    SET totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL
                    WHERE id = ?
                `).run(approval.target_user);
                return { executed: true, action: '2FA reset' };
            }
            break;
    }

    return { executed: false, action: 'Unknown action' };
}
