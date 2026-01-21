'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AuditEntry {
    id: number;
    user_id: string | null;
    action: string;
    target: string | null;
    details: string | null;
    ip: string | null;
    created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
    'LOGIN_SUCCESS': '#22c55e',
    'LOGIN_FAILED': '#ef4444',
    'LOGOUT': '#6b7280',
    'SSO_ACCESS': '#3b82f6',
    'USER_CREATED': '#8b5cf6',
    'USER_UPDATED': '#f59e0b',
    'USER_DELETED': '#ef4444',
    'PASSWORD_CHANGED': '#f59e0b',
};

const ACTION_ICONS: Record<string, string> = {
    'LOGIN_SUCCESS': '✓',
    'LOGIN_FAILED': '✗',
    'LOGOUT': '↪',
    'SSO_ACCESS': '🔗',
    'USER_CREATED': '+',
    'USER_UPDATED': '✎',
    'USER_DELETED': '🗑',
    'PASSWORD_CHANGED': '🔑',
};

export default function AuditLogPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function loadLogs() {
            try {
                const res = await fetch('/api/audit?limit=200');
                if (res.status === 401 || res.status === 403) {
                    router.push('/login');
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.logs || []);
                }
            } catch (error) {
                console.error('Failed to load audit log:', error);
            } finally {
                setLoading(false);
            }
        }
        loadLogs();
    }, [router]);

    const filteredLogs = logs.filter(log => {
        if (filter !== 'all' && log.action !== filter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                log.action.toLowerCase().includes(term) ||
                log.target?.toLowerCase().includes(term) ||
                log.details?.toLowerCase().includes(term) ||
                log.user_id?.toLowerCase().includes(term) ||
                log.ip?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const uniqueActions = [...new Set(logs.map(l => l.action))];

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
                    ← Back to Dashboard
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Audit Log</h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Track all authentication and user management events</p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                        padding: '0.75rem 1rem',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        color: '#e2e8f0',
                        minWidth: '250px',
                    }}
                />
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        padding: '0.75rem 1rem',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        color: '#e2e8f0',
                    }}
                >
                    <option value="all">All Actions</option>
                    {uniqueActions.map(action => (
                        <option key={action} value={action}>{action}</option>
                    ))}
                </select>
                <div style={{ marginLeft: 'auto', color: '#64748b' }}>
                    {filteredLogs.length} entries
                </div>
            </div>

            {/* Log Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
            ) : (
                <div style={{
                    background: '#1e293b',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    border: '1px solid #334155'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #334155' }}>Time</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #334155' }}>Action</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #334155' }}>Target</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #334155' }}>Details</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #334155' }}>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.25rem 0.75rem',
                                            background: `${ACTION_COLORS[log.action] || '#6b7280'}20`,
                                            color: ACTION_COLORS[log.action] || '#6b7280',
                                            borderRadius: '9999px',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                        }}>
                                            <span>{ACTION_ICONS[log.action] || '•'}</span>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                        {log.target || '-'}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#94a3b8', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {log.details || '-'}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                                        {log.ip || '-'}
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                        No audit entries found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#1e293b', borderRadius: '0.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#64748b' }}>Action Types</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {Object.entries(ACTION_COLORS).map(([action, color]) => (
                        <div key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: color,
                            }} />
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{action}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
