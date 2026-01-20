'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    displayName: string;
    discordId: string | null;
    authorityLevel: number;
    enabled: boolean;
    totpEnabled: boolean;
    createdAt: string;
    hasMailbox: boolean;
    mailboxStatus?: string;
    isMailAdmin?: boolean;
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

export default function UsersPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [miabConnected, setMiabConnected] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form state
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [newDiscordId, setNewDiscordId] = useState('');
    const [newAuthorityLevel, setNewAuthorityLevel] = useState(0);
    const [createMailbox, setCreateMailbox] = useState(true);

    useEffect(() => {
        checkAuthAndLoad();
    }, []);

    async function checkAuthAndLoad() {
        try {
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();

            if (!sessionData.authenticated || sessionData.user.authorityLevel < 3) {
                router.push('/login');
                return;
            }

            setCurrentUser(sessionData.user);
            await loadUsers();
        } catch (e) {
            console.error('Auth check failed:', e);
            router.push('/login');
        } finally {
            setLoading(false);
        }
    }

    async function loadUsers() {
        try {
            const res = await fetch('/api/mail/users');
            const data = await res.json();

            if (res.ok) {
                setUsers(data.users || []);
                setMiabConnected(data.miabConnected);
            } else {
                setError(data.error || 'Failed to load users');
            }
        } catch (e) {
            setError('Failed to load users');
        }
    }

    async function handleCreateUser(e: FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/mail/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newEmail,
                    password: newPassword,
                    displayName: newDisplayName,
                    discordId: newDiscordId || null,
                    authorityLevel: newAuthorityLevel,
                    createMailbox,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(`User ${newEmail} created successfully!`);
                setShowCreateModal(false);
                resetForm();
                await loadUsers();
            } else {
                setError(data.error || 'Failed to create user');
            }
        } catch (e) {
            setError('Failed to create user');
        } finally {
            setCreating(false);
        }
    }

    async function handleDeleteUser(userId: string, email: string) {
        if (!confirm(`Delete user ${email}? This will also delete their mailbox.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/mail/users?userId=${userId}&email=${encodeURIComponent(email)}&deleteMailbox=true`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setSuccess(`User ${email} deleted`);
                await loadUsers();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to delete user');
            }
        } catch (e) {
            setError('Failed to delete user');
        }
    }

    function resetForm() {
        setNewEmail('');
        setNewPassword('');
        setNewDisplayName('');
        setNewDiscordId('');
        setNewAuthorityLevel(0);
        setCreateMailbox(true);
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

                <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <a href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none' }}>Dashboard</a>
                    <a href="/dashboard/users" style={{ color: '#fff', textDecoration: 'none', fontWeight: '600' }}>Users</a>
                    <button onClick={() => router.push('/api/auth/logout')} className="dashboard-logout">
                        Sign out
                    </button>
                </nav>
            </header>

            {/* Content */}
            <main className="dashboard-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '600' }}>User Management</h1>
                        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
                            {miabConnected ? '✅ Connected to Mail-in-a-box' : '⚠️ Mail-in-a-box not connected'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.25rem',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                        }}
                    >
                        <span>+</span> Create User
                    </button>
                </div>

                {/* Errors/Success */}
                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', borderRadius: '8px', color: '#4ade80', marginBottom: '1rem' }}>
                        {success}
                    </div>
                )}

                {/* Users Table */}
                <div className="dashboard-card">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Discord</th>
                                    <th>Authority</th>
                                    <th>Mailbox</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: '500' }}>{u.displayName}</td>
                                        <td>{u.email}</td>
                                        <td style={{ color: u.discordId ? '#fff' : '#64748b' }}>
                                            {u.discordId || 'Not linked'}
                                        </td>
                                        <td>
                                            <span className="badge badge-blue">
                                                {AUTHORITY_NAMES[u.authorityLevel] || 'User'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.hasMailbox ? 'badge-green' : 'badge-red'}`}>
                                                {u.hasMailbox ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.enabled ? 'badge-green' : 'badge-red'}`}>
                                                {u.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => router.push(`/dashboard/users/${u.id}`)}
                                                    style={{ padding: '0.25rem 0.5rem', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    Edit
                                                </button>
                                                {currentUser?.authorityLevel >= 5 && (
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                                        style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                }}>
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        padding: '2rem',
                        width: '100%',
                        maxWidth: '500px',
                        border: '1px solid #334155',
                    }}>
                        <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                            Create New User
                        </h2>

                        <form onSubmit={handleCreateUser}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        required
                                        placeholder="user@usgrp.xyz"
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                        Password *
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                        Display Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        required
                                        placeholder="John Doe"
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                        Discord ID (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newDiscordId}
                                        onChange={(e) => setNewDiscordId(e.target.value)}
                                        placeholder="123456789012345678"
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                                        Authority Level
                                    </label>
                                    <select
                                        value={newAuthorityLevel}
                                        onChange={(e) => setNewAuthorityLevel(parseInt(e.target.value))}
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                                    >
                                        {Object.entries(AUTHORITY_NAMES).map(([level, name]) => (
                                            <option key={level} value={level}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={createMailbox}
                                        onChange={(e) => setCreateMailbox(e.target.checked)}
                                        id="createMailbox"
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    <label htmlFor="createMailbox" style={{ color: '#fff', fontSize: '0.875rem' }}>
                                        Create mailbox in Mail-in-a-box
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                                    style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    {creating ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
