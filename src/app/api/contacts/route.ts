import { NextRequest } from 'next/server';
import { ContactCategory } from '@prisma/client';
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

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const category = parseCategory(searchParams.get('category'));
    const vip = searchParams.get('vip');
    const sort = searchParams.get('sort') || 'NAME';

    const where: {
      userId: string;
      category?: ContactCategory;
      vipStatus?: boolean;
      OR?: Array<Record<string, any>>;
    } = {
      userId: auth.user.userId,
    };

    if (category) {
      where.category = category;
    }

    if (vip === 'true') {
      where.vipStatus = true;
    }
    if (vip === 'false') {
      where.vipStatus = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sort === 'LAST_CONTACT_OLDEST'
        ? [{ lastContactAt: 'asc' }, { name: 'asc' }]
        : sort === 'CATEGORY'
        ? [{ category: 'asc' }, { name: 'asc' }]
        : [{ name: 'asc' }];

    const contacts = await prisma.contact.findMany({
      where,
      orderBy,
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
        _count: { select: { interactions: true } },
      },
    });

    return successResponse({
      contacts: contacts.map((contact) => {
        const { _count, ...data } = contact;
        return {
          ...data,
          interactionCount: _count.interactions,
        };
      }),
    });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch contacts', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      company?: string | null;
      title?: string | null;
      category?: string | null;
      vipStatus?: boolean;
      notes?: string | null;
      lastContactAt?: string | null;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!name || !email) {
      return errorResponse('VALIDATION_ERROR', 'Name and email are required', 400);
    }

    const category = parseCategory(body.category || null) || ContactCategory.OTHER;

    const contact = await prisma.contact.create({
      data: {
        userId: auth.user.userId,
        companyId: auth.user.companyId,
        name,
        email,
        company: body.company ?? null,
        title: body.title ?? null,
        category,
        vipStatus: Boolean(body.vipStatus),
        notes: body.notes ?? null,
        lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : null,
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
        _count: { select: { interactions: true } },
      },
    });

    const { _count, ...data } = contact;
    return successResponse(
      {
        contact: {
          ...data,
          interactionCount: _count.interactions,
        },
      },
      201
    );
  } catch (error) {
    return errorResponse('CREATE_FAILED', 'Failed to create contact', 500);
  }
}
