'use client';

import { useState, useEffect } from 'react';

const APPLICATIONS = [
    {
        name: 'USGRP Mail',
        url: 'https://mail.usgrp.xyz',
        callbackPath: '/api/auth/callback',
        icon: '📧',
        description: 'Secure staff email and communication',
        status: 'online'
    },
    {
        name: 'Admin Dashboard',
        url: 'https://admin.usgrp.xyz',
        callbackPath: '/api/auth/callback',
        icon: '🏛️',
        description: 'Staff administration and management tools',
        status: 'online'
    },
    {
        name: 'Status Portal',
        url: 'https://status.usgrp.xyz',
        callbackPath: '/api/auth/callback',
        icon: '📊',
        description: 'System status, changelogs, and roadmap',
        status: 'online'
    },
];

export default function AppsPage() {
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getToken() {
            try {
                const res = await fetch('/api/auth/session');
                if (res.ok) {
                    const data = await res.json();
                    if (data.authToken) {
                        setAuthToken(data.authToken);
                    }
                }
            } catch (e) {
                console.error('Failed to get auth token:', e);
            } finally {
                setLoading(false);
            }
        }
        getToken();
    }, []);

    function handleAppClick(app: typeof APPLICATIONS[0]) {
        if (authToken) {
            // SSO redirect with token
            const callbackUrl = `${app.url}${app.callbackPath}?token=${encodeURIComponent(authToken)}`;
            window.location.href = callbackUrl;
        } else {
            // Fallback - just go to the app (will redirect to login)
            window.location.href = app.url;
        }
    }

    return (
        <div>
            {/* Page Header */}
            <div className="gov-page-header">
                <h1 className="gov-page-title">Applications</h1>
                <p className="gov-page-subtitle">Access USGRP services with single sign-on</p>
            </div>

            {/* SSO Info */}
            <div className="gov-alert gov-alert-info">
                <strong>Single Sign-On Enabled:</strong> Click any application below to launch with your current session.
                You will be automatically authenticated.
            </div>

            {/* Apps Grid */}
            <div className="gov-apps-grid">
                {APPLICATIONS.map((app) => (
                    <div
                        key={app.name}
                        className="gov-app-card"
                        onClick={() => handleAppClick(app)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleAppClick(app)}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        <div className="gov-app-icon">{app.icon}</div>
                        <div className="gov-app-info">
                            <h3>{app.name}</h3>
                            <p>{app.description}</p>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <span className={`gov-badge ${app.status === 'online' ? 'gov-badge-green' : 'gov-badge-red'}`}>
                                {app.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '1.25rem', color: 'var(--gov-blue)' }}>→</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Access Info */}
            <div className="gov-card" style={{ marginTop: '1.5rem' }}>
                <div className="gov-card-header">
                    <h2 className="gov-card-title">About Single Sign-On</h2>
                </div>
                <div className="gov-card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ color: 'var(--gov-gray-dark)', margin: '0 0 0.5rem' }}>🔐 Secure Authentication</h4>
                            <p style={{ color: 'var(--gov-gray)', fontSize: '0.875rem', margin: 0 }}>
                                Your credentials are securely transmitted using encrypted connections.
                                Each application verifies your identity through the central Auth service.
                            </p>
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--gov-gray-dark)', margin: '0 0 0.5rem' }}>⚡ One Login, All Services</h4>
                            <p style={{ color: 'var(--gov-gray)', fontSize: '0.875rem', margin: 0 }}>
                                Log in once to access all USGRP applications. No need to remember
                                multiple passwords or log in separately to each service.
                            </p>
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--gov-gray-dark)', margin: '0 0 0.5rem' }}>📋 Activity Logging</h4>
                            <p style={{ color: 'var(--gov-gray)', fontSize: '0.875rem', margin: 0 }}>
                                All SSO access is logged for security. Administrators can view which
                                services you've accessed through the Audit Log.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Need Access? */}
            <div className="gov-card">
                <div className="gov-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--gov-gray-dark)', fontSize: '1rem' }}>Need access to additional services?</h3>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--gov-gray)', fontSize: '0.875rem' }}>
                            Contact an administrator if you require access to services not listed here.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
