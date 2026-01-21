'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    target_user: string | null;
    details: string | null;
    ip_address: string | null;
    created_at: string;
    display_name?: string;
    email?: string;
}

const ACTION_TYPES = [
    { key: 'ALL', label: 'All Actions' },
    { key: 'LOGIN', label: 'Login' },
    { key: 'LOGOUT', label: 'Logout' },
    { key: 'SSO_ACCESS', label: 'SSO Access' },
    { key: 'USER_CREATED', label: 'User Created' },
    { key: 'USER_UPDATED', label: 'User Updated' },
    { key: 'USER_DELETED', label: 'User Deleted' },
    { key: 'PASSWORD_CHANGED', label: 'Password Changed' },
];

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    async function loadLogs() {
        try {
            const res = await fetch('/api/audit?limit=100');
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (e) {
            console.error('Failed to load audit logs:', e);
        } finally {
            setLoading(false);
        }
    }

    function getActionIcon(action: string): string {
        const icons: Record<string, string> = {
            'LOGIN': '🔓',
            'LOGOUT': '🔒',
            'SSO_ACCESS': '🚀',
            'USER_CREATED': '➕',
            'USER_UPDATED': '✏️',
            'USER_DELETED': '🗑️',
            'PASSWORD_CHANGED': '🔑',
        };
        return icons[action] || '📌';
    }

    function getActionBadgeClass(action: string): string {
        if (action.includes('DELETE') || action === 'LOGOUT') return 'gov-badge-red';
        if (action.includes('CREATE') || action === 'LOGIN') return 'gov-badge-green';
        if (action === 'SSO_ACCESS') return 'gov-badge-blue';
        return 'gov-badge-gold';
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    const filteredLogs = logs.filter((log) => {
        if (filter !== 'ALL' && log.action !== filter) return false;
        if (search) {
            const searchLower = search.toLowerCase();
            return (
                log.email?.toLowerCase().includes(searchLower) ||
                log.display_name?.toLowerCase().includes(searchLower) ||
                log.action.toLowerCase().includes(searchLower) ||
                log.target_user?.toLowerCase().includes(searchLower) ||
                log.details?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading audit logs...
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">Audit Log</h1>
                <p className="gov-page-subtitle">View security events and user activities</p>
            </div>

            {/* Filters */}
            <div className="gov-card">
                <div className="gov-card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="gov-form-group" style={{ margin: 0, minWidth: '200px' }}>
                        <label className="gov-form-label">Filter by Action</label>
                        <select
                            className="gov-form-input"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            {ACTION_TYPES.map((type) => (
                                <option key={type.key} value={type.key}>{type.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="gov-form-group" style={{ margin: 0, flex: 1, minWidth: '250px' }}>
                        <label className="gov-form-label">Search</label>
                        <input
                            type="text"
                            className="gov-form-input"
                            placeholder="Search by user, email, or details..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={loadLogs} className="gov-btn gov-btn-secondary">
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="gov-stats-grid">
                <div className="gov-stat-card">
                    <div className="gov-stat-label">Total Events</div>
                    <div className="gov-stat-value">{logs.length}</div>
                </div>
                <div className="gov-stat-card green">
                    <div className="gov-stat-label">Logins</div>
                    <div className="gov-stat-value">{logs.filter(l => l.action === 'LOGIN').length}</div>
                </div>
                <div className="gov-stat-card">
                    <div className="gov-stat-label">SSO Accesses</div>
                    <div className="gov-stat-value">{logs.filter(l => l.action === 'SSO_ACCESS').length}</div>
                </div>
                <div className="gov-stat-card gold">
                    <div className="gov-stat-label">User Changes</div>
                    <div className="gov-stat-value">{logs.filter(l => l.action.includes('USER')).length}</div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="gov-card">
                <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="gov-card-title">Event Log ({filteredLogs.length} entries)</h2>
                </div>
                <div className="gov-card-body" style={{ padding: 0 }}>
                    <div className="gov-table-container">
                        <table className="gov-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Target / Details</th>
                                    <th>IP Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{log.display_name || 'Unknown'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--gov-gray)' }}>{log.email}</div>
                                        </td>
                                        <td>
                                            <span style={{ marginRight: '0.5rem' }}>{getActionIcon(log.action)}</span>
                                            <span className={`gov-badge ${getActionBadgeClass(log.action)}`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                                            {log.target_user || log.details || '-'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                            {log.ip_address || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gov-gray)' }}>
                                            No audit logs found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
