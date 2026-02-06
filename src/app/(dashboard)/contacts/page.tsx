'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/lib/utils/api-client';

type ContactCategory =
  | 'INVESTOR'
  | 'BOARD_MEMBER'
  | 'CUSTOMER'
  | 'PARTNER'
  | 'TEAM'
  | 'ADVISOR'
  | 'VENDOR'
  | 'OTHER';

type ContactSummary = {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  title?: string | null;
  category: ContactCategory;
  vipStatus: boolean;
  notes?: string | null;
  lastContactAt?: string | null;
  createdAt: string;
  interactionCount: number;
};

type ContactInteraction = {
  id: string;
  type: 'EMAIL_SENT' | 'EMAIL_RECEIVED' | 'MEETING' | 'CALL' | 'NOTE';
  subject?: string | null;
  summary?: string | null;
  timestamp: string;
  email?: {
    id: string;
    subject: string;
    from: string;
    receivedAt: string;
  } | null;
  event?: {
    id: string;
    title: string;
    startTime: string;
  } | null;
};

type RelatedEmail = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
};

type RelatedMeeting = {
  id: string;
  title: string;
  startTime: string;
};

type ContactDetail = ContactSummary & {
  interactions: ContactInteraction[];
  relatedEmails: RelatedEmail[];
  relatedMeetings: RelatedMeeting[];
};

type SortOption = 'NAME' | 'LAST_CONTACT_OLDEST' | 'CATEGORY';

const CATEGORY_OPTIONS: ContactCategory[] = [
  'INVESTOR',
  'BOARD_MEMBER',
  'CUSTOMER',
  'PARTNER',
  'TEAM',
  'ADVISOR',
  'VENDOR',
  'OTHER',
];

const OVERDUE_GRACE_DAYS = 7;

const EXPECTED_FREQUENCY: Record<ContactCategory, number | null> = {
  INVESTOR: 28,
  BOARD_MEMBER: 14,
  CUSTOMER: 42,
  PARTNER: 28,
  TEAM: null,
  ADVISOR: 56,
  VENDOR: null,
  OTHER: null,
};

function formatCategory(category: ContactCategory) {
  return category.replace('_', ' ').toLowerCase();
}

function getHealthStatus(contact: ContactSummary) {
  const expectedDays = EXPECTED_FREQUENCY[contact.category];
  const lastContactAt = contact.lastContactAt
    ? new Date(contact.lastContactAt)
    : new Date(contact.createdAt);
  const daysSince = Math.max(
    0,
    Math.floor((Date.now() - lastContactAt.getTime()) / (24 * 60 * 60 * 1000))
  );

  if (!expectedDays) {
    return { status: 'healthy', emoji: '🟢', label: 'Healthy' };
  }

  if (daysSince < expectedDays) {
    return { status: 'healthy', emoji: '🟢', label: 'Healthy' };
  }

  if (daysSince < expectedDays + OVERDUE_GRACE_DAYS) {
    return { status: 'due', emoji: '🟡', label: 'Due' };
  }

  return { status: 'overdue', emoji: '🔴', label: 'Overdue' };
}

function formatDate(value?: string | null) {
  if (!value) return 'No contact yet';
  return new Date(value).toLocaleDateString();
}

