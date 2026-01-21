'use client';

import { useState, FormEvent } from 'react';

export default function SecurityPage() {
    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    async function handlePasswordChange(e: FormEvent) {
        e.preventDefault();
        setPasswordMessage('');
        setPasswordError('');

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords don't match");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return;
        }

        setPasswordLoading(true);

        try {
            const res = await fetch('/api/auth/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setPasswordMessage(data.message || 'Password changed successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordError(data.error || 'Failed to change password');
            }
        } catch (e) {
            setPasswordError('Connection error. Please try again.');
        } finally {
            setPasswordLoading(false);
        }
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">Security Settings</h1>
                <p className="gov-page-subtitle">Manage your account security and authentication</p>
            </div>

            {/* Change Password */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">🔑 Change Password</h2>
                </div>
                <div className="gov-card-body">
                    <p style={{ color: 'var(--gov-gray)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
                        Your password is used for both Auth and Mail. Changing it here will update both systems.
                    </p>

                    {passwordMessage && <div className="gov-alert gov-alert-success">{passwordMessage}</div>}
                    {passwordError && <div className="gov-alert gov-alert-error">{passwordError}</div>}

                    <form onSubmit={handlePasswordChange} style={{ maxWidth: '400px' }}>
                        <div className="gov-form-group">
                            <label className="gov-form-label">Current Password</label>
                            <input
                                type="password"
                                className="gov-form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="gov-form-group">
                            <label className="gov-form-label">New Password</label>
                            <input
                                type="password"
                                className="gov-form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                            <small style={{ color: 'var(--gov-gray)', fontSize: '0.75rem' }}>
                                Minimum 8 characters
                            </small>
                        </div>
                        <div className="gov-form-group">
                            <label className="gov-form-label">Confirm New Password</label>
                            <input
                                type="password"
                                className="gov-form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" disabled={passwordLoading} className="gov-btn gov-btn-primary">
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">🛡️ Two-Factor Authentication</h2>
                </div>
                <div className="gov-card-body">
                    <div className="gov-alert gov-alert-warning">
                        <strong>Coming Soon:</strong> Two-factor authentication will be available in a future update.
                    </div>
                    <p style={{ color: 'var(--gov-gray)', fontSize: '0.9375rem' }}>
                        Two-factor authentication adds an extra layer of security by requiring a code from your
                        authenticator app in addition to your password.
                    </p>
                </div>
            </div>

            {/* Active Sessions */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">📱 Active Sessions</h2>
                </div>
                <div className="gov-card-body">
                    <div className="gov-alert gov-alert-info">
                        Session management allows you to view and revoke access from other devices.
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1rem',
                        background: 'var(--gov-gray-lightest)',
                        borderRadius: '4px',
                        border: '1px solid var(--gov-gray-lighter)'
                    }}>
                        <div style={{ fontSize: '1.5rem', marginRight: '1rem' }}>💻</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--gov-gray-dark)' }}>
                                Current Session
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gov-gray)' }}>
                                This browser • Active now
                            </div>
                        </div>
                        <span className="gov-badge gov-badge-green">ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* Security Recommendations */}
            <div className="gov-card">
                <div className="gov-card-header">
                    <h2 className="gov-card-title">✅ Security Recommendations</h2>
                </div>
                <div className="gov-card-body">
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--gov-gray-dark)' }}>
                        <li style={{ marginBottom: '0.75rem' }}>
                            <strong>Use a strong, unique password</strong>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                                Combine letters, numbers, and symbols. Don't reuse passwords from other accounts.
                            </p>
                        </li>
                        <li style={{ marginBottom: '0.75rem' }}>
                            <strong>Enable two-factor authentication (when available)</strong>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                                Adds an extra layer of protection to your account.
                            </p>
                        </li>
                        <li style={{ marginBottom: '0.75rem' }}>
                            <strong>Review active sessions regularly</strong>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                                Check for any suspicious activity and revoke unknown sessions.
                            </p>
                        </li>
                        <li>
                            <strong>Keep your contact information up to date</strong>
                            <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                                Ensure you can recover your account if needed.
                            </p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
