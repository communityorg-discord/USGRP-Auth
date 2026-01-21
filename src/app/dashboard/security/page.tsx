'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SessionInfo {
    id: string;
    device: string;
    ip: string;
    lastActive: string;
    createdAt: string;
    isCurrent: boolean;
    isRemembered: boolean;
}

interface RememberedDevice {
    id: string;
    deviceName: string | null;
    ip: string | null;
    lastUsed: string;
    createdAt: string;
}

export default function SecurityPage() {
    const router = useRouter();
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [devices, setDevices] = useState<RememberedDevice[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            // Check auth
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            if (!sessionData.authenticated) {
                router.push('/login');
                return;
            }
            setCurrentUser(sessionData.user);

            // Load sessions
            const sessionsRes = await fetch('/api/sessions');
            if (sessionsRes.ok) {
                const data = await sessionsRes.json();
                setSessions(data.sessions || []);
            }

            // Load remembered devices
            const devicesRes = await fetch('/api/devices');
            if (devicesRes.ok) {
                const data = await devicesRes.json();
                setDevices(data.devices || []);
            }
        } catch (error) {
            console.error('Error loading security data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function killSession(sessionId: string) {
        setActionLoading(sessionId);
        setMessage(null);

        try {
            const res = await fetch('/api/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setSessions(sessions.filter(s => s.id !== sessionId));
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to terminate session' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setActionLoading(null);
        }
    }

    async function killAllSessions() {
        if (!confirm('This will log you out of all other devices. Continue?')) return;

        setActionLoading('all');
        setMessage(null);

        try {
            const res = await fetch('/api/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setSessions(sessions.filter(s => s.isCurrent));
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to terminate sessions' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setActionLoading(null);
        }
    }

    async function removeDevice(deviceId: string) {
        setActionLoading(deviceId);
        setMessage(null);

        try {
            const res = await fetch('/api/devices', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId }),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: 'Device removed' });
                setDevices(devices.filter(d => d.id !== deviceId));
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to remove device' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setActionLoading(null);
        }
    }

    function formatDate(dateStr: string): string {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown';

        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return date.toLocaleDateString();
    }

    if (loading) {
        return (
            <div className="gov-page-loading">
                <div className="loading-spinner"></div>
                <p>Loading security settings...</p>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="gov-page-header">
                <div>
                    <h1 className="gov-page-title">Security Settings</h1>
                    <p className="gov-page-subtitle">Manage your sessions, devices, and security preferences</p>
                </div>
            </div>

            {message && (
                <div className={`gov-alert gov-alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Active Sessions */}
            <div className="gov-card" style={{ marginBottom: '1.5rem' }}>
                <div className="gov-card-header">
                    <h2 className="gov-card-title">📱 Active Sessions</h2>
                    <button
                        className="gov-btn gov-btn-danger"
                        onClick={killAllSessions}
                        disabled={actionLoading === 'all' || sessions.filter(s => !s.isCurrent).length === 0}
                    >
                        {actionLoading === 'all' ? 'Terminating...' : 'Log Out All Other Sessions'}
                    </button>
                </div>
                <div className="gov-card-body">
                    {sessions.length === 0 ? (
                        <p className="gov-empty-state">No active sessions found.</p>
                    ) : (
                        <div className="sessions-list">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`session-item ${session.isCurrent ? 'current' : ''}`}
                                >
                                    <div className="session-icon">
                                        {session.device.includes('Windows') ? '💻' :
                                            session.device.includes('macOS') ? '🖥️' :
                                                session.device.includes('iOS') ? '📱' :
                                                    session.device.includes('Android') ? '📱' : '🌐'}
                                    </div>
                                    <div className="session-info">
                                        <div className="session-device">
                                            {session.device}
                                            {session.isCurrent && <span className="current-badge">This device</span>}
                                        </div>
                                        <div className="session-meta">
                                            <span>📍 {session.ip}</span>
                                            <span>⏱️ Last active: {formatDate(session.lastActive)}</span>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <button
                                            className="gov-btn gov-btn-secondary"
                                            onClick={() => killSession(session.id)}
                                            disabled={actionLoading === session.id}
                                        >
                                            {actionLoading === session.id ? 'Ending...' : 'End Session'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Remembered Devices */}
            <div className="gov-card" style={{ marginBottom: '1.5rem' }}>
                <div className="gov-card-header">
                    <h2 className="gov-card-title">🔐 Remembered Devices</h2>
                </div>
                <div className="gov-card-body">
                    {devices.length === 0 ? (
                        <p className="gov-empty-state">No remembered devices. Devices are remembered when you check "Remember this device" during login.</p>
                    ) : (
                        <div className="sessions-list">
                            {devices.map(device => (
                                <div key={device.id} className="session-item">
                                    <div className="session-icon">🔑</div>
                                    <div className="session-info">
                                        <div className="session-device">
                                            {device.deviceName || 'Unknown Device'}
                                        </div>
                                        <div className="session-meta">
                                            <span>📍 {device.ip || 'Unknown IP'}</span>
                                            <span>Last used: {formatDate(device.lastUsed)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="gov-btn gov-btn-secondary"
                                        onClick={() => removeDevice(device.id)}
                                        disabled={actionLoading === device.id}
                                    >
                                        {actionLoading === device.id ? 'Removing...' : 'Remove'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">🛡️ Two-Factor Authentication</h2>
                </div>
                <div className="gov-card-body">
                    <div className="security-status">
                        <div className="status-row">
                            <span className="status-label">TOTP (Authenticator App)</span>
                            <span className={`gov-badge ${currentUser?.totpEnabled ? 'gov-badge-success' : 'gov-badge-warning'}`}>
                                {currentUser?.totpEnabled ? '✓ Enabled' : '⚠ Not Set Up'}
                            </span>
                        </div>
                        {!currentUser?.totpEnabled && (
                            <p className="mfa-warning">
                                ⚠️ Two-factor authentication is required for all accounts. Please set up an authenticator app.
                            </p>
                        )}
                    </div>

                    <div className="security-actions">
                        {!currentUser?.totpEnabled ? (
                            <a href="/dashboard/profile" className="gov-btn gov-btn-primary">
                                Set Up 2FA
                            </a>
                        ) : (
                            <a href="/dashboard/profile" className="gov-btn gov-btn-secondary">
                                Manage 2FA Settings
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .sessions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .session-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--gov-white);
                    border: 1px solid var(--gov-border);
                    border-radius: 8px;
                }
                
                .session-item.current {
                    border-color: var(--gov-blue);
                    background: rgba(59, 130, 246, 0.05);
                }
                
                .session-icon {
                    font-size: 1.5rem;
                }
                
                .session-info {
                    flex: 1;
                }
                
                .session-device {
                    font-weight: 500;
                    color: var(--gov-gray-dark);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .current-badge {
                    font-size: 0.75rem;
                    padding: 0.125rem 0.5rem;
                    background: var(--gov-blue);
                    color: white;
                    border-radius: 12px;
                    font-weight: 500;
                }
                
                .session-meta {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.8125rem;
                    color: var(--gov-gray);
                    margin-top: 0.25rem;
                }
                
                .security-status {
                    margin-bottom: 1rem;
                }
                
                .status-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--gov-border);
                }
                
                .status-label {
                    font-weight: 500;
                    color: var(--gov-gray-dark);
                }
                
                .mfa-warning {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background: rgba(234, 179, 8, 0.1);
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    border-radius: 6px;
                    color: #92400e;
                    font-size: 0.875rem;
                }
                
                .security-actions {
                    margin-top: 1rem;
                }
                
                .gov-page-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 400px;
                    color: var(--gov-gray);
                }
                
                .gov-empty-state {
                    color: var(--gov-gray);
                    text-align: center;
                    padding: 2rem;
                }
            `}</style>
        </div>
    );
}
