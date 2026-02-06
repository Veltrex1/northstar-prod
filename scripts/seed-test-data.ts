import {
  CalendarProvider,
  ContactCategory,
  DraftStatus,
  EmailPriority,
  EmailStatus,
  EventStatus,
  InteractionType,
  MemoryType,
  PrismaClient,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const TEST_USER = {
  name: "Test User",
  email: "test@northstar.com",
  password: "Test123!",
  companyName: "Northstar Labs",
  industry: "Technology",
};

const pick = <T>(values: T[]) => values[Math.floor(Math.random() * values.length)];
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

async function ensureTestUser() {
  const passwordHash = await hash(TEST_USER.password, 10);
  const existing = await prisma.user.findUnique({
    where: { email: TEST_USER.email },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { email: TEST_USER.email },
      data: {
        name: TEST_USER.name,
        passwordHash,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        personalityProfile: {
          archetype: "Strategic Builder",
          strengths: ["clarity", "decisiveness", "coaching"],
          communicationStyle: "direct, supportive, concise",
          workingRhythm: "morning deep work, afternoon collaboration",
        },
        voiceProfile: {
          tone: "confident, warm, crisp",
          preferredLength: "medium",
          formatting: "short paragraphs, numbered lists for decisions",
          phrasesToUse: ["net-net", "let’s align on the goal", "key takeaway"],
        },
      },
      include: { company: true },
    });

    return { user, company: user.company };
  }

  const company = await prisma.company.create({
    data: {
      name: TEST_USER.companyName,
      industry: TEST_USER.industry,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      passwordHash,
      role: "OWNER",
      companyId: company.id,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      personalityProfile: {
        archetype: "Strategic Builder",
        strengths: ["clarity", "decisiveness", "coaching"],
        communicationStyle: "direct, supportive, concise",
        workingRhythm: "morning deep work, afternoon collaboration",
      },
      voiceProfile: {
        tone: "confident, warm, crisp",
        preferredLength: "medium",
        formatting: "short paragraphs, numbered lists for decisions",
        phrasesToUse: ["net-net", "let’s align on the goal", "key takeaway"],
      },
    },
  });

  return { user, company };
}

async function cleanupExistingData(userId: string, companyId: string) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true },
  });
  const contactIds = contacts.map((contact) => contact.id);

  if (contactIds.length > 0) {
    await prisma.contactInteraction.deleteMany({
      where: { contactId: { in: contactIds } },
    });
  }

  await prisma.contact.deleteMany({ where: { userId } });

  const events = await prisma.calendarEvent.findMany({
    where: { userId },
    select: { id: true },
  });
  const eventIds = events.map((event) => event.id);

  if (eventIds.length > 0) {
    await prisma.meetingBrief.deleteMany({
      where: { eventId: { in: eventIds } },
    });
  }

  await prisma.calendarEvent.deleteMany({ where: { userId } });
  await prisma.emailDraft.deleteMany({ where: { userId } });
  await prisma.email.deleteMany({ where: { userId } });
  await prisma.conversationMemory.deleteMany({ where: { userId } });
  await prisma.conversation.deleteMany({ where: { userId } });
  await prisma.dailyDigest.deleteMany({ where: { userId, companyId } });
}

