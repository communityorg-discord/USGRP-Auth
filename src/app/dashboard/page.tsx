'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    discordId: string | null;
    displayName: string;
    authorityLevel: number;
    roles: string[];
    enabled: boolean;
    totpEnabled: boolean;
    createdAt: string;
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

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (!data.authenticated) {
                    router.push('/login');
                    return;
                }

                setUser(data.user);

                // Load users if admin
                if (data.user.authorityLevel >= 3) {
                    const usersRes = await fetch('/api/users');
                    if (usersRes.ok) {
                        const usersData = await usersRes.json();
                        setUsers(usersData.users);
                    }
                }

            } catch (e) {
                console.error('Auth check failed:', e);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }

        checkAuth();
    }, [router]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    if (loading) {
        return (
            <div className="login-container">
                <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
            {/* Header */}
            <header style={{
                background: 'var(--card)',
                borderBottom: '1px solid var(--border)',
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        USGRP Auth
                    </span>
                    <span className="badge badge-primary">
                        {AUTHORITY_NAMES[user?.authorityLevel] || 'User'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--muted)' }}>{user?.email}</span>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'var(--secondary)',
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem'
                        }}
                    >
                        Sign out
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    marginBottom: '1.5rem'
                }}>
                    Dashboard
                </h1>

                {/* User Info Card */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        marginBottom: '1rem',
                        color: 'var(--muted)'
                    }}>
                        Your Account
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                Display Name
                            </div>
                            <div style={{ fontWeight: '500' }}>{user?.displayName}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                Email
                            </div>
                            <div style={{ fontWeight: '500' }}>{user?.email}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                Discord ID
                            </div>
                            <div style={{ fontWeight: '500' }}>{user?.discordId || 'Not linked'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                Authority Level
                            </div>
                            <div>
                                <span className="badge badge-primary">
                                    {AUTHORITY_NAMES[user?.authorityLevel] || 'User'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users Table (Admin only) */}
                {user?.authorityLevel >= 3 && (
                    <div className="card">
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--muted)' }}>
                                All Users ({users.length})
                            </h2>
                            <button
                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                onClick={() => router.push('/admin/users/new')}
                            >
                                + Add User
                            </button>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Authority</th>
                                        <th>Status</th>
                                        <th>2FA</th>
                                        <th>Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: '500' }}>{u.displayName}</td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className="badge badge-primary">
                                                    {AUTHORITY_NAMES[u.authorityLevel] || 'User'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${u.enabled ? 'badge-success' : 'badge-error'}`}>
                                                    {u.enabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${u.totpEnabled ? 'badge-success' : 'badge-warning'}`}>
                                                    {u.totpEnabled ? 'Enabled' : 'Off'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                                                {new Date(u.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
