import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileCheck2,
  GitCompareArrows,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { NotificationItem } from '../types';

export function PublicHeader({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (path: string) => void;
}) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Opportunities', path: '/opportunities' },
    { label: 'Verify', path: '/verify' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Compare', path: '/compare' },
    { label: 'Pricing', path: '/pricing' },
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4E8E0] bg-[#F7F7F0]/95 backdrop-blur-sm dark:border-[#232D27] dark:bg-[#0C110E]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="font-display text-lg font-bold tracking-tight text-[#101713] whitespace-nowrap shrink-0 dark:text-[#F7F7F0]"
        >
          ProofPath AI
        </button>

        {/* Zone 2: 5 Single-line Nav Links */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#101713] underline decoration-[#C5F36A] decoration-2 underline-offset-8 dark:text-[#C5F36A]'
                    : 'text-[#5E6B5B] hover:text-[#101713] dark:text-[#8C9A88] dark:hover:text-[#F7F7F0]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav(user ? '/dashboard' : '/login')}
            className="hidden rounded-lg bg-[#101713] px-4 py-2 text-sm font-semibold text-[#F7F7F0] transition-colors hover:bg-[#1D2520] whitespace-nowrap shrink-0 md:inline-flex dark:bg-[#C5F36A] dark:text-[#101713] dark:hover:bg-[#b5e458]"
          >
            {user ? 'Workspace' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E8E0] text-[#101713] md:hidden dark:border-[#232D27] dark:text-[#F7F7F0]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E4E8E0] bg-[#F7F7F0] px-4 py-4 md:hidden dark:border-[#232D27] dark:bg-[#0C110E]">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#1D2520] hover:bg-[#E4E8E0]/50 dark:text-[#F7F7F0] dark:hover:bg-[#141B17]"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleNav(user ? '/dashboard' : '/login')}
              className="mt-2 rounded-lg bg-[#101713] px-4 py-2.5 text-center text-sm font-semibold text-[#F7F7F0] dark:bg-[#C5F36A] dark:text-[#101713]"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter({ navigate }: { navigate: (path: string) => void }) {
  const { theme, toggleTheme } = useAuth();
  return (
    <footer className="border-t border-[#E4E8E0] bg-white dark:border-[#232D27] dark:bg-[#0C110E]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <p className="font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
              ProofPath AI
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#5E6B5B] dark:text-[#8C9A88]">
              Evidence-first student opportunity intelligence, claim verification, and application protection platform.
            </p>
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E4E8E0] px-3 py-1.5 text-xs font-medium text-[#1D2520] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#F7F7F0] dark:hover:bg-[#141B17]"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              <span>{theme === 'light' ? 'Dark Appearance' : 'Light Appearance'}</span>
            </button>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-[#101713] uppercase dark:text-[#F7F7F0]">
              Platform
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
              <li>
                <button type="button" onClick={() => navigate('/features')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Features
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/how-it-works')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  How It Works
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/verify')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Public Verification
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/opportunities')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Verified Directory
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-[#101713] uppercase dark:text-[#F7F7F0]">
              Organization
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
              <li>
                <button type="button" onClick={() => navigate('/about')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  About
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/pricing')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Pricing
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/contact')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Contact
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/register')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Create Account
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-[#101713] uppercase dark:text-[#F7F7F0]">
              Trust &amp; Governance
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
              <li>
                <button type="button" onClick={() => navigate('/responsible-ai')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Responsible AI
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/privacy')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/terms')} className="hover:text-[#101713] dark:hover:text-[#C5F36A]">
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#E4E8E0] pt-6 text-xs text-[#5E6B5B] sm:flex-row sm:items-center dark:border-[#232D27] dark:text-[#8C9A88]">
          <p>© {new Date().getFullYear()} ProofPath AI. Built for student opportunity transparency.</p>
          <p className="font-mono">Evidence-backed verification · Zero fabricated citations</p>
        </div>
      </div>
    </footer>
  );
}

export function WorkspaceShell({
  currentPath,
  navigate,
  breadcrumb,
  children,
}: {
  currentPath: string;
  navigate: (path: string) => void;
  breadcrumb: string[];
  children: React.ReactNode;
}) {
  const { user, theme, toggleTheme, unreadNotifications, setUnreadNotifications, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [globalQuery, setGlobalQuery] = useState('');

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiRequest<{ items: NotificationItem[] }>('/api/notifications');
      setNotifications(data.items);
      setUnreadNotifications(data.items.filter((n) => !n.isRead).length);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (notifOpen && user) {
      loadNotifications();
    }
  }, [notifOpen, user]);

  const markRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadNotifications((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotifications(0);
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalQuery.trim()) {
      navigate(`/opportunities?q=${encodeURIComponent(globalQuery.trim())}`);
    } else {
      navigate('/opportunities');
    }
  };

  const studentLinks = [
    { label: 'Command Center', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4 shrink-0" /> },
    { label: 'Verify Evidence', path: '/verify', icon: <FileCheck2 className="h-4 w-4 shrink-0" /> },
    { label: 'Discover', path: '/opportunities', icon: <Compass className="h-4 w-4 shrink-0" /> },
    { label: 'Compare', path: '/compare', icon: <GitCompareArrows className="h-4 w-4 shrink-0" /> },
    { label: 'Eligibility Matrix', path: '/dashboard/eligibility', icon: <UserCheck className="h-4 w-4 shrink-0" /> },
    { label: 'Applications', path: '/dashboard/applications', icon: <Kanban className="h-4 w-4 shrink-0" /> },
    { label: 'AI Advisor', path: '/dashboard/assistant', icon: <Bot className="h-4 w-4 shrink-0" /> },
    { label: 'Trust Center', path: '/dashboard/trust', icon: <ShieldCheck className="h-4 w-4 shrink-0" /> },
  ];

  const isPrivileged = user?.role === 'admin' || user?.role === 'moderator';

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-[#E4E8E0] px-4 dark:border-[#232D27]">
          {!collapsed && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="font-display text-base font-bold tracking-tight text-[#101713] whitespace-nowrap dark:text-[#F7F7F0]"
            >
              ProofPath AI
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden rounded-lg p-1.5 text-[#5E6B5B] hover:bg-[#F7F7F0] lg:inline-flex dark:text-[#8C9A88] dark:hover:bg-[#1D2520]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1 p-3" aria-label="Workspace navigation">
          {studentLinks.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setMobileDrawer(false);
                  navigate(item.path);
                }}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
                    : 'text-[#1D2520] hover:bg-[#F7F7F0] dark:text-[#D5DDD2] dark:hover:bg-[#1D2520]'
                }`}
              >
                {item.icon}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          {isPrivileged && (
            <div className="pt-4">
              {!collapsed && (
                <p className="px-3 pb-1.5 font-mono text-[11px] font-semibold tracking-wider text-[#8C9A88] uppercase">
                  Administration
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileDrawer(false);
                  navigate('/admin');
                }}
                title={collapsed ? 'Admin Console' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  currentPath === '/admin'
                    ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
                    : 'text-[#1D2520] hover:bg-[#F7F7F0] dark:text-[#D5DDD2] dark:hover:bg-[#1D2520]'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">Admin &amp; Moderation</span>}
              </button>
            </div>
          )}
        </nav>
      </div>

      <div className="border-t border-[#E4E8E0] p-3 dark:border-[#232D27]">
        <button
          type="button"
          onClick={() => {
            setMobileDrawer(false);
            navigate('/dashboard/settings');
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            currentPath === '/dashboard/settings'
              ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
              : 'text-[#5E6B5B] hover:bg-[#F7F7F0] dark:text-[#8C9A88] dark:hover:bg-[#1D2520]'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Preferences</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F7F0] text-[#101713] dark:bg-[#0C110E] dark:text-[#F7F7F0]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#E4E8E0] bg-white transition-all duration-200 lg:block dark:border-[#232D27] dark:bg-[#141B17] ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#101713]/60"
            onClick={() => setMobileDrawer(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 bg-white dark:bg-[#141B17]">{SidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E4E8E0] bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-[#232D27] dark:bg-[#141B17]/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawer(true)}
              aria-label="Open workspace menu"
              className="rounded-lg border border-[#E4E8E0] p-2 text-[#5E6B5B] lg:hidden dark:border-[#232D27] dark:text-[#8C9A88]"
            >
              <Menu className="h-4 w-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
              {breadcrumb.map((part, idx) => (
                <React.Fragment key={part + idx}>
                  {idx > 0 && <span className="text-[#8C9A88]">/</span>}
                  <span
                    className={
                      idx === breadcrumb.length - 1
                        ? 'font-display font-semibold text-[#101713] truncate dark:text-[#F7F7F0]'
                        : 'hidden text-[#5E6B5B] sm:inline dark:text-[#8C9A88]'
                    }
                  >
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <form onSubmit={handleGlobalSearch} className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8C9A88]" />
              <input
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search opportunities..."
                aria-label="Global opportunity search"
                className="h-9 w-52 rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] pr-3 pl-9 text-sm text-[#101713] placeholder:text-[#8C9A88] focus:border-[#101713] focus:outline-none lg:w-64 dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0] dark:focus:border-[#C5F36A]"
              />
            </form>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E8E0] text-[#5E6B5B] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#8C9A88] dark:hover:bg-[#1D2520]"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E8E0] text-[#5E6B5B] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#8C9A88] dark:hover:bg-[#1D2520]"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-[#C5F36A] px-1 font-mono text-[10px] font-bold text-[#101713]">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E4E8E0] bg-white shadow-xl dark:border-[#232D27] dark:bg-[#141B17]">
                  <div className="flex items-center justify-between border-b border-[#E4E8E0] px-4 py-3 dark:border-[#232D27]">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#101713] hover:underline dark:text-[#C5F36A]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Mark all read</span>
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E8E0] dark:divide-[#232D27]">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-[#5E6B5B]">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.isRead) markRead(n.id);
                            setNotifOpen(false);
                            navigate(n.link || '/dashboard');
                          }}
                          className={`block w-full px-4 py-3 text-left transition-colors hover:bg-[#F7F7F0] dark:hover:bg-[#1D2520] ${
                            !n.isRead ? 'bg-[#C5F36A]/15 dark:bg-[#C5F36A]/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#101713] dark:text-[#F7F7F0]">
                              {n.title}
                            </span>
                            <span className="font-mono text-[10px] text-[#8C9A88]">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E4E8E0] px-2.5 py-1.5 text-sm font-medium text-[#1D2520] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#F7F7F0] dark:hover:bg-[#1D2520]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#101713] text-xs font-semibold text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]">
                    {user.fullName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate sm:inline">{user.fullName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#8C9A88]" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E4E8E0] bg-white p-1.5 shadow-xl dark:border-[#232D27] dark:bg-[#141B17]">
                    <div className="border-b border-[#E4E8E0] px-3 py-2 dark:border-[#232D27]">
                      <p className="truncate text-sm font-semibold text-[#101713] dark:text-[#F7F7F0]">
                        {user.fullName}
                      </p>
                      <p className="truncate text-xs text-[#5E6B5B]">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/dashboard/eligibility');
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#1D2520] hover:bg-[#F7F7F0] dark:text-[#F7F7F0] dark:hover:bg-[#1D2520]"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Eligibility Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/dashboard/settings');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#1D2520] hover:bg-[#F7F7F0] dark:text-[#F7F7F0] dark:hover:bg-[#1D2520]"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span>Account Preferences</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-lg bg-[#101713] px-3.5 py-1.5 text-sm font-semibold text-[#F7F7F0] hover:bg-[#1D2520] dark:bg-[#C5F36A] dark:text-[#101713]"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