async function seedEmails(userId: string, companyId: string) {
  const now = new Date();
  const senders = [
    "maria.chen@orionfund.com",
    "alex@brightpath.io",
    "jordan@acmeventures.com",
    "devon@shipwright.ai",
    "lena@horizonhealth.org",
    "ravi@northpeakpartners.com",
    "emily@blueharbor.com",
    "support@stackline.dev",
    "ceo@atlasfinance.com",
    "ops@northwindlogistics.com",
  ];

  const emailSeeds = [
    {
      subject: "Q1 board materials review",
      body: "Attached the draft board deck. Can you review sections 3 and 4?",
      priority: EmailPriority.HIGH,
      status: EmailStatus.UNREAD,
      hasDraft: false,
    },
    {
      subject: "Customer renewal: Helios Health",
      body: "Renewal is in flight. Need a quick note to the CFO to unblock.",
      priority: EmailPriority.URGENT,
      status: EmailStatus.DRAFT_READY,
      hasDraft: true,
    },
    {
      subject: "Partnership proposal with BrightPath",
      body: "Sharing a draft partnership outline and timeline. Thoughts?",
      priority: EmailPriority.NORMAL,
      status: EmailStatus.UNREAD,
      hasDraft: false,
    },
    {
      subject: "Weekly metrics update",
      body: "MAUs up 8%. Funnel conversion dipped in mid-market segment.",
      priority: EmailPriority.LOW,
      status: EmailStatus.RESPONDED,
      hasDraft: false,
    },
    {
      subject: "Product roadmap feedback",
      body: "We should double down on the workflow automation lane.",
      priority: EmailPriority.NORMAL,
      status: EmailStatus.DRAFT_READY,
      hasDraft: true,
    },
    {
      subject: "Investor diligence request",
      body: "Please share updated ARR, churn, and pipeline summaries.",
      priority: EmailPriority.HIGH,
      status: EmailStatus.UNREAD,
      hasDraft: false,
    },
    {
      subject: "Upcoming keynote logistics",
      body: "Stage time confirmed. Do you want a rehearsal slot?",
      priority: EmailPriority.NORMAL,
      status: EmailStatus.UNREAD,
      hasDraft: false,
    },
    {
      subject: "Security questionnaire follow-up",
      body: "Customer needs responses by Friday. Can we align?",
      priority: EmailPriority.HIGH,
      status: EmailStatus.DRAFT_READY,
      hasDraft: true,
    },
    {
      subject: "Finance ops: budget reforecast",
      body: "We need updated headcount assumptions for Q2.",
      priority: EmailPriority.NORMAL,
      status: EmailStatus.UNREAD,
      hasDraft: false,
    },
    {
      subject: "Team offsite RSVP",
      body: "Please confirm attendance for the April offsite.",
      priority: EmailPriority.LOW,
      status: EmailStatus.ARCHIVED,
      hasDraft: false,
    },
  ];

  const createdEmails = [];

  for (let index = 0; index < emailSeeds.length; index += 1) {
    const seed = emailSeeds[index];
    const from = senders[index % senders.length];
    const receivedAt = new Date(now.getTime() - (index + 2) * 60 * 60 * 1000);

    const email = await prisma.email.create({
      data: {
        companyId,
        userId,
        messageId: `msg_${nanoid(12)}`,
        threadId: `thread_${nanoid(8)}`,
        from,
        to: [TEST_USER.email],
        cc: index % 3 === 0 ? ["chief.of.staff@northstar.com"] : [],
        subject: seed.subject,
        body: seed.body,
        snippet: seed.body.slice(0, 90),
        receivedAt,
        priority: seed.priority,
        status: seed.status,
        isExternal: true,
      },
    });

    if (seed.hasDraft) {
      const draft = await prisma.emailDraft.create({
        data: {
          userId,
          emailId: email.id,
          subject: `Re: ${seed.subject}`,
          content: `Draft reply:\n\nThanks for the update. I'll review and revert by EOD.`,
          tone: "confident, concise",
          status: DraftStatus.DRAFT,
          isAutoGenerated: true,
          generatedAt: new Date(),
        },
      });

      await prisma.email.update({
        where: { id: email.id },
        data: { draftId: draft.id },
      });
    }

    createdEmails.push(email);
  }

  return createdEmails;
}

async function seedCalendarEvents(userId: string, companyId: string) {
  const today = startOfDay(new Date());
  const events = [
    {
      title: "Board prep sync",
      description: "Align on narrative and open risks before board meeting.",
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      attendees: ["cfo@northstar.com", "chief.of.staff@northstar.com"],
      location: "Conf Room A",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      status: EventStatus.CONFIRMED,
      needsBrief: true,
    },
    {
      title: "Customer exec check-in",
      description: "Quarterly executive check-in with Helios Health.",
      startTime: new Date(today.getTime() + 15 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 16 * 60 * 60 * 1000),
      attendees: ["cto@helioshealth.org", "vp@helioshealth.org"],
      location: "Zoom",
      meetingUrl: "https://zoom.us/j/934112233",
      status: EventStatus.CONFIRMED,
      needsBrief: false,
    },
    {
      title: "Investor diligence call",
      description: "Pipeline review and financial snapshot.",
      startTime: addDays(today, 2),
      endTime: addDays(today, 2.5),
      attendees: ["maria.chen@orionfund.com"],
      location: "Google Meet",
      meetingUrl: "https://meet.google.com/inv-diligence",
      status: EventStatus.TENTATIVE,
      needsBrief: true,
    },
    {
      title: "Product roadmap review",
      description: "Review Q2 roadmap milestones and staffing.",
      startTime: addDays(today, 4),
      endTime: addDays(today, 4.5),
      attendees: ["vp.product@northstar.com", "design.lead@northstar.com"],
      location: "Conf Room B",
      meetingUrl: "https://meet.google.com/prod-roadmap",
      status: EventStatus.CONFIRMED,
      needsBrief: false,
    },
    {
      title: "Offsite planning",
      description: "Finalize agenda and facilitators for April offsite.",
      startTime: addDays(today, 7),
      endTime: addDays(today, 7.5),
      attendees: ["ops@northstar.com", "people@northstar.com"],
      location: "Conference Room C",
      meetingUrl: "https://meet.google.com/offsite-plan",
      status: EventStatus.CONFIRMED,
      needsBrief: false,
    },
  ];

  const createdEvents = [];

  for (const eventSeed of events) {
    const event = await prisma.calendarEvent.create({
      data: {
        companyId,
        userId,
        eventId: `evt_${nanoid(10)}`,
        provider: CalendarProvider.GOOGLE,
        title: eventSeed.title,
        description: eventSeed.description,
        startTime: eventSeed.startTime,
        endTime: eventSeed.endTime,
        attendees: eventSeed.attendees,
        location: eventSeed.location,
        meetingUrl: eventSeed.meetingUrl,
        status: eventSeed.status,
      },
    });

    if (eventSeed.needsBrief) {
      const brief = await prisma.meetingBrief.create({
        data: {
          eventId: event.id,
          content:
            "Key goal: align on narrative, confirm next steps, and capture risks.",
          attendeeContext: {
            personas: ["CFO", "Chief of Staff"],
            notes: "Focus on metrics and clear action items.",
          },
          talkingPoints: [
            "ARR progress vs plan",
            "Key customer renewals",
            "Hiring priorities",
          ],
          questions: ["What decisions must be made today?", "What risks need coverage?"],
          relevantDocs: {
            links: ["Board deck v4", "Q1 metrics snapshot"],
          },
        },
      });

      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { briefId: brief.id },
      });
    }

    createdEvents.push(event);
  }

  return createdEvents;
}

