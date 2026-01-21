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
                router.push('/dashboard');
                return;
            }

            setCurrentUser(sessionData.user);
            await loadUsers();
        } catch (e) {
            console.error('Auth check failed:', e);
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
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading users...
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="gov-page-title">User Management</h1>
                    <p className="gov-page-subtitle">
                        {miabConnected ? '✅ Connected to Mail-in-a-Box' : '⚠️ Mail-in-a-Box not connected'}
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="gov-btn gov-btn-primary">
                    + Create User
                </button>
            </div>

            {/* Alerts */}
            {error && <div className="gov-alert gov-alert-error">{error}</div>}
            {success && <div className="gov-alert gov-alert-success">{success}</div>}

            {/* Users Table */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">All Users ({users.length})</h2>
                </div>
                <div className="gov-card-body" style={{ padding: 0 }}>
                    <div className="gov-table-container">
                        <table className="gov-table">
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
                                    <tr key={u.id} onClick={() => router.push(`/dashboard/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontWeight: 600, color: 'var(--gov-blue)' }}>{u.displayName}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{u.email}</td>
                                        <td style={{ color: u.discordId ? 'var(--gov-gray-dark)' : 'var(--gov-gray-light)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                            {u.discordId || 'Not linked'}
                                        </td>
                                        <td>
                                            <span className="gov-badge gov-badge-blue">
                                                {AUTHORITY_NAMES[u.authorityLevel] || 'User'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`gov-badge ${u.hasMailbox ? 'gov-badge-green' : 'gov-badge-red'}`}>
                                                {u.hasMailbox ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`gov-badge ${u.enabled ? 'gov-badge-green' : 'gov-badge-red'}`}>
                                                {u.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => router.push(`/dashboard/users/${u.id}`)} className="gov-btn gov-btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
                                                    Edit
                                                </button>
                                                {currentUser?.authorityLevel >= 5 && (
                                                    <button onClick={() => handleDeleteUser(u.id, u.email)} className="gov-btn gov-btn-danger" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
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
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div className="gov-card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <div className="gov-card-header">
                            <h2 className="gov-card-title">Create New User</h2>
                        </div>
                        <div className="gov-card-body">
                            <form onSubmit={handleCreateUser}>
                                <div className="gov-form-group">
                                    <label className="gov-form-label">Email *</label>
                                    <input
                                        type="email"
                                        className="gov-form-input"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        required
                                        placeholder="user@usgrp.xyz"
                                    />
                                </div>

                                <div className="gov-form-group">
                                    <label className="gov-form-label">Password *</label>
                                    <input
                                        type="password"
                                        className="gov-form-input"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="gov-form-group">
                                    <label className="gov-form-label">Display Name *</label>
                                    <input
                                        type="text"
                                        className="gov-form-input"
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        required
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="gov-form-group">
                                    <label className="gov-form-label">Discord ID (optional)</label>
                                    <input
                                        type="text"
                                        className="gov-form-input"
                                        value={newDiscordId}
                                        onChange={(e) => setNewDiscordId(e.target.value)}
                                        placeholder="123456789012345678"
                                    />
                                </div>

                                <div className="gov-form-group">
                                    <label className="gov-form-label">Authority Level</label>
                                    <select
                                        className="gov-form-input"
                                        value={newAuthorityLevel}
                                        onChange={(e) => setNewAuthorityLevel(parseInt(e.target.value))}
                                    >
                                        {Object.entries(AUTHORITY_NAMES).map(([level, name]) => (
                                            <option key={level} value={level}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="gov-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={createMailbox}
                                        onChange={(e) => setCreateMailbox(e.target.checked)}
                                        id="createMailbox"
                                    />
                                    <label htmlFor="createMailbox" style={{ color: 'var(--gov-gray-dark)', fontSize: '0.875rem', margin: 0 }}>
                                        Create mailbox in Mail-in-a-Box
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }} className="gov-btn gov-btn-secondary">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={creating} className="gov-btn gov-btn-primary">
                                        {creating ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
