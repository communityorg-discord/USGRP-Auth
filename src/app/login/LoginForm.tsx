'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('return');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [checkingSession, setCheckingSession] = useState(true);

    // Check if already logged in
    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (data.authenticated) {
                    // Already logged in, redirect
                    if (returnUrl) {
                        window.location.href = `${returnUrl}?token=${encodeURIComponent(data.token || '')}`;
                    } else {
                        router.push('/dashboard');
                    }
                }
            } catch (e) {
                console.error('Session check failed:', e);
            } finally {
                setCheckingSession(false);
            }
        }

        checkSession();
    }, [returnUrl, router]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    rememberMe,
                    returnUrl,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed');
                return;
            }

            if (data.requires2FA) {
                router.push(`/login/2fa${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ''}`);
                return;
            }

            // Successful login
            if (returnUrl) {
                // SSO redirect - include token in callback
                const callbackUrl = new URL(returnUrl);
                callbackUrl.pathname = '/api/auth/callback';
                callbackUrl.searchParams.set('token', data.token);
                window.location.href = callbackUrl.toString();
            } else {
                router.push('/dashboard');
            }

        } catch (e) {
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (checkingSession) {
        return (
            <div className="login-container">
                <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="card login-card">
                <div className="login-header">
                    <div className="login-logo">USGRP</div>
                    <p className="login-subtitle">
                        {returnUrl
                            ? `Sign in to continue to ${new URL(returnUrl).hostname}`
                            : 'Central Authentication'
                        }
                    </p>
                </div>

                {error && (
                    <div className="error-message" style={{ marginBottom: '1.25rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@usgrp.xyz"
                            required
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <div className="form-footer">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>Remember me</span>
                        </label>
                        <a href="/forgot-password">Forgot password?</a>
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading && <span className="spinner" />}
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <div style={{
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--muted)'
                }}>
                    Don't have an account?{' '}
                    <a href="/register">Contact administrator</a>
                </div>
            </div>
        </div>
    );
}