async function seedContacts(userId: string, companyId: string, emails: { id: string }[], events: { id: string }[]) {
  const contactSeeds = [
    { name: "Maria Chen", email: "maria.chen@orionfund.com", company: "Orion Fund", title: "Partner", category: ContactCategory.INVESTOR, vipStatus: true },
    { name: "Alex Rivera", email: "alex@brightpath.io", company: "BrightPath", title: "CEO", category: ContactCategory.PARTNER, vipStatus: true },
    { name: "Jordan Wells", email: "jordan@acmeventures.com", company: "Acme Ventures", title: "Principal", category: ContactCategory.INVESTOR, vipStatus: false },
    { name: "Lena Ortiz", email: "lena@horizonhealth.org", company: "Horizon Health", title: "VP Operations", category: ContactCategory.CUSTOMER, vipStatus: false },
    { name: "Devon Brooks", email: "devon@shipwright.ai", company: "Shipwright", title: "Head of Partnerships", category: ContactCategory.PARTNER, vipStatus: false },
    { name: "Ravi Kapoor", email: "ravi@northpeakpartners.com", company: "NorthPeak Partners", title: "Managing Director", category: ContactCategory.INVESTOR, vipStatus: true },
    { name: "Emily Park", email: "emily@blueharbor.com", company: "Blue Harbor", title: "Chief of Staff", category: ContactCategory.BOARD_MEMBER, vipStatus: true },
    { name: "Sam Patel", email: "sam@northstar.com", company: "Northstar", title: "VP Product", category: ContactCategory.TEAM, vipStatus: false },
    { name: "Avery Kim", email: "avery@northstar.com", company: "Northstar", title: "Design Lead", category: ContactCategory.TEAM, vipStatus: false },
    { name: "Priya Shah", email: "priya@northstar.com", company: "Northstar", title: "Chief of Staff", category: ContactCategory.TEAM, vipStatus: true },
    { name: "Nora Green", email: "nora@cobalt.io", company: "Cobalt", title: "Security Lead", category: ContactCategory.VENDOR, vipStatus: false },
    { name: "Luke Hart", email: "luke@fulcrum.com", company: "Fulcrum", title: "Advisor", category: ContactCategory.ADVISOR, vipStatus: false },
    { name: "Tasha Ford", email: "tasha@helioshealth.org", company: "Helios Health", title: "CFO", category: ContactCategory.CUSTOMER, vipStatus: true },
    { name: "Miles Carter", email: "miles@atlasfinance.com", company: "Atlas Finance", title: "CEO", category: ContactCategory.CUSTOMER, vipStatus: false },
    { name: "Harper Singh", email: "harper@stackline.dev", company: "Stackline", title: "Support Lead", category: ContactCategory.VENDOR, vipStatus: false },
    { name: "Quinn Howard", email: "quinn@northwindlogistics.com", company: "Northwind Logistics", title: "COO", category: ContactCategory.CUSTOMER, vipStatus: false },
    { name: "Drew Bailey", email: "drew@phoenixlabs.io", company: "Phoenix Labs", title: "Product Manager", category: ContactCategory.PARTNER, vipStatus: false },
    { name: "Ivy Coleman", email: "ivy@solstice.io", company: "Solstice", title: "Head of Growth", category: ContactCategory.CUSTOMER, vipStatus: false },
    { name: "Omar Ali", email: "omar@silverline.ai", company: "Silverline", title: "CTO", category: ContactCategory.PARTNER, vipStatus: false },
    { name: "Sofia Reyes", email: "sofia@everestcap.com", company: "Everest Capital", title: "Board Observer", category: ContactCategory.BOARD_MEMBER, vipStatus: false },
  ];

  const createdContacts = [];
  const now = new Date();

  for (let index = 0; index < contactSeeds.length; index += 1) {
    const seed = contactSeeds[index];
    const lastContactAt = index % 2 === 0 ? addDays(now, -(index + 1)) : null;

    const contact = await prisma.contact.create({
      data: {
        userId,
        companyId,
        name: seed.name,
        email: seed.email,
        company: seed.company,
        title: seed.title,
        category: seed.category,
        vipStatus: seed.vipStatus,
        notes: seed.vipStatus ? "High-touch contact. Follow up within 24h." : null,
        lastContactAt,
        metadata: {
          timezone: "America/Los_Angeles",
          preferredChannel: index % 3 === 0 ? "email" : "slack",
        },
      },
    });

    createdContacts.push(contact);
  }

  const interactionSeeds = createdContacts.slice(0, 8);

  for (const [index, contact] of interactionSeeds.entries()) {
    const interactionsCount = index % 3 === 0 ? 3 : 2;

    for (let i = 0; i < interactionsCount; i += 1) {
      const linkEmail = pick(emails);
      const linkEvent = pick(events);

      await prisma.contactInteraction.create({
        data: {
          contactId: contact.id,
          type: pick([InteractionType.EMAIL_RECEIVED, InteractionType.MEETING, InteractionType.CALL]),
          subject: `Touchpoint ${i + 1} with ${contact.name}`,
          summary: "Discussed roadmap priorities, next steps, and stakeholder alignment.",
          emailId: i % 2 === 0 ? linkEmail.id : null,
          eventId: i % 2 !== 0 ? linkEvent.id : null,
          timestamp: addDays(now, -(i + index + 1)),
          metadata: {
            sentiment: pick(["positive", "neutral", "actionable"]),
            followUpNeeded: i === interactionsCount - 1,
          },
        },
      });
    }
  }

  return createdContacts;
}

