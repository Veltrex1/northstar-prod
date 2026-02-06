export function trackEvent(event: string, properties?: Record<string, any>) {
  console.log(`[Analytics] ${event}`, properties);

  // TODO: Send to analytics service
  // posthog.capture(event, properties);
}

export const events = {
  USER_SIGNUP: "user_signup",
  ONBOARDING_COMPLETED: "onboarding_completed",
  EMAIL_DRAFT_SENT: "email_draft_sent",
  MEETING_BRIEF_VIEWED: "meeting_brief_viewed",
  CHAT_MESSAGE_SENT: "chat_message_sent",
  INTEGRATION_CONNECTED: "integration_connected",
  CONTACT_SYNCED: "contact_synced",
} as const;
