/**
 * Remembered Devices API
 * 
 * Manage remembered devices for 2FA bypass
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import {
    getRememberedDevices,
    removeRememberedDevice,
    removeAllRememberedDevices,
    logAudit
} from '@/lib/db';

// GET - List remembered devices for current user
export async function GET(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const devices = getRememberedDevices(session.user.userId);

        // Format for display
        const formattedDevices = devices.map(d => ({
            id: d.id,
            deviceName: d.device_name,
            ip: d.ip,
            lastUsed: d.last_used,
            createdAt: d.created_at,
        }));

        return NextResponse.json({ devices: formattedDevices });

    } catch (error) {
        console.error('Devices GET error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Remove a remembered device
export async function DELETE(request: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.isLoggedIn || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { deviceId, all } = await request.json();

        if (all) {
            const count = removeAllRememberedDevices(session.user.userId);

            logAudit(
                session.user.userId,
                'DEVICES_REMOVE_ALL',
                null,
                `Removed ${count} remembered devices`,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
            );

            return NextResponse.json({
                success: true,
                message: `Removed ${count} remembered device(s)`
            });
        }

        if (!deviceId) {
            return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
        }

        // Verify device belongs to user by checking it exists in their list
        const devices = getRememberedDevices(session.user.userId);
        const targetDevice = devices.find(d => d.id === deviceId);

        if (!targetDevice) {
            return NextResponse.json({ error: 'Device not found' }, { status: 404 });
        }

        const removed = removeRememberedDevice(deviceId);

        if (removed) {
            logAudit(
                session.user.userId,
                'DEVICE_REMOVE',
                deviceId,
                `Removed remembered device: ${targetDevice.device_name || 'Unknown'}`,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
            );
        }

        return NextResponse.json({
            success: removed,
            message: removed ? 'Device removed' : 'Failed to remove device'
        });

    } catch (error) {
        console.error('Devices DELETE error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
