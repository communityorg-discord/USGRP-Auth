'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ApprovalRequest {
    id: string;
    requester_id: string;
    requester_name: string;
    requester_email: string;
    approver_name: string | null;
    action_type: string;
    target_user: string | null;
    action_data: string | null;
    reason: string;
    status: 'pending' | 'approved' | 'denied' | 'expired';
    expires_at: string;
    created_at: string;
    resolved_at: string | null;
    approver_reason: string | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    'USER_DELETE': { label: 'Delete User', icon: '🗑️', color: 'danger' },
    'USER_SUSPEND': { label: 'Suspend User', icon: '⛔', color: 'warning' },
    'USER_UNSUSPEND': { label: 'Unsuspend User', icon: '✅', color: 'success' },
    'AUTHORITY_CHANGE_ADMIN': { label: 'Change Authority', icon: '👑', color: 'info' },
    'RESET_2FA_ADMIN': { label: 'Reset 2FA', icon: '🔐', color: 'warning' },
};

export default function ApprovalsPage() {
    const router = useRouter();
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'expired'>('pending');
    const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [approverReason, setApproverReason] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, [filter]);

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

            // Load approvals
            const res = await fetch(`/api/approvals?status=${filter}`);
            if (res.ok) {
                const data = await res.json();
                setApprovals(data.approvals || []);
            }
        } catch (error) {
            console.error('Error loading approvals:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDecision(decision: 'approved' | 'denied') {
        if (!selectedApproval) return;

        setActionLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/approvals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approvalId: selectedApproval.id,
                    decision,
                    approverReason: approverReason || null,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({
                    type: 'success',
                    text: `Request ${decision}${data.actionResult?.executed ? '. Action executed.' : ''}`
                });
                setSelectedApproval(null);
                setApproverReason('');
                loadData();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to process request' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setActionLoading(false);
        }
    }

    function formatDate(dateStr: string): string {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    function getTimeRemaining(expiresAt: string): string {
        const expires = new Date(expiresAt);
        const now = new Date();
        const diff = expires.getTime() - now.getTime();

        if (diff < 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${mins}m remaining`;
        return `${mins}m remaining`;
    }

    if (loading) {
        return (
            <div className="gov-page-loading">
                <div className="loading-spinner"></div>
                <p>Loading approvals...</p>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="gov-page-header">
                <div>
                    <h1 className="gov-page-title">Approval Requests</h1>
                    <p className="gov-page-subtitle">Review and approve high-risk administrative actions</p>
                </div>
            </div>

            {message && (
                <div className={`gov-alert gov-alert-${message.type}`} style={{ marginBottom: '1rem' }}>
                    {message.text}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="gov-tabs" style={{ marginBottom: '1.5rem' }}>
                {(['pending', 'approved', 'denied', 'expired'] as const).map(status => (
                    <button
                        key={status}
                        className={`gov-tab ${filter === status ? 'active' : ''}`}
                        onClick={() => setFilter(status)}
                    >
                        {status === 'pending' && '⏳ '}
                        {status === 'approved' && '✅ '}
                        {status === 'denied' && '❌ '}
                        {status === 'expired' && '⏰ '}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Info Banner for Two-Person Rule */}
            <div className="gov-info-banner" style={{ marginBottom: '1.5rem' }}>
                <span>🔒</span>
                <div>
                    <strong>Two-Person Rule (4-Eyes Principle)</strong>
                    <p>High-risk actions require approval from a different administrator. You cannot approve your own requests.</p>
                </div>
            </div>

            {/* Approvals List */}
            <div className="gov-card">
                <div className="gov-card-body">
                    {approvals.length === 0 ? (
                        <div className="gov-empty-state">
                            <p>No {filter} requests</p>
                        </div>
                    ) : (
                        <div className="approvals-list">
                            {approvals.map(approval => {
                                const actionInfo = ACTION_LABELS[approval.action_type] || {
                                    label: approval.action_type,
                                    icon: '❓',
                                    color: 'default'
                                };
                                const canApprove = filter === 'pending' &&
                                    approval.requester_id !== currentUser?.userId;

                                return (
                                    <div key={approval.id} className="approval-item">
                                        <div className="approval-icon" data-color={actionInfo.color}>
                                            {actionInfo.icon}
                                        </div>
                                        <div className="approval-info">
                                            <div className="approval-action">
                                                <strong>{actionInfo.label}</strong>
                                                {filter === 'pending' && (
                                                    <span className="expires-badge">
                                                        {getTimeRemaining(approval.expires_at)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="approval-meta">
                                                <span>Requested by: {approval.requester_name}</span>
                                                <span>•</span>
                                                <span>{formatDate(approval.created_at)}</span>
                                            </div>
                                            <div className="approval-reason">
                                                "{approval.reason}"
                                            </div>
                                            {approval.status !== 'pending' && approval.approver_name && (
                                                <div className="approval-resolution">
                                                    {approval.status === 'approved' ? '✅' : '❌'}
                                                    {approval.status} by {approval.approver_name}
                                                    {approval.approver_reason && ` - "${approval.approver_reason}"`}
                                                </div>
                                            )}
                                        </div>
                                        {canApprove && (
                                            <button
                                                className="gov-btn gov-btn-primary"
                                                onClick={() => setSelectedApproval(approval)}
                                            >
                                                Review
                                            </button>
                                        )}
                                        {filter === 'pending' && approval.requester_id === currentUser?.userId && (
                                            <span className="your-request-badge">Your request</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Review Modal */}
            {selectedApproval && (
                <div className="gov-modal-overlay" onClick={() => setSelectedApproval(null)}>
                    <div className="gov-modal" onClick={e => e.stopPropagation()}>
                        <div className="gov-modal-header">
                            <h2>Review Approval Request</h2>
                            <button className="gov-modal-close" onClick={() => setSelectedApproval(null)}>×</button>
                        </div>
                        <div className="gov-modal-body">
                            <div className="review-details">
                                <div className="review-row">
                                    <span className="label">Action:</span>
                                    <span className="value">
                                        {ACTION_LABELS[selectedApproval.action_type]?.icon}
                                        {ACTION_LABELS[selectedApproval.action_type]?.label || selectedApproval.action_type}
                                    </span>
                                </div>
                                <div className="review-row">
                                    <span className="label">Requested By:</span>
                                    <span className="value">{selectedApproval.requester_name} ({selectedApproval.requester_email})</span>
                                </div>
                                <div className="review-row">
                                    <span className="label">Reason:</span>
                                    <span className="value">{selectedApproval.reason}</span>
                                </div>
                                {selectedApproval.target_user && (
                                    <div className="review-row">
                                        <span className="label">Target User:</span>
                                        <span className="value">{selectedApproval.target_user}</span>
                                    </div>
                                )}
                                <div className="review-row">
                                    <span className="label">Expires:</span>
                                    <span className="value">{getTimeRemaining(selectedApproval.expires_at)}</span>
                                </div>
                            </div>

                            <div className="gov-form-group" style={{ marginTop: '1rem' }}>
                                <label>Your Comment (Optional)</label>
                                <textarea
                                    className="gov-form-input"
                                    value={approverReason}
                                    onChange={e => setApproverReason(e.target.value)}
                                    placeholder="Add a reason for your decision..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="gov-modal-footer">
                            <button
                                className="gov-btn gov-btn-danger"
                                onClick={() => handleDecision('denied')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Processing...' : '❌ Deny'}
                            </button>
                            <button
                                className="gov-btn gov-btn-success"
                                onClick={() => handleDecision('approved')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Processing...' : '✅ Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .approvals-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .approval-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--gov-white);
                    border: 1px solid var(--gov-border);
                    border-radius: 8px;
                }
                
                .approval-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    flex-shrink: 0;
                    background: #f1f5f9;
                }
                
                .approval-icon[data-color="danger"] { background: #fef2f2; }
                .approval-icon[data-color="warning"] { background: #fefce8; }
                .approval-icon[data-color="success"] { background: #f0fdf4; }
                .approval-icon[data-color="info"] { background: #eff6ff; }
                
                .approval-info {
                    flex: 1;
                }
                
                .approval-action {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                }
                
                .approval-action strong {
                    color: var(--gov-gray-dark);
                }
                
                .expires-badge {
                    font-size: 0.75rem;
                    padding: 0.125rem 0.5rem;
                    background: #fef9c3;
                    color: #854d0e;
                    border-radius: 12px;
                }
                
                .approval-meta {
                    display: flex;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                    color: var(--gov-gray);
                }
                
                .approval-reason {
                    margin-top: 0.5rem;
                    padding: 0.5rem;
                    background: #f8fafc;
                    border-radius: 4px;
                    font-size: 0.875rem;
                    color: var(--gov-gray-dark);
                    font-style: italic;
                }
                
                .approval-resolution {
                    margin-top: 0.5rem;
                    font-size: 0.8125rem;
                    color: var(--gov-gray);
                }
                
                .your-request-badge {
                    font-size: 0.75rem;
                    padding: 0.25rem 0.5rem;
                    background: #dbeafe;
                    color: #1e40af;
                    border-radius: 4px;
                    white-space: nowrap;
                }
                
                .gov-info-banner {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem;
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                }
                
                .gov-info-banner span {
                    font-size: 1.25rem;
                }
                
                .gov-info-banner strong {
                    display: block;
                    color: #1e40af;
                    margin-bottom: 0.25rem;
                }
                
                .gov-info-banner p {
                    font-size: 0.875rem;
                    color: #3b82f6;
                    margin: 0;
                }
                
                .gov-tabs {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                
                .gov-tab {
                    padding: 0.5rem 1rem;
                    background: var(--gov-white);
                    border: 1px solid var(--gov-border);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    transition: all 0.15s;
                }
                
                .gov-tab:hover {
                    background: #f8fafc;
                }
                
                .gov-tab.active {
                    background: var(--gov-blue);
                    color: white;
                    border-color: var(--gov-blue);
                }
                
                .review-details {
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 1rem;
                }
                
                .review-row {
                    display: flex;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .review-row:last-child {
                    border-bottom: none;
                }
                
                .review-row .label {
                    width: 120px;
                    font-weight: 500;
                    color: var(--gov-gray);
                    flex-shrink: 0;
                }
                
                .review-row .value {
                    color: var(--gov-gray-dark);
                }
                
                .gov-empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: var(--gov-gray);
                }
                
                .gov-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .gov-modal {
                    background: white;
                    border-radius: 12px;
                    width: 95%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow: auto;
                }
                
                .gov-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--gov-border);
                }
                
                .gov-modal-header h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin: 0;
                }
                
                .gov-modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--gov-gray);
                }
                
                .gov-modal-body {
                    padding: 1.5rem;
                }
                
                .gov-modal-footer {
                    display: flex;
                    gap: 0.75rem;
                    justify-content: flex-end;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--gov-border);
                    background: #f8fafc;
                }
                
                .gov-page-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 400px;
                    color: var(--gov-gray);
                }
            `}</style>
        </div>
    );
}
