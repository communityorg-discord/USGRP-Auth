'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
    userId: string;
    email: string;
    displayName: string;
    discordId: string | null;
    authorityLevel: number;
}

interface NavItem {
    name: string;
    path: string;
    icon: string;
    minLevel: number;
}

const NAV_SECTIONS = [
    {
        title: 'Account',
        items: [
            { name: 'Overview', path: '/dashboard', icon: '📊', minLevel: 0 },
            { name: 'Profile', path: '/dashboard/profile', icon: '👤', minLevel: 0 },
            { name: 'Security', path: '/dashboard/security', icon: '🔐', minLevel: 0 },
            { name: 'Applications', path: '/dashboard/apps', icon: '🚀', minLevel: 0 },
        ],
    },
    {
        title: 'Administration',
        items: [
            { name: 'Users', path: '/dashboard/users', icon: '👥', minLevel: 3 },
            { name: 'Approvals', path: '/dashboard/approvals', icon: '✅', minLevel: 3 },
            { name: 'Audit Log', path: '/dashboard/audit', icon: '📋', minLevel: 3 },
        ],
    },
    {
        title: 'System',
        items: [
            { name: 'Permissions', path: '/dashboard/permissions', icon: '🔑', minLevel: 5 },
        ],
    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (!data.authenticated) {
                    router.push('/login');
                    return;
                }

                setUser(data.user);
            } catch (e) {
                console.error('Auth check failed:', e);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }

        checkAuth();
    }, [router]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    if (loading) {
        return (
            <div className="gov-loading">
                <div className="gov-loading-spinner" />
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="gov-layout">
            {/* Top Header */}
            <header className="gov-header">
                <div className="gov-header-left">
                    <button
                        className="gov-sidebar-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        ☰
                    </button>
                    <div className="gov-logo">
                        <div className="gov-seal">🏛️</div>
                        <div className="gov-title">
                            <span className="gov-title-main">USGRP Auth</span>
                            <span className="gov-title-sub">Identity Management Portal</span>
                        </div>
                    </div>
                </div>
                <div className="gov-header-right">
                    <div className="gov-official-badge">
                        An Official USGRP Portal
                    </div>
                    <div className="gov-user-menu">
                        <button
                            className="gov-user-button"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                        >
                            <span className="gov-user-avatar">
                                {user?.displayName?.charAt(0) || 'U'}
                            </span>
                            <span className="gov-user-name">{user?.displayName}</span>
                            <span className="gov-user-arrow">▼</span>
                        </button>
                        {userMenuOpen && (
                            <div className="gov-user-dropdown">
                                <div className="gov-user-dropdown-header">
                                    <strong>{user?.displayName}</strong>
                                    <span>{user?.email}</span>
                                </div>
                                <Link href="/dashboard/profile" className="gov-user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                    👤 My Profile
                                </Link>
                                <Link href="/dashboard/security" className="gov-user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                    🔐 Security
                                </Link>
                                <hr className="gov-user-dropdown-divider" />
                                <button onClick={handleLogout} className="gov-user-dropdown-item gov-logout">
                                    ↪ Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="gov-body">
                {/* Sidebar */}
                <aside className={`gov-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                    <nav className="gov-nav">
                        {NAV_SECTIONS.map((section) => {
                            const visibleItems = section.items.filter(
                                (item) => (user?.authorityLevel || 0) >= item.minLevel
                            );

                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={section.title} className="gov-nav-section">
                                    <div className="gov-nav-section-title">{section.title}</div>
                                    {visibleItems.map((item) => (
                                        <Link
                                            key={item.path}
                                            href={item.path}
                                            className={`gov-nav-item ${pathname === item.path ? 'active' : ''}`}
                                        >
                                            <span className="gov-nav-icon">{item.icon}</span>
                                            <span className="gov-nav-label">{item.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            );
                        })}
                    </nav>

                    <div className="gov-sidebar-footer">
                        <div className="gov-authority-badge">
                            {getAuthorityName(user?.authorityLevel || 0)}
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="gov-main">
                    {children}
                </main>
            </div>
        </div>
    );
}

function getAuthorityName(level: number): string {
    const names: Record<number, string> = {
        0: 'User',
        1: 'Moderator',
        2: 'Senior Mod',
        3: 'Admin',
        4: 'HR',
        5: 'Superuser',
        6: 'Bot Developer',
    };
    return names[level] || 'User';
}
