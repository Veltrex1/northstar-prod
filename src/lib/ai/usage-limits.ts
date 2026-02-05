import { prisma } from "@/lib/db/prisma";

const DEFAULT_OUTPUT_USD_PER_MILLION = 15;
const DEFAULT_MONTHLY_OUTPUT_TOKEN_CAP = 3_333_333;

export class MonthlyTokenLimitError extends Error {
  code: string;
  status: number;

  constructor(message: string) {
    super(message);
    this.code = "MONTHLY_TOKEN_LIMIT";
    this.status = 429;
  }
}

function getNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMonthlyOutputTokenCap(): number {
  return Math.floor(
    getNumberEnv(
      process.env.CLAUDE_MONTHLY_OUTPUT_TOKEN_CAP,
      DEFAULT_MONTHLY_OUTPUT_TOKEN_CAP
    )
  );
}

export function getOutputUsdPerMillion(): number {
  return getNumberEnv(
    process.env.CLAUDE_OUTPUT_USD_PER_MILLION,
    DEFAULT_OUTPUT_USD_PER_MILLION
  );
}

export function getMonthStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function assertWithinMonthlyOutputTokenCap(
  userId: string,
  reserveTokens: number = 0
): Promise<void> {
  const monthStart = getMonthStart();
  const usage = await prisma.userMonthlyUsage.findUnique({
    where: { userId_monthStart: { userId, monthStart } },
  });

  const usedTokens = usage?.outputTokens ?? 0;
  const cap = getMonthlyOutputTokenCap();

  if (usedTokens + reserveTokens > cap) {
    throw new MonthlyTokenLimitError(
      "Monthly Claude token limit reached. Please try again next month."
    );
  }
}

export async function recordOutputTokens(
  userId: string,
  outputTokens: number
) {
  if (!outputTokens || outputTokens <= 0) return;

  const monthStart = getMonthStart();

  return prisma.userMonthlyUsage.upsert({
    where: { userId_monthStart: { userId, monthStart } },
    create: {
      userId,
      monthStart,
      outputTokens,
    },
    update: {
      outputTokens: {
        increment: outputTokens,
      },
    },
  });
}
