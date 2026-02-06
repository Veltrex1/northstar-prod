import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

type GmailPushPayload = {
  emailAddress?: string;
  historyId?: string;
};

type GmailPushNotification = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
  emailAddress?: string;
  historyId?: string;
};

export async function POST(request: Request) {
  try {
    if (!hasValidHeaders(request.headers)) {
      return new Response("Invalid headers", { status: 400 });
    }

    const body = (await request.json()) as GmailPushNotification;
    const payload = decodeNotificationPayload(body);
    const emailAddress = payload.emailAddress || body.emailAddress;

    if (!emailAddress) {
      return new Response("Missing email address", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailAddress },
      include: {
        integrations: {
          where: { platform: "GOOGLE_WORKSPACE", status: "CONNECTED" },
        },
      },
    });

    if (!user || !user.integrations[0]) {
      return new Response("User not found", { status: 404 });
    }

    void handleNewEmail(user.id, user.integrations[0].id).catch((error) => {
      logger.error("Gmail webhook async processing error", error);
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    logger.error("Gmail webhook error", error);
    return new Response("Error", { status: 500 });
  }
}

function hasValidHeaders(headers: Headers): boolean {
  const contentType = headers.get("content-type") || "";
  const hasPubSubHeaders =
    headers.has("x-goog-version") || headers.has("ce-type") || headers.has("ce-specversion");

  return contentType.includes("application/json") && hasPubSubHeaders;
}

function decodeNotificationPayload(body: GmailPushNotification): GmailPushPayload {
  if (!body.message?.data) {
    return { emailAddress: body.emailAddress, historyId: body.historyId };
  }

  try {
    const decoded = Buffer.from(body.message.data, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as GmailPushPayload;
    return payload;
  } catch (error) {
    logger.warn("Failed to decode Gmail webhook payload", error);
    return { emailAddress: body.emailAddress, historyId: body.historyId };
  }
}

async function handleNewEmail(userId: string, integrationId: string) {
  const { syncGmailInbox } = await import("@/lib/services/email/inbox-sync");
  const { generateAutoDraft } = await import("@/lib/services/email/auto-draft");

  await syncGmailInbox(userId, integrationId);

  const emails = await prisma.email.findMany({
    where: {
      userId,
      status: "UNREAD",
      draftId: null,
      isExternal: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  for (const email of emails) {
    await generateAutoDraft(email.id);
  }
}
