import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary, SkeletonBlock, ToastContainer } from './components/ui/Common';
import { PublicFooter, PublicHeader, WorkspaceShell } from './components/Layout';
// Route-level lazy loading keeps page-specific code out of the initial bundle.
const AboutPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.ContactPage })));
const FeaturesPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.FeaturesPage })));
const HowItWorksPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.HowItWorksPage })));
const LandingPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.LandingPage })));
const LegalPolicyPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.LegalPolicyPage })));
const PricingPage = lazy(() => import('./pages/PublicPages').then((module) => ({ default: module.PricingPage })));

const ForgotPasswordPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })));
const LoginPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.RegisterPage })));

const VerificationWorkspace = lazy(() => import('./pages/VerificationWorkspace').then((module) => ({ default: module.VerificationWorkspace })));

const CompareOpportunitiesPage = lazy(() => import('./pages/OpportunitiesPages').then((module) => ({ default: module.CompareOpportunitiesPage })));
const OpportunitiesDirectoryPage = lazy(() => import('./pages/OpportunitiesPages').then((module) => ({ default: module.OpportunitiesDirectoryPage })));
const OpportunityDetailPage = lazy(() => import('./pages/OpportunitiesPages').then((module) => ({ default: module.OpportunityDetailPage })));

const DashboardOverview = lazy(() => import('./pages/DashboardOverview').then((module) => ({ default: module.DashboardOverview })));
const EligibilityPage = lazy(() => import('./pages/EligibilityPage').then((module) => ({ default: module.EligibilityPage })));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage').then((module) => ({ default: module.ApplicationsPage })));
const AssistantPage = lazy(() => import('./pages/AssistantPage').then((module) => ({ default: module.AssistantPage })));
const TrustCenterPage = lazy(() => import('./pages/TrustCenterPage').then((module) => ({ default: module.TrustCenterPage })) );
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then((module) => ({ default: module.AdminPanel })));