async function seedDailyDigests(userId: string, companyId: string) {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  await prisma.dailyDigest.createMany({
    data: [
      {
        userId,
        companyId,
        date: today,
        content: {
          highlights: [
            "2 high-priority emails need drafts",
            "Board prep sync at 9:00 AM",
          ],
          agenda: ["Board prep sync", "Customer exec check-in"],
          followUps: ["Send renewal note to Helios CFO"],
        },
      },
      {
        userId,
        companyId,
        date: yesterday,
        content: {
          highlights: ["Metrics review complete", "Pipeline update sent"],
          agenda: ["Investor diligence call prep"],
          followUps: ["Share updated ARR snapshot with Orion Fund"],
        },
      },
    ],
  });
}

async function seedConversations(userId: string, companyId: string) {
  const conversations = [
    {
      title: "Board prep: narrative focus",
      messages: [
        { role: "user", content: "Draft the core board narrative.", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Focused on growth, efficiency, and enterprise momentum.", timestamp: new Date().toISOString() },
      ],
    },
    {
      title: "Customer renewal blockers",
      messages: [
        { role: "user", content: "Summarize renewal risks.", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Risk: security questionnaire delay. Mitigation: fast-track responses.", timestamp: new Date().toISOString() },
      ],
    },
    {
      title: "Q2 hiring priorities",
      messages: [
        { role: "user", content: "What roles should we prioritize?", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Prioritize enterprise AEs and customer success leadership.", timestamp: new Date().toISOString() },
      ],
    },
  ];

  for (const convo of conversations) {
    const created = await prisma.conversation.create({
      data: {
        companyId,
        userId,
        title: convo.title,
        messages: convo.messages,
      },
    });

    await prisma.conversationMemory.createMany({
      data: [
        {
          userId,
          companyId,
          conversationId: created.id,
          type: MemoryType.DECISION,
          title: "Board narrative focus",
          content: "Emphasize enterprise momentum, margin improvement, and strategic partnerships.",
          metadata: { source: convo.title },
        },
        {
          userId,
          companyId,
          conversationId: created.id,
          type: MemoryType.GOAL,
          title: "Q2 priorities",
          content: "Drive renewals and tighten GTM execution.",
          metadata: { source: convo.title },
        },
      ],
    });
  }
}

async function main() {
  const { user, company } = await ensureTestUser();

  await cleanupExistingData(user.id, company.id);

  const emails = await seedEmails(user.id, company.id);
  const events = await seedCalendarEvents(user.id, company.id);
  await seedContacts(user.id, company.id, emails, events);
  await seedDailyDigests(user.id, company.id);
  await seedConversations(user.id, company.id);

  console.log("Seeded test data for:", TEST_USER.email);
}

main()
  .catch((error) => {
    console.error("Failed to seed test data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
