'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

// Available applications with SSO
const APPLICATIONS = [
    { name: 'Mail', url: 'https://mail.usgrp.xyz', icon: '📧', description: 'USGRP Email' },
    { name: 'Admin Dashboard', url: 'https://admin.usgrp.xyz', icon: '🏛️', description: 'Staff Administration' },
    { name: 'Status Portal', url: 'https://status.usgrp.xyz', icon: '📊', description: 'Service Status' },
];

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Password change state
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (!data.authenticated) {
                    router.push('/login');
                    return;
                }

                setUser(data.user);
            } catch (error) {
                console.error('Failed to load profile:', error);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }
        loadProfile();
    }, [router]);

    async function handlePasswordChange(e: FormEvent) {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords don't match");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return;
        }

        setPasswordLoading(true);

        try {
            const res = await fetch('/api/auth/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setPasswordError(data.error || 'Failed to change password');
                return;
            }

            setPasswordSuccess(data.message || 'Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordChange(false);
        } catch (error) {
            setPasswordError('Connection error. Please try again.');
        } finally {
            setPasswordLoading(false);
        }
    }

    function handleAppClick(url: string) {
        // Apps will auto-sign in via SSO since user is already authenticated
        window.location.href = url;
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#64748b' }}>Loading...</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
                    ← Back to Dashboard
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>My Profile</h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Manage your account and access applications</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {/* Account Details */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    border: '1px solid #334155'
                }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>👤</span> Account Details
                    </h2>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ color: '#64748b', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Display Name</label>
                            <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>{user?.displayName}</div>
                        </div>
                        <div>
                            <label style={{ color: '#64748b', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                            <div style={{ fontFamily: 'monospace' }}>{user?.email}</div>
                        </div>
                        <div>
                            <label style={{ color: '#64748b', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Discord ID</label>
                            <div style={{ fontFamily: 'monospace' }}>{user?.discordId || 'Not linked'}</div>
                        </div>
                        <div>
                            <label style={{ color: '#64748b', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Role</label>
                            <div>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#3b82f620',
                                    color: '#3b82f6',
                                    borderRadius: '9999px',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                }}>
                                    {AUTHORITY_NAMES[user?.authorityLevel || 0]}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Applications */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    border: '1px solid #334155'
                }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🚀</span> Quick Access
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Click to open with automatic sign-in
                    </p>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {APPLICATIONS.map(app => (
                            <button
                                key={app.name}
                                onClick={() => handleAppClick(app.url)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    width: '100%',
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.background = '#334155';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.background = '#0f172a';
                                    e.currentTarget.style.borderColor = '#334155';
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{app.icon}</span>
                                <div>
                                    <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{app.name}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{app.description}</div>
                                </div>
                                <span style={{ marginLeft: 'auto', color: '#64748b' }}>→</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Password Change */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    border: '1px solid #334155'
                }}>
                    <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔐</span> Security
                    </h2>

                    {passwordSuccess && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: '#22c55e20',
                            color: '#22c55e',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                        }}>
                            ✓ {passwordSuccess}
                        </div>
                    )}

                    {!showPasswordChange ? (
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                Password changes apply to Auth and Mail
                            </p>
                            <button
                                onClick={() => setShowPasswordChange(true)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                }}
                            >
                                Change Password
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '1rem' }}>
                            {passwordError && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    background: '#ef444420',
                                    color: '#ef4444',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                }}>
                                    {passwordError}
                                </div>
                            )}

                            <div>
                                <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '0.5rem',
                                        color: '#e2e8f0',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '0.5rem',
                                        color: '#e2e8f0',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '0.5rem',
                                        color: '#e2e8f0',
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    type="submit"
                                    disabled={passwordLoading}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        background: passwordLoading ? '#334155' : '#22c55e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        cursor: passwordLoading ? 'not-allowed' : 'pointer',
                                        fontWeight: 500,
                                    }}
                                >
                                    {passwordLoading ? 'Updating...' : 'Update Password'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordChange(false);
                                        setPasswordError('');
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    }}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        background: 'transparent',
                                        color: '#64748b',
                                        border: '1px solid #334155',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