function getCategoryBadgeVariant(category: ContactCategory) {
  switch (category) {
    case 'INVESTOR':
      return 'default' as const;
    case 'BOARD_MEMBER':
      return 'secondary' as const;
    case 'CUSTOMER':
      return 'outline' as const;
    case 'PARTNER':
      return 'secondary' as const;
    case 'TEAM':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | 'ALL'>('ALL');
  const [vipFilter, setVipFilter] = useState<'ALL' | 'VIP' | 'NON_VIP'>('ALL');
  const [sort, setSort] = useState<SortOption>('NAME');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (vipFilter === 'VIP') params.set('vip', 'true');
      if (vipFilter === 'NON_VIP') params.set('vip', 'false');
      params.set('sort', sort);

      const response = await fetch(`/api/contacts?${params.toString()}`);
      const result = await parseApiResponse<{ contacts: ContactSummary[] }>(response);
      if (result.success) {
        setContacts(result.data.contacts || []);
      } else {
        toast({
          title: 'Failed to load contacts',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to load contacts',
        description: 'Unable to fetch contacts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, search, sort, toast, vipFilter]);

  const fetchContactDetail = useCallback(
    async (contactId: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/contacts/${contactId}`);
        const result = await parseApiResponse<{ contact: ContactDetail }>(response);
        if (result.success) {
          setContactDetail(result.data.contact);
          setNotesDraft(result.data.contact.notes || '');
          setNoteDraft('');
        } else {
          toast({
            title: 'Failed to load contact',
            description: result.error.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Failed to load contact',
          description: 'Unable to fetch contact details',
          variant: 'destructive',
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (activeContactId) {
      fetchContactDetail(activeContactId);
    } else {
      setContactDetail(null);
    }
  }, [activeContactId, fetchContactDetail]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => contacts.some((contact) => contact.id === id)));
  }, [contacts]);

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((contact) => contact.id));
    }
  };

  const toggleSelected = (contactId: string) => {
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSync = async () => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/contacts/sync', { method: 'POST' });
      const result = await parseApiResponse<{ created: number; updated: number; total: number }>(
        response
      );
      if (result.success) {
        toast({
          title: 'Contacts synced',
          description: `Added ${result.data.created}, updated ${result.data.updated}`,
        });
        await fetchContacts();
      } else {
        toast({
          title: 'Sync failed',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Unable to sync contacts',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const runBulkUpdate = async (action: 'vip' | 'delete') => {
    if (!selectedIds.length) return;
    if (action === 'delete' && !window.confirm('Delete selected contacts?')) return;

    setIsMutating(true);
    try {
      const requests = selectedIds.map((contactId) =>
        fetch(`/api/contacts/${contactId}`, {
          method: action === 'delete' ? 'DELETE' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:
            action === 'delete'
              ? undefined
              : JSON.stringify({
                  vipStatus: true,
                }),
        })
      );

      const results = await Promise.all(requests);
      const parsed = await Promise.all(
        results.map((response) => parseApiResponse<{ contact?: ContactSummary }>(response))
      );

      const failed = parsed.find((result) => !result.success);
      if (failed && !failed.success) {
        toast({
          title: 'Bulk action failed',
          description: failed.error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: action === 'delete' ? 'Contacts deleted' : 'VIP status updated',
          description: `Updated ${selectedIds.length} contacts`,
        });
      }
      await fetchContacts();
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: 'Bulk action failed',
        description: 'Unable to update contacts',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDetailUpdate = async (payload: Record<string, unknown>) => {
    if (!contactDetail) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await parseApiResponse<{ contact: ContactDetail }>(response);
      if (result.success) {
        setContactDetail(result.data.contact);
        setNotesDraft(result.data.contact.notes || '');
        setNoteDraft('');
        await fetchContacts();
      } else {
        toast({
          title: 'Update failed',
          description: result.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Unable to update contact',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredContacts = useMemo(() => contacts, [contacts]);
  const isBusy = isLoading || isMutating;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`contacts-filter-${index}`} className="h-9 w-full" />
            ))}
          </div>
        </Card>
        <Card className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`contact-row-${index}`} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-gray-600">
            {contacts.length} contacts • {selectedIds.length} selected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={isBusy}>
            Sync contacts
          </Button>
          <Button
            variant="secondary"
            onClick={() => runBulkUpdate('vip')}
            disabled={isBusy || selectedIds.length === 0}
          >
            Mark as VIP
          </Button>
          <Button
            variant="destructive"
            onClick={() => runBulkUpdate('delete')}
            disabled={isBusy || selectedIds.length === 0}
          >
            Delete
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Search</label>
            <Input
              className="mt-1"
              placeholder="Search name, email, company"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as ContactCategory | 'ALL')}
            >
              <option value="ALL">All</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {formatCategory(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">VIP</label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={vipFilter}
              onChange={(event) => setVipFilter(event.target.value as 'ALL' | 'VIP' | 'NON_VIP')}
            >
              <option value="ALL">All</option>
              <option value="VIP">VIP only</option>
              <option value="NON_VIP">Not VIP</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sort</label>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
            >
              <option value="NAME">Name</option>
              <option value="LAST_CONTACT_OLDEST">Last contact (oldest first)</option>
              <option value="CATEGORY">Category</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all contacts"
                />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>VIP</TableHead>
              <TableHead>Last contact</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Interactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {isLoading ? 'Loading contacts...' : 'No contacts found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => {
                const health = getHealthStatus(contact);
                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={() => setActiveContactId(contact.id)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(contact.id)}
                        onCheckedChange={() => toggleSelected(contact.id)}
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">{contact.email}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.title || 'No title'} • {contact.company || 'No company'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(contact.category)}>
                        {formatCategory(contact.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>{contact.vipStatus ? '⭐' : '—'}</TableCell>
                    <TableCell>{formatDate(contact.lastContactAt)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span>{health.emoji}</span>
                        <span className="text-xs text-muted-foreground">{health.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{contact.interactionCount}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={Boolean(activeContactId)} onOpenChange={() => setActiveContactId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contact details</DialogTitle>
            <DialogDescription>Relationship history and related activity.</DialogDescription>
          </DialogHeader>

          {detailLoading || !contactDetail ? (
            <div className="text-sm text-muted-foreground">Loading contact...</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">{contactDetail.name}</h2>
                      <p className="text-sm text-muted-foreground">{contactDetail.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getCategoryBadgeVariant(contactDetail.category)}>
                        {formatCategory(contactDetail.category)}
                      </Badge>
                      {contactDetail.vipStatus && <Badge variant="secondary">VIP</Badge>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {contactDetail.title || 'No title'} • {contactDetail.company || 'No company'}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span>Last contact: {formatDate(contactDetail.lastContactAt)}</span>
                    <span>Interactions: {contactDetail.interactionCount}</span>
                    <span>
                      Health: {getHealthStatus(contactDetail).emoji}{' '}
                      {getHealthStatus(contactDetail).label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDetailUpdate({ vipStatus: !contactDetail.vipStatus })
                      }
                      disabled={detailLoading}
                    >
                      {contactDetail.vipStatus ? 'Remove VIP' : 'Mark as VIP'}
                    </Button>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={contactDetail.category}
                      onChange={(event) =>
                        handleDetailUpdate({ category: event.target.value as ContactCategory })
                      }
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {formatCategory(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Notes</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDetailUpdate({ notes: notesDraft })}
                      disabled={detailLoading}
                    >
                      Save notes
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    placeholder="Add private notes about this contact..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Quick note to log in timeline"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleDetailUpdate({ note: noteDraft })}
                      disabled={!noteDraft.trim() || detailLoading}
                    >
                      Add note
                    </Button>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Interaction history</h3>
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                    {contactDetail.interactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
                    ) : (
                      contactDetail.interactions.map((interaction) => (
                        <div key={interaction.id} className="border-l-2 border-muted pl-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{interaction.type.replace('_', ' ')}</Badge>
                            <span>{new Date(interaction.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm font-medium">
                            {interaction.subject || 'Interaction'}
                          </p>
                          {interaction.summary && (
                            <p className="text-sm text-muted-foreground">
                              {interaction.summary}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Related emails</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {contactDetail.relatedEmails.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No related emails.</p>
                    ) : (
                      contactDetail.relatedEmails.map((email) => (
                        <div key={email.id} className="border rounded-md p-2">
                          <p className="text-sm font-medium">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {email.from} • {new Date(email.receivedAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Related meetings</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {contactDetail.relatedMeetings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No related meetings.</p>
                    ) : (
                      contactDetail.relatedMeetings.map((meeting) => (
                        <div key={meeting.id} className="border rounded-md p-2">
                          <p className="text-sm font-medium">{meeting.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(meeting.startTime).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
