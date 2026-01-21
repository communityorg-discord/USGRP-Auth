'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
            <div className="sso-container">
                <div className="sso-loading">
                    <div className="sso-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="dashboard-brand">
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" rx="8" fill="#3b82f6" />
                        <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h1>USGRP Auth</h1>
                </div>

                <div className="dashboard-user">
                    <div className="dashboard-user-info">
                        <div className="dashboard-user-name">{user?.displayName}</div>
                        <div className="dashboard-user-email">{user?.email}</div>
                    </div>
                    <button onClick={handleLogout} className="dashboard-logout">
                        Sign out
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="dashboard-content">
                <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                    Dashboard
                </h1>

                {/* Account Card */}
                <div className="dashboard-card">
                    <h2>Your Account</h2>
                    <div className="dashboard-grid">
                        <div className="dashboard-stat">
                            <div className="dashboard-stat-label">Display Name</div>
                            <div className="dashboard-stat-value">{user?.displayName}</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat-label">Email</div>
                            <div className="dashboard-stat-value">{user?.email}</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat-label">Discord ID</div>
                            <div className="dashboard-stat-value">{user?.discordId || 'Not linked'}</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat-label">Authority Level</div>
                            <div className="dashboard-stat-value">
                                <span className="badge badge-blue">
                                    {AUTHORITY_NAMES[user?.authorityLevel] || 'User'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin Navigation (Admin+) */}
                {user?.authorityLevel >= 3 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <Link href="/dashboard/users" style={{ textDecoration: 'none' }}>
                            <div className="dashboard-card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                                <h3 style={{ margin: 0, color: '#fff' }}>User Management</h3>
                                <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Create, edit, delete users</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/audit" style={{ textDecoration: 'none' }}>
                            <div className="dashboard-card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                                <h3 style={{ margin: 0, color: '#fff' }}>Audit Log</h3>
                                <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>View SSO access & activity</p>
                            </div>
                        </Link>
                    </div>
                )}

                {/* Users Table (Admin+) */}
                {user?.authorityLevel >= 3 && (
                    <div className="dashboard-card">
                        <h2>All Users ({users.length})</h2>
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
                                                <span className="badge badge-blue">
                                                    {AUTHORITY_NAMES[u.authorityLevel] || 'User'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${u.enabled ? 'badge-green' : 'badge-red'}`}>
                                                    {u.enabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${u.totpEnabled ? 'badge-green' : 'badge-yellow'}`}>
                                                    {u.totpEnabled ? 'On' : 'Off'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>
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
