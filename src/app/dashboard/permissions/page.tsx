'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    displayName: string;
    discordId: string | null;
    authorityLevel: number;
    roles: string[];
    permissions: string[];
    enabled: boolean;
}

const AUTHORITY_LEVELS = [
    { value: 0, name: 'User', description: 'Basic access, community member' },
    { value: 1, name: 'Moderator', description: 'Can moderate community content' },
    { value: 2, name: 'Senior Mod', description: 'Senior moderation privileges' },
    { value: 3, name: 'Admin', description: 'Administrative access, user management' },
    { value: 4, name: 'HR', description: 'Human resources, staff management' },
    { value: 5, name: 'Superuser', description: 'Full system access, permissions management' },
    { value: 6, name: 'Bot Developer', description: 'Maximum access, development capabilities' },
];

const AVAILABLE_PERMISSIONS = [
    { key: 'dashboard:view', name: 'View Dashboard', description: 'Access to admin dashboard' },
    { key: 'dashboard:appeals', name: 'Manage Appeals', description: 'Handle user appeals' },
    { key: 'dashboard:users', name: 'Manage Users', description: 'Create/edit/delete users' },
    { key: 'dashboard:analytics', name: 'View Analytics', description: 'Access analytics data' },
    { key: 'mail:admin', name: 'Mail Admin', description: 'Manage mailboxes and aliases' },
    { key: 'status:admin', name: 'Status Admin', description: 'Manage status portal' },
    { key: 'audit:view', name: 'View Audit Log', description: 'Access audit logs' },
];

export default function PermissionsPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [editedLevel, setEditedLevel] = useState<number>(0);
    const [editedPermissions, setEditedPermissions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const sessionRes = await fetch('/api/auth/session');
                const sessionData = await sessionRes.json();

                if (!sessionData.authenticated) {
                    router.push('/login');
                    return;
                }

                if (sessionData.user.authorityLevel < 5) {
                    router.push('/dashboard?error=Insufficient permissions');
                    return;
                }

                setCurrentUser(sessionData.user);

                const usersRes = await fetch('/api/users');
                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    setUsers(usersData.users);
                }
            } catch (err) {
                console.error('Load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    function selectUser(user: User) {
        setSelectedUser(user);
        setEditedLevel(user.authorityLevel);
        setEditedPermissions(user.permissions || []);
        setMessage('');
        setError('');
    }

    function togglePermission(key: string) {
        setEditedPermissions((prev) =>
            prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
        );
    }

    async function saveChanges() {
        if (!selectedUser) return;

        setSaving(true);
        setMessage('');
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    authorityLevel: editedLevel,
                    permissions: editedPermissions,
                }),
            });

            if (res.ok) {
                setMessage('Permissions updated successfully!');
                const usersRes = await fetch('/api/users');
                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    setUsers(usersData.users);
                    const updated = usersData.users.find((u: User) => u.id === selectedUser.id);
                    if (updated) setSelectedUser(updated);
                }
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update permissions');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading permissions...
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">Permissions Management</h1>
                <p className="gov-page-subtitle">Manage user authority levels and granular permissions (SUPERUSER+ only)</p>
            </div>

            <div className="gov-alert gov-alert-warning">
                <strong>⚠️ Sensitive Area:</strong> Changes to permissions take effect immediately.
                Users cannot be granted higher authority than your own level.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                {/* User List */}
                <div className="gov-card" style={{ maxHeight: 'calc(100vh - 250px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="gov-card-header">
                        <h2 className="gov-card-title">Select User</h2>
                    </div>
                    <div className="gov-card-body" style={{ padding: 0, overflow: 'auto', flex: 1 }}>
                        {users.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => selectUser(user)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--gov-gray-lighter)',
                                    background: selectedUser?.id === user.id ? 'var(--gov-gray-lightest)' : 'transparent',
                                    borderLeft: selectedUser?.id === user.id ? '3px solid var(--gov-blue)' : '3px solid transparent',
                                }}
                            >
                                <div style={{ fontWeight: 600, color: 'var(--gov-gray-dark)' }}>{user.displayName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)' }}>{user.email}</div>
                                <div style={{ marginTop: '0.25rem' }}>
                                    <span className="gov-badge gov-badge-blue" style={{ fontSize: '0.625rem' }}>
                                        {AUTHORITY_LEVELS.find((l) => l.value === user.authorityLevel)?.name || 'User'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Permissions Editor */}
                <div className="gov-card">
                    {selectedUser ? (
                        <>
                            <div className="gov-card-header">
                                <h2 className="gov-card-title">{selectedUser.displayName}</h2>
                            </div>
                            <div className="gov-card-body">
                                <p style={{ color: 'var(--gov-gray)', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
                                    {selectedUser.email}
                                </p>

                                {message && <div className="gov-alert gov-alert-success">{message}</div>}
                                {error && <div className="gov-alert gov-alert-error">{error}</div>}

                                {/* Authority Level */}
                                <h3 style={{ margin: '0 0 1rem', color: 'var(--gov-gray-dark)', fontSize: '1rem' }}>
                                    Authority Level
                                </h3>
                                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '2rem' }}>
                                    {AUTHORITY_LEVELS.map((level) => {
                                        const canSelect = currentUser.authorityLevel > level.value || level.value === editedLevel;
                                        return (
                                            <label
                                                key={level.value}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem 1rem',
                                                    background: editedLevel === level.value ? 'rgba(0, 113, 188, 0.08)' : 'var(--gov-gray-lightest)',
                                                    border: editedLevel === level.value ? '2px solid var(--gov-blue)' : '1px solid var(--gov-gray-lighter)',
                                                    borderRadius: '4px',
                                                    cursor: canSelect ? 'pointer' : 'not-allowed',
                                                    opacity: canSelect ? 1 : 0.5,
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    checked={editedLevel === level.value}
                                                    onChange={() => setEditedLevel(level.value)}
                                                    disabled={!canSelect}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--gov-gray-dark)' }}>{level.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)' }}>{level.description}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* Granular Permissions */}
                                <h3 style={{ margin: '0 0 1rem', color: 'var(--gov-gray-dark)', fontSize: '1rem' }}>
                                    Granular Permissions
                                </h3>
                                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    {AVAILABLE_PERMISSIONS.map((perm) => (
                                        <label
                                            key={perm.key}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                background: editedPermissions.includes(perm.key) ? 'rgba(46, 133, 64, 0.08)' : 'var(--gov-gray-lightest)',
                                                border: editedPermissions.includes(perm.key) ? '2px solid var(--gov-green)' : '1px solid var(--gov-gray-lighter)',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={editedPermissions.includes(perm.key)}
                                                onChange={() => togglePermission(perm.key)}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: 'var(--gov-gray-dark)' }}>{perm.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)' }}>{perm.description}</div>
                                            </div>
                                            <code style={{ fontSize: '0.6875rem', color: 'var(--gov-gray)', background: 'var(--gov-gray-lighter)', padding: '0.125rem 0.375rem', borderRadius: '3px' }}>
                                                {perm.key}
                                            </code>
                                        </label>
                                    ))}
                                </div>

                                <button onClick={saveChanges} disabled={saving} className="gov-btn gov-btn-primary">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="gov-card-body" style={{ textAlign: 'center', padding: '4rem', color: 'var(--gov-gray)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
                            <p>Select a user from the list to manage their permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
