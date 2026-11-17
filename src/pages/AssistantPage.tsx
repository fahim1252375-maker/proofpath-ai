import React, { useEffect, useState } from 'react';
import { Bot, CalendarDays, Check, ClipboardCheck, Copy, ExternalLink, FileText, Loader2, MessagesSquare, Plus, Send, Trash2 } from 'lucide-react';
import { getAdvisorWorkflows, type AdvisorWorkflow } from '../lib/advisorWorkflows';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { AssistantMessage, ConversationItem } from '../types';
import { EmptyState, SkeletonBlock } from '../components/ui/Common';

/**
 * Copilot availability states, derived only from the server's own
 * fallbackReason (Guided Mode is never described as Gemini output).
 */
export type AssistantFallbackKind =
  | 'quota_exhausted'
  | 'provider_off'
  | 'consent_required'
  | 'outdated_consent'
  | 'provider_unavailable';

export interface AssistantFallbackNotice {
  kind: AssistantFallbackKind;
  title: string;
  detail: string;
}

const QUOTA_REASONS = ['user_limit', 'global_limit', 'concurrency_limit'] as const;
const PROVIDER_OFF_REASONS = [
  'disabled',
  'free_tier_unconfirmed',
  'model_unavailable',
  'api_key_missing',
  'global_limit_unconfigured',
] as const;

export function classifyAssistantFallback(
  fallbackReason: string | null | undefined,
  options: { previousConsentAt?: string | null } = {}
): AssistantFallbackNotice | null {
  if (!fallbackReason) return null;

  if (fallbackReason === 'consent_required') {
    if (options.previousConsentAt) {
      return {
        kind: 'outdated_consent',
        title: 'Your earlier Gemini consent is outdated',
        detail:
          'ProofPath versions its AI privacy terms, and the consent decision saved on ' +
          `${options.previousConsentAt.slice(0, 10)} no longer applies to the current version. ` +
          'Review the “What is sent to Google?” summary and tick the consent box again to re-enable Gemini. ' +
          'Your question was answered locally in Guided Mode.',
      };
    }
    return {
      kind: 'consent_required',
      title: 'External AI needs your consent',
      detail:
        'Gemini stayed off because external processing is not consented for your account. ' +
        'Guided Mode answered locally using your ProofPath data. Tick the consent box in the privacy panel above if you want Gemini Free responses.',
    };
  }

  if ((QUOTA_REASONS as readonly string[]).includes(fallbackReason)) {
    return {
      kind: 'quota_exhausted',
      title: 'Today’s Gemini quota is used up',
      detail:
        'Your daily allowance or the site-wide free-tier cap is spent, so Gemini was not called. ' +
        'Guided Mode answered locally from your ProofPath data and remains fully available. Counters reset at midnight Pacific time.',
    };
  }

  if ((PROVIDER_OFF_REASONS as readonly string[]).includes(fallbackReason)) {
    return {
      kind: 'provider_off',
      title: 'Gemini is switched off by the operator',
      detail:
        'This deployment has not enabled external AI: the free tier, model, API key, and project cap must all be confirmed by the operator first. ' +
        'Guided Mode answered locally from your records and is unaffected.',
    };
  }

  return {
    kind: 'provider_unavailable',
    title: 'Gemini is unavailable right now',
    detail:
      fallbackReason === 'provider_rate_limited'
        ? 'Google rate-limited the request, so no message was sent externally. Guided Mode answered locally; try again after the counter resets at midnight Pacific time.'
        : 'Gemini could not be reached, so nothing was sent externally. Guided Mode answered locally from your ProofPath data.',
  };
}

/**
 * The availability endpoint keeps the consent contract unchanged: it reports
 * only the active consent flag and the last decision timestamp. A timestamp
 * with an inactive flag means a previous decision exists but is no longer
 * active (outdated version or revoked), which is what the re-consent UX keys on.
 */
export function hasInactiveConsentDecision(status: {
  consent: boolean;
  consentUpdatedAt: string | null;
} | null): boolean {
  return Boolean(status && !status.consent && status.consentUpdatedAt);
}

