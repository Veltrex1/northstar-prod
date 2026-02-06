const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'PINECONE_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'NEXT_PUBLIC_APP_URL',
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables:\n${missing.join('\n')}`);
  }

  console.log('✓ All required environment variables are set');
}

// Call on startup
validateEnv();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
} as const;
