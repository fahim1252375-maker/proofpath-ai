import React, { useEffect, useState } from 'react';
import { Bot, CalendarDays, ClipboardCheck, ExternalLink, FileText, Loader2, MessagesSquare, Plus, Send, Trash2 } from 'lucide-react';
import { getAdvisorWorkflows, type AdvisorWorkflow } from '../lib/advisorWorkflows';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { AssistantMessage, ConversationItem } from '../types';
import { EmptyState, SkeletonBlock } from '../components/ui/Common';

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
    } catch (err) {
      addToast({
        type: 'error',
        title: 'AI Assistant Error',
        description: err instanceof Error ? err.message : 'Unable to reach AI advisor',
      });
    } finally {
      setSending(false);
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

  const suggestedQuestions =
    language === 'bn'
      ? [
          'আমার প্রোফাইল অনুযায়ী কোন স্কলারশিপগুলো সবচেয়ে উপযুক্ত?',
          'ভুয়া স্কলারশিপ বা ইন্টার্নশিপ প্রতারণা চেনার উপায় কী?',
          'Chevening বনাম Erasmus Mundus এর যোগ্যতা তুলনা করুন।',
        ]
      : [
          'Which verified scholarships match my current eligibility profile?',
          'What red flags indicate a scholarship or internship scam?',
          'Compare Chevening and Erasmus Mundus eligibility requirements for me.',
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
            Bilingual Grounded Advisor
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-[#101713] dark:text-[#F7F7F0]">
            AI Opportunity Advisor
          </h1>
          <p className="text-xs text-[#5E6B5B] dark:text-[#8C9A88]">
            Grounded in your Student Profile, Verified Directory records, and saved Verification Reports.
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

      {(initialOpportunityId || initialReportId) && (
        <div className="rounded-lg border border-[#9ECF42] bg-[#C5F36A]/20 px-3 py-2 text-xs font-medium text-[#101713] dark:border-[#C5F36A]/40 dark:bg-[#C5F36A]/10 dark:text-[#C5F36A]">
          Context attached: {initialOpportunityId ? `Opportunity ${initialOpportunityId}` : `Verification Report ${initialReportId}`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Conversation History */}
        <aside className="rounded-xl border border-[#E4E8E0] bg-white p-3 lg:col-span-3 dark:border-[#232D27] dark:bg-[#141B17]">
          <p className="px-2 pb-2 font-mono text-[11px] font-semibold text-[#5E6B5B] uppercase dark:text-[#8C9A88]">
            Conversations
          </p>
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
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.groundingRefs && m.groundingRefs.length > 0 && (
                      <div className="mt-3 border-t border-[#E4E8E0] pt-2 text-xs dark:border-[#232D27]">
                        <p className="font-semibold text-[#5E6B5B]">Sources cited:</p>
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
