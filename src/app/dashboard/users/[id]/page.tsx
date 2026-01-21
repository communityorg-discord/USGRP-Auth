'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface User {
    id: string;
    email: string;
    display_name: string;
    discord_id: string | null;
    authority_level: number;
    enabled: boolean;
    totp_enabled: boolean;
    created_at: string;
    has_mailbox?: boolean;
    permissions?: string[];
}

interface AuditLog {
    id: string;
    action: string;
    details: string | null;
    ip_address: string | null;
    created_at: string;
}

const AUTHORITY_NAMES: Record<number, string> = {
    0: 'User',
    1: 'Moderator',
    2: 'Senior Mod',
    3: 'Admin',
    4: 'HR',
    5: 'Superuser',
    6: 'Bot Developer',
};

export default function UserDetailPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [user, setUser] = useState<User | null>(null);
    const [activity, setActivity] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Edit form state
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editDiscordId, setEditDiscordId] = useState('');
    const [editAuthorityLevel, setEditAuthorityLevel] = useState(0);
    const [editEnabled, setEditEnabled] = useState(true);

    useEffect(() => {
        loadData();
    }, [userId]);

    async function loadData() {
        try {
            // Check auth
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            if (!sessionData.authenticated || sessionData.user.authorityLevel < 3) {
                router.push('/dashboard');
                return;
            }
            setCurrentUser(sessionData.user);

            // Load user
            const userRes = await fetch(`/api/users?userId=${userId}`);
            if (userRes.ok) {
                const userData = await userRes.json();
                if (userData.user) {
                    setUser(userData.user);
                    setEditDisplayName(userData.user.display_name || userData.user.displayName || '');
                    setEditDiscordId(userData.user.discord_id || userData.user.discordId || '');
                    setEditAuthorityLevel(userData.user.authority_level ?? userData.user.authorityLevel ?? 0);
                    setEditEnabled(userData.user.enabled !== false);
                }
            }

            // Load activity
            const activityRes = await fetch(`/api/audit?userId=${userId}&limit=20`);
            if (activityRes.ok) {
                const activityData = await activityRes.json();
                setActivity(activityData.logs || []);
            }
        } catch (e) {
            console.error('Load error:', e);
            setError('Failed to load user data');
        } finally {
            setLoading(false);
        }
    }

    async function saveChanges() {
        if (!user) return;

        setSaving(true);
        setMessage('');
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    displayName: editDisplayName,
                    discordId: editDiscordId || null,
                    authorityLevel: editAuthorityLevel,
                    enabled: editEnabled,
                }),
            });

            if (res.ok) {
                setMessage('User updated successfully!');
                setEditing(false);
                await loadData();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update user');
            }
        } catch (e) {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    }

    function formatDate(dateStr: string): string {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString();
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading user...
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <h2 style={{ color: 'var(--gov-red)' }}>User Not Found</h2>
                <Link href="/dashboard/users" className="gov-btn gov-btn-secondary">
                    ← Back to Users
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <Link href="/dashboard/users" style={{ color: 'var(--gov-blue)', fontSize: '0.875rem', textDecoration: 'none' }}>
                        ← Back to Users
                    </Link>
                    <h1 className="gov-page-title" style={{ marginTop: '0.5rem' }}>{user.display_name || user.email}</h1>
                    <p className="gov-page-subtitle">{user.email}</p>
                </div>
                {!editing && (
                    <button onClick={() => setEditing(true)} className="gov-btn gov-btn-primary">
                        ✏️ Edit User
                    </button>
                )}
            </div>

            {message && <div className="gov-alert gov-alert-success">{message}</div>}
            {error && <div className="gov-alert gov-alert-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* User Details / Edit Form */}
                <div className="gov-card">
                    <div className="gov-card-header">
                        <h2 className="gov-card-title">{editing ? 'Edit User' : 'User Details'}</h2>
                    </div>
                    <div className="gov-card-body">
                        {editing ? (
                            <div>
                                <div className="gov-form-group">
                                    <label className="gov-form-label">Display Name</label>
                                    <input
                                        type="text"
                                        className="gov-form-input"
                                        value={editDisplayName}
                                        onChange={(e) => setEditDisplayName(e.target.value)}
                                    />
                                </div>
                                <div className="gov-form-group">
                                    <label className="gov-form-label">Discord ID</label>
                                    <input
                                        type="text"
                                        className="gov-form-input"
                                        value={editDiscordId}
                                        onChange={(e) => setEditDiscordId(e.target.value)}
                                        placeholder="123456789012345678"
                                    />
                                </div>
                                {currentUser?.authorityLevel >= 5 && (
                                    <div className="gov-form-group">
                                        <label className="gov-form-label">Authority Level</label>
                                        <select
                                            className="gov-form-input"
                                            value={editAuthorityLevel}
                                            onChange={(e) => setEditAuthorityLevel(parseInt(e.target.value))}
                                        >
                                            {Object.entries(AUTHORITY_NAMES).map(([level, name]) => (
                                                <option key={level} value={level}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="gov-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input
                                        type="checkbox"
                                        id="enabled"
                                        checked={editEnabled}
                                        onChange={(e) => setEditEnabled(e.target.checked)}
                                    />
                                    <label htmlFor="enabled" style={{ margin: 0 }}>Account Enabled</label>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                    <button onClick={saveChanges} disabled={saving} className="gov-btn gov-btn-primary">
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button onClick={() => setEditing(false)} className="gov-btn gov-btn-secondary">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>User ID</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{user.id}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Email</div>
                                    <div>{user.email}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Display Name</div>
                                    <div>{user.display_name || 'Not set'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Discord ID</div>
                                    <div style={{ fontFamily: 'monospace' }}>{user.discord_id || 'Not linked'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Authority Level</div>
                                    <span className="gov-badge gov-badge-blue">
                                        {AUTHORITY_NAMES[user.authority_level] || 'User'}
                                    </span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Status</div>
                                    <span className={`gov-badge ${user.enabled ? 'gov-badge-green' : 'gov-badge-red'}`}>
                                        {user.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Two-Factor Auth</div>
                                    <span className={`gov-badge ${user.totp_enabled ? 'gov-badge-green' : 'gov-badge-gold'}`}>
                                        {user.totp_enabled ? 'Enabled' : 'Not Set Up'}
                                    </span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)', marginBottom: '0.25rem' }}>Created</div>
                                    <div>{formatDate(user.created_at)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="gov-card">
                    <div className="gov-card-header">
                        <h2 className="gov-card-title">Recent Activity</h2>
                    </div>
                    <div className="gov-card-body" style={{ padding: 0 }}>
                        {activity.length > 0 ? (
                            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                {activity.map((log) => (
                                    <div key={log.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--gov-gray-lighter)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="gov-badge gov-badge-blue">{log.action.replace(/_/g, ' ')}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gov-gray)' }}>{formatDate(log.created_at)}</span>
                                        </div>
                                        {log.details && (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--gov-gray)', marginTop: '0.5rem' }}>
                                                {log.details}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gov-gray)' }}>
                                No recent activity
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
