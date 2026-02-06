'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Bell,
  Calendar,
  ChevronDown,
  Mail,
  Target,
} from 'lucide-react';

type DigestContent = {
  date: string;
  greeting: string;
  summary: string;
  emails: {
    total: number;
    urgent: number;
    high: number;
    normal: number;
    low: number;
    draftsReady: number;
    topSenders: Array<{ sender: string; count: number }>;
  };
  meetings: {
    total: number;
    nextMeeting: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      attendees: string[];
      meetingUrl?: string | null;
    } | null;
    briefsReady: number;
  };
  insights: Array<unknown>;
  reminders: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
};

type DailyDigestRecord = {
  id: string;
  date: string;
  content: DigestContent;
  dismissedAt: string | null;
};

const LAST_SEEN_KEY = 'dailyDigestLastSeen';

export function DailyDigest() {
  const [digest, setDigest] = useState<DailyDigestRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadDigest = async () => {
      try {
        const response = await fetch('/api/digest/today');
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!payload?.success) {
          return;
        }
        if (isMounted) {
          setDigest(payload.data?.digest ?? null);
        }
      } catch {
        // Ignore fetch errors for now.
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDigest();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!digest || digest.dismissedAt) {
      setIsHidden(true);
      return;
    }

    try {
      const digestDate = digest.content?.date || digest.date;
      const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);
      if (lastSeen !== digestDate) {
        setIsExpanded(true);
        window.localStorage.setItem(LAST_SEEN_KEY, digestDate);
      } else {
        setIsExpanded(false);
      }
    } catch {
      setIsExpanded(true);
    }
  }, [digest]);

  const handleDismiss = async () => {
    if (isDismissing) return;
    setIsDismissing(true);
    try {
      const response = await fetch('/api/digest/today', { method: 'POST' });
      if (response.ok) {
        setIsHidden(true);
      }
    } finally {
      setIsDismissing(false);
    }
  };

  const digestDateLabel = useMemo(() => {
    if (!digest?.content?.date) return '';
    return format(new Date(digest.content.date), 'EEEE, MMM d');
  }, [digest?.content?.date]);

  if (isLoading || isHidden || !digest?.content) {
    return null;
  }

  const { emails, meetings, insights, reminders, goals } = digest.content;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="mx-6 mt-4 border-slate-200">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{digest.content.greeting}</CardTitle>
              <CardDescription className="text-sm text-slate-600">
                {digestDateLabel} • {digest.content.summary}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                disabled={isDismissing}
              >
                Dismiss
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {isExpanded ? 'Collapse' : 'Expand'}
                  <ChevronDown
                    className={cn(
                      'ml-2 h-4 w-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Emails: {emails.total}</Badge>
            <Badge variant="secondary">Meetings: {meetings.total}</Badge>
            <Badge variant="secondary">Drafts ready: {emails.draftsReady}</Badge>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            <SectionCard
              icon={<Mail className="h-4 w-4" />}
              title="Email summary"
              action={
                <Link className="text-sm text-blue-600 hover:underline" href="/email/queue">
                  View queue
                </Link>
              }
            >
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                <Badge variant="outline">Urgent: {emails.urgent}</Badge>
                <Badge variant="outline">High: {emails.high}</Badge>
                <Badge variant="outline">Normal: {emails.normal}</Badge>
                <Badge variant="outline">Low: {emails.low}</Badge>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-slate-600">Top senders</p>
                {emails.topSenders.length === 0 ? (
                  <p className="text-slate-500">No recent senders in the last 24 hours.</p>
                ) : (
                  <ul className="space-y-1 text-slate-700">
                    {emails.topSenders.map((sender) => (
                      <li key={sender.sender} className="flex justify-between">
                        <span>{sender.sender}</span>
                        <span className="text-slate-500">{sender.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>

            <SectionCard
              icon={<Calendar className="h-4 w-4" />}
              title="Meeting summary"
              action={
                <Link className="text-sm text-blue-600 hover:underline" href="/meetings">
                  View meetings
                </Link>
              }
            >
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                <Badge variant="outline">Today: {meetings.total}</Badge>
                <Badge variant="outline">Briefs ready: {meetings.briefsReady}</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-700">
                <p className="text-slate-600">Next meeting</p>
                {meetings.nextMeeting ? (
                  <div className="mt-1 space-y-1">
                    <p className="font-medium">{meetings.nextMeeting.title || 'Untitled'}</p>
                    <p className="text-slate-500">
                      {format(new Date(meetings.nextMeeting.startTime), 'p')} -{' '}
                      {format(new Date(meetings.nextMeeting.endTime), 'p')}
                    </p>
                    {meetings.nextMeeting.attendees?.length > 0 && (
                      <p className="text-slate-500">
                        Attendees: {meetings.nextMeeting.attendees.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">No upcoming meetings scheduled.</p>
                )}
              </div>
            </SectionCard>

            <ExpandableSection
              icon={<Bell className="h-4 w-4" />}
              title="Insights"
              count={insights.length}
              emptyMessage="No new insights yet."
            >
              <ul className="space-y-2 text-sm text-slate-700">
                {insights.map((insight, index) => (
                  <li key={`insight-${index}`}>{formatInsight(insight)}</li>
                ))}
              </ul>
            </ExpandableSection>

            <ExpandableSection
              icon={<Bell className="h-4 w-4" />}
              title="Reminders"
              count={reminders.length}
              emptyMessage="No reminders yet."
            >
              <ul className="space-y-2 text-sm text-slate-700">
                {reminders.map((reminder, index) => (
                  <li key={`reminder-${index}`}>{formatReminder(reminder)}</li>
                ))}
              </ul>
            </ExpandableSection>

            {goals.length > 0 && (
              <SectionCard icon={<Target className="h-4 w-4" />} title="Goals">
                <ul className="space-y-2 text-sm text-slate-700">
                  {goals.map((goal, index) => (
                    <li key={`goal-${index}`}>{formatGoal(goal)}</li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

type SectionCardProps = {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

function SectionCard({ icon, title, action, children }: SectionCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="text-slate-500">{icon}</span>
          {title}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

type ExpandableSectionProps = {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
};

function ExpandableSection({
  icon,
  title,
  count,
  emptyMessage,
  children,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="text-slate-500">{icon}</span>
            {title}
            <Badge variant="secondary" className="ml-1">
              {count}
            </Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {open ? 'Hide' : 'Show'}
              <ChevronDown
                className={cn(
                  'ml-2 h-4 w-4 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-3">
            {count === 0 ? (
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            ) : (
              children
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function formatReminder(reminder: Record<string, unknown>) {
  if (reminder?.type === 'relationship' && typeof reminder.contact === 'object') {
    const contact = reminder.contact as {
      name?: string;
      email?: string;
      company?: string | null;
      lastContactAt?: string | null;
    };
    const name = contact.name || contact.email || 'Contact';
    const lastContact = contact.lastContactAt
      ? format(new Date(contact.lastContactAt), 'MMM d')
      : 'never';
    return `${name} • Last contact ${lastContact}`;
  }

  if (reminder?.type === 'goal_checkin' && typeof reminder.goal === 'object') {
    const goal = reminder.goal as { title?: string };
    return `Goal check-in: ${goal.title || 'Untitled goal'}`;
  }

  return 'Reminder';
}

function formatGoal(goal: Record<string, unknown>) {
  if (typeof goal?.title === 'string') {
    return goal.title;
  }
  return 'Goal';
}

function formatInsight(insight: unknown) {
  if (typeof insight === 'string') {
    return insight;
  }
  return 'Insight';
}
