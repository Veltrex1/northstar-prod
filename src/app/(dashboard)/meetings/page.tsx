'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';
import { events, trackEvent } from '@/lib/analytics/events';

type MeetingBrief = {
  id: string;
  content?: string;
  attendeeContext?: Record<string, string>;
  talkingPoints?: string[];
  questions?: string[];
  generatedAt?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  attendees: string[];
  location?: string | null;
  meetingUrl?: string | null;
  meetingBrief?: MeetingBrief | null;
};

type MeetingsResponse = {
  today: CalendarEvent[];
  thisWeek: CalendarEvent[];
  upcoming: CalendarEvent[];
};

type FilterMode = 'all' | 'briefs' | 'today';

function formatTimeRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const time = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${time} - ${endTime}`;
}

function formatDuration(start: string, end: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function getInitials(email: string) {
  const base = email.split('@')[0] || email;
  const parts = base.split(/[.\-_]/g).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function getLocationLabel(event: CalendarEvent) {
  return event.meetingUrl || event.location || 'No location';
}

function getRelevantData(brief?: MeetingBrief | null): string[] {
  if (!brief?.content) return [];
  const match = brief.content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { relevantData?: string[] };
    return Array.isArray(parsed.relevantData) ? parsed.relevantData : [];
  } catch {
    return [];
  }
}

export default function MeetingsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<MeetingsResponse>({
    today: [],
    thisWeek: [],
    upcoming: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const selectedRelevantData = useMemo(
    () => (selectedEvent?.meetingBrief ? getRelevantData(selectedEvent.meetingBrief) : []),
    [selectedEvent]
  );

  useEffect(() => {
    const fetchMeetings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/meetings');
        const result = await parseApiResponse<MeetingsResponse>(response);
        if (result.success) {
          setData(result.data);
        } else {
          toast({
            title: 'Failed to load meetings',
            description: result.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Failed to load meetings',
          description: 'Unable to fetch meetings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [toast]);

  const filtered = useMemo(() => {
    if (filterMode === 'today') {
      return { today: data.today, thisWeek: [], upcoming: [] };
    }

    if (filterMode === 'briefs') {
      const onlyBriefs = (events: CalendarEvent[]) =>
        events.filter((event) => Boolean(event.meetingBrief));
      return {
        today: onlyBriefs(data.today),
        thisWeek: onlyBriefs(data.thisWeek),
        upcoming: onlyBriefs(data.upcoming),
      };
    }

    return data;
  }, [data, filterMode]);

  const handleViewBrief = (event: CalendarEvent) => {
    setSelectedEvent(event);
    if (event.meetingBrief) {
      trackEvent(events.MEETING_BRIEF_VIEWED, {
        eventId: event.id,
        title: event.title,
        hasBrief: true,
      });
    }
  };

  const totalMeetings =
    filtered.today.length + filtered.thisWeek.length + filtered.upcoming.length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-4 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={`meeting-filter-${index}`} className="h-9 w-32" />
          ))}
        </Card>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`meeting-skeleton-${index}`} className="p-4 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-gray-600">Upcoming calendar events and briefs</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {isLoading && <span className="text-primary">Updating...</span>}
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filterMode === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterMode('all')}
        >
          Show all
        </Button>
        <Button
          size="sm"
          variant={filterMode === 'briefs' ? 'default' : 'outline'}
          onClick={() => setFilterMode('briefs')}
        >
          Show only with briefs
        </Button>
        <Button
          size="sm"
          variant={filterMode === 'today' ? 'default' : 'outline'}
          onClick={() => setFilterMode('today')}
        >
          Show only today
        </Button>
      </Card>

      {totalMeetings === 0 ? (
        <Card className="p-10 text-center text-gray-600">
          <p className="text-lg font-medium">No upcoming meetings</p>
          <p className="text-sm">Events within the next 30 days will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <MeetingSection
            title="Today's Meetings"
            events={filtered.today}
            onViewBrief={handleViewBrief}
          />
          <MeetingSection
            title="This Week"
            events={filtered.thisWeek}
            onViewBrief={handleViewBrief}
          />
          <MeetingSection
            title="Upcoming (next 7-30 days)"
            events={filtered.upcoming}
            onViewBrief={handleViewBrief}
          />
        </div>
      )}

      <Dialog open={Boolean(selectedEvent)} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Meeting Brief</DialogTitle>
            <DialogDescription>
              {selectedEvent?.title || 'Meeting details'}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent?.meetingBrief ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold mb-2">Attendee context</p>
                <div className="space-y-2">
                  {Object.entries(selectedEvent.meetingBrief.attendeeContext || {}).map(
                    ([name, context]) => (
                      <Card key={name} className="p-3">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-sm text-muted-foreground">{context}</p>
                      </Card>
                    )
                  )}
                  {Object.keys(selectedEvent.meetingBrief.attendeeContext || {}).length ===
                    0 && <p className="text-sm text-muted-foreground">No context.</p>}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Talking points</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {(selectedEvent.meetingBrief.talkingPoints || []).map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                  {(selectedEvent.meetingBrief.talkingPoints || []).length === 0 && (
                    <li>No talking points available.</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Questions to ask</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {(selectedEvent.meetingBrief.questions || []).map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                  {(selectedEvent.meetingBrief.questions || []).length === 0 && (
                    <li>No questions available.</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Relevant data</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {selectedRelevantData.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                  {selectedRelevantData.length === 0 && (
                    <li>No relevant data available.</li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end">
                <Button asChild variant="outline">
                  <Link href={`/meetings/${selectedEvent.id}`}>View full brief</Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No brief available yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetingSection({
  title,
  events,
  onViewBrief,
}: {
  title: string;
  events: CalendarEvent[];
  onViewBrief: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4">
        {events.map((event) => {
          const timeRange = formatTimeRange(event.startTime, event.endTime);
          const duration = formatDuration(event.startTime, event.endTime);
          const locationLabel = getLocationLabel(event);
          const hasBrief = Boolean(event.meetingBrief);

          return (
            <Card key={event.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {timeRange} • {duration}
                  </p>
                </div>
                {hasBrief && <Badge variant="secondary">Brief Ready</Badge>}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {event.attendees.slice(0, 6).map((attendee) => (
                  <div key={attendee} className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {getInitials(attendee)}
                    </div>
                    <span className="text-sm text-muted-foreground">{attendee}</span>
                  </div>
                ))}
                {event.attendees.length === 0 && (
                  <span className="text-sm text-muted-foreground">No attendees listed</span>
                )}
                {event.attendees.length > 6 && (
                  <Badge variant="outline">+{event.attendees.length - 6} more</Badge>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {event.meetingUrl ? (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {locationLabel}
                  </a>
                ) : (
                  locationLabel
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasBrief}
                  onClick={() => onViewBrief(event)}
                >
                  View Brief
                </Button>
                {event.meetingUrl ? (
                  <Button size="sm" asChild>
                    <a href={event.meetingUrl} target="_blank" rel="noreferrer">
                      Join Call
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    Join Call
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
