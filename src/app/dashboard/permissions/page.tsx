'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
                // Check auth
                const sessionRes = await fetch('/api/auth/session');
                const sessionData = await sessionRes.json();

                if (!sessionData.authenticated) {
                    router.push('/login');
                    return;
                }

                // Check authority level (SUPERUSER+ only)
                if (sessionData.user.authorityLevel < 5) {
                    router.push('/dashboard?error=Insufficient permissions');
                    return;
                }

                setCurrentUser(sessionData.user);

                // Load users
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
        setEditedPermissions(prev =>
            prev.includes(key)
                ? prev.filter(p => p !== key)
                : [...prev, key]
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
                // Refresh users list
                const usersRes = await fetch('/api/users');
                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    setUsers(usersData.users);
                    // Update selected user
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
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Permissions Management</h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Manage user authority levels and granular permissions (SUPERUSER+ only)</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                {/* Users List */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    border: '1px solid #334155',
                    maxHeight: '80vh',
                    overflowY: 'auto'
                }}>
                    <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Users</h2>

                    {users.map(user => (
                        <div
                            key={user.id}
                            onClick={() => selectUser(user)}
                            style={{
                                padding: '0.75rem 1rem',
                                background: selectedUser?.id === user.id ? '#334155' : 'transparent',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                marginBottom: '0.25rem',
                                border: selectedUser?.id === user.id ? '1px solid #3b82f6' : '1px solid transparent',
                            }}
                        >
                            <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{user.displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.email}</div>
                            <div style={{ marginTop: '0.25rem' }}>
                                <span style={{
                                    padding: '0.125rem 0.5rem',
                                    background: '#3b82f620',
                                    color: '#3b82f6',
                                    borderRadius: '9999px',
                                    fontSize: '0.7rem',
                                }}>
                                    {AUTHORITY_LEVELS.find(l => l.value === user.authorityLevel)?.name || 'User'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Permissions Editor */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    border: '1px solid #334155'
                }}>
                    {selectedUser ? (
                        <>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedUser.displayName}</h2>
                                <p style={{ color: '#64748b', margin: '0.25rem 0', fontFamily: 'monospace' }}>{selectedUser.email}</p>
                            </div>

                            {message && (
                                <div style={{ padding: '0.75rem 1rem', background: '#22c55e20', color: '#22c55e', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                    ✓ {message}
                                </div>
                            )}
                            {error && (
                                <div style={{ padding: '0.75rem 1rem', background: '#ef444420', color: '#ef4444', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                    {error}
                                </div>
                            )}

                            {/* Authority Level */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Authority Level</h3>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {AUTHORITY_LEVELS.map(level => (
                                        <label
                                            key={level.value}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                background: editedLevel === level.value ? '#3b82f620' : '#0f172a',
                                                border: editedLevel === level.value ? '1px solid #3b82f6' : '1px solid #334155',
                                                borderRadius: '0.5rem',
                                                cursor: currentUser.authorityLevel > level.value || level.value === editedLevel ? 'pointer' : 'not-allowed',
                                                opacity: currentUser.authorityLevel > level.value || level.value === editedLevel ? 1 : 0.5,
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                checked={editedLevel === level.value}
                                                onChange={() => setEditedLevel(level.value)}
                                                disabled={currentUser.authorityLevel <= level.value && level.value !== editedLevel}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{level.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{level.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Granular Permissions */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Granular Permissions</h3>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label
                                            key={perm.key}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                background: editedPermissions.includes(perm.key) ? '#22c55e20' : '#0f172a',
                                                border: editedPermissions.includes(perm.key) ? '1px solid #22c55e' : '1px solid #334155',
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={editedPermissions.includes(perm.key)}
                                                onChange={() => togglePermission(perm.key)}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{perm.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{perm.description}</div>
                                            </div>
                                            <code style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b' }}>{perm.key}</code>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={saveChanges}
                                disabled={saving}
                                style={{
                                    padding: '0.75rem 2rem',
                                    background: saving ? '#334155' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    fontWeight: 500,
                                    fontSize: '1rem',
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>
                            Select a user to manage their permissions
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