export function AssistantPage({
  initialOpportunityId = '',
  initialReportId = '',
}: {
  initialOpportunityId?: string;
  initialReportId?: string;
}) {
  const { user, addToast } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [language, setLanguage] = useState<'en' | 'bn'>(user?.preferredLanguage || 'en');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    availability: string;
    aiReady: boolean;
    consent: boolean;
    consentUpdatedAt: string | null;
    usedToday: number;
    dailyLimit: number;
    remainingToday: number;
    resetAt: string;
  } | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<AssistantFallbackNotice | null>(null);
  const [retryPrompt, setRetryPrompt] = useState('');
  const [sendError, setSendError] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const loadConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await apiRequest<{ items: ConversationItem[] }>('/api/assistant/conversations');
      setConversations(data.items);
      if (!activeConvId && data.items.length > 0 && !initialOpportunityId && !initialReportId) {
        setActiveConvId(data.items[0].id);
        setLanguage(data.items[0].language);
      }
    } finally {
      setLoadingConvs(false);
    }
  };

  useEffect(() => {
    loadConversations();
    apiRequest<typeof aiStatus>('/api/assistant/status')
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    apiRequest<{ items: AssistantMessage[] }>(`/api/assistant/conversations/${activeConvId}/messages`)
      .then((res) => setMessages(res.items))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeConvId]);

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    if (!promptText) setInput('');

    try {
      const res = await apiRequest<{
        conversationId: string;
        userMessage: AssistantMessage;
        assistantMessage: AssistantMessage;
        fallbackReason: string | null;
        usage: { usedToday: number; dailyLimit: number; resetAt: string };
      }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId || undefined,
          message: text,
          language,
          contextOpportunityId: initialOpportunityId || undefined,
          contextReportId: initialReportId || undefined,
        }),
      });

      if (!activeConvId) {
        setActiveConvId(res.conversationId);
        await loadConversations();
      }
      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
      setAiStatus((current) => current ? {
        ...current,
        usedToday: res.usage.usedToday,
        dailyLimit: res.usage.dailyLimit,
        remainingToday: Math.max(0, res.usage.dailyLimit - res.usage.usedToday),
        resetAt: res.usage.resetAt,
      } : current);
      setRetryPrompt('');
      setSendError('');
      setFallbackNotice(
        classifyAssistantFallback(res.fallbackReason, {
          previousConsentAt: res.fallbackReason === 'consent_required' ? aiStatus?.consentUpdatedAt || null : null,
        })
      );
    } catch (err) {
      setRetryPrompt(text);
      setSendError(err instanceof Error ? err.message : 'Unable to reach ProofPath Advisor.');
      setFallbackNotice(null);
    } finally {
      setSending(false);
    }
  };

  const handleConsentChange = async (enabled: boolean) => {
    try {
      await apiRequest('/api/assistant/consent', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      const next = await apiRequest<typeof aiStatus>('/api/assistant/status');
      setAiStatus(next);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Privacy setting not saved',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleDeleteConv = async (id: string) => {
    await apiRequest(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    loadConversations();
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all of your saved advisor conversations? This cannot be undone.')) return;
    await apiRequest('/api/assistant/conversations', { method: 'DELETE' });
    setActiveConvId(null);
    setMessages([]);
    await loadConversations();
  };

  const handleCopy = async (message: AssistantMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      addToast({ type: 'error', title: 'Copy unavailable', description: 'Your browser did not allow clipboard access.' });
    }
  };

  const suggestedQuestions =
    language === 'bn'
      ? [
          'আমার প্রোফাইল অনুযায়ী কোন স্কলারশিপগুলো সবচেয়ে উপযুক্ত?',
          'ভুয়া স্কলারশিপ বা ইন্টার্নশিপ প্রতারণা চেনার উপায় কী?',
          'আমার প্রোফাইলের সঙ্গে কোন প্রকাশিত সুযোগের রেকর্ড মেলে?',
        ]
      : [
          'Which published opportunity records match my profile?',
          'What red flags indicate a scholarship or internship scam?',
          'Compare eligibility requirements in my saved opportunity records.',
          'What documents should I prepare 3 months before deadlines?',
        ];

  const advisorWorkflows = getAdvisorWorkflows(language);
  const workflowIcons = {
    roadmap: CalendarDays,
    eligibility: ClipboardCheck,
    statement: FileText,
    interview: MessagesSquare,
  } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-wider text-[#5E6B5B] uppercase dark:text-[#C5F36A]">
            Bilingual student advisor
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-[#101713] dark:text-[#F7F7F0]">
            ProofPath Student Copilot
          </h1>
          <p className="text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
            Practical writing, eligibility, and application guidance with local profile checks and source links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-[#E4E8E0]/60 p-1 dark:bg-[#1D2520]">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                language === 'en'
                  ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
                  : 'text-[#5E6B5B] dark:text-[#A9B5A6]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                language === 'bn'
                  ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
                  : 'text-[#5E6B5B] dark:text-[#A9B5A6]'
              }`}
            >
              বাংলা (Bangla)
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#101713] px-3 py-1.5 text-xs font-semibold text-[#C5F36A] hover:bg-[#1D2520] dark:bg-[#C5F36A] dark:text-[#101713]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      <section aria-label="AI privacy and availability" className="rounded-xl border border-[#DCE5D3] bg-white p-4 dark:border-[#2C3730] dark:bg-[#141B17]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#101713] dark:text-[#F7F7F0]">
              {aiStatus?.aiReady && aiStatus.availability === 'ready' ? 'Gemini Free is available' : 'ProofPath Guided Mode is available'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5E6B5B] dark:text-[#A9B5A6]">
              {aiStatus?.availability === 'ready'
                ? `${aiStatus.remainingToday} of ${aiStatus.dailyLimit} daily Gemini responses remain. The counter resets at ${new Date(aiStatus.resetAt).toLocaleString()}.`
                : 'Gemini stays off unless the server confirms its free tier, has a configured project cap, and you opt in. Guided replies use your ProofPath data locally.'}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#F0F4E9] px-3 py-1 text-xs font-semibold text-[#40552F] dark:bg-[#1D2A1E] dark:text-[#C5F36A]">
            {aiStatus?.aiReady && aiStatus.availability === 'ready' ? 'Free tier · capped' : 'No-cost guided mode'}
          </span>
        </div>
        <details className="mt-3 rounded-lg bg-[#F7F7F0] p-3 text-xs leading-relaxed text-[#455044] dark:bg-[#0C110E] dark:text-[#A9B5A6]">
          <summary className="cursor-pointer font-semibold text-[#101713] dark:text-[#F7F7F0]">What is sent to Google?</summary>
          <p className="mt-2">
            Only your current message is sent to Google Gemini after obvious email addresses, phone numbers, and labeled identity numbers are removed. Redaction can miss details, so do not include sensitive or confidential information. Your profile, previous chats, verification reports, and uploaded files are never included. Google’s Free-tier terms may allow prompts and responses to be used to improve its products; see the{' '}
            <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Gemini API terms</a>.
          </p>
          <p className="mt-2">You can turn external processing off at any time. Guided Mode remains available.</p>
        </details>
        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#243329] dark:text-[#D5DDD2]">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#668A38]"
            checked={Boolean(aiStatus?.consent)}
            onChange={(event) => handleConsentChange(event.target.checked)}
          />
          <span>Allow my current message, with obvious personal identifiers redacted, to be processed by Google Gemini Free when the site’s free-tier quota is available.</span>
        </label>
        {hasInactiveConsentDecision(aiStatus) && (
          <p role="status" className="mt-2 rounded-lg bg-[#C5F36A]/20 px-2.5 py-2 text-[11px] font-medium leading-relaxed text-[#101713] dark:bg-[#C5F36A]/10 dark:text-[#C5F36A]">
            Your earlier consent (saved {aiStatus?.consentUpdatedAt?.slice(0, 10)}) is outdated: ProofPath versions its AI privacy terms, so the previous approval no longer applies. Review the terms above and tick the box to consent again. Guided Mode stays available either way.
          </p>
        )}
      </section>

      {(initialOpportunityId || initialReportId) && (
        <div className="rounded-lg border border-[#9ECF42] bg-[#C5F36A]/20 px-3 py-2 text-xs font-medium text-[#101713] dark:border-[#C5F36A]/40 dark:bg-[#C5F36A]/10 dark:text-[#C5F36A]">
          Context attached: {initialOpportunityId ? `Opportunity ${initialOpportunityId}` : `Verification Report ${initialReportId}`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Conversation History */}
        <aside className="rounded-xl border border-[#E4E8E0] bg-white p-3 lg:col-span-3 dark:border-[#232D27] dark:bg-[#141B17]">
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <p className="font-mono text-[11px] font-semibold text-[#5E6B5B] uppercase dark:text-[#8C9A88]">Conversations</p>
            {conversations.length > 0 && <button type="button" onClick={handleClearHistory} className="text-[10px] font-semibold text-[#71806E] underline hover:text-red-600">Clear all</button>}
          </div>
          {loadingConvs ? (
            <SkeletonBlock className="h-24" />
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[#5E6B5B]">No saved conversations yet.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs ${
                    activeConvId === c.id
                      ? 'bg-[#101713] text-[#C5F36A] dark:bg-[#C5F36A] dark:text-[#101713]'
                      : 'text-[#101713] hover:bg-[#F7F7F0] dark:text-[#E4E8E0] dark:hover:bg-[#1D2520]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConvId(c.id);
                      setLanguage(c.language);
                    }}
                    className="min-w-0 flex-1 truncate text-left font-semibold"
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConv(c.id)}
                    aria-label="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Chat Viewport */}
        <div className="flex h-[560px] flex-col rounded-xl border border-[#E4E8E0] bg-white lg:col-span-9 dark:border-[#232D27] dark:bg-[#141B17]">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {loadingMsgs ? (
              <SkeletonBlock className="h-32" />
            ) : messages.length === 0 ? (
              <div className="space-y-6 py-4">
                <EmptyState
                  icon={<Bot className="h-5 w-5" />}
                  title={
                    language === 'bn'
                      ? 'প্রুফপাথ এআই উপদেষ্টাকে জিজ্ঞাসা করুন'
                      : 'Ask ProofPath AI Advisor'
                  }
                  description={
                    language === 'bn'
                      ? 'আপনার যোগ্যতা, স্কলারশিপের শর্তাবলী বা ভেরিফিকেশন রিপোর্ট সম্পর্কে প্রশ্ন করুন।'
                      : 'Ask about opportunity authenticity, eligibility gaps, or application preparation in English or বাংলা.'
                  }
                />
                <section aria-labelledby="advisor-studio-heading" className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71806E] dark:text-[#C5F36A]">
                        Guided AI workflows
                      </p>
                      <h3 id="advisor-studio-heading" className="font-display text-base font-bold text-[#101713] dark:text-[#F7F7F0]">
                        {language === 'bn' ? 'Strategy Studio' : 'Strategy Studio'}
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#71806E] dark:text-[#8C9A88]">
                      {language === 'bn' ? 'আপনার বর্তমান প্রোফাইল ও উপলব্ধ রেকর্ড ব্যবহার করে' : 'Uses your profile and available records'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {advisorWorkflows.map((workflow) => {
                      const Icon = workflowIcons[workflow.id];
                      return (
                        <button
                          key={workflow.id}
                          type="button"
                          disabled={sending}
                          onClick={() => handleSend(workflow.prompt)}
                          className="group flex min-h-[124px] items-start gap-3 rounded-xl border border-[#E4E8E0] bg-[#FBFBF7] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#A6B98F] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2C3730] dark:bg-[#101713] dark:hover:border-[#C5F36A]/60"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E4E8E0] bg-white text-[#243329] transition-colors group-hover:border-[#C5F36A] group-hover:bg-[#C5F36A]/20 dark:border-[#354139] dark:bg-[#1D2520] dark:text-[#C5F36A]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[#101713] dark:text-[#F7F7F0]">{workflow.title}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-[#71806E] dark:text-[#9EAD9B]">{workflow.description}</span>
                            <span className="mt-3 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-[#5E6B5B] group-hover:text-[#101713] dark:text-[#C5F36A] dark:group-hover:text-[#F7F7F0]">
                              {language === 'bn' ? 'Workflow শুরু করুন' : 'Start workflow'} <span className="ml-1" aria-hidden="true">→</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="quick-question-heading" className="space-y-2">
                  <h3 id="quick-question-heading" className="text-[11px] font-semibold text-[#71806E] dark:text-[#8C9A88]">
                    {language === 'bn' ? 'অথবা দ্রুত একটি প্রশ্ন করুন' : 'Or start with a quick question'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={sending}
                        onClick={() => handleSend(q)}
                        className="rounded-lg border border-[#E4E8E0] px-3 py-2 text-left text-xs font-medium text-[#243329] transition-colors hover:border-[#9BAA91] hover:bg-[#F7F7F0] disabled:opacity-50 dark:border-[#354139] dark:text-[#D5DDD2] dark:hover:bg-[#1D2520]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#101713] text-[#F7F7F0] dark:bg-[#C5F36A] dark:text-[#101713]'
                        : 'border border-[#E4E8E0] bg-[#F7F7F0] text-[#101713] dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0]'
                    }`}
                  >
                    {m.role === 'assistant' && (
                      <div className="mb-2 flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider text-[#5E6B5B] dark:text-[#A9B5A6]">
                        <span>{m.responseMode === 'gemini' ? 'Gemini Free + local checks' : 'ProofPath guided'}</span>
                        <button type="button" onClick={() => handleCopy(m)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 normal-case tracking-normal hover:bg-white/60 dark:hover:bg-[#1D2520]" aria-label="Copy assistant response">
                          {copiedMessageId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedMessageId === m.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.groundingRefs && m.groundingRefs.length > 0 && (
                      <div className="mt-3 border-t border-[#E4E8E0] pt-2 text-xs dark:border-[#232D27]">
                        <p className="font-semibold text-[#5E6B5B]">Links from your saved ProofPath records:</p>
                        <ul className="mt-1 space-y-1">
                          {m.groundingRefs.map((ref, idx) => (
                            <li key={idx}>
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#101713] underline decoration-[#C5F36A] decoration-2 dark:text-[#C5F36A]"
                              >
                                <span className="truncate max-w-xs">{ref.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {sendError && (
            <div role="alert" className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <span>{sendError}</span>
              {retryPrompt && <button type="button" onClick={() => handleSend(retryPrompt)} disabled={sending} className="shrink-0 font-semibold underline">Retry</button>}
            </div>
          )}

          {fallbackNotice && (
            <div
              role="status"
              aria-live="polite"
              data-testid="assistant-fallback-notice"
              className={`mx-3 mb-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                fallbackNotice.kind === 'quota_exhausted'
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                  : fallbackNotice.kind === 'outdated_consent'
                  ? 'border-[#9ECF42] bg-[#C5F36A]/20 text-[#101713] dark:border-[#C5F36A]/50 dark:bg-[#C5F36A]/10 dark:text-[#C5F36A]'
                  : 'border-[#E4E8E0] bg-[#F7F7F0] text-[#243329] dark:border-[#354139] dark:bg-[#0C110E] dark:text-[#D5DDD2]'
              }`}
            >
              <p className="font-semibold">{fallbackNotice.title}</p>
              <p className="mt-0.5">{fallbackNotice.detail}</p>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-[#E4E8E0] p-3 dark:border-[#232D27]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              aria-label="Message the ProofPath Student Copilot"
              placeholder={
                language === 'bn'
                  ? 'বাংলায় বা ইংরেজিতে আপনার প্রশ্ন লিখুন...'
                  : 'Ask about eligibility, documents, or verification risks...'
              }
              className="h-10 flex-1 rounded-lg border border-[#E4E8E0] bg-[#F7F7F0] px-3 text-sm text-[#101713] focus:border-[#101713] focus:outline-none dark:border-[#232D27] dark:bg-[#0C110E] dark:text-[#F7F7F0] dark:focus:border-[#C5F36A]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#101713] px-4 text-xs font-semibold text-[#C5F36A] hover:bg-[#1D2520] disabled:opacity-50 dark:bg-[#C5F36A] dark:text-[#101713]"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
