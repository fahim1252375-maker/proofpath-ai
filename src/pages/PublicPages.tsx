import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Compass,
  ExternalLink,
  FileCheck2,
  GitCompareArrows,
  Kanban,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { OpportunityItem, VerificationReport } from '../types';
import { VerificationStatusTag } from '../components/ui/Common';

interface PublicStats {
  verifiedOpportunities: number;
  totalOpportunities: number;
  verificationReports: number;
  countriesCovered: number;
  communityReports: number;
  announcement: {
    headline: string;
    subheadline: string;
    trustBanner: string;
  } | null;
}

export function LandingPage({ navigate }: { navigate: (path: string) => void }) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [sampleReport, setSampleReport] = useState<VerificationReport | null>(null);
  const [featuredOpps, setFeaturedOpps] = useState<OpportunityItem[]>([]);
  const [quickUrl, setQuickUrl] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [auditImgFailed, setAuditImgFailed] = useState(false);

  useEffect(() => {
    apiRequest<PublicStats>('/api/public/stats').then(setStats).catch(() => {});
    apiRequest<{ items: VerificationReport[] }>('/api/verifications?scope=public')
      .then((res) => {
        if (res.items.length > 0) setSampleReport(res.items[0]);
      })
      .catch(() => {});
    apiRequest<{ items: OpportunityItem[] }>('/api/opportunities?limit=3&sort=verified_recent')
      .then((res) => setFeaturedOpps(res.items))
      .catch(() => {});
  }, []);

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      navigate(`/verify?url=${encodeURIComponent(quickUrl.trim())}`);
    } else {
      navigate('/verify');
    }
  };

  return (
    <div className="bg-[#F7F7F0] dark:bg-[#0C110E]">
      {/* Editorial Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <p className="font-mono text-xs font-semibold tracking-wider text-[#5E6B5B] uppercase dark:text-[#C5F36A]">
                Evidence Intelligence · Student Protection
              </p>
              <h1
                className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[#101713] sm:text-5xl lg:text-[52px] lg:leading-[1.06] dark:text-[#F7F7F0]"
                style={{ textWrap: 'balance' }}
              >
                {stats?.announcement?.headline || 'Your Future Deserves Verified Opportunities.'}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#455044] dark:text-[#A9B5A6]">
                {stats?.announcement?.subheadline ||
                  'Discover scholarships, fellowships, internships and global opportunities with AI-powered verification, personalized eligibility intelligence, and transparent evidence.'}
              </p>

              {/* Interactive Product Quick-Verify Bar */}
              <form
                onSubmit={handleQuickVerify}
                className="mt-8 flex flex-col gap-2 rounded-xl border border-[#D7DDD0] bg-white p-2 sm:flex-row sm:items-center dark:border-[#232D27] dark:bg-[#141B17]"
              >
                <input
                  type="url"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="Paste any scholarship or internship URL to inspect..."
                  aria-label="Opportunity URL to verify"
                  className="h-11 flex-1 rounded-lg bg-transparent px-3 text-sm text-[#101713] placeholder:text-[#8C9A88] focus:outline-none dark:text-[#F7F7F0]"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#101713] px-5 text-sm font-semibold text-[#C5F36A] transition-colors hover:bg-[#1D2520] whitespace-nowrap shrink-0 dark:bg-[#C5F36A] dark:text-[#101713] dark:hover:bg-[#b5e458]"
                >
                  <span>Verify Opportunity</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
                <span>Audits live URLs, announcements, PDFs &amp; posters</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/opportunities')}
                  className="font-semibold text-[#101713] underline decoration-[#C5F36A] decoration-2 underline-offset-4 dark:text-[#C5F36A]"
                >
                  Explore Verified Directory
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[340px] overflow-hidden rounded-2xl border border-[#E4E8E0] bg-[#101713] dark:border-[#232D27]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_verification_platform_1794640632313.jpg"
                  alt="University students reviewing verified international scholarship dossiers"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="h-full w-full object-cover opacity-85"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#1D2520] p-8 text-[#C5F36A]">
                  <ShieldCheck className="h-14 w-14" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#101713] via-[#101713]/80 to-transparent p-6 text-[#F7F7F0]">
                <p className="font-mono text-[11px] font-semibold tracking-wider text-[#C5F36A] uppercase">
                  Primary-Source Audit Standard
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#F7F7F0]">
                  {stats?.announcement?.trustBanner ||
                    'Zero fabricated evidence. Every verdict cites inspected sources and states confidence limits.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Real Database Telemetry Strip */}
        <div className="mt-10 grid grid-cols-2 gap-6 rounded-xl border border-[#E4E8E0] bg-white p-6 sm:grid-cols-4 dark:border-[#232D27] dark:bg-[#141B17]">
          <div>
            <p className="font-mono text-3xl font-bold text-[#101713] tabular-nums dark:text-[#C5F36A]">
              {stats ? stats.verifiedOpportunities : '—'}
            </p>
            <p className="mt-1 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
              Verified Directory Programs
            </p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold text-[#101713] tabular-nums dark:text-[#F7F7F0]">
              {stats ? stats.verificationReports : '—'}
            </p>
            <p className="mt-1 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
              Evidence Audits Logged
            </p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold text-[#101713] tabular-nums dark:text-[#F7F7F0]">
              {stats ? stats.countriesCovered : '—'}
            </p>
            <p className="mt-1 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
              Destination Regions Indexed
            </p>
          </div>
          <div>
            <p className="font-mono text-3xl font-bold text-[#101713] tabular-nums dark:text-[#F7F7F0]">
              6
            </p>
            <p className="mt-1 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
              Explicit Verdict Tiers
            </p>
          </div>
        </div>
      </section>

      {/* Live Verification Evidence Preview (Real DB Record) */}
      <section className="border-t border-[#E4E8E0] bg-[#101713] py-16 text-[#F7F7F0] dark:border-[#232D27]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="font-mono text-xs font-semibold tracking-wider text-[#C5F36A] uppercase">
                Live Evidence Inspection
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Claims separated. Sources linked. Risks exposed.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#A9B5A6]">
                Instead of opaque trust scores, ProofPath AI decomposes every submission into individual claims—funding coverage, application fees, domain ownership, and deadline validity—and links retrieved primary evidence.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/verify')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C5F36A] px-4 py-2.5 text-sm font-semibold text-[#101713] hover:bg-[#b5e458]"
                >
                  <span>Open Evidence Engine</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/responsible-ai')}
                  className="rounded-lg border border-[#2C3730] px-4 py-2.5 text-sm font-medium text-[#F7F7F0] hover:bg-[#1D2520]"
                >
                  Anti-Hallucination Standard
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-[#2C3730] bg-[#1D2520] p-6">
                {sampleReport ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C3730] pb-4">
                      <div>
                        <p className="font-mono text-[11px] text-[#8C9A88] uppercase">
                          Stored Public Audit · {sampleReport.inputType}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-bold text-[#F7F7F0]">
                          {sampleReport.extractedInfo.title}
                        </h3>
                      </div>
                      <VerificationStatusTag status={sampleReport.overallStatus} />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-[#D5DDD2]">
                      {sampleReport.summary}
                    </p>
                    <div className="mt-5 space-y-2.5">
                      {sampleReport.claims.slice(0, 2).map((c, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#2C3730] bg-[#141B17] p-3.5 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[#F7F7F0]">{c.claim}</span>
                            <span className="font-mono text-[10px] font-semibold text-[#C5F36A] shrink-0">
                              {c.verdict}
                            </span>
                          </div>
                          {c.sourceUrl && (
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-[#C5F36A] hover:underline"
                            >
                              <span>{c.sourceUrl}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-[#8C9A88]">
                    Open the Verification Engine to inspect live evidence reports.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Opportunity Discovery Preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-[#5E6B5B] uppercase dark:text-[#C5F36A]">
              Audited Catalog Preview
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#101713] dark:text-[#F7F7F0]">
              Verified Opportunities Ready for Match Analysis
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#101713] underline decoration-[#C5F36A] decoration-2 underline-offset-4 dark:text-[#C5F36A]"
          >
            <span>View all directory programs</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {featuredOpps.map((opp) => (
            <article
              key={opp.id}
              className="flex flex-col justify-between rounded-xl border border-[#E4E8E0] bg-white p-6 transition-colors hover:border-[#101713] dark:border-[#232D27] dark:bg-[#141B17] dark:hover:border-[#C5F36A]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
                  <span className="capitalize">
                    {opp.category} · {opp.country}
                  </span>
                  <VerificationStatusTag status={opp.verificationStatus} />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[#101713] dark:text-[#F7F7F0]">
                  {opp.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-[#5E6B5B] dark:text-[#8C9A88]">
                  {opp.organization}
                </p>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#455044] dark:text-[#A9B5A6]">
                  {opp.description}
                </p>
              </div>
              <div className="mt-5 border-t border-[#E4E8E0] pt-4 text-xs dark:border-[#232D27]">
                <div className="flex items-center justify-between">
                  <span className="text-[#5E6B5B] dark:text-[#8C9A88]">Deadline</span>
                  <span className="font-mono font-semibold text-[#101713] tabular-nums dark:text-[#F7F7F0]">
                    {opp.deadline}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                  className="mt-3 w-full rounded-lg border border-[#E4E8E0] py-2 text-xs font-semibold text-[#101713] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#F7F7F0] dark:hover:bg-[#1D2520]"
                >
                  Inspect Match &amp; Trust Profile
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Core Capabilities Editorial Bento */}
      <section className="border-t border-[#E4E8E0] bg-white py-16 dark:border-[#232D27] dark:bg-[#141B17]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#101713] dark:text-[#F7F7F0]">
              Built for Verification Integrity and Student Clarity
            </h2>
            <p className="mt-3 text-base text-[#5E6B5B] dark:text-[#8C9A88]">
              ProofPath AI connects claim-level evidence graphs, multi-factor eligibility analysis, and readiness checklists inside one transparent architecture.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[#E4E8E0] bg-[#F7F7F0] p-6 lg:col-span-7 dark:border-[#232D27] dark:bg-[#0C110E]">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col justify-between">
                  <div>
                    <FileCheck2 className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
                    <h3 className="mt-3 font-display text-lg font-bold text-[#101713] dark:text-[#F7F7F0]">
                      01. Evidence Relationship Explorer
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#455044] dark:text-[#A9B5A6]">
                      Submit links, announcements, PDFs, or screenshots. Explore claim-to-source verification graphs, risk alerts, and comparison history.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/verify')}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#101713] underline decoration-[#C5F36A] decoration-2 underline-offset-4 dark:text-[#C5F36A]"
                  >
                    <span>Launch Verification Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-[#E4E8E0] dark:border-[#232D27]">
                  {!auditImgFailed ? (
                    <img
                      src="/src/assets/images/feature_evidence_audit_1794640632183.jpg"
                      alt="Scholarship dossier and academic verification workflow"
                      referrerPolicy="no-referrer"
                      onError={() => setAuditImgFailed(true)}
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-[#E4E8E0] dark:bg-[#1D2520]">
                      <FileCheck2 className="h-10 w-10 text-[#5E6B5B]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-xl border border-[#E4E8E0] bg-[#F7F7F0] p-6 dark:border-[#232D27] dark:bg-[#0C110E]">
                <UserCheck className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
                <h3 className="mt-3 font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                  02. Opportunity Intelligence Score
                </h3>
                <p className="mt-1.5 text-sm text-[#455044] dark:text-[#A9B5A6]">
                  Transparent 0–100 readiness index combining profile completeness, match coverage, checklists, and safety hygiene.
                </p>
              </div>
              <div className="rounded-xl border border-[#E4E8E0] bg-[#F7F7F0] p-6 dark:border-[#232D27] dark:bg-[#0C110E]">
                <Bot className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
                <h3 className="mt-3 font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                  03. Bilingual Advisor (English &amp; বাংলা)
                </h3>
                <p className="mt-1.5 text-sm text-[#455044] dark:text-[#A9B5A6]">
                  Context-aware guidance grounded in your academic profile, directory programs, and saved verification reports.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#0C110E]">
              <Compass className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                04. Opportunity Match Intelligence
              </h3>
              <p className="mt-1.5 text-sm text-[#455044] dark:text-[#A9B5A6]">
                Every opportunity displays eligibility fit, funding alignment, academic cutoff checks, and missing criteria.
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#0C110E]">
              <GitCompareArrows className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                05. Opportunity Trust Profiles
              </h3>
              <p className="mt-1.5 text-sm text-[#455044] dark:text-[#A9B5A6]">
                Inspect domain classifications, organization identity, historical audits, and community safety flags.
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#0C110E]">
              <Kanban className="h-5 w-5 text-[#101713] dark:text-[#C5F36A]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                06. Application Readiness Checklist
              </h3>
              <p className="mt-1.5 text-sm text-[#455044] dark:text-[#A9B5A6]">
                Track stage workflows across Kanban, List, and Calendar grids with missing document indicators.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works & Anti-Hallucination Callout */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#101713] dark:text-[#F7F7F0]">
              Three-Stage Evidence Methodology
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
              When authoritative confirmation cannot be retrieved, ProofPath AI explicitly reports UNVERIFIED or INSUFFICIENT_EVIDENCE instead of guessing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/how-it-works')}
            className="text-sm font-semibold text-[#101713] underline decoration-[#C5F36A] decoration-2 underline-offset-4 dark:text-[#C5F36A]"
          >
            Inspect verification tiers →
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              step: 'STAGE 01',
              title: 'Submit Link, Text, or File',
              body: 'URLs are screened against SSRF rules; PDFs and posters are magic-byte verified prior to AI extraction.',
            },
            {
              step: 'STAGE 02',
              title: 'Corroborate Claims Against Sources',
              body: 'Funding, organization, fee demands, and deadlines are isolated and checked via live web search grounding.',
            },
            {
              step: 'STAGE 03',
              title: 'Visualize Evidence & Export Audit',
              body: 'Explore claim-to-source relationship graphs, review confidence limits, flag scams, or export PDF dossiers.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#141B17]"
            >
              <p className="font-mono text-xs font-semibold text-[#5E6B5B] dark:text-[#C5F36A]">
                {item.step}
              </p>
              <h3 className="mt-2 font-display text-lg font-bold text-[#101713] dark:text-[#F7F7F0]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#455044] dark:text-[#A9B5A6]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[#E4E8E0] bg-[#1D2520] py-14 text-[#F7F7F0] dark:border-[#232D27]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Build your verified global opportunity pipeline
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[#A9B5A6]">
              Create a free student account to calculate your Opportunity Intelligence Score, track applications, and save evidence reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-lg bg-[#C5F36A] px-5 py-2.5 text-sm font-semibold text-[#101713] transition-colors hover:bg-[#b5e458] whitespace-nowrap"
            >
              Create Student Account
            </button>
            <button
              type="button"
              onClick={() => navigate('/verify')}
              className="rounded-lg border border-[#344339] px-5 py-2.5 text-sm font-semibold text-[#F7F7F0] transition-colors hover:bg-[#101713] whitespace-nowrap"
            >
              Run Public Audit
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FeaturesPage({ navigate }: { navigate: (path: string) => void }) {
  const blocks = [
    {
      title: 'Evidence Relationship Explorer',
      detail: 'Interactive graph linking submitted claims, host organizations, retrieved web sources, and final verdicts.',
    },
    {
      title: 'Opportunity Intelligence Score',
      detail: 'Weighted 0–100 readiness metric calculated transparently from profile, match, checklist, and safety data.',
    },
    {
      title: 'Deterministic Eligibility Matching',
      detail: 'Evaluates GPA normalization, nationality rules, English test thresholds, age brackets, and deadlines without guessing.',
    },
    {
      title: 'Opportunity Trust Profiles',
      detail: 'Domain classification, organization identity, historical audit counts, and community safety indicators per program.',
    },
    {
      title: 'Application Readiness & Calendar',
      detail: 'Kanban, table list, and monthly deadline calendar views with missing-document readiness checklists.',
    },
    {
      title: 'Bilingual AI Opportunity Advisor (EN / বাংলা)',
      detail: 'Context-aware advising anchored in your profile, directory records, and saved verification audits.',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-semibold tracking-wider text-[#5E6B5B] uppercase dark:text-[#C5F36A]">
          System Architecture
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#101713] sm:text-4xl dark:text-[#F7F7F0]">
          Platform Capabilities
        </h1>
        <p className="mt-3 text-base text-[#5E6B5B] dark:text-[#8C9A88]">
          Every workflow in ProofPath AI is backed by persistent database records, strict server validation, and evidence-grounded AI analysis.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b, idx) => (
          <div
            key={b.title}
            className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#141B17]"
          >
            <p className="font-mono text-xs font-semibold text-[#5E6B5B] dark:text-[#C5F36A]">
              0{idx + 1}.
            </p>
            <h2 className="mt-2 font-display text-lg font-bold text-[#101713] dark:text-[#F7F7F0]">{b.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#455044] dark:text-[#A9B5A6]">{b.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <button
          type="button"
          onClick={() => navigate('/verify')}
          className="rounded-lg bg-[#101713] px-5 py-2.5 text-sm font-semibold text-[#C5F36A] hover:bg-[#1D2520] dark:bg-[#C5F36A] dark:text-[#101713]"
        >
          Launch Verification Engine
        </button>
      </div>
    </div>
  );
}

export function HowItWorksPage({ navigate }: { navigate: (path: string) => void }) {
  const tiers = [
    { name: 'VERIFIED', desc: 'Official organizational, government, or university domain directly confirms the opportunity and terms.' },
    { name: 'SUPPORTED', desc: 'Credible independent or partial official sources corroborate key claims, with minor details still to check.' },
    { name: 'CONTRADICTED', desc: 'Primary evidence directly refutes claims—such as impersonated domains, fake application fees, or false awards.' },
    { name: 'UNVERIFIED', desc: 'No authoritative confirmation was found on official institutional domains.' },
    { name: 'INSUFFICIENT_EVIDENCE', desc: 'The submission lacks verifiable identifiers (organization name, official URL, or specific terms).' },
    { name: 'EXPIRED', desc: 'The opportunity appears genuine or previously active, but its official deadline has already passed.' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-[#101713] sm:text-4xl dark:text-[#F7F7F0]">
        Verification Methodology
      </h1>
      <p className="mt-3 max-w-2xl text-base text-[#5E6B5B] dark:text-[#8C9A88]">
        ProofPath AI separates factual claim extraction from evidence retrieval so students see exactly why a verdict was assigned.
      </p>

      <div className="mt-10 space-y-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="flex flex-col justify-between gap-3 rounded-xl border border-[#E4E8E0] bg-white p-5 sm:flex-row sm:items-center dark:border-[#232D27] dark:bg-[#141B17]"
          >
            <span className="font-mono text-xs font-bold text-[#101713] dark:text-[#C5F36A]">
              {t.name}
            </span>
            <p className="flex-1 text-sm text-[#455044] dark:text-[#A9B5A6]">{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate('/verify')}
          className="rounded-lg bg-[#101713] px-5 py-2.5 text-sm font-semibold text-[#C5F36A] hover:bg-[#1D2520] dark:bg-[#C5F36A] dark:text-[#101713]"
        >
          Audit an Opportunity
        </button>
        <button
          type="button"
          onClick={() => navigate('/responsible-ai')}
          className="rounded-lg border border-[#E4E8E0] px-5 py-2.5 text-sm font-semibold text-[#101713] hover:bg-white dark:border-[#232D27] dark:text-[#F7F7F0] dark:hover:bg-[#141B17]"
        >
          Responsible AI Standards
        </button>
      </div>
    </div>
  );
}

export function PricingPage({ navigate }: { navigate: (path: string) => void }) {
  const plans = [
    {
      audience: 'For individual students',
      name: 'Student Core',
      price: '$0',
      cadence: 'Free forever',
      features: [
        'Public URL, text & document verification workspace',
        'Evidence Relationship Explorer & PDF export',
        'Verified opportunity directory, Trust Profiles & Match Intelligence',
        'Opportunity Intelligence Score & Eligibility Matrix',
        'Application Kanban, List & Calendar tracker',
      ],
      cta: 'Create Student Account',
      action: () => navigate('/register'),
      highlight: false,
    },
    {
      audience: 'For university advising teams',
      name: 'Institutional Pro',
      price: '$49',
      cadence: 'per advisor seat / month',
      features: [
        'Elevated verification & AI advisor rate limits',
        'Shared moderation & scam-alert review queue',
        'Custom opportunity catalog publishing (CMS)',
        'AI usage & security audit logs',
        'Dedicated onboarding & compliance reporting',
      ],
      cta: 'Contact Institutional Sales',
      action: () => navigate('/contact'),
      highlight: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-[#101713] sm:text-4xl dark:text-[#F7F7F0]">
          Transparent Pricing
        </h1>
        <p className="mt-3 text-base text-[#5E6B5B] dark:text-[#8C9A88]">
          Core student safety and opportunity verification remain free. Institutions fund high-volume advising workflows.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col justify-between rounded-2xl border p-8 ${
              p.highlight
                ? 'border-[#101713] bg-[#101713] text-[#F7F7F0] dark:border-[#C5F36A] dark:bg-[#141B17]'
                : 'border-[#E4E8E0] bg-white text-[#101713] dark:border-[#232D27] dark:bg-[#141B17] dark:text-[#F7F7F0]'
            }`}
          >
            <div>
              <p className={`font-mono text-xs font-semibold uppercase ${p.highlight ? 'text-[#C5F36A]' : 'text-[#5E6B5B] dark:text-[#8C9A88]'}`}>
                {p.audience}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">{p.name}</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tabular-nums">{p.price}</span>
                <span className={`text-sm ${p.highlight ? 'text-[#A9B5A6]' : 'text-[#5E6B5B] dark:text-[#8C9A88]'}`}>
                  {p.cadence}
                </span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? 'text-[#C5F36A]' : 'text-[#101713] dark:text-[#C5F36A]'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={p.action}
              className={`mt-8 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                p.highlight
                  ? 'bg-[#C5F36A] text-[#101713] hover:bg-[#b5e458]'
                  : 'border border-[#E4E8E0] text-[#101713] hover:bg-[#F7F7F0] dark:border-[#232D27] dark:text-[#F7F7F0] dark:hover:bg-[#1D2520]'
              }`}
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-[#101713] sm:text-4xl dark:text-[#F7F7F0]">
        About ProofPath AI
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[#455044] dark:text-[#A9B5A6]">
        International students navigate thousands of scholarship announcements, internship offers, and study-abroad portals every year—alongside growing impersonation scams and misleading fee-charging intermediaries. ProofPath AI was engineered to give every student and academic advisor an auditable, evidence-first verification workflow.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-[#E4E8E0] bg-white p-5 dark:border-[#232D27] dark:bg-[#141B17]">
          <img
            src="/src/assets/images/avatar_student_lead_1794640632225.jpg"
            alt="Student Research Lead"
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-lg object-cover"
          />
          <div>
            <p className="font-display text-sm font-bold text-[#101713] dark:text-[#F7F7F0]">Amina Rahman</p>
            <p className="text-xs text-[#5E6B5B] dark:text-[#8C9A88]">Student Advocacy &amp; Bilingual Access</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[#E4E8E0] bg-white p-5 dark:border-[#232D27] dark:bg-[#141B17]">
          <img
            src="/src/assets/images/avatar_admin_analyst_1794640633226.jpg"
            alt="Verification Compliance Lead"
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-lg object-cover"
          />
          <div>
            <p className="font-display text-sm font-bold text-[#101713] dark:text-[#F7F7F0]">Elena Vance</p>
            <p className="text-xs text-[#5E6B5B] dark:text-[#8C9A88]">Trust &amp; Verification Standards</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const { addToast } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, subject, message }),
      });
      setSent(true);
      addToast({ type: 'success', title: 'Message submitted', description: 'Stored in our support queue.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-[#101713] dark:text-[#F7F7F0]">Contact Team</h1>
      <p className="mt-2 text-sm text-[#5E6B5B] dark:text-[#8C9A88]">
        Report an institutional partnership inquiry, verification question, or security concern.
      </p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-[#C5F36A] bg-white p-6 dark:border-[#C5F36A]/40 dark:bg-[#141B17]">
          <h2 className="font-display text-base font-bold text-[#101713] dark:text-[#C5F36A]">
            Inquiry Received
          </h2>
          <p className="mt-1 text-sm text-[#455044] dark:text-[#A9B5A6]">
            Thank you. Your message has been recorded in our database for review by the ProofPath AI team.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setName('');
              setEmail('');
              setSubject('');
              setMessage('');
            }}
            className="mt-4 rounded-lg bg-[#101713] px-4 py-2 text-xs font-semibold text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#141B17]"
        >
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#1D2520] dark:text-[#D5DDD2]">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm dark:border-[#232D27] dark:bg-[#0C110E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1D2520] dark:text-[#D5DDD2]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm dark:border-[#232D27] dark:bg-[#0C110E]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1D2520] dark:text-[#D5DDD2]">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm dark:border-[#232D27] dark:bg-[#0C110E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1D2520] dark:text-[#D5DDD2]">
              Message
            </label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] p-3 text-sm dark:border-[#232D27] dark:bg-[#0C110E]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#101713] px-5 py-2.5 text-sm font-semibold text-[#C5F36A] hover:bg-[#1D2520] disabled:opacity-50 dark:bg-[#C5F36A] dark:text-[#101713]"
          >
            {submitting ? 'Submitting...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}

export function LegalPolicyPage({
  title,
  sections,
}: {
  title: string;
  sections: Array<{ heading: string; body: string }>;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="inline-flex items-center gap-2 font-mono text-xs text-[#5E6B5B] dark:text-[#C5F36A]">
        <ShieldAlert className="h-4 w-4" />
        <span>Governance Standard</span>
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold text-[#101713] dark:text-[#F7F7F0]">{title}</h1>
      <p className="mt-2 font-mono text-xs text-[#5E6B5B]">
        Effective Date: November 2026
      </p>
      <div className="mt-8 space-y-6">
        {sections.map((s) => (
          <section
            key={s.heading}
            className="rounded-xl border border-[#E4E8E0] bg-white p-6 dark:border-[#232D27] dark:bg-[#141B17]"
          >
            <h2 className="font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">{s.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#455044] dark:text-[#A9B5A6]">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
