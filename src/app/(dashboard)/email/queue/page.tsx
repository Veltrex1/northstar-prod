'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';

type EmailPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

type EmailDraft = {
  id: string;
  subject?: string | null;
  content: string;
  tone?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  threadId?: string | null;
};

type QueueEmail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  priority: EmailPriority;
  status: string;
  draft?: EmailDraft | null;
  metadata?: Record<string, any> | null;
};

type QueueStats = {
  total: number;
  byPriority: Record<EmailPriority, number>;
  oldest: string | null;
  newest: string | null;
};

const PRIORITY_ORDER: EmailPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
const TONE_OPTIONS = ['professional', 'friendly', 'concise', 'empathetic'];

function isVipSender(email: QueueEmail) {
  return Boolean(email.metadata?.vip || email.metadata?.isVip);
}

function getPriorityBadge(priority: EmailPriority) {
  switch (priority) {
    case 'URGENT':
      return { label: 'Urgent', variant: 'destructive' as const };
    case 'HIGH':
      return { label: 'High', variant: 'default' as const };
    case 'NORMAL':
      return { label: 'Normal', variant: 'secondary' as const };
    default:
      return { label: 'Low', variant: 'outline' as const };
  }
}

function useEmailQueue() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<QueueEmail[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const previousTotalRef = useRef<number | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/queue');
      const data = await parseApiResponse<{
        emails: QueueEmail[];
        total: number;
        page: number;
        pageSize: number;
      }>(response);

      if (data.success) {
        setEmails(data.data.emails || []);
      } else {
        toast({
          title: 'Queue fetch failed',
          description: data.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Queue fetch failed',
        description: 'Unable to load email queue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        const response = await fetch('/api/email/queue/stats');
        const data = await parseApiResponse<QueueStats>(response);

        if (data.success) {
          setStats(data.data);
          if (previousTotalRef.current !== null) {
            const delta = data.data.total - previousTotalRef.current;
            if (delta > 0) {
              toast({
                title: 'New drafts ready',
                description: `${delta} new draft${delta === 1 ? '' : 's'} arrived`,
              });
            }
          }
          previousTotalRef.current = data.data.total;
        } else if (!options?.silent) {
          toast({
            title: 'Stats fetch failed',
            description: data.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        if (!options?.silent) {
          toast({
            title: 'Stats fetch failed',
            description: 'Unable to load email stats',
            variant: 'destructive',
          });
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchQueue();
    fetchStats();
  }, [fetchQueue, fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats({ silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const sendDraft = useCallback(
    async (emailId: string) => {
      setIsMutating(true);
      try {
        const response = await fetch(`/api/email/${emailId}/send-draft`, {
          method: 'POST',
        });
        const data = await parseApiResponse<{ message: string }>(response);

        if (data.success) {
          toast({
            title: 'Email sent',
            description: data.data.message,
          });
          await fetchQueue();
          await fetchStats({ silent: true });
        } else {
          toast({
            title: 'Send failed',
            description: data.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Send failed',
          description: 'Unable to send the draft',
          variant: 'destructive',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, fetchStats, toast]
  );

  const updateStatus = useCallback(
    async (emailId: string, status: string) => {
      setIsMutating(true);
      try {
        const response = await fetch(`/api/email/${emailId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const data = await parseApiResponse<{ message?: string }>(response);

        if (data.success) {
          toast({
            title: 'Email updated',
            description: 'Email moved out of the queue',
          });
          await fetchQueue();
          await fetchStats({ silent: true });
        } else {
          toast({
            title: 'Update failed',
            description: data.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Update failed',
          description: 'Unable to update email status',
          variant: 'destructive',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, fetchStats, toast]
  );

  const skipEmail = useCallback(
    async (emailId: string) => {
      await updateStatus(emailId, 'ARCHIVED');
    },
    [updateStatus]
  );

  const archiveEmail = useCallback(
    async (emailId: string) => {
      await updateStatus(emailId, 'ARCHIVED');
    },
    [updateStatus]
  );

  const regenerateDraft = useCallback(
    async (draftId: string, tone: string) => {
      setIsMutating(true);
      try {
        const response = await fetch(`/api/email/drafts/${draftId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tone }),
        });
        const data = await parseApiResponse<{ message?: string }>(response);

        if (data.success) {
          toast({
            title: 'Draft regenerated',
            description: 'Updated draft is ready',
          });
          await fetchQueue();
          await fetchStats({ silent: true });
        } else {
          toast({
            title: 'Regenerate failed',
            description: data.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Regenerate failed',
          description: 'Unable to regenerate the draft',
          variant: 'destructive',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [fetchQueue, fetchStats, toast]
  );

  const actions = useMemo(
    () => ({
      sendDraft,
      skipEmail,
      archiveEmail,
      regenerateDraft,
    }),
    [sendDraft, skipEmail, archiveEmail, regenerateDraft]
  );

  return { emails, stats, isLoading, isMutating, actions };
}

export default function EmailQueuePage() {
  const { emails, stats, isLoading, isMutating, actions } = useEmailQueue();
  const [priorityFilter, setPriorityFilter] = useState<EmailPriority | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'NEWEST' | 'OLDEST' | 'PRIORITY'>('PRIORITY');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [toneByEmail, setToneByEmail] = useState<Record<string, string>>({});
  const editorRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const isBusy = isLoading || isMutating;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`queue-filter-${index}`} className="h-9 w-full" />
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`queue-skeleton-${index}`} className="p-4 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-24 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const filteredEmails = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return emails
      .filter((email) => {
        if (priorityFilter !== 'ALL' && email.priority !== priorityFilter) {
          return false;
        }
        if (normalizedSearch) {
          const haystack = `${email.from} ${email.subject} ${email.snippet}`.toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (new Date(email.receivedAt) < fromDate) {
            return false;
          }
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          if (new Date(email.receivedAt) > toDate) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'NEWEST') {
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        }
        if (sort === 'OLDEST') {
          return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        }
        return (
          PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
        );
      });
  }, [emails, priorityFilter, search, dateFrom, dateTo, sort]);

  useEffect(() => {
    if (!filteredEmails.length) {
      setSelectedEmailId(null);
      return;
    }
    if (!selectedEmailId || !filteredEmails.some((email) => email.id === selectedEmailId)) {
      setSelectedEmailId(filteredEmails[0].id);
    }
  }, [filteredEmails, selectedEmailId]);

  useEffect(() => {
    if (!emails.length) return;
    setDraftEdits((prev) => {
      const next = { ...prev };
      for (const email of emails) {
        if (email.draft?.content && !next[email.id]) {
          next[email.id] = email.draft.content;
        }
      }
      return next;
    });
    setToneByEmail((prev) => {
      const next = { ...prev };
      for (const email of emails) {
        if (!next[email.id]) {
          next[email.id] = email.draft?.tone || 'professional';
        }
      }
      return next;
    });
  }, [emails]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const currentEmail = filteredEmails.find((email) => email.id === selectedEmailId);
      if (!currentEmail) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        actions.sendDraft(currentEmail.id);
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        actions.skipEmail(currentEmail.id);
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        editorRefs.current[currentEmail.id]?.focus();
      }
      if (event.key.toLowerCase() === 'r' && currentEmail.draft?.id) {
        event.preventDefault();
        actions.regenerateDraft(
          currentEmail.draft.id,
          toneByEmail[currentEmail.id] || 'professional'
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, filteredEmails, selectedEmailId, toneByEmail]);

  const emailsReceived = stats?.total ?? emails.length;
  const draftsReady = emails.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Queue</h1>
          <p className="text-gray-600">
            {emailsReceived} emails received, {draftsReady} drafts ready
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Queue refreshes every 30 seconds</span>
          {isBusy && <span className="text-primary">Updating...</span>}
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as EmailPriority | 'ALL')
              }
            >
              <option value="ALL">All</option>
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {priority.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date range</label>
            <div className="mt-1 flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Search</label>
            <Input
              className="mt-1"
              placeholder="Search sender or subject"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sort</label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as 'NEWEST' | 'OLDEST' | 'PRIORITY')
              }
            >
              <option value="PRIORITY">Priority</option>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
            </select>
          </div>
        </div>
      </Card>

      {filteredEmails.length === 0 ? (
        <Card className="p-10 text-center text-gray-600">
          <p className="text-lg font-medium">No drafts in the queue</p>
          <p className="text-sm">New emails will appear here as drafts are generated.</p>
        </Card>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {filteredEmails.map((email) => {
            const draftContent = draftEdits[email.id] || email.draft?.content || '';
            const priorityBadge = getPriorityBadge(email.priority);
            const isSelected = email.id === selectedEmailId;

            return (
              <Card
                key={email.id}
                className={`p-4 transition border ${
                  isSelected ? 'border-primary shadow-sm' : 'border-border'
                }`}
                onClick={() => setSelectedEmailId(email.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityBadge.variant}>{priorityBadge.label}</Badge>
                    {isVipSender(email) && <Badge variant="outline">VIP</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(email.receivedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    From: <span className="font-medium text-foreground">{email.from}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="lg:w-1/2 space-y-2">
                    <div>
                      <p className="text-sm font-semibold">Original Email</p>
                      <p className="text-xs text-muted-foreground">{email.subject}</p>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {email.snippet || 'No preview available.'}
                    </p>
                  </div>

                  <div className="lg:w-1/2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Draft Response</p>
                        <p className="text-xs text-muted-foreground">
                          {email.draft?.subject || email.subject}
                        </p>
                      </div>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={toneByEmail[email.id] || 'professional'}
                        onChange={(event) =>
                          setToneByEmail((prev) => ({
                            ...prev,
                            [email.id]: event.target.value,
                          }))
                        }
                      >
                        {TONE_OPTIONS.map((tone) => (
                          <option key={tone} value={tone}>
                            {tone}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Textarea
                      ref={(node) => {
                        editorRefs.current[email.id] = node;
                      }}
                      value={draftContent}
                      onChange={(event) =>
                        setDraftEdits((prev) => ({
                          ...prev,
                          [email.id]: event.target.value,
                        }))
                      }
                      placeholder="Draft response..."
                      rows={6}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => actions.sendDraft(email.id)}
                    disabled={isBusy}
                  >
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editorRefs.current[email.id]?.focus()}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      email.draft?.id &&
                      actions.regenerateDraft(
                        email.draft.id,
                        toneByEmail[email.id] || 'professional'
                      )
                    }
                    disabled={!email.draft?.id || isBusy}
                  >
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.skipEmail(email.id)}
                    disabled={isBusy}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.archiveEmail(email.id)}
                    disabled={isBusy}
                  >
                    Archive
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