function AppRouter() {
  const { user, loading } = useAuth();
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const navigate = useCallback((target: string) => {
    const url = new URL(target, window.location.origin);
    window.history.pushState({}, '', url.pathname + url.search);
    setLocationState({ pathname: url.pathname, search: url.search });
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setLocationState({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  const { pathname, search } = locationState;
  const searchParams = new URLSearchParams(search);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-8">
        <SkeletonBlock className="h-14" />
        <SkeletonBlock className="h-72" />
      </div>
    );
  }

  // Protected routes redirect cleanly to login if unauthenticated
  const isProtectedPath =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  if (isProtectedPath && !user) {
    return (
      <div className="pp-public-shell flex min-h-screen flex-col bg-[#F7F7F0] text-[#101713] dark:bg-[#0C110E] dark:text-[#F7F7F0]">
        <PublicHeader currentPath="/login" navigate={navigate} />
        <main className="pp-public-canvas flex-1">
          <LoginPage navigate={navigate} />
        </main>
        <PublicFooter navigate={navigate} />
      </div>
    );
  }

  if (pathname === '/admin' && user && user.role !== 'admin' && user.role !== 'moderator') {
    return (
      <WorkspaceShell currentPath="/dashboard" navigate={navigate} breadcrumb={['Workspace', 'Access Denied']}>
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center dark:border-red-900 dark:bg-[#141B17]">
          <h1 className="font-display text-xl font-bold text-[#101713] dark:text-[#F7F7F0]">
            Administrator or Moderator Role Required
          </h1>
          <p className="mt-2 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
            Your current role ({user.role}) does not have access to administration endpoints.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-4 rounded-lg bg-[#101713] px-4 py-2 text-xs font-semibold text-[#F7F7F0] dark:bg-[#C5F36A] dark:text-[#101713]"
          >
            Return to Student Dashboard
          </button>
        </div>
      </WorkspaceShell>
    );
  }

  // Workspace Routes (also render /verify, /opportunities, /compare in WorkspaceShell when signed in)
  const useWorkspaceShell =
    Boolean(user) &&
    (pathname.startsWith('/dashboard') ||
      pathname === '/admin' ||
      pathname === '/verify' ||
      pathname.startsWith('/opportunities') ||
      pathname === '/compare');

  if (useWorkspaceShell) {
    let breadcrumb = ['Workspace', 'Overview'];
    let content: React.ReactNode = <DashboardOverview navigate={navigate} />;

    if (pathname === '/dashboard') {
      breadcrumb = ['Workspace', 'Overview'];
      content = <DashboardOverview navigate={navigate} />;
    } else if (pathname === '/dashboard/eligibility') {
      breadcrumb = ['Workspace', 'Eligibility Profile'];
      content = <EligibilityPage navigate={navigate} />;
    } else if (pathname === '/dashboard/applications') {
      breadcrumb = ['Workspace', 'Application Pipeline'];
      content = <ApplicationsPage />;
    } else if (pathname === '/dashboard/assistant') {
      breadcrumb = ['Workspace', 'AI Advisor'];
      content = (
        <AssistantPage
          initialOpportunityId={searchParams.get('opportunityId') || ''}
          initialReportId={searchParams.get('reportId') || ''}
        />
      );
    } else if (pathname === '/dashboard/settings') {
      breadcrumb = ['Workspace', 'Preferences'];
      content = <SettingsPage />;
    } else if (pathname === '/dashboard/trust') {
      breadcrumb = ['Workspace', 'Trust Center'];
      content = <TrustCenterPage navigate={navigate} />;
    } else if (pathname === '/admin') {
      breadcrumb = ['Administration', 'Console'];
      content = <AdminPanel />;
    } else if (pathname === '/verify') {
      breadcrumb = ['Workspace', 'Verify Opportunity'];
      content = (
        <VerificationWorkspace
          navigate={navigate}
          initialUrl={searchParams.get('url') || ''}
          initialReportId={searchParams.get('report') || ''}
        />
      );
    } else if (pathname === '/opportunities') {
      breadcrumb = ['Workspace', 'Discover'];
      content = (
        <OpportunitiesDirectoryPage
          navigate={navigate}
          initialQuery={searchParams.get('q') || ''}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
        />
      );
    } else if (pathname.startsWith('/opportunities/')) {
      const oppId = pathname.replace('/opportunities/', '');
      breadcrumb = ['Workspace', 'Discover', 'Details'];
      content = <OpportunityDetailPage id={oppId} navigate={navigate} />;
    } else if (pathname === '/compare') {
      const paramIds = (searchParams.get('ids') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      breadcrumb = ['Workspace', 'Compare'];
      content = (
        <CompareOpportunitiesPage
          compareIds={paramIds.length ? paramIds : compareIds}
          onClearCompare={() => setCompareIds([])}
          navigate={navigate}
        />
      );
    }

    return (
      <WorkspaceShell currentPath={pathname} navigate={navigate} breadcrumb={breadcrumb}>
        {content}
      </WorkspaceShell>
    );
  }

  // Public Website Routes
  let publicContent: React.ReactNode;
  if (pathname === '/' || pathname === '') {
    publicContent = <LandingPage navigate={navigate} />;
  } else if (pathname === '/features') {
    publicContent = <FeaturesPage navigate={navigate} />;
  } else if (pathname === '/how-it-works') {
    publicContent = <HowItWorksPage navigate={navigate} />;
  } else if (pathname === '/pricing') {
    publicContent = <PricingPage navigate={navigate} />;
  } else if (pathname === '/about') {
    publicContent = <AboutPage />;
  } else if (pathname === '/contact') {
    publicContent = <ContactPage />;
  } else if (pathname === '/login') {
    publicContent = <LoginPage navigate={navigate} />;
  } else if (pathname === '/register') {
    publicContent = <RegisterPage navigate={navigate} />;
  } else if (pathname === '/forgot-password') {
    publicContent = <ForgotPasswordPage navigate={navigate} />;
  } else if (pathname === '/verify') {
    publicContent = (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <VerificationWorkspace
          navigate={navigate}
          initialUrl={searchParams.get('url') || ''}
          initialReportId={searchParams.get('report') || ''}
        />
      </div>
    );
  } else if (pathname === '/opportunities') {
    publicContent = (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <OpportunitiesDirectoryPage
          navigate={navigate}
          initialQuery={searchParams.get('q') || ''}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
        />
      </div>
    );
  } else if (pathname.startsWith('/opportunities/')) {
    const oppId = pathname.replace('/opportunities/', '');
    publicContent = (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <OpportunityDetailPage id={oppId} navigate={navigate} />
      </div>
    );
  } else if (pathname === '/compare') {
    const paramIds = (searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    publicContent = (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CompareOpportunitiesPage
          compareIds={paramIds.length ? paramIds : compareIds}
          onClearCompare={() => setCompareIds([])}
          navigate={navigate}
        />
      </div>
    );
  } else if (pathname === '/privacy') {
    publicContent = (
      <LegalPolicyPage
        title="Privacy Policy"
        sections={[
          {
            heading: 'Data Collection & Minimal Retention',
            body: 'ProofPath AI stores only the account, eligibility profile, verification audit, and application tracking data you explicitly submit. Uploaded PDFs and screenshots are processed in memory for verification and never resold or shared with third-party marketers.',
          },
          {
            heading: 'Authentication & Cookie Security',
            body: 'Sessions are protected via HTTP-only cryptographic cookies, scrypt password hashing, and per-session CSRF tokens.',
          },
        ]}
      />
    );
  } else if (pathname === '/terms') {
    publicContent = (
      <LegalPolicyPage
        title="Terms of Service"
        sections={[
          {
            heading: 'Advisory & Verification Scope',
            body: 'ProofPath AI provides evidence-backed verification analysis and eligibility guidance. Final admission, visa, and funding decisions rest solely with the official host institution.',
          },
          {
            heading: 'Acceptable Use',
            body: 'Automated scraping, SSRF probing of private networks, or submitting abusive content to the verification workspace is strictly prohibited and logged.',
          },
        ]}
      />
    );
  } else if (pathname === '/responsible-ai') {
    publicContent = (
      <LegalPolicyPage
        title="Responsible AI & Anti-Hallucination Standards"
        sections={[
          {
            heading: 'No Fabricated Citations',
            body: 'Every external link stored in verification evidence records must come directly from retrieved web grounding or the submitted primary source. When authoritative corroboration is unavailable, ProofPath AI reports UNVERIFIED or INSUFFICIENT_EVIDENCE.',
          },
          {
            heading: 'Explicit Missing Data Handling',
            body: 'Our eligibility engine never assumes GPA, nationality, or English scores when absent from a student profile, surfacing MISSING_INFO with transparent reasoning.',
          },
        ]}
      />
    );
  } else {
    publicContent = <LandingPage navigate={navigate} />;
  }

  return (
      <div className="pp-public-shell flex min-h-screen flex-col bg-[#F7F7F0] text-[#101713] dark:bg-[#0C110E] dark:text-[#F7F7F0]">
      <PublicHeader currentPath={pathname} navigate={navigate} />
        <main className="pp-public-canvas flex-1">
          <div key={pathname} className="pp-page-enter">{publicContent}</div>
        </main>
      <PublicFooter navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="mx-auto max-w-5xl space-y-4 p-8">
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-72" />
            </div>
          }
        >
          <AppRouter />
        </Suspense>
        <ToastContainer />
      </AuthProvider>
    </ErrorBoundary>
  );
}
