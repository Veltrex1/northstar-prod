import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "PINECONE_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
];

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

function getPineconeControllerHostUrl() {
  return (
    process.env.PINECONE_CONTROLLER_HOST_URL ||
    (process.env.PINECONE_ENVIRONMENT
      ? `https://controller.${process.env.PINECONE_ENVIRONMENT}.pinecone.io`
      : undefined)
  );
}

function checkEnv(): { status: CheckStatus; missing: string[] } {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (!getPineconeControllerHostUrl()) {
    missing.push("PINECONE_CONTROLLER_HOST_URL|PINECONE_ENVIRONMENT");
  }

  return {
    status: missing.length === 0 ? "ok" : "error",
    missing,
  };
}

async function checkDatabase(): Promise<CheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<CheckStatus> {
  try {
    await redis.ping();
    return "ok";
  } catch {
    return "error";
  }
}

async function checkPinecone(): Promise<CheckStatus> {
  try {
    const controllerHostUrl = getPineconeControllerHostUrl();
    if (!controllerHostUrl || !process.env.PINECONE_API_KEY) {
      return "error";
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      controllerHostUrl,
    });

    await pinecone.listIndexes();
    return "ok";
  } catch {
    return "error";
  }
}

async function checkAnthropic(): Promise<CheckStatus> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return "error";
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });

    return "ok";
  } catch {
    return "error";
  }
}

async function checkOpenAI(): Promise<CheckStatus> {
  try {
    if (!process.env.OPENAI_API_KEY) return "error";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await openai.models.list();
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const envCheck = checkEnv();

  const [database, redisStatus, pinecone, anthropic, openai] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkPinecone(),
    checkAnthropic(),
    checkOpenAI(),
  ]);

  const checks = {
    database,
    redis: redisStatus,
    pinecone,
    anthropic,
    openai,
    env: envCheck.status,
  };

  const hasDatabaseError = database === "error";
  const hasAnyError = Object.values(checks).some((status) => status === "error");
  const status = hasDatabaseError ? "unhealthy" : hasAnyError ? "degraded" : "healthy";

  return NextResponse.json({
    status,
    checks,
    timestamp: new Date().toISOString(),
  });
}
