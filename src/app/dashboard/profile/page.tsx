'use client';

import { useState, useEffect } from 'react';

interface User {
    userId: string;
    email: string;
    displayName: string;
    discordId: string | null;
    authorityLevel: number;
    roles: string[];
    permissions: string[];
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

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [discordId, setDiscordId] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (data.authenticated && data.user) {
                    setUser(data.user);
                    setDisplayName(data.user.displayName);
                    setDiscordId(data.user.discordId || '');
                }
            } catch (e) {
                console.error('Failed to load profile:', e);
            } finally {
                setLoading(false);
            }
        }
        loadProfile();
    }, []);

    async function handleSave() {
        if (!user) return;

        setSaving(true);
        setMessage('');
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.userId,
                    displayName,
                    discordId: discordId || null,
                }),
            });

            if (res.ok) {
                setMessage('Profile updated successfully');
                setEditing(false);
                // Refresh user data
                const sessionRes = await fetch('/api/auth/session');
                const sessionData = await sessionRes.json();
                if (sessionData.user) setUser(sessionData.user);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update profile');
            }
        } catch (e) {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading profile...
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">My Profile</h1>
                <p className="gov-page-subtitle">View and manage your account information</p>
            </div>

            {message && <div className="gov-alert gov-alert-success">{message}</div>}
            {error && <div className="gov-alert gov-alert-error">{error}</div>}

            {/* Personal Information */}
            <div className="gov-card">
                <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="gov-card-title">Personal Information</h2>
                    {!editing && (
                        <button onClick={() => setEditing(true)} className="gov-btn gov-btn-secondary">
                            ✏️ Edit
                        </button>
                    )}
                </div>
                <div className="gov-card-body">
                    {editing ? (
                        <div>
                            <div className="gov-form-group">
                                <label className="gov-form-label">Display Name</label>
                                <input
                                    type="text"
                                    className="gov-form-input"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className="gov-form-group">
                                <label className="gov-form-label">Discord ID</label>
                                <input
                                    type="text"
                                    className="gov-form-input"
                                    value={discordId}
                                    onChange={(e) => setDiscordId(e.target.value)}
                                    placeholder="Optional - Your Discord user ID"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                <button onClick={handleSave} disabled={saving} className="gov-btn gov-btn-primary">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button onClick={() => { setEditing(false); setDisplayName(user?.displayName || ''); setDiscordId(user?.discordId || ''); }} className="gov-btn gov-btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <div className="gov-stat-label">Display Name</div>
                                <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--gov-gray-dark)' }}>
                                    {user?.displayName}
                                </div>
                            </div>
                            <div>
                                <div className="gov-stat-label">Email Address</div>
                                <div style={{ fontSize: '1rem', color: 'var(--gov-gray-dark)', fontFamily: 'monospace' }}>
                                    {user?.email}
                                </div>
                            </div>
                            <div>
                                <div className="gov-stat-label">Discord ID</div>
                                <div style={{ fontSize: '1rem', color: 'var(--gov-gray-dark)', fontFamily: 'monospace' }}>
                                    {user?.discordId || 'Not linked'}
                                </div>
                            </div>
                            <div>
                                <div className="gov-stat-label">Authority Level</div>
                                <div>
                                    <span className="gov-badge gov-badge-blue">
                                        {AUTHORITY_NAMES[user?.authorityLevel || 0]}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Account Information */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">Account Details</h2>
                </div>
                <div className="gov-card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        <div>
                            <div className="gov-stat-label">User ID</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--gov-gray)', fontFamily: 'monospace' }}>
                                {user?.userId}
                            </div>
                        </div>
                        <div>
                            <div className="gov-stat-label">Account Type</div>
                            <div style={{ fontSize: '1rem', color: 'var(--gov-gray-dark)' }}>
                                Staff Account
                            </div>
                        </div>
                        <div>
                            <div className="gov-stat-label">Permissions</div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {(user?.permissions || []).length > 0 ? (
                                    user?.permissions.map((p) => (
                                        <span key={p} className="gov-badge gov-badge-green">{p}</span>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--gov-gray)' }}>Standard permissions</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Quick Link */}
            <div className="gov-card">
                <div className="gov-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--gov-gray-dark)', fontSize: '1rem' }}>Security Settings</h3>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                            Change password, manage 2FA, view active sessions
                        </p>
                    </div>
                    <a href="/dashboard/security" className="gov-btn gov-btn-primary">
                        🔐 Manage Security
                    </a>
                </div>
            </div>
        </div>
    );
}
