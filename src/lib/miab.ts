/**
 * Mail-in-a-Box API Client
 * 
 * Integrates with MIAB admin API for mailbox management.
 * Docs: https://mailinabox.email/api-docs.html
 */

// MIAB API Configuration
const MIAB_API_URL = process.env.MIAB_API_URL || 'https://box.usgrp.xyz/admin';
const MIAB_ADMIN_EMAIL = process.env.MIAB_ADMIN_EMAIL || '';
const MIAB_ADMIN_PASSWORD = process.env.MIAB_ADMIN_PASSWORD || '';

/**
 * Get Basic Auth header for MIAB API
 */
function getAuthHeader(): string {
    const credentials = Buffer.from(`${MIAB_ADMIN_EMAIL}:${MIAB_ADMIN_PASSWORD}`).toString('base64');
    return `Basic ${credentials}`;
}

/**
 * Make authenticated request to MIAB API
 */
async function miabRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: Record<string, string>
): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
        const url = `${MIAB_API_URL}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };

        if (body) {
            options.body = new URLSearchParams(body).toString();
        }

        const response = await fetch(url, options);
        const text = await response.text();

        if (!response.ok) {
            return { ok: false, error: text || response.statusText };
        }

        // MIAB returns plain text for most responses
        try {
            return { ok: true, data: JSON.parse(text) };
        } catch {
            return { ok: true, data: text };
        }
    } catch (error: any) {
        console.error('MIAB API error:', error);
        return { ok: false, error: error.message || 'MIAB API request failed' };
    }
}

// ============================================
// User/Mailbox Management
// ============================================

export interface MailUser {
    email: string;
    privileges: string[];
    status: string;
    mailbox?: string;
}

/**
 * Get all mail users
 */
export async function getMailUsers(): Promise<{ ok: boolean; users?: MailUser[]; error?: string }> {
    const result = await miabRequest('/mail/users?format=json');
    if (!result.ok) {
        return { ok: false, error: result.error };
    }
    return { ok: true, users: result.data };
}

/**
 * Create a new mailbox
 */
export async function createMailbox(
    email: string,
    password: string
): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/users/add', 'POST', {
        email,
        password,
    });

    if (!result.ok) {
        return { ok: false, error: result.error };
    }

    // MIAB returns "mail user added" on success
    if (result.data?.includes?.('added') || result.data === 'mail user added') {
        return { ok: true };
    }

    return { ok: false, error: result.data || 'Unknown error' };
}

/**
 * Delete a mailbox
 */
export async function deleteMailbox(email: string): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/users/remove', 'POST', {
        email,
    });

    if (!result.ok) {
        return { ok: false, error: result.error };
    }

    return { ok: true };
}

/**
 * Change mailbox password
 */
export async function changeMailPassword(
    email: string,
    password: string
): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/users/password', 'POST', {
        email,
        password,
    });

    if (!result.ok) {
        return { ok: false, error: result.error };
    }

    return { ok: true };
}

/**
 * Add admin privilege to user
 */
export async function addAdminPrivilege(email: string): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/users/privileges/add', 'POST', {
        email,
        privilege: 'admin',
    });

    return { ok: result.ok, error: result.error };
}

/**
 * Remove admin privilege from user
 */
export async function removeAdminPrivilege(email: string): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/users/privileges/remove', 'POST', {
        email,
        privilege: 'admin',
    });

    return { ok: result.ok, error: result.error };
}

// ============================================
// Alias Management
// ============================================

export interface MailAlias {
    address: string;
    forwardsTo: string[];
    permittedSenders?: string[];
}

/**
 * Get all aliases
 */
export async function getAliases(): Promise<{ ok: boolean; aliases?: MailAlias[]; error?: string }> {
    const result = await miabRequest('/mail/aliases?format=json');
    if (!result.ok) {
        return { ok: false, error: result.error };
    }
    return { ok: true, aliases: result.data };
}

/**
 * Create an alias
 */
export async function createAlias(
    address: string,
    forwardsTo: string
): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/aliases/add', 'POST', {
        address,
        forwards_to: forwardsTo,
    });

    return { ok: result.ok, error: result.error };
}

/**
 * Delete an alias
 */
export async function deleteAlias(address: string): Promise<{ ok: boolean; error?: string }> {
    const result = await miabRequest('/mail/aliases/remove', 'POST', {
        address,
    });

    return { ok: result.ok, error: result.error };
}

// ============================================
// System Status
// ============================================

/**
 * Get MIAB system status
 */
export async function getSystemStatus(): Promise<{ ok: boolean; status?: any; error?: string }> {
    const result = await miabRequest('/system/status');
    if (!result.ok) {
        return { ok: false, error: result.error };
    }
    return { ok: true, status: result.data };
}

/**
 * Test connection to MIAB API
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!MIAB_ADMIN_EMAIL || !MIAB_ADMIN_PASSWORD) {
        return { ok: false, error: 'MIAB credentials not configured' };
    }

    const result = await getMailUsers();
    return { ok: result.ok, error: result.error };
}
