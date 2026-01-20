'use client';

import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="login-container">
                <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
