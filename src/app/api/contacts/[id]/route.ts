import { NextRequest } from 'next/server';
import { ContactCategory, InteractionType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/api-response';

function parseCategory(value: string | null): ContactCategory | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return Object.values(ContactCategory).includes(upper as ContactCategory)
    ? (upper as ContactCategory)
    : null;
}

async function fetchContactDetail(contactId: string, userId: string) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      title: true,
      category: true,
      vipStatus: true,
      notes: true,
      lastContactAt: true,
      createdAt: true,
      interactions: {
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          type: true,
          subject: true,
          summary: true,
          timestamp: true,
          email: {
            select: {
              id: true,
              subject: true,
              from: true,
              receivedAt: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startTime: true,
            },
          },
        },
      },
      _count: { select: { interactions: true } },
    },
  });

  if (!contact) {
    return null;
  }

  const { _count, ...contactData } = contact;
  const relatedEmails = new Map<string, typeof contact.interactions[number]['email']>();
  const relatedMeetings = new Map<string, typeof contact.interactions[number]['event']>();

  for (const interaction of contact.interactions) {
    if (interaction.email) {
      relatedEmails.set(interaction.email.id, interaction.email);
    }
    if (interaction.event) {
      relatedMeetings.set(interaction.event.id, interaction.event);
    }
  }

  return {
    ...contactData,
    interactionCount: _count.interactions,
    relatedEmails: Array.from(relatedEmails.values()),
    relatedMeetings: Array.from(relatedMeetings.values()),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const contact = await fetchContactDetail(params.id, auth.user.userId);
    if (!contact) {
      return errorResponse('NOT_FOUND', 'Contact not found', 404);
    }

    return successResponse({ contact });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch contact', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      name?: string | null;
      company?: string | null;
      title?: string | null;
      category?: string | null;
      vipStatus?: boolean;
      notes?: string | null;
      lastContactAt?: string | null;
      note?: string | null;
    };

    const existing = await prisma.contact.findFirst({
      where: { id: params.id, userId: auth.user.userId },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Contact not found', 404);
    }

    const updateData: {
      name?: string;
      company?: string | null;
      title?: string | null;
      category?: ContactCategory;
      vipStatus?: boolean;
      notes?: string | null;
      lastContactAt?: Date | null;
    } = {};

    if (typeof body.name === 'string') {
      updateData.name = body.name.trim();
    }
    if (body.company !== undefined) {
      updateData.company = body.company;
    }
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.category) {
      const category = parseCategory(body.category);
      if (category) {
        updateData.category = category;
      }
    }
    if (typeof body.vipStatus === 'boolean') {
      updateData.vipStatus = body.vipStatus;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }
    if (body.lastContactAt) {
      updateData.lastContactAt = new Date(body.lastContactAt);
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note) {
      updateData.lastContactAt = new Date();
    }

    if (note) {
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: params.id },
          data: updateData,
        }),
        prisma.contactInteraction.create({
          data: {
            contactId: params.id,
            type: InteractionType.NOTE,
            summary: note,
            timestamp: new Date(),
          },
        }),
      ]);
    } else if (Object.keys(updateData).length > 0) {
      await prisma.contact.update({
        where: { id: params.id },
        data: updateData,
      });
    }

    const contact = await fetchContactDetail(params.id, auth.user.userId);
    if (!contact) {
      return errorResponse('NOT_FOUND', 'Contact not found', 404);
    }

    return successResponse({ contact });
  } catch (error) {
    return errorResponse('UPDATE_FAILED', 'Failed to update contact', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const deleted = await prisma.contact.deleteMany({
      where: {
        id: params.id,
        userId: auth.user.userId,
      },
    });

    if (deleted.count === 0) {
      return errorResponse('NOT_FOUND', 'Contact not found', 404);
    }

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse('DELETE_FAILED', 'Failed to delete contact', 500);
  }
}
