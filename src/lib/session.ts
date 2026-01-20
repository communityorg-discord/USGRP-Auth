import { SessionOptions } from 'iron-session';
import { AuthToken } from './auth';

export interface SessionData {
    authToken?: string;
    user?: AuthToken;
    isLoggedIn: boolean;
    lastActivity?: number;
    pending2FA?: boolean;
    pendingUserId?: string;
}

export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || 'usgrp-auth-session-secret-at-least-32-characters',
    cookieName: 'usgrp-auth-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    },
};

export const extendedSessionOptions: SessionOptions = {
    ...sessionOptions,
    cookieOptions: {
        ...sessionOptions.cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export const defaultSession: SessionData = {
    isLoggedIn: false,
};
