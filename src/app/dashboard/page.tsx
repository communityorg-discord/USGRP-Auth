'use client';

import { useState, useEffect } from 'react';

interface Stats {
    totalUsers: number;
    activeUsers: number;
    recentLogins: number;
    ssoAccesses: number;
}

interface RecentActivity {
    id: string;
    action: string;
    targetUser: string | null;
    details: string | null;
    ipAddress: string | null;
    createdAt: string;
}

export default function DashboardOverview() {
    const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, recentLogins: 0, ssoAccesses: 0 });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                // Load users
                const usersRes = await fetch('/api/users');
                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    const enabledUsers = usersData.users.filter((u: any) => u.enabled);
                    setStats(prev => ({
                        ...prev,
                        totalUsers: usersData.users.length,
                        activeUsers: enabledUsers.length,
                    }));
                }

                // Load audit log
                const auditRes = await fetch('/api/audit?limit=10');
                if (auditRes.ok) {
                    const auditData = await auditRes.json();
                    setRecentActivity(auditData.logs || []);

                    // Count recent logins and SSO accesses
                    const logins = (auditData.logs || []).filter((l: any) => l.action === 'LOGIN').length;
                    const sso = (auditData.logs || []).filter((l: any) => l.action === 'SSO_ACCESS').length;
                    setStats(prev => ({
                        ...prev,
                        recentLogins: logins,
                        ssoAccesses: sso,
                    }));
                }
            } catch (e) {
                console.error('Failed to load dashboard data:', e);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

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

    function formatTimeAgo(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gov-gray)' }}>
                Loading dashboard...
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">Dashboard Overview</h1>
                <p className="gov-page-subtitle">Welcome to the USGRP Identity Management Portal</p>
            </div>

            {/* System Notice */}
            <div className="gov-alert gov-alert-info">
                <strong>System Status:</strong> All services operational. Last sync: {new Date().toLocaleTimeString()}
            </div>

            {/* Stats Grid */}
            <div className="gov-stats-grid">
                <div className="gov-stat-card">
                    <div className="gov-stat-label">Total Users</div>
                    <div className="gov-stat-value">{stats.totalUsers}</div>
                </div>
                <div className="gov-stat-card green">
                    <div className="gov-stat-label">Active Users</div>
                    <div className="gov-stat-value">{stats.activeUsers}</div>
                </div>
                <div className="gov-stat-card gold">
                    <div className="gov-stat-label">Recent Logins</div>
                    <div className="gov-stat-value">{stats.recentLogins}</div>
                </div>
                <div className="gov-stat-card">
                    <div className="gov-stat-label">SSO Accesses</div>
                    <div className="gov-stat-value">{stats.ssoAccesses}</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">Quick Actions</h2>
                </div>
                <div className="gov-card-body" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <a href="/dashboard/profile" className="gov-btn gov-btn-secondary">
                        👤 Edit Profile
                    </a>
                    <a href="/dashboard/security" className="gov-btn gov-btn-secondary">
                        🔐 Security Settings
                    </a>
                    <a href="/dashboard/apps" className="gov-btn gov-btn-primary">
                        🚀 Launch Application
                    </a>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">Recent Activity</h2>
                </div>
                <div className="gov-card-body" style={{ padding: 0 }}>
                    {recentActivity.length > 0 ? (
                        <div className="gov-table-container">
                            <table className="gov-table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Details</th>
                                        <th>IP Address</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentActivity.map((activity) => (
                                        <tr key={activity.id}>
                                            <td>
                                                <span style={{ marginRight: '0.5rem' }}>{getActionIcon(activity.action)}</span>
                                                {activity.action.replace(/_/g, ' ')}
                                            </td>
                                            <td>{activity.targetUser || activity.details || '-'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                {activity.ipAddress || '-'}
                                            </td>
                                            <td>{formatTimeAgo(activity.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gov-gray)' }}>
                            No recent activity to display
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
