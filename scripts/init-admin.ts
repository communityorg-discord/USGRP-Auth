/**
 * Initialize first admin user script
 * Run with: npx ts-node scripts/init-admin.ts
 * Or: npm run init-admin
 */

import { createUser, getUserByEmail } from '../src/lib/db';
import { hashPassword, generateId } from '../src/lib/auth';
import { AUTHORITY_LEVELS } from '../src/lib/roles';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@usgrp.xyz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThis123!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';

async function initAdmin() {
    console.log('USGRP Auth - Initialize Admin User');
    console.log('===================================\n');

    // Check if admin already exists
    const existing = getUserByEmail(ADMIN_EMAIL);
    if (existing) {
        console.log(`User ${ADMIN_EMAIL} already exists.`);
        console.log('No changes made.');
        return;
    }

    // Create admin user
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const user = createUser({
        id: generateId(),
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        discord_id: null,
        display_name: ADMIN_NAME,
        authority_level: AUTHORITY_LEVELS.SUPERUSER,
        roles: JSON.stringify(['superuser']),
        permissions: '[]',
        enabled: 1,
        totp_secret: null,
        totp_enabled: 0,
    });

    if (user) {
        console.log('✓ Admin user created successfully!\n');
        console.log('  Email:', ADMIN_EMAIL);
        console.log('  Password:', ADMIN_PASSWORD);
        console.log('  Authority: SUPERUSER\n');
        console.log('⚠ IMPORTANT: Change the password after first login!');
    } else {
        console.error('✗ Failed to create admin user');
    }
}

initAdmin().catch(console.error);
