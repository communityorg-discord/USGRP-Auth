'use client';

import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="sso-container">
                <div className="sso-loading">
                    <div className="sso-spinner"></div>
                </div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
