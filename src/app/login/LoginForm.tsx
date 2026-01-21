'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('return');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (data.authenticated) {
                    // Only auto-redirect if no returnUrl (i.e., direct login to Auth dashboard)
                    // For SSO flows with returnUrl, user must re-enter password for IMAP access
                    if (!returnUrl) {
                        router.push('/dashboard');
                    }
                    // If returnUrl exists, don't auto-redirect - let user enter password
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
                body: JSON.stringify({ email, password, returnUrl }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                return;
            }

            if (data.requires2FA) {
                router.push(`/login/2fa${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ''}`);
                return;
            }

            if (returnUrl) {
                const callbackUrl = new URL(returnUrl);
                callbackUrl.pathname = '/api/auth/callback';
                callbackUrl.searchParams.set('token', data.token);
                // Pass encoded credentials for IMAP access
                // Using base64 encoding - in production, use proper encryption
                callbackUrl.searchParams.set('mc', btoa(JSON.stringify({ e: email, p: password })));
                window.location.href = callbackUrl.toString();
            } else {
                router.push('/dashboard');
            }

        } catch (e) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (checkingSession) {
        return (
            <div className="sso-container">
                <div className="sso-loading">
                    <div className="sso-spinner"></div>
                    <p>Checking session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sso-container">
            <div className="sso-card">
                {/* Logo & Branding */}
                <div className="sso-header">
                    <div className="sso-logo">
                        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="40" height="40" rx="8" fill="#3b82f6" />
                            <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="sso-title">USGRP</h1>
                    <p className="sso-subtitle">Identity Provider</p>
                </div>

                {/* Sign In Text */}
                <div className="sso-form-header">
                    <h2>Sign in</h2>
                    {returnUrl && (
                        <p className="sso-return-hint">
                            to continue to <strong>{new URL(returnUrl).hostname}</strong>
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="sso-error">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="sso-form">
                    <div className="sso-field">
                        <label htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@usgrp.xyz"
                            required
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="sso-field">
                        <label htmlFor="password">Password</label>
                        <div className="sso-password-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="sso-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="sso-submit"
                        disabled={loading || !email || !password}
                    >
                        {loading ? (
                            <>
                                <div className="sso-spinner-small"></div>
                                Signing in...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </button>
                </form>

                {/* Footer Links */}
                <div className="sso-footer">
                    <a href="/forgot-password">Forgot password?</a>
                </div>
            </div>

            {/* Security Footer */}
            <div className="sso-security">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Secured by USGRP Auth</span>
            </div>
        </div>
    );
}
